alter table private.association_seal_reset_requests
  drop constraint if exists association_seal_reset_requests_before_rolls_check;

alter table private.association_seal_reset_requests
  add constraint association_seal_reset_requests_before_rolls_check
  check (before_rolls between 0 and 20);

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

  perform private.persist_client_payload_with_server_economy(v_user,v_save.payload,'0.1.61');

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
