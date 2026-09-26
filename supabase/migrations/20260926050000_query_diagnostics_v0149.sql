-- v0.1.49 RPC/query diagnostics: identify which database statements are creating load.
create table if not exists private.query_monitor_state(
 queryid bigint primary key,
 calls bigint not null default 0,
 total_exec_time double precision not null default 0,
 updated_at timestamptz not null default now()
);
alter table private.query_monitor_state enable row level security;
revoke all on private.query_monitor_state from public,anon,authenticated;

create table if not exists private.query_monitor_snapshots(
 captured_at timestamptz not null,
 queryid bigint not null,
 label text not null,
 calls_per_min numeric(14,2) not null,
 exec_ms_per_min numeric(16,2) not null,
 mean_exec_ms numeric(14,2) not null,
 primary key(captured_at,queryid)
);
alter table private.query_monitor_snapshots enable row level security;
revoke all on private.query_monitor_snapshots from public,anon,authenticated;
create index if not exists query_monitor_snapshots_recent_idx on private.query_monitor_snapshots(captured_at desc,calls_per_min desc);

create or replace function private.query_monitor_label(p_query text)
returns text language sql immutable set search_path='' as $$
 select case
  when p_query ~* '/rpc/|rpc_' then left(regexp_replace(p_query,E'[\\n\\r\\t ]+',' ','g'),100)
  when p_query ~* '^\\s*(select|with).*\\b(save_game_state|claim_game_session|heartbeat_game_session|get_online_market_state|place_online_market_order|settle_online_expedition|start_online_expedition|enhance_online_equipment|craft)' then left(regexp_replace(p_query,E'[\\n\\r\\t ]+',' ','g'),100)
  else left(regexp_replace(p_query,E'[\\n\\r\\t ]+',' ','g'),100)
 end
$$;

create or replace function private.collect_query_monitor_snapshot()
returns void language plpgsql security definer set search_path='' as $$
declare v_now timestamptz:=clock_timestamp(); v_interval numeric;
begin
 v_interval:=60;
 insert into private.query_monitor_snapshots(captured_at,queryid,label,calls_per_min,exec_ms_per_min,mean_exec_ms)
 select v_now,s.queryid,private.query_monitor_label(s.query),
   round((greatest(0,s.calls-coalesce(st.calls,0))*60.0/v_interval)::numeric,2),
   round((greatest(0,s.total_exec_time-coalesce(st.total_exec_time,0))*60.0/v_interval)::numeric,2),
   round((case when greatest(0,s.calls-coalesce(st.calls,0))>0
     then greatest(0,s.total_exec_time-coalesce(st.total_exec_time,0))/greatest(1,s.calls-coalesce(st.calls,0))
     else 0 end)::numeric,2)
 from extensions.pg_stat_statements s
 join pg_roles r on r.oid=s.userid
 left join private.query_monitor_state st on st.queryid=s.queryid
 where s.dbid=(select oid from pg_database where datname=current_database())
   and r.rolname in ('supabase_admin','authenticator','authenticated','supabase_auth_admin','supabase_storage_admin')
   and s.queryid is not null
 order by greatest(0,s.total_exec_time-coalesce(st.total_exec_time,0)) desc
 limit 20;

 insert into private.query_monitor_state(queryid,calls,total_exec_time,updated_at)
 select s.queryid,s.calls,s.total_exec_time,v_now
 from extensions.pg_stat_statements s
 join pg_roles r on r.oid=s.userid
 where s.dbid=(select oid from pg_database where datname=current_database())
   and r.rolname in ('supabase_admin','authenticator','authenticated','supabase_auth_admin','supabase_storage_admin')
   and s.queryid is not null
 on conflict(queryid) do update set calls=excluded.calls,total_exec_time=excluded.total_exec_time,updated_at=excluded.updated_at;

 delete from private.query_monitor_snapshots where captured_at<v_now-interval '7 days';
 delete from private.query_monitor_state where updated_at<v_now-interval '1 day';
end $$;
revoke all on function private.collect_query_monitor_snapshot() from public,anon,authenticated;

create or replace function public.get_query_monitoring()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_result jsonb;
begin
 if v_user is null or not exists(select 1 from private.monitoring_admins where user_id=v_user) then
  raise exception 'MONITORING_FORBIDDEN' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.exec_ms_per_min desc),'[]'::jsonb) into v_result
 from (
  select captured_at,queryid,label,calls_per_min,exec_ms_per_min,mean_exec_ms
  from private.query_monitor_snapshots
  where captured_at=(select max(captured_at) from private.query_monitor_snapshots)
  order by exec_ms_per_min desc limit 8
 ) x;
 return v_result;
end $$;
revoke all on function public.get_query_monitoring() from public,anon;
grant execute on function public.get_query_monitoring() to authenticated;

do $$
declare v_job bigint;
begin
 select jobid into v_job from cron.job where jobname='tower-query-monitor' limit 1;
 if v_job is not null then perform cron.unschedule(v_job); end if;
 perform cron.schedule('tower-query-monitor','* * * * *','select private.collect_query_monitor_snapshot();');
end $$;
