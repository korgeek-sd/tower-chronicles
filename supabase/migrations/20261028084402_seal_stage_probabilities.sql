-- Basic stage probabilities only; no probability reroll or guaranteed +3 bonus.
-- Source: https://probability.plaync.com/lineagem/view?probCategoryId=683568e3068cf65296bc535e
-- Table row = current level + 1 (level 0 uses row 1; level 29 uses row 30).
-- Integer weights are basis points, totaling 10000 per row.
begin;
create or replace function private.association_seal_probability_weights(p_level integer)
returns integer[] language sql immutable strict set search_path='' as $$
 select array[plus_one,plus_two,plus_three]
 from (values
  (0,6250,3300,450),
  (1,6450,3100,450),
  (2,6650,2900,450),
  (3,6850,2700,450),
  (4,7050,2500,450),
  (5,7250,2300,450),
  (6,7450,2100,450),
  (7,7650,1900,450),
  (8,7950,1700,350),
  (9,8150,1500,350),
  (10,8350,1300,350),
  (11,8550,1100,350),
  (12,8650,1000,350),
  (13,8750,900,350),
  (14,8850,800,350),
  (15,8850,800,350),
  (16,8850,800,350),
  (17,8950,800,250),
  (18,8950,800,250),
  (19,8950,800,250),
  (20,8950,800,250),
  (21,9150,700,150),
  (22,9150,700,150),
  (23,9150,700,150),
  (24,9350,500,150),
  (25,9600,300,100),
  (26,9700,200,100),
  (27,9805,150,45),
  (28,9925,75,0),
  (29,10000,0,0)
 ) as rates(level,plus_one,plus_two,plus_three)
 where level=greatest(0,least(29,p_level));
$$;
revoke all on function private.association_seal_probability_weights(integer) from public,anon,authenticated,service_role;

create or replace function private.association_seal_draw_step(p_level integer)
returns smallint language plpgsql volatile strict set search_path='' as $$
declare
 v_weights integer[]:=private.association_seal_probability_weights(p_level);
 v_roll double precision:=random();
begin
 if v_roll<v_weights[1]/10000.0 then return 1; end if;
 if v_roll<(v_weights[1]+v_weights[2])/10000.0 then return 2; end if;
 return 3;
end;
$$;
revoke all on function private.association_seal_draw_step(integer) from public,anon,authenticated,service_role;

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

  v_step:=private.association_seal_draw_step(v_seal.level);
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
$function$
;

CREATE OR REPLACE FUNCTION public.roll_association_seal(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  v_step:=private.association_seal_draw_step(v_seal.level);
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
$function$
;

-- Retire the unparameterized fixed-rate draw after switching both callers.
drop function if exists private.association_seal_draw_step();
commit;
