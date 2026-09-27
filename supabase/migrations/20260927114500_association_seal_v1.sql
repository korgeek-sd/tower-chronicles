create table if not exists private.player_association_seals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  level smallint not null default 0 check (level between 0 and 30),
  rolls_used smallint not null default 0 check (rolls_used between 0 and 20),
  reset_count integer not null default 0 check (reset_count >= 0),
  updated_at timestamptz not null default now()
);
alter table private.player_association_seals enable row level security;
revoke all on private.player_association_seals from public,anon,authenticated;

create table if not exists private.association_seal_roll_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  step smallint not null check (step between 1 and 3),
  before_level smallint not null check (before_level between 0 and 29),
  after_level smallint not null check (after_level between 1 and 30),
  gold_cost bigint not null check (gold_cost = 300),
  created_at timestamptz not null default now(),
  primary key(user_id,request_id)
);
alter table private.association_seal_roll_requests enable row level security;
revoke all on private.association_seal_roll_requests from public,anon,authenticated;

create table if not exists private.association_seal_reset_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  before_level smallint not null check (before_level between 0 and 29),
  before_rolls smallint not null check (before_rolls = 20),
  gold_cost bigint not null check (gold_cost = 3000),
  created_at timestamptz not null default now(),
  primary key(user_id,request_id)
);
alter table private.association_seal_reset_requests enable row level security;
revoke all on private.association_seal_reset_requests from public,anon,authenticated;

create index if not exists association_seal_roll_requests_user_created_idx
  on private.association_seal_roll_requests(user_id,created_at desc);
create index if not exists association_seal_reset_requests_user_created_idx
  on private.association_seal_reset_requests(user_id,created_at desc);

create or replace function private.association_seal_bonus_json(p_level integer)
returns jsonb
language plpgsql
immutable
set search_path=''
as $$
declare
  v_level integer:=greatest(0,least(30,coalesce(p_level,0)));
  v_hp numeric:=0;
  v_half numeric:=0;
begin
  v_hp:=v_level*.10
    + case when v_level>=5 then .20 else 0 end
    + case when v_level>=10 then .30 else 0 end
    + case when v_level>=15 then .40 else 0 end
    + case when v_level>=20 then .50 else 0 end
    + case when v_level>=25 then .60 else 0 end
    + case when v_level>=30 then 1.00 else 0 end;
  v_hp:=round(v_hp,2);
  v_half:=round(v_hp/2,2);
  return jsonb_build_object(
    'hpPercent',v_hp,
    'attackPercent',v_half,
    'defensePercent',v_half
  );
end;
$$;
revoke all on function private.association_seal_bonus_json(integer) from public,anon,authenticated;

create or replace function private.association_seal_draw_step()
returns smallint
language plpgsql
volatile
set search_path=''
as $$
declare
  v_roll double precision:=random();
begin
  if v_roll<.76 then return 1; end if;
  if v_roll<.96 then return 2; end if;
  return 3;
end;
$$;
revoke all on function private.association_seal_draw_step() from public,anon,authenticated;

create or replace function private.association_seal_state_json(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_level integer:=0;
  v_rolls integer:=0;
  v_resets integer:=0;
  v_gold bigint:=0;
begin
  select level,rolls_used,reset_count
    into v_level,v_rolls,v_resets
  from private.player_association_seals
  where user_id=p_user;
  v_level:=coalesce(v_level,0);
  v_rolls:=coalesce(v_rolls,0);
  v_resets:=coalesce(v_resets,0);

  select gold into v_gold
  from private.player_wallets
  where user_id=p_user;
  v_gold:=coalesce(v_gold,0);

  return jsonb_build_object(
    'sealId','association',
    'level',v_level,
    'rollsUsed',v_rolls,
    'resetCount',v_resets,
    'gold',v_gold,
    'completed',v_level>=30
  ) || private.association_seal_bonus_json(v_level);
end;
$$;
revoke all on function private.association_seal_state_json(uuid) from public,anon,authenticated;

create or replace function public.get_association_seal_state(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.sync_market_economy_from_latest_save(v_user);
  insert into private.player_association_seals(user_id)
    values(v_user)
    on conflict(user_id) do nothing;
  return private.association_seal_state_json(v_user);
end;
$$;
revoke all on function public.get_association_seal_state(uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function public.get_association_seal_state(uuid,bigint,text,text) to authenticated;

create or replace function public.roll_association_seal(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid;
  v_save public.game_saves%rowtype;
  v_wallet private.player_wallets%rowtype;
  v_seal private.player_association_seals%rowtype;
  v_existing private.association_seal_roll_requests%rowtype;
  v_step smallint;
  v_after smallint;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  if p_request_id is null then raise exception 'SEAL_REQUEST_REQUIRED'; end if;
  if exists(select 1 from private.online_expeditions where user_id=v_user and status='ACTIVE') then
    raise exception 'SEAL_ROLL_DURING_EXPEDITION';
  end if;

  perform private.sync_market_economy_from_latest_save(v_user);
  select * into v_save from public.game_saves where user_id=v_user for update;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED'; end if;
  select * into v_wallet from private.player_wallets where user_id=v_user for update;
  if not found then raise exception 'SERVER_WALLET_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,41));
  select * into v_existing
  from private.association_seal_roll_requests
  where user_id=v_user and request_id=p_request_id;
  if found then
    return jsonb_build_object(
      'requestId',p_request_id,
      'step',v_existing.step,
      'beforeLevel',v_existing.before_level,
      'afterLevel',v_existing.after_level,
      'goldCost',v_existing.gold_cost,
      'state',private.association_seal_state_json(v_user),
      'record',private.cloud_record_json(v_user),
      'replayed',true
    );
  end if;

  insert into private.player_association_seals(user_id)
    values(v_user)
    on conflict(user_id) do nothing;
  select * into v_seal
  from private.player_association_seals
  where user_id=v_user
  for update;

  if v_seal.level>=30 then raise exception 'SEAL_COMPLETED'; end if;
  if v_seal.rolls_used>=20 then raise exception 'SEAL_ROLL_LIMIT'; end if;
  if v_wallet.gold<300 then raise exception 'SEAL_GOLD_SHORTAGE'; end if;

  v_step:=private.association_seal_draw_step();
  v_after:=least(30,v_seal.level+v_step);

  update private.player_wallets
    set gold=gold-300,updated_at=now()
  where user_id=v_user;

  update private.player_association_seals
    set level=v_after,rolls_used=rolls_used+1,updated_at=now()
  where user_id=v_user;

  insert into private.association_seal_roll_requests(
    user_id,request_id,step,before_level,after_level,gold_cost
  ) values(
    v_user,p_request_id,v_step,v_seal.level,v_after,300
  );

  perform private.persist_client_payload_with_server_economy(v_user,v_save.payload,'0.1.60');

  return jsonb_build_object(
    'requestId',p_request_id,
    'step',v_step,
    'beforeLevel',v_seal.level,
    'afterLevel',v_after,
    'goldCost',300,
    'state',private.association_seal_state_json(v_user),
    'record',private.cloud_record_json(v_user),
    'replayed',false
  );
end;
$$;
revoke all on function public.roll_association_seal(uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.roll_association_seal(uuid,bigint,text,text,uuid) to authenticated;

create or replace function public.reset_association_seal(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid;
  v_save public.game_saves%rowtype;
  v_wallet private.player_wallets%rowtype;
  v_seal private.player_association_seals%rowtype;
  v_existing private.association_seal_reset_requests%rowtype;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  if p_request_id is null then raise exception 'SEAL_RESET_REQUEST_REQUIRED'; end if;
  if exists(select 1 from private.online_expeditions where user_id=v_user and status='ACTIVE') then
    raise exception 'SEAL_ROLL_DURING_EXPEDITION';
  end if;

  perform private.sync_market_economy_from_latest_save(v_user);
  select * into v_save from public.game_saves where user_id=v_user for update;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED'; end if;
  select * into v_wallet from private.player_wallets where user_id=v_user for update;
  if not found then raise exception 'SERVER_WALLET_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,42));
  select * into v_existing
  from private.association_seal_reset_requests
  where user_id=v_user and request_id=p_request_id;
  if found then
    return jsonb_build_object(
      'requestId',p_request_id,
      'beforeLevel',v_existing.before_level,
      'beforeRolls',v_existing.before_rolls,
      'goldCost',v_existing.gold_cost,
      'state',private.association_seal_state_json(v_user),
      'record',private.cloud_record_json(v_user),
      'replayed',true
    );
  end if;

  insert into private.player_association_seals(user_id)
    values(v_user)
    on conflict(user_id) do nothing;
  select * into v_seal
  from private.player_association_seals
  where user_id=v_user
  for update;

  if v_seal.level>=30 then raise exception 'SEAL_COMPLETED'; end if;
  if v_seal.rolls_used<20 then raise exception 'SEAL_RESET_NOT_READY'; end if;
  if v_wallet.gold<3000 then raise exception 'SEAL_GOLD_SHORTAGE'; end if;

  update private.player_wallets
    set gold=gold-3000,updated_at=now()
  where user_id=v_user;

  update private.player_association_seals
    set level=0,rolls_used=0,reset_count=reset_count+1,updated_at=now()
  where user_id=v_user;

  insert into private.association_seal_reset_requests(
    user_id,request_id,before_level,before_rolls,gold_cost
  ) values(
    v_user,p_request_id,v_seal.level,v_seal.rolls_used,3000
  );

  perform private.persist_client_payload_with_server_economy(v_user,v_save.payload,'0.1.59');

  return jsonb_build_object(
    'requestId',p_request_id,
    'beforeLevel',v_seal.level,
    'beforeRolls',v_seal.rolls_used,
    'goldCost',3000,
    'state',private.association_seal_state_json(v_user),
    'record',private.cloud_record_json(v_user),
    'replayed',false
  );
end;
$$;
revoke all on function public.reset_association_seal(uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.reset_association_seal(uuid,bigint,text,text,uuid) to authenticated;

-- Association seal bonuses are authoritative combat modifiers.
-- Seal changes are blocked during an active expedition, so a run cannot change bonuses mid-run.
create or replace function private.combat_equipment_stats(p_user uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_eq jsonb:=p_payload->'expedition'->'equipment';
 v_items jsonb:=coalesce(p_payload->'items','[]'::jsonb);
 v_weapon jsonb;v_armor jsonb;v_boots jsonb;
 v_kind text:='sword';v_mult numeric:=1;v_scale numeric:=.55;
 v_attack numeric:=8;v_def numeric:=3;v_hp numeric:=180;
 v_seal_level integer:=0;v_seal_bonus jsonb;
begin
 select i into v_weapon from jsonb_array_elements(v_items)i
  where i->>'id'=v_eq->>'weapon' and i->>'kind' in('sword','dagger','bow','staff') limit 1;
 select i into v_armor from jsonb_array_elements(v_items)i
  where i->>'id'=v_eq->>'armor' and i->>'kind'='armor' limit 1;
 select i into v_boots from jsonb_array_elements(v_items)i
  where i->>'id'=v_eq->>'boots' and i->>'kind'='boots' limit 1;

 if v_weapon is not null then
   v_kind:=v_weapon->>'kind';
   v_mult:=1+greatest(0,least(3,coalesce((v_weapon->>'enhancement')::int,0)))*0.1;
   v_scale:=case when v_weapon->>'id'='starter' then .55
     else greatest(1,least(5,coalesce((v_weapon->>'tier')::int,1))) end;
 end if;

 v_attack:=v_attack+(case v_kind when 'sword' then 10 when 'dagger' then 7 when 'bow' then 12 else 6 end)*v_scale*v_mult;
 v_def:=v_def+(case v_kind when 'sword' then 4 when 'bow' then 1 else 0 end)*v_scale*v_mult;

 if v_armor is not null then
   v_mult:=1+greatest(0,least(3,coalesce((v_armor->>'enhancement')::int,0)))*0.1;
   v_hp:=v_hp+55*greatest(1,least(5,coalesce((v_armor->>'tier')::int,1)))*v_mult;
   v_def:=v_def+7*greatest(1,least(5,coalesce((v_armor->>'tier')::int,1)))*v_mult;
 end if;
 if v_boots is not null then
   v_mult:=1+greatest(0,least(3,coalesce((v_boots->>'enhancement')::int,0)))*0.1;
   v_hp:=v_hp+15*greatest(1,least(5,coalesce((v_boots->>'tier')::int,1)))*v_mult;
 end if;

 select level into v_seal_level
 from private.player_association_seals
 where user_id=p_user;
 v_seal_bonus:=private.association_seal_bonus_json(coalesce(v_seal_level,0));

 v_hp:=v_hp*(1+coalesce((v_seal_bonus->>'hpPercent')::numeric,0)/100);
 v_attack:=v_attack*(1+coalesce((v_seal_bonus->>'attackPercent')::numeric,0)/100);
 v_def:=v_def*(1+coalesce((v_seal_bonus->>'defensePercent')::numeric,0)/100);

 return jsonb_build_object('attack',v_attack,'defense',v_def,'hp',round(v_hp),'weapon',v_kind);
end $$;
revoke all on function private.combat_equipment_stats(uuid,jsonb) from public,anon,authenticated;
