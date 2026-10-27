-- New independent protective seal. Preserve existing combat seal accounts unchanged.
create table if not exists private.player_guardian_seals(
 user_id uuid primary key references auth.users(id) on delete cascade,
 level smallint not null default 0 check(level between 0 and 30),
 rolls_used smallint not null default 0 check(rolls_used between 0 and 20),
 reset_count integer not null default 0 check(reset_count>=0),
 updated_at timestamptz not null default now()
);
alter table private.player_guardian_seals enable row level security;
revoke all on private.player_guardian_seals from public,anon,authenticated;
create table if not exists private.guardian_seal_roll_requests(
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 step smallint not null check(step between 1 and 3),
 before_level smallint not null check(before_level between 0 and 29),
 after_level smallint not null check(after_level between 1 and 30),
 gold_cost bigint not null check(gold_cost=300),
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table private.guardian_seal_roll_requests enable row level security;
revoke all on private.guardian_seal_roll_requests from public,anon,authenticated;
create index if not exists guardian_seal_roll_requests_created_idx on private.guardian_seal_roll_requests(user_id,created_at desc);
create table if not exists private.guardian_seal_reset_requests(
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 before_level smallint not null check(before_level between 0 and 29),
 before_rolls smallint not null check(before_rolls between 0 and 20),
 gold_cost bigint not null check(gold_cost=3000),
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table private.guardian_seal_reset_requests enable row level security;
revoke all on private.guardian_seal_reset_requests from public,anon,authenticated;
create index if not exists guardian_seal_reset_requests_created_idx on private.guardian_seal_reset_requests(user_id,created_at desc);
-- Guardian stats from same milestone schedule: defensive HP and armor; no attack.
create or replace function private.guardian_seal_bonus_json(p_level integer)
returns jsonb language sql immutable set search_path=''
as $guardian$
 select jsonb_build_object(
  'hpPercent',round(coalesce((private.association_seal_bonus_json(p_level)->>'hpPercent')::numeric,0)/2,2),
  'attackPercent',0,
  'defensePercent',coalesce((private.association_seal_bonus_json(p_level)->>'hpPercent')::numeric,0)
 );
$guardian$;
revoke all on function private.guardian_seal_bonus_json(integer) from public,anon,authenticated;
create or replace function private.guardian_seal_state_json(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $guardian$
declare v_level integer:=0;v_rolls integer:=0;v_resets integer:=0;v_gold bigint:=0;
begin
 select level,rolls_used,reset_count into v_level,v_rolls,v_resets
 from private.player_guardian_seals where user_id=p_user;
 select gold into v_gold from private.player_wallets where user_id=p_user;
 v_level:=coalesce(v_level,0);
 return jsonb_build_object('sealId','guardian','level',v_level,'rollsUsed',coalesce(v_rolls,0),'resetCount',coalesce(v_resets,0),'gold',coalesce(v_gold,0),'completed',v_level>=30)
 || private.guardian_seal_bonus_json(v_level);
end;
$guardian$;
revoke all on function private.guardian_seal_state_json(uuid) from public,anon,authenticated;


CREATE OR REPLACE FUNCTION public.get_guardian_seal_state(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.sync_market_economy_from_latest_save(v_user);
  insert into private.player_guardian_seals(user_id)
    values(v_user)
    on conflict(user_id) do nothing;
  return private.guardian_seal_state_json(v_user);
end;
$function$;


CREATE OR REPLACE FUNCTION public.roll_guardian_seal(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid;
  v_save public.game_saves%rowtype;
  v_wallet private.player_wallets%rowtype;
  v_seal private.player_guardian_seals%rowtype;
  v_existing private.guardian_seal_roll_requests%rowtype;
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

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,43));
  select * into v_existing
  from private.guardian_seal_roll_requests
  where user_id=v_user and request_id=p_request_id;
  if found then
    return jsonb_build_object(
      'requestId',p_request_id,
      'step',v_existing.step,
      'beforeLevel',v_existing.before_level,
      'afterLevel',v_existing.after_level,
      'goldCost',v_existing.gold_cost,
      'state',private.guardian_seal_state_json(v_user),
      'record',private.cloud_record_json(v_user),
      'replayed',true
    );
  end if;

  insert into private.player_guardian_seals(user_id)
    values(v_user)
    on conflict(user_id) do nothing;
  select * into v_seal
  from private.player_guardian_seals
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

  update private.player_guardian_seals
    set level=v_after,rolls_used=rolls_used+1,updated_at=now()
  where user_id=v_user;

  insert into private.guardian_seal_roll_requests(
    user_id,request_id,step,before_level,after_level,gold_cost
  ) values(
    v_user,p_request_id,v_step,v_seal.level,v_after,300
  );

  perform private.persist_client_payload_with_server_economy(v_user,v_save.payload,'0.1.93');

  return jsonb_build_object(
    'requestId',p_request_id,
    'step',v_step,
    'beforeLevel',v_seal.level,
    'afterLevel',v_after,
    'goldCost',300,
    'state',private.guardian_seal_state_json(v_user),
    'record',private.cloud_record_json(v_user),
    'replayed',false
  );
end;
$function$;


CREATE OR REPLACE FUNCTION public.reset_guardian_seal(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid;
  v_save public.game_saves%rowtype;
  v_wallet private.player_wallets%rowtype;
  v_seal private.player_guardian_seals%rowtype;
  v_existing private.guardian_seal_reset_requests%rowtype;
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

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,44));
  select * into v_existing
  from private.guardian_seal_reset_requests
  where user_id=v_user and request_id=p_request_id;
  if found then
    return jsonb_build_object(
      'requestId',p_request_id,
      'beforeLevel',v_existing.before_level,
      'beforeRolls',v_existing.before_rolls,
      'goldCost',v_existing.gold_cost,
      'state',private.guardian_seal_state_json(v_user),
      'record',private.cloud_record_json(v_user),
      'replayed',true
    );
  end if;

  insert into private.player_guardian_seals(user_id)
    values(v_user)
    on conflict(user_id) do nothing;
  select * into v_seal
  from private.player_guardian_seals
  where user_id=v_user
  for update;

  if v_seal.level>=30 then raise exception 'SEAL_COMPLETED'; end if;
  if v_wallet.gold<3000 then raise exception 'SEAL_GOLD_SHORTAGE'; end if;

  update private.player_wallets
    set gold=gold-3000,updated_at=now()
  where user_id=v_user;

  update private.player_guardian_seals
    set level=0,rolls_used=0,reset_count=reset_count+1,updated_at=now()
  where user_id=v_user;

  insert into private.guardian_seal_reset_requests(
    user_id,request_id,before_level,before_rolls,gold_cost
  ) values(
    v_user,p_request_id,v_seal.level,v_seal.rolls_used,3000
  );

  perform private.persist_client_payload_with_server_economy(v_user,v_save.payload,'0.1.93');

  return jsonb_build_object(
    'requestId',p_request_id,
    'beforeLevel',v_seal.level,
    'beforeRolls',v_seal.rolls_used,
    'goldCost',3000,
    'state',private.guardian_seal_state_json(v_user),
    'record',private.cloud_record_json(v_user),
    'replayed',false
  );
end;
$function$;


CREATE OR REPLACE FUNCTION private.combat_equipment_stats(p_user uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 eq jsonb:=coalesce(p_payload->'expedition'->'equipment',p_payload->'equipped','{}');
 i jsonb;b jsonb;slot text;expected text;weapon text:='sword';
 hp numeric:=180;attack numeric:=8;defense numeric:=3;crit numeric:=.05;crit_damage numeric:=1.5;pen numeric:=0;
 seal_level integer:=0;bonus jsonb; guardian_level integer:=0;guardian_bonus jsonb; allocated jsonb;
 ap jsonb;
begin
 foreach slot in array array['weapon','helmet','armor','gloves','boots','necklace','ring'] loop
  select gear into i from private.market_assets where user_id=p_user and item_id='equipment_v2:'||(eq->>slot) and quantity=1;
  if i is null then continue;end if;
  expected:=case i->>'kind' when 'association_supply_iron_sword' then 'weapon' when 'outer_guard_longbow' then 'weapon' when 'archive_standard_arcane_staff' then 'weapon' when 'expedition_iron_helmet' then 'helmet' when 'return_corps_plate_armor' then 'armor' when 'mining_detail_reinforced_gloves' then 'gloves' when 'survey_corps_dust_boots' then 'boots' when 'association_registration_tag' then 'necklace' when 'expedition_merit_ring' then 'ring' else null end;
  if expected is distinct from slot then continue;end if;
  b:=private.fixed_equipment_stats(i->>'kind',i->>'grade');
  hp:=hp+coalesce((b->>'hp')::numeric,0);attack:=attack+coalesce((b->>'attack')::numeric,0);defense:=defense+coalesce((b->>'defense')::numeric,0);
  crit:=crit+coalesce((b->>'critChance')::numeric,0);crit_damage:=crit_damage+coalesce((b->>'critDamage')::numeric,0);pen:=pen+coalesce((b->>'armorPenetration')::numeric,0);
  if slot='weapon' then weapon:=case i->>'kind' when 'outer_guard_longbow' then 'bow' when 'archive_standard_arcane_staff' then 'staff' else 'sword' end;end if;
 end loop;
 select stat_allocation into allocated from private.hunting_states where user_id=p_user;
 hp:=hp+12*coalesce((allocated->>'hp')::integer,0);
 attack:=attack+coalesce((allocated->>'attack')::integer,0);
 defense:=defense+2*coalesce((allocated->>'defense')::integer,0);
 crit:=least(.6,crit+.02*coalesce((allocated->>'crit')::integer,0));
 select level into seal_level from private.player_association_seals where user_id=p_user;
 bonus:=private.association_seal_bonus_json(coalesce(seal_level,0));
 hp:=hp*(1+coalesce((bonus->>'hpPercent')::numeric,0)/100);
 attack:=attack*(1+coalesce((bonus->>'attackPercent')::numeric,0)/100);
 defense:=defense*(1+coalesce((bonus->>'defensePercent')::numeric,0)/100);
 select level into guardian_level from private.player_guardian_seals where user_id=p_user;
 guardian_bonus:=private.guardian_seal_bonus_json(coalesce(guardian_level,0));
 hp:=hp*(1+coalesce((guardian_bonus->>'hpPercent')::numeric,0)/100);
 defense:=defense*(1+coalesce((guardian_bonus->>'defensePercent')::numeric,0)/100);
 ap:=coalesce(private.appearance_equipped_effect(p_user,p_payload),'{}'::jsonb);
 if ap->>'id'='attack' then attack:=attack*(1+(case when ap->>'id'='attack' then coalesce((ap->>'value')::numeric,0) else 0 end)/100);end if;
 if ap->>'id'='defense' then defense:=defense*(1+(case when ap->>'id'='defense' then coalesce((ap->>'value')::numeric,0) else 0 end)/100);end if;
 if ap->>'id'='max_hp' then hp:=hp*(1+(case when ap->>'id'='max_hp' then coalesce((ap->>'value')::numeric,0) else 0 end)/100);end if;
 if ap->>'id'='crit_chance' then crit:=crit+(case when ap->>'id'='crit_chance' then coalesce((ap->>'value')::numeric,0) else 0 end)/100;end if;
 if ap->>'id'='crit_damage' then crit_damage:=crit_damage+(case when ap->>'id'='crit_damage' then coalesce((ap->>'value')::numeric,0) else 0 end)/100;end if;
 if ap->>'id'='armor_penetration' then pen:=pen+(case when ap->>'id'='armor_penetration' then coalesce((ap->>'value')::numeric,0) else 0 end)/100;end if;
 return jsonb_build_object('hp',round(hp),'attack',attack,'defense',defense,'critChance',least(.6,crit),'critDamage',crit_damage,'armorPenetration',least(1,pen),'weapon',weapon,'appearanceEffect',ap);
end $function$;



revoke all on function public.get_guardian_seal_state(uuid,bigint,text,text) from public,anon,authenticated;
revoke all on function public.roll_guardian_seal(uuid,bigint,text,text,uuid) from public,anon,authenticated;
revoke all on function public.reset_guardian_seal(uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.get_guardian_seal_state(uuid,bigint,text,text) to authenticated;
grant execute on function public.roll_guardian_seal(uuid,bigint,text,text,uuid) to authenticated;
grant execute on function public.reset_guardian_seal(uuid,bigint,text,text,uuid) to authenticated;
revoke all on function private.combat_equipment_stats(uuid,jsonb) from public,anon,authenticated;