create table if not exists private.job_registration_catalog (
  job_id text primary key,
  rarity text not null check (rarity in ('C','B','A','SR','SSR')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table private.job_registration_catalog enable row level security;
revoke all on private.job_registration_catalog from public,anon,authenticated;

insert into private.job_registration_catalog(job_id,rarity,enabled) values
 ('contract_mercenary','C',true),('hunter','C',true),('excavator','C',true),('field_medic','C',true),('reclaimer','C',true),
 ('vanguard_explorer','B',true),('tracker','B',true),('survivor','B',true),('duelist','B',true),('expedition_medic','B',true),
 ('executor','A',true),('inquisitor','A',true),('deep_delver','A',true),('bloodfighter','A',true),('expedition_tactician','A',true),
 ('berserker','SR',true),('mutagen_doctor','SR',true),('soulcaster','SR',true),('ascetic_fighter','SR',true),('field_engineer','SR',true),
 ('dragonblood_knight','SSR',true),('sealed_archivist','SSR',true),('corpse_tuner','SSR',true),('self_alchemist','SSR',true),('black_carriage_gambler','SSR',true)
on conflict(job_id) do update set rarity=excluded.rarity,enabled=excluded.enabled;

create table if not exists private.player_job_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id text not null references private.job_registration_catalog(job_id),
  record_count smallint not null default 0 check (record_count between 0 and 60),
  updated_at timestamptz not null default now(),
  primary key(user_id,job_id)
);
alter table private.player_job_records enable row level security;
revoke all on private.player_job_records from public,anon,authenticated;

create table if not exists private.player_job_pickups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sr_job_id text references private.job_registration_catalog(job_id),
  ssr_job_id text references private.job_registration_catalog(job_id),
  updated_at timestamptz not null default now()
);
alter table private.player_job_pickups enable row level security;
revoke all on private.player_job_pickups from public,anon,authenticated;

create table if not exists private.player_job_residuals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
alter table private.player_job_residuals enable row level security;
revoke all on private.player_job_residuals from public,anon,authenticated;

create table if not exists private.job_registration_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  paid_rolls smallint not null check (paid_rolls in (1,10)),
  result_count smallint not null check (result_count in (1,11)),
  gold_cost bigint not null check (gold_cost >= 0),
  gold_before bigint not null check (gold_before >= 0),
  gold_after bigint not null check (gold_after >= 0),
  results jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id,request_id)
);
alter table private.job_registration_requests enable row level security;
revoke all on private.job_registration_requests from public,anon,authenticated;
create index if not exists job_registration_requests_user_created_idx
  on private.job_registration_requests(user_id,created_at desc);

create or replace function private.job_registration_secure_unit()
returns double precision
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  b bytea:=extensions.gen_random_bytes(4);
  n bigint;
begin
  n:=get_byte(b,0)::bigint*16777216
    +get_byte(b,1)::bigint*65536
    +get_byte(b,2)::bigint*256
    +get_byte(b,3)::bigint;
  return n::double precision/4294967296.0;
end;
$$;
revoke all on function private.job_registration_secure_unit() from public,anon,authenticated;

create or replace function private.job_registration_draw_rarity()
returns text
language plpgsql
volatile
security definer
set search_path=''
as $$
declare r double precision:=private.job_registration_secure_unit();
begin
  if r<0.51 then return 'C'; end if;
  if r<0.81 then return 'B'; end if;
  if r<0.94 then return 'A'; end if;
  if r<0.99 then return 'SR'; end if;
  return 'SSR';
end;
$$;
revoke all on function private.job_registration_draw_rarity() from public,anon,authenticated;

create or replace function private.job_registration_pick_job(p_user uuid,p_rarity text)
returns text
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_target text;
  v_candidates text[];
  v_count integer;
  v_index integer;
begin
  if p_rarity='SR' then
    select sr_job_id into v_target from private.player_job_pickups where user_id=p_user;
  elsif p_rarity='SSR' then
    select ssr_job_id into v_target from private.player_job_pickups where user_id=p_user;
  end if;

  if v_target is not null and private.job_registration_secure_unit()<0.5 then
    return v_target;
  end if;

  select array_agg(job_id order by job_id) into v_candidates
  from private.job_registration_catalog
  where rarity=p_rarity and enabled and (v_target is null or job_id<>v_target);

  v_count:=coalesce(array_length(v_candidates,1),0);
  if v_count=0 then
    if v_target is not null then return v_target; end if;
    raise exception 'JOB_REGISTRATION_POOL_EMPTY';
  end if;
  v_index:=1+floor(private.job_registration_secure_unit()*v_count)::integer;
  return v_candidates[v_index];
end;
$$;
revoke all on function private.job_registration_pick_job(uuid,text) from public,anon,authenticated;

create or replace function private.job_registration_residual_value(p_rarity text)
returns integer
language sql
immutable
set search_path=''
as $$
  select case p_rarity
    when 'C' then 1 when 'B' then 2 when 'A' then 4 when 'SR' then 8 when 'SSR' then 16
    else 0 end
$$;
revoke all on function private.job_registration_residual_value(text) from public,anon,authenticated;

create or replace function private.apply_job_registration_record(p_user uuid,p_job_id text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_rarity text;
  v_old smallint:=0;
  v_new smallint:=0;
  v_residual integer:=0;
  v_owned_before boolean:=false;
  v_owned_after boolean:=false;
  v_stars integer:=0;
begin
  select rarity into v_rarity
  from private.job_registration_catalog
  where job_id=p_job_id and enabled;
  if not found then raise exception 'JOB_ID_INVALID'; end if;

  select exists(
    select 1 from private.player_job_entitlements
    where user_id=p_user and job_id=p_job_id
  ) into v_owned_before;

  select record_count into v_old
  from private.player_job_records
  where user_id=p_user and job_id=p_job_id
  for update;
  if not found then v_old:=0; end if;

  if v_old<60 then
    v_new:=v_old+1;
    insert into private.player_job_records(user_id,job_id,record_count,updated_at)
    values(p_user,p_job_id,v_new,now())
    on conflict(user_id,job_id) do update
      set record_count=excluded.record_count,updated_at=now();
  else
    v_new:=60;
    v_residual:=private.job_registration_residual_value(v_rarity);
    insert into private.player_job_residuals(user_id,balance,updated_at)
    values(p_user,v_residual,now())
    on conflict(user_id) do update
      set balance=private.player_job_residuals.balance+excluded.balance,updated_at=now();
  end if;

  if v_new>=10 and not v_owned_before then
    perform private.grant_server_job(p_user,p_job_id);
  end if;

  select exists(
    select 1 from private.player_job_entitlements
    where user_id=p_user and job_id=p_job_id
  ) into v_owned_after;

  v_stars:=case when v_new>=60 then 3 when v_new>=30 then 2 when v_new>=10 then 1 else 0 end;

  return jsonb_build_object(
    'jobId',p_job_id,
    'rarity',v_rarity,
    'recordCount',v_new,
    'stars',v_stars,
    'unlocked',v_owned_after,
    'newlyUnlocked',(not v_owned_before and v_owned_after),
    'residualGained',v_residual
  );
end;
$$;
revoke all on function private.apply_job_registration_record(uuid,text) from public,anon,authenticated;

create or replace function private.job_registration_state_json(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_gold bigint:=0;
  v_residual bigint:=0;
  v_sr text;
  v_ssr text;
  v_records jsonb;
begin
  select gold into v_gold from private.player_wallets where user_id=p_user;
  v_gold:=coalesce(v_gold,0);
  select balance into v_residual from private.player_job_residuals where user_id=p_user;
  v_residual:=coalesce(v_residual,0);
  select sr_job_id,ssr_job_id into v_sr,v_ssr from private.player_job_pickups where user_id=p_user;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'jobId',c.job_id,
      'rarity',c.rarity,
      'recordCount',coalesce(r.record_count,0),
      'stars',case when coalesce(r.record_count,0)>=60 then 3 when coalesce(r.record_count,0)>=30 then 2 when coalesce(r.record_count,0)>=10 then 1 else 0 end,
      'unlocked',exists(select 1 from private.player_job_entitlements e where e.user_id=p_user and e.job_id=c.job_id)
    )
    order by case c.rarity when 'C' then 1 when 'B' then 2 when 'A' then 3 when 'SR' then 4 else 5 end,c.job_id
  ),'[]'::jsonb) into v_records
  from private.job_registration_catalog c
  left join private.player_job_records r on r.user_id=p_user and r.job_id=c.job_id
  where c.enabled;

  return jsonb_build_object(
    'gold',v_gold,
    'residualRecords',v_residual,
    'pickups',jsonb_build_object('sr',v_sr,'ssr',v_ssr),
    'records',v_records
  );
end;
$$;
revoke all on function private.job_registration_state_json(uuid) from public,anon,authenticated;

create or replace function public.get_job_registration_state(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare u uuid;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.sync_market_economy_from_latest_save(u);
  return private.job_registration_state_json(u);
end;
$$;
revoke all on function public.get_job_registration_state(uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function public.get_job_registration_state(uuid,bigint,text,text) to authenticated;

create or replace function public.set_job_registration_pickups(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
  p_sr_job_id text,p_ssr_job_id text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare u uuid;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);

  if p_sr_job_id is not null and not exists(
    select 1 from private.job_registration_catalog where job_id=p_sr_job_id and rarity='SR' and enabled
  ) then raise exception 'JOB_PICKUP_INVALID'; end if;

  if p_ssr_job_id is not null and not exists(
    select 1 from private.job_registration_catalog where job_id=p_ssr_job_id and rarity='SSR' and enabled
  ) then raise exception 'JOB_PICKUP_INVALID'; end if;

  insert into private.player_job_pickups(user_id,sr_job_id,ssr_job_id,updated_at)
  values(u,p_sr_job_id,p_ssr_job_id,now())
  on conflict(user_id) do update
    set sr_job_id=excluded.sr_job_id,ssr_job_id=excluded.ssr_job_id,updated_at=now();

  perform private.sync_market_economy_from_latest_save(u);
  return private.job_registration_state_json(u);
end;
$$;
revoke all on function public.set_job_registration_pickups(uuid,bigint,text,text,text,text) from public,anon,authenticated;
grant execute on function public.set_job_registration_pickups(uuid,bigint,text,text,text,text) to authenticated;

create or replace function public.register_online_job(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
  p_request_id uuid,p_paid_rolls integer
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  u uuid;
  v_save public.game_saves%rowtype;
  v_wallet private.player_wallets%rowtype;
  v_existing private.job_registration_requests%rowtype;
  v_cost bigint;
  v_result_count integer;
  v_results jsonb:='[]'::jsonb;
  v_rarity text;
  v_job_id text;
  v_result jsonb;
  v_sr text;
  v_ssr text;
  i integer;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  if p_request_id is null then raise exception 'JOB_REGISTRATION_REQUEST_REQUIRED'; end if;
  if p_paid_rolls not in (1,10) then raise exception 'JOB_REGISTRATION_MODE_INVALID'; end if;
  if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') then
    raise exception 'JOB_REGISTRATION_DURING_EXPEDITION';
  end if;

  perform private.sync_market_economy_from_latest_save(u);
  select * into v_save from public.game_saves where user_id=u for update;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED'; end if;
  select * into v_wallet from private.player_wallets where user_id=u for update;
  if not found then raise exception 'SERVER_WALLET_REQUIRED'; end if;

  select * into v_existing
  from private.job_registration_requests
  where user_id=u and request_id=p_request_id;
  if found then
    if v_existing.paid_rolls<>p_paid_rolls then raise exception 'JOB_REGISTRATION_REQUEST_CONFLICT'; end if;
    return jsonb_build_object(
      'requestId',p_request_id,
      'paidRolls',v_existing.paid_rolls,
      'resultCount',v_existing.result_count,
      'goldCost',v_existing.gold_cost,
      'goldBefore',v_existing.gold_before,
      'goldAfter',v_existing.gold_after,
      'results',v_existing.results,
      'state',private.job_registration_state_json(u),
      'record',private.cloud_record_json(u),
      'replayed',true
    );
  end if;

  v_cost:=p_paid_rolls*100;
  v_result_count:=case when p_paid_rolls=10 then 11 else 1 end;
  if v_wallet.gold<v_cost then raise exception 'JOB_REGISTRATION_GOLD_SHORTAGE'; end if;

  select sr_job_id,ssr_job_id into v_sr,v_ssr
  from private.player_job_pickups where user_id=u;

  update private.player_wallets
  set gold=gold-v_cost,updated_at=now()
  where user_id=u;

  for i in 1..v_result_count loop
    v_rarity:=private.job_registration_draw_rarity();
    v_job_id:=private.job_registration_pick_job(u,v_rarity);
    v_result:=private.apply_job_registration_record(u,v_job_id)
      ||jsonb_build_object(
        'index',i,
        'pickup',case when v_rarity='SR' then v_sr is not null and v_job_id=v_sr
                      when v_rarity='SSR' then v_ssr is not null and v_job_id=v_ssr
                      else false end
      );
    v_results:=v_results||jsonb_build_array(v_result);
  end loop;

  insert into private.job_registration_requests(
    user_id,request_id,paid_rolls,result_count,gold_cost,gold_before,gold_after,results
  ) values(
    u,p_request_id,p_paid_rolls,v_result_count,v_cost,v_wallet.gold,v_wallet.gold-v_cost,v_results
  );

  perform private.persist_client_payload_with_server_economy(u,v_save.payload,'0.1.51');

  return jsonb_build_object(
    'requestId',p_request_id,
    'paidRolls',p_paid_rolls,
    'resultCount',v_result_count,
    'goldCost',v_cost,
    'goldBefore',v_wallet.gold,
    'goldAfter',v_wallet.gold-v_cost,
    'results',v_results,
    'state',private.job_registration_state_json(u),
    'record',private.cloud_record_json(u),
    'replayed',false
  );
end;
$$;
revoke all on function public.register_online_job(uuid,bigint,text,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.register_online_job(uuid,bigint,text,text,uuid,integer) to authenticated;
