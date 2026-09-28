-- v0.1.69: retire Golden Recorder gameplay privileges while keeping legacy save fields compatible.

create or replace function private.gold_exchange_seller_fee_bps(p_user uuid)
returns integer
language sql
immutable
security invoker
set search_path=''
as $$
  select 200
$$;

revoke all on function private.gold_exchange_seller_fee_bps(uuid) from public,anon,authenticated;

create or replace function public.start_online_craft(
  p_lease_id uuid,
  p_generation bigint,
  p_client_instance_id text,
  p_device_id text,
  p_job_id text,
  p_kind text,
  p_tier integer,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid;
  v_save public.game_saves%rowtype;
  v_mastery jsonb;
  v_unlocked integer;
  v_crafts integer;
  v_cost bigint;
  v_discount numeric;
  v_outstanding integer;
  v_queued integer;
  v_ready timestamptz;
  v_status text;
  v_asset private.market_assets%rowtype;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.sync_market_economy_from_latest_save(v_user);

  select * into v_save
  from public.game_saves
  where user_id=v_user
  for update;

  if not found then raise exception 'CLOUD_SAVE_REQUIRED'; end if;
  if jsonb_typeof(v_save.payload->'expedition') is distinct from 'null' then
    raise exception 'CRAFT_EXPEDITION_BLOCKED';
  end if;

  if p_kind in('sword','dagger','bow','staff','armor','boots','vampire','unyielding','berserker') then
    raise exception 'CRAFT_EQUIPMENT_REMOVED';
  end if;

  if p_job_id!~'^craft-[0-9]+$'
     or p_kind not in('healing_lesser','healing_standard','healing_greater','healing_supreme')
     or p_quantity<>10 then
    raise exception 'CRAFT_INPUT_INVALID';
  end if;

  if (p_kind='healing_lesser' and p_tier<>1)
     or (p_kind='healing_standard' and p_tier<>2)
     or (p_kind='healing_greater' and p_tier<>3)
     or (p_kind='healing_supreme' and p_tier<>4) then
    raise exception 'CRAFT_INPUT_INVALID';
  end if;

  v_mastery:=v_save.payload->'mastery'->'alchemy';
  begin
    v_unlocked:=(v_mastery->>'unlocked')::integer;
    v_crafts:=(v_mastery->>'crafts')::integer;
  exception when others then
    raise exception 'CRAFT_MASTERY_INVALID';
  end;

  if p_tier>v_unlocked then raise exception 'CRAFT_TIER_LOCKED'; end if;
  if exists(
    select 1
    from private.online_craft_jobs
    where user_id=v_user and job_id=p_job_id
  ) then
    raise exception 'CRAFT_JOB_EXISTS';
  end if;

  v_discount:=least(0.30,greatest(0,v_crafts)*0.02);
  v_cost:=greatest(1,ceil(6*p_tier*(1-v_discount))::bigint);

  select count(*) into v_outstanding
  from private.online_craft_jobs
  where user_id=v_user and status in('ACTIVE','QUEUED');

  select count(*) into v_queued
  from private.online_craft_jobs
  where user_id=v_user and status='QUEUED';

  if v_outstanding>0 and v_queued>=3 then
    raise exception 'CRAFT_QUEUE_FULL';
  end if;

  select * into v_asset
  from private.market_assets
  where user_id=v_user and item_id='material:kaleon:'||p_tier::text
  for update;

  if not found or v_asset.quantity<v_cost then
    raise exception 'CRAFT_MATERIAL_SHORTAGE';
  end if;

  if v_asset.quantity=v_cost then
    delete from private.market_assets
    where user_id=v_user and item_id=v_asset.item_id;
  else
    update private.market_assets
    set quantity=quantity-v_cost,updated_at=now()
    where user_id=v_user and item_id=v_asset.item_id;
  end if;

  select greatest(now(),coalesce(max(ready_at),now()))+interval '30 seconds'
  into v_ready
  from private.online_craft_jobs
  where user_id=v_user and status in('ACTIVE','QUEUED');

  v_status:=case when v_outstanding=0 then 'ACTIVE' else 'QUEUED' end;

  insert into private.online_craft_jobs(
    user_id,job_id,kind,tier,quantity,field,material_tower,material_cost,status,queued_at,ready_at
  ) values(
    v_user,p_job_id,p_kind,p_tier,p_quantity,'alchemy','kaleon',v_cost,v_status,now(),v_ready
  );

  perform private.persist_market_economy_to_save(v_user);

  return jsonb_build_object(
    'jobId',p_job_id,
    'materialCost',v_cost,
    'readyAt',extract(epoch from v_ready)*1000,
    'record',private.cloud_record_json(v_user)
  );
end;
$$;
