create table if not exists private.player_job_record_exchange_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  rarity text not null check (rarity in ('C','B','A','SR','SSR')),
  period_start date not null,
  used smallint not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key(user_id,rarity,period_start)
);
alter table private.player_job_record_exchange_usage enable row level security;
revoke all on private.player_job_record_exchange_usage from public,anon,authenticated;

create table if not exists private.player_job_recommendations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
alter table private.player_job_recommendations enable row level security;
revoke all on private.player_job_recommendations from public,anon,authenticated;

create table if not exists private.player_job_recommendation_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  used smallint not null default 0 check (used between 0 and 3),
  updated_at timestamptz not null default now(),
  primary key(user_id,period_start)
);
alter table private.player_job_recommendation_usage enable row level security;
revoke all on private.player_job_recommendation_usage from public,anon,authenticated;

create table if not exists private.job_record_exchange_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  job_id text not null references private.job_registration_catalog(job_id),
  rarity text not null check (rarity in ('C','B','A','SR','SSR')),
  residual_cost integer not null check (residual_cost > 0),
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id,request_id)
);
alter table private.job_record_exchange_requests enable row level security;
revoke all on private.job_record_exchange_requests from public,anon,authenticated;

create table if not exists private.job_recommendation_exchange_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  residual_cost integer not null check (residual_cost > 0),
  recommendation_balance bigint not null check (recommendation_balance >= 0),
  created_at timestamptz not null default now(),
  primary key(user_id,request_id)
);
alter table private.job_recommendation_exchange_requests enable row level security;
revoke all on private.job_recommendation_exchange_requests from public,anon,authenticated;

create index if not exists player_job_record_exchange_usage_user_idx on private.player_job_record_exchange_usage(user_id,period_start desc);
create index if not exists job_record_exchange_requests_user_created_idx on private.job_record_exchange_requests(user_id,created_at desc);
create index if not exists job_recommendation_exchange_requests_user_created_idx on private.job_recommendation_exchange_requests(user_id,created_at desc);

create or replace function private.job_record_exchange_cost(p_rarity text)
returns integer language sql immutable set search_path='' as $$
  select case p_rarity when 'C' then 5 when 'B' then 10 when 'A' then 20 when 'SR' then 50 when 'SSR' then 160 else 0 end
$$;
revoke all on function private.job_record_exchange_cost(text) from public,anon,authenticated;

create or replace function private.job_record_exchange_limit(p_rarity text)
returns integer language sql immutable set search_path='' as $$
  select case p_rarity when 'C' then 10 when 'B' then 8 when 'A' then 5 when 'SR' then 2 when 'SSR' then 1 else 0 end
$$;
revoke all on function private.job_record_exchange_limit(text) from public,anon,authenticated;

create or replace function private.job_record_exchange_period_start(p_rarity text)
returns date language sql stable set search_path='' as $$
  select case when p_rarity='SSR'
    then date_trunc('month',now() at time zone 'Asia/Seoul')::date
    else date_trunc('week',now() at time zone 'Asia/Seoul')::date end
$$;
revoke all on function private.job_record_exchange_period_start(text) from public,anon,authenticated;

create or replace function private.job_recommendation_period_start()
returns date language sql stable set search_path='' as $$
  select date_trunc('week',now() at time zone 'Asia/Seoul')::date
$$;
revoke all on function private.job_recommendation_period_start() from public,anon,authenticated;

create or replace function private.job_registration_state_json(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_gold bigint:=0; v_residual bigint:=0; v_recommendations bigint:=0;
  v_sr text; v_ssr text; v_records jsonb; v_exchange jsonb;
  v_recommendation_used integer:=0; v_recommendation_period date:=private.job_recommendation_period_start();
begin
  select gold into v_gold from private.player_wallets where user_id=p_user; v_gold:=coalesce(v_gold,0);
  select balance into v_residual from private.player_job_residuals where user_id=p_user; v_residual:=coalesce(v_residual,0);
  select balance into v_recommendations from private.player_job_recommendations where user_id=p_user; v_recommendations:=coalesce(v_recommendations,0);
  select sr_job_id,ssr_job_id into v_sr,v_ssr from private.player_job_pickups where user_id=p_user;

  select coalesce(jsonb_agg(jsonb_build_object(
    'jobId',c.job_id,'rarity',c.rarity,'recordCount',coalesce(r.record_count,0),
    'stars',case when coalesce(r.record_count,0)>=60 then 3 when coalesce(r.record_count,0)>=30 then 2 when coalesce(r.record_count,0)>=10 then 1 else 0 end,
    'unlocked',exists(select 1 from private.player_job_entitlements e where e.user_id=p_user and e.job_id=c.job_id)
  ) order by case c.rarity when 'C' then 1 when 'B' then 2 when 'A' then 3 when 'SR' then 4 else 5 end,c.job_id),'[]'::jsonb)
  into v_records
  from private.job_registration_catalog c
  left join private.player_job_records r on r.user_id=p_user and r.job_id=c.job_id
  where c.enabled;

  select jsonb_object_agg(rarity,jsonb_build_object(
    'cost',private.job_record_exchange_cost(rarity),
    'used',coalesce((select u.used from private.player_job_record_exchange_usage u where u.user_id=p_user and u.rarity=x.rarity and u.period_start=private.job_record_exchange_period_start(x.rarity)),0),
    'limit',private.job_record_exchange_limit(rarity),
    'period',case when rarity='SSR' then 'MONTH' else 'WEEK' end,
    'periodStart',private.job_record_exchange_period_start(rarity)
  )) into v_exchange from (values ('C'),('B'),('A'),('SR'),('SSR')) x(rarity);

  select used into v_recommendation_used from private.player_job_recommendation_usage where user_id=p_user and period_start=v_recommendation_period;
  v_recommendation_used:=coalesce(v_recommendation_used,0);

  return jsonb_build_object(
    'gold',v_gold,'residualRecords',v_residual,'associationRecommendations',v_recommendations,
    'pickups',jsonb_build_object('sr',v_sr,'ssr',v_ssr),'records',v_records,
    'exchangeUsage',coalesce(v_exchange,'{}'::jsonb),
    'recommendationExchange',jsonb_build_object('cost',30,'used',v_recommendation_used,'limit',3,'period','WEEK','periodStart',v_recommendation_period)
  );
end;
$$;
revoke all on function private.job_registration_state_json(uuid) from public,anon,authenticated;

create or replace function public.exchange_job_residual_record(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid,p_job_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  u uuid; v_rarity text; v_cost integer; v_limit integer; v_period date;
  v_balance bigint:=0; v_used integer:=0; v_record_count integer:=0;
  v_result jsonb; v_existing private.job_record_exchange_requests%rowtype; v_save public.game_saves%rowtype;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  if p_request_id is null then raise exception 'JOB_RECORD_EXCHANGE_REQUEST_REQUIRED'; end if;
  if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') then raise exception 'JOB_RECORD_EXCHANGE_DURING_EXPEDITION'; end if;

  select * into v_existing from private.job_record_exchange_requests where user_id=u and request_id=p_request_id;
  if found then
    if v_existing.job_id<>p_job_id then raise exception 'JOB_RECORD_EXCHANGE_REQUEST_CONFLICT'; end if;
    return jsonb_build_object('requestId',p_request_id,'result',v_existing.result,'state',private.job_registration_state_json(u),'record',private.cloud_record_json(u),'replayed',true);
  end if;

  select rarity into v_rarity from private.job_registration_catalog where job_id=p_job_id and enabled;
  if not found then raise exception 'JOB_ID_INVALID'; end if;
  select coalesce(record_count,0) into v_record_count from private.player_job_records where user_id=u and job_id=p_job_id;
  if v_record_count>=60 then raise exception 'JOB_RECORD_MAXED'; end if;

  v_cost:=private.job_record_exchange_cost(v_rarity);
  v_limit:=private.job_record_exchange_limit(v_rarity);
  v_period:=private.job_record_exchange_period_start(v_rarity);

  insert into private.player_job_residuals(user_id,balance,updated_at) values(u,0,now()) on conflict(user_id) do nothing;
  select balance into v_balance from private.player_job_residuals where user_id=u for update;
  if v_balance<v_cost then raise exception 'JOB_RESIDUAL_SHORTAGE'; end if;

  insert into private.player_job_record_exchange_usage(user_id,rarity,period_start,used,updated_at)
  values(u,v_rarity,v_period,0,now()) on conflict(user_id,rarity,period_start) do nothing;
  select used into v_used from private.player_job_record_exchange_usage where user_id=u and rarity=v_rarity and period_start=v_period for update;
  if v_used>=v_limit then raise exception 'JOB_RECORD_EXCHANGE_LIMIT'; end if;

  update private.player_job_residuals set balance=balance-v_cost,updated_at=now() where user_id=u;
  update private.player_job_record_exchange_usage set used=used+1,updated_at=now() where user_id=u and rarity=v_rarity and period_start=v_period;

  v_result:=private.apply_job_registration_record(u,p_job_id)||jsonb_build_object('residualCost',v_cost,'exchangePeriodStart',v_period);
  insert into private.job_record_exchange_requests(user_id,request_id,job_id,rarity,residual_cost,result)
  values(u,p_request_id,p_job_id,v_rarity,v_cost,v_result);

  select * into v_save from public.game_saves where user_id=u;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED'; end if;
  perform private.persist_client_payload_with_server_economy(u,v_save.payload,'0.1.54');

  return jsonb_build_object('requestId',p_request_id,'result',v_result,'state',private.job_registration_state_json(u),'record',private.cloud_record_json(u),'replayed',false);
end;
$$;
revoke all on function public.exchange_job_residual_record(uuid,bigint,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.exchange_job_residual_record(uuid,bigint,text,text,uuid,text) to authenticated;

create or replace function public.exchange_job_residual_recommendation(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  u uuid; v_period date:=private.job_recommendation_period_start(); v_balance bigint:=0; v_used integer:=0;
  v_recommendation_balance bigint:=0; v_existing private.job_recommendation_exchange_requests%rowtype;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  if p_request_id is null then raise exception 'JOB_RECOMMENDATION_REQUEST_REQUIRED'; end if;
  if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') then raise exception 'JOB_RECOMMENDATION_DURING_EXPEDITION'; end if;

  select * into v_existing from private.job_recommendation_exchange_requests where user_id=u and request_id=p_request_id;
  if found then
    return jsonb_build_object('requestId',p_request_id,'recommendationBalance',v_existing.recommendation_balance,'state',private.job_registration_state_json(u),'replayed',true);
  end if;

  insert into private.player_job_residuals(user_id,balance,updated_at) values(u,0,now()) on conflict(user_id) do nothing;
  select balance into v_balance from private.player_job_residuals where user_id=u for update;
  if v_balance<30 then raise exception 'JOB_RESIDUAL_SHORTAGE'; end if;

  insert into private.player_job_recommendation_usage(user_id,period_start,used,updated_at)
  values(u,v_period,0,now()) on conflict(user_id,period_start) do nothing;
  select used into v_used from private.player_job_recommendation_usage where user_id=u and period_start=v_period for update;
  if v_used>=3 then raise exception 'JOB_RECOMMENDATION_WEEKLY_LIMIT'; end if;

  update private.player_job_residuals set balance=balance-30,updated_at=now() where user_id=u;
  insert into private.player_job_recommendations(user_id,balance,updated_at) values(u,1,now())
  on conflict(user_id) do update set balance=private.player_job_recommendations.balance+1,updated_at=now()
  returning balance into v_recommendation_balance;
  update private.player_job_recommendation_usage set used=used+1,updated_at=now() where user_id=u and period_start=v_period;

  insert into private.job_recommendation_exchange_requests(user_id,request_id,residual_cost,recommendation_balance)
  values(u,p_request_id,30,v_recommendation_balance);

  return jsonb_build_object('requestId',p_request_id,'recommendationBalance',v_recommendation_balance,'state',private.job_registration_state_json(u),'replayed',false);
end;
$$;
revoke all on function public.exchange_job_residual_recommendation(uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.exchange_job_residual_recommendation(uuid,bigint,text,text,uuid) to authenticated;
