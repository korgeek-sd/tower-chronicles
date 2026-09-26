-- v0.1.49 operational monitoring: 1-minute snapshots, spike alerts, websocket leases and admin dashboard.

create extension if not exists pg_cron;

create table if not exists private.monitoring_admins(
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.monitoring_admins enable row level security;
revoke all on private.monitoring_admins from public,anon,authenticated;

create table if not exists private.system_monitor_state(
  singleton boolean primary key default true check(singleton),
  last_sample_at timestamptz,
  db_calls_total bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table private.system_monitor_state enable row level security;
revoke all on private.system_monitor_state from public,anon,authenticated;
insert into private.system_monitor_state(singleton) values(true) on conflict(singleton) do nothing;

create table if not exists private.system_monitor_snapshots(
  captured_at timestamptz primary key,
  interval_seconds integer not null check(interval_seconds>0),
  db_calls_per_min numeric(14,2) not null default 0,
  realtime_messages_per_min numeric(14,2) not null default 0,
  websocket_connections integer not null default 0,
  save_writes_per_min numeric(14,2) not null default 0,
  active_game_sessions integer not null default 0,
  severity text not null check(severity in ('NORMAL','WARNING','CRITICAL')),
  alerts jsonb not null default '[]'::jsonb
);
alter table private.system_monitor_snapshots enable row level security;
revoke all on private.system_monitor_snapshots from public,anon,authenticated;

create table if not exists private.system_monitor_thresholds(
  metric text primary key,
  warning_floor numeric not null check(warning_floor>=0),
  critical_floor numeric not null check(critical_floor>=warning_floor),
  warning_multiplier numeric not null check(warning_multiplier>=1),
  critical_multiplier numeric not null check(critical_multiplier>=warning_multiplier)
);
alter table private.system_monitor_thresholds enable row level security;
revoke all on private.system_monitor_thresholds from public,anon,authenticated;

insert into private.system_monitor_thresholds(metric,warning_floor,critical_floor,warning_multiplier,critical_multiplier) values
 ('db_calls_per_min',300,1000,3,6),
 ('realtime_messages_per_min',120,500,3,6),
 ('websocket_connections',20,100,3,6),
 ('save_writes_per_min',60,240,3,6)
on conflict(metric) do update set
 warning_floor=excluded.warning_floor,critical_floor=excluded.critical_floor,
 warning_multiplier=excluded.warning_multiplier,critical_multiplier=excluded.critical_multiplier;

create table if not exists private.system_monitor_alert_state(
  metric text primary key references private.system_monitor_thresholds(metric) on delete cascade,
  active boolean not null default false,
  severity text not null default 'NORMAL' check(severity in ('NORMAL','WARNING','CRITICAL')),
  current_value numeric not null default 0,
  threshold_value numeric not null default 0,
  baseline_value numeric not null default 0,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  occurrences bigint not null default 0
);
alter table private.system_monitor_alert_state enable row level security;
revoke all on private.system_monitor_alert_state from public,anon,authenticated;

create table if not exists private.websocket_connection_leases(
  user_id uuid not null references auth.users(id) on delete cascade,
  auth_session_id uuid not null,
  client_instance_id text not null,
  socket_kind text not null check(socket_kind in ('session','market')),
  platform text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key(user_id,auth_session_id,client_instance_id,socket_kind)
);
alter table private.websocket_connection_leases enable row level security;
revoke all on private.websocket_connection_leases from public,anon,authenticated;

create index if not exists websocket_connection_leases_expires_idx on private.websocket_connection_leases(expires_at);
create index if not exists game_save_versions_created_at_idx on public.game_save_versions(created_at);
create index if not exists system_monitor_snapshots_captured_idx on private.system_monitor_snapshots(captured_at desc);

create or replace function public.set_websocket_presence(
  p_client_instance_id text,p_socket_kind text,p_platform text,p_connected boolean
) returns boolean
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_session_text text:=auth.jwt()->>'session_id';
  v_session uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  begin v_session:=v_session_text::uuid;
  exception when others then raise exception 'AUTH_SESSION_INVALID' using errcode='42501'; end;
  if not exists(select 1 from auth.sessions s where s.id=v_session and s.user_id=v_user) then
    raise exception 'AUTH_SESSION_INVALID' using errcode='42501';
  end if;
  if nullif(p_client_instance_id,'') is null or p_socket_kind not in ('session','market') then
    raise exception 'WEBSOCKET_PRESENCE_INVALID';
  end if;
  if p_connected then
    insert into private.websocket_connection_leases(
      user_id,auth_session_id,client_instance_id,socket_kind,platform,connected_at,updated_at,expires_at
    ) values(
      v_user,v_session,p_client_instance_id,p_socket_kind,left(coalesce(p_platform,'Web'),40),now(),now(),now()+interval '5 minutes'
    )
    on conflict(user_id,auth_session_id,client_instance_id,socket_kind) do update
    set platform=excluded.platform,updated_at=now(),expires_at=now()+interval '5 minutes';
  else
    delete from private.websocket_connection_leases
    where user_id=v_user and auth_session_id=v_session
      and client_instance_id=p_client_instance_id and socket_kind=p_socket_kind;
  end if;
  return true;
end;
$$;
revoke all on function public.set_websocket_presence(text,text,text,boolean) from public,anon;
grant execute on function public.set_websocket_presence(text,text,text,boolean) to authenticated;

create or replace function private.collect_system_monitor_snapshot()
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_now timestamptz:=clock_timestamp();
  v_prev timestamptz; v_prev_calls bigint; v_total_calls bigint; v_interval_seconds integer;
  v_db numeric:=0; v_realtime numeric:=0; v_ws integer:=0; v_saves numeric:=0; v_sessions integer:=0;
  v_db_base numeric:=0; v_rt_base numeric:=0; v_ws_base numeric:=0; v_save_base numeric:=0;
  v_overall text:='NORMAL'; v_alerts jsonb:='[]'::jsonb; metric_row record;
  v_metric_severity text; v_warn numeric; v_crit numeric; v_baseline numeric; v_value numeric;
begin
  select last_sample_at,db_calls_total into v_prev,v_prev_calls
  from private.system_monitor_state where singleton=true for update;

  select coalesce(sum(s.calls),0)::bigint into v_total_calls
  from extensions.pg_stat_statements s
  join pg_roles role_info on role_info.oid=s.userid
  where s.dbid=(select oid from pg_database where datname=current_database())
    and role_info.rolname in ('supabase_admin','authenticator','authenticated','supabase_auth_admin','supabase_storage_admin');

  if v_prev is null then
    v_prev:=v_now; v_interval_seconds:=60;
  else
    v_interval_seconds:=greatest(1,round(extract(epoch from (v_now-v_prev)))::integer);
    v_db:=greatest(0,v_total_calls-v_prev_calls)*60.0/v_interval_seconds;
    select count(*)*60.0/v_interval_seconds into v_realtime
    from realtime.messages where inserted_at >= (v_prev at time zone 'UTC') and inserted_at < (v_now at time zone 'UTC');
    select count(*)*60.0/v_interval_seconds into v_saves
    from public.game_save_versions where created_at>=v_prev and created_at<v_now;
  end if;

  delete from private.websocket_connection_leases where expires_at<=v_now;
  select count(*)::integer into v_ws from private.websocket_connection_leases where expires_at>v_now;
  select count(*)::integer into v_sessions from private.active_game_sessions where expires_at>v_now;

  select coalesce(avg(db_calls_per_min),0),coalesce(avg(realtime_messages_per_min),0),
         coalesce(avg(websocket_connections),0),coalesce(avg(save_writes_per_min),0)
  into v_db_base,v_rt_base,v_ws_base,v_save_base
  from private.system_monitor_snapshots where captured_at>=v_now-interval '15 minutes';

  for metric_row in
    select * from (values
      ('db_calls_per_min'::text,v_db,v_db_base),
      ('realtime_messages_per_min'::text,v_realtime,v_rt_base),
      ('websocket_connections'::text,v_ws::numeric,v_ws_base),
      ('save_writes_per_min'::text,v_saves,v_save_base)
    ) x(metric,value,baseline)
    join private.system_monitor_thresholds t using(metric)
  loop
    v_value:=metric_row.value; v_baseline:=metric_row.baseline;
    v_warn:=greatest(metric_row.warning_floor,v_baseline*metric_row.warning_multiplier);
    v_crit:=greatest(metric_row.critical_floor,v_baseline*metric_row.critical_multiplier);
    if v_value>=v_crit then v_metric_severity:='CRITICAL';
    elsif v_value>=v_warn then v_metric_severity:='WARNING';
    else v_metric_severity:='NORMAL'; end if;
    if v_metric_severity='CRITICAL' then v_overall:='CRITICAL';
    elsif v_metric_severity='WARNING' and v_overall='NORMAL' then v_overall:='WARNING'; end if;

    if v_metric_severity<>'NORMAL' then
      v_alerts:=v_alerts||jsonb_build_array(jsonb_build_object(
        'metric',metric_row.metric,'severity',v_metric_severity,'value',round(v_value,2),
        'baseline',round(v_baseline,2),
        'threshold',round(case when v_metric_severity='CRITICAL' then v_crit else v_warn end,2)
      ));
      insert into private.system_monitor_alert_state(
        metric,active,severity,current_value,threshold_value,baseline_value,first_seen_at,last_seen_at,occurrences
      ) values(
        metric_row.metric,true,v_metric_severity,v_value,
        case when v_metric_severity='CRITICAL' then v_crit else v_warn end,v_baseline,v_now,v_now,1
      )
      on conflict(metric) do update set
        active=true,severity=excluded.severity,current_value=excluded.current_value,
        threshold_value=excluded.threshold_value,baseline_value=excluded.baseline_value,
        first_seen_at=case when private.system_monitor_alert_state.active
          then private.system_monitor_alert_state.first_seen_at else excluded.first_seen_at end,
        last_seen_at=excluded.last_seen_at,occurrences=private.system_monitor_alert_state.occurrences+1;
    else
      insert into private.system_monitor_alert_state(
        metric,active,severity,current_value,threshold_value,baseline_value,first_seen_at,last_seen_at,occurrences
      ) values(metric_row.metric,false,'NORMAL',v_value,v_warn,v_baseline,null,v_now,0)
      on conflict(metric) do update set
        active=false,severity='NORMAL',current_value=excluded.current_value,
        threshold_value=excluded.threshold_value,baseline_value=excluded.baseline_value,
        first_seen_at=null,last_seen_at=excluded.last_seen_at;
    end if;
  end loop;

  insert into private.system_monitor_snapshots(
    captured_at,interval_seconds,db_calls_per_min,realtime_messages_per_min,
    websocket_connections,save_writes_per_min,active_game_sessions,severity,alerts
  ) values(v_now,v_interval_seconds,round(v_db,2),round(v_realtime,2),v_ws,round(v_saves,2),v_sessions,v_overall,v_alerts);

  update private.system_monitor_state
  set last_sample_at=v_now,db_calls_total=v_total_calls,updated_at=v_now where singleton=true;
  delete from private.system_monitor_snapshots where captured_at<v_now-interval '7 days';

  return jsonb_build_object(
    'capturedAt',v_now,'severity',v_overall,'dbCallsPerMin',round(v_db,2),
    'realtimeMessagesPerMin',round(v_realtime,2),'websocketConnections',v_ws,
    'saveWritesPerMin',round(v_saves,2),'activeGameSessions',v_sessions,'alerts',v_alerts
  );
end;
$$;
revoke all on function private.collect_system_monitor_snapshot() from public,anon,authenticated;

create or replace function public.get_system_monitoring()
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_latest jsonb; v_history jsonb; v_alerts jsonb;
begin
  if v_user is null or not exists(select 1 from private.monitoring_admins where user_id=v_user) then
    raise exception 'MONITORING_FORBIDDEN' using errcode='42501';
  end if;
  select to_jsonb(s) into v_latest from private.system_monitor_snapshots s order by captured_at desc limit 1;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.captured_at),'[]'::jsonb) into v_history
  from (select captured_at,db_calls_per_min,realtime_messages_per_min,websocket_connections,
               save_writes_per_min,active_game_sessions,severity
        from private.system_monitor_snapshots order by captured_at desc limit 30) x;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.metric),'[]'::jsonb) into v_alerts
  from private.system_monitor_alert_state a where a.active;
  return jsonb_build_object('latest',v_latest,'history',v_history,'activeAlerts',v_alerts);
end;
$$;
revoke all on function public.get_system_monitoring() from public,anon;
grant execute on function public.get_system_monitoring() to authenticated;

do $$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname='tower-system-monitor' limit 1;
  if v_job is not null then perform cron.unschedule(v_job); end if;
  perform cron.schedule('tower-system-monitor','* * * * *','select private.collect_system_monitor_snapshot();');
end $$;
