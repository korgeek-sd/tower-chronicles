-- v0.1.49 server-authoritative crafting, enhancement, and association fee spending.

create table if not exists private.online_craft_jobs(
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id text not null,
  kind text not null,
  tier integer not null check (tier between 1 and 5),
  quantity integer not null check (quantity>0),
  field text not null check (field in ('weapon','armor','accessory','alchemy')),
  material_tower text not null check (material_tower in ('ore','leather','gem','kaleon')),
  material_cost bigint not null check (material_cost>0),
  status text not null check (status in ('ACTIVE','QUEUED','CLAIMED','CANCELLED')),
  queued_at timestamptz not null default now(),
  ready_at timestamptz not null,
  claimed_at timestamptz,
  cancelled_at timestamptz,
  gear_item_id text,
  primary key(user_id,job_id)
);
alter table private.online_craft_jobs enable row level security;
revoke all on private.online_craft_jobs from public,anon,authenticated;
create index if not exists online_craft_jobs_active_idx
on private.online_craft_jobs(user_id,status,ready_at);

create or replace function public.start_online_craft(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
  p_job_id text,p_kind text,p_tier integer,p_quantity integer
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid;v_save public.game_saves%rowtype;v_field text;v_tower text;v_mastery jsonb;
  v_unlocked integer;v_crafts integer;v_cost bigint;v_discount numeric;v_premium numeric:=0;
  v_golden_expires bigint;v_outstanding integer;v_queued integer;v_ready timestamptz;v_status text;
  v_asset private.market_assets%rowtype;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.sync_market_economy_from_latest_save(v_user);
  select * into v_save from public.game_saves where user_id=v_user for update;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
  if jsonb_typeof(v_save.payload->'expedition') is distinct from 'null' then raise exception 'CRAFT_EXPEDITION_BLOCKED';end if;

  if p_job_id!~'^craft-[0-9]+$' or p_tier<1 or p_tier>5 then raise exception 'CRAFT_INPUT_INVALID';end if;
  if p_kind in ('sword','dagger','bow','staff') then v_field:='weapon';v_tower:='ore';
  elsif p_kind in ('armor','boots') then v_field:='armor';v_tower:='leather';
  elsif p_kind in ('vampire','unyielding','berserker') then v_field:='accessory';v_tower:='gem';
  elsif p_kind in ('healing_lesser','healing_standard','healing_greater','healing_supreme') then
    v_field:='alchemy';v_tower:='kaleon';
    if p_quantity<>10 then raise exception 'CRAFT_INPUT_INVALID';end if;
    if (p_kind='healing_lesser' and p_tier<>1)
       or (p_kind='healing_standard' and p_tier<>2)
       or (p_kind='healing_greater' and p_tier<>3)
       or (p_kind='healing_supreme' and p_tier<>4) then raise exception 'CRAFT_INPUT_INVALID';end if;
  else raise exception 'CRAFT_INPUT_INVALID';
  end if;
  if v_field<>'alchemy' and p_quantity<>1 then raise exception 'CRAFT_INPUT_INVALID';end if;
  if exists(select 1 from private.online_craft_jobs where user_id=v_user and job_id=p_job_id) then raise exception 'CRAFT_JOB_EXISTS';end if;

  v_mastery:=v_save.payload->'mastery'->v_field;
  begin v_unlocked:=(v_mastery->>'unlocked')::integer;v_crafts:=(v_mastery->>'crafts')::integer;
  exception when others then raise exception 'CRAFT_MASTERY_INVALID';end;
  if p_tier>v_unlocked then raise exception 'CRAFT_TIER_LOCKED';end if;

  begin v_golden_expires:=(v_save.payload->'goldenRecorder'->>'expiresAt')::bigint;exception when others then v_golden_expires:=null;end;
  if v_golden_expires is not null and v_golden_expires>(extract(epoch from now())*1000)::bigint then v_premium:=0.02;end if;
  v_discount:=least(0.30,greatest(0,v_crafts)*0.02);
  v_cost:=greatest(1,ceil(6*p_tier*(1-v_discount-v_premium))::bigint);

  select count(*) into v_outstanding from private.online_craft_jobs where user_id=v_user and status in ('ACTIVE','QUEUED');
  select count(*) into v_queued from private.online_craft_jobs where user_id=v_user and status='QUEUED';
  if v_outstanding>0 and v_premium=0 then raise exception 'CRAFT_BUSY';end if;
  if v_premium>0 and v_queued>=3 then raise exception 'CRAFT_QUEUE_FULL';end if;

  select * into v_asset from private.market_assets
  where user_id=v_user and item_id='material:'||v_tower||':'||p_tier::text for update;
  if not found or v_asset.quantity<v_cost then raise exception 'CRAFT_MATERIAL_SHORTAGE';end if;
  if v_asset.quantity=v_cost then delete from private.market_assets where user_id=v_user and item_id=v_asset.item_id;
  else update private.market_assets set quantity=quantity-v_cost,updated_at=now() where user_id=v_user and item_id=v_asset.item_id;end if;

  select greatest(now(),coalesce(max(ready_at),now()))+interval '30 seconds' into v_ready
  from private.online_craft_jobs where user_id=v_user and status in ('ACTIVE','QUEUED');
  v_status:=case when v_outstanding=0 then 'ACTIVE' else 'QUEUED' end;

  insert into private.online_craft_jobs(user_id,job_id,kind,tier,quantity,field,material_tower,material_cost,status,queued_at,ready_at)
  values(v_user,p_job_id,p_kind,p_tier,p_quantity,v_field,v_tower,v_cost,v_status,now(),v_ready);

  perform private.persist_market_economy_to_save(v_user);
  return jsonb_build_object('jobId',p_job_id,'materialCost',v_cost,'readyAt',extract(epoch from v_ready)*1000,'record',private.cloud_record_json(v_user));
end;$$;

create or replace function public.cancel_online_craft(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_job_id text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_job private.online_craft_jobs%rowtype;v_next record;v_cursor timestamptz:=now();v_first boolean:=true;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  select * into v_job from private.online_craft_jobs where user_id=v_user and job_id=p_job_id for update;
  if not found or v_job.status not in ('ACTIVE','QUEUED') then raise exception 'CRAFT_NOT_CANCELLABLE';end if;

  insert into private.market_assets(user_id,item_id,quantity,updated_at)
  values(v_user,'material:'||v_job.material_tower||':'||v_job.tier::text,v_job.material_cost,now())
  on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+excluded.quantity,updated_at=now();

  update private.online_craft_jobs set status='CANCELLED',cancelled_at=now() where user_id=v_user and job_id=p_job_id;
  if v_job.status='ACTIVE' then
    for v_next in select job_id from private.online_craft_jobs where user_id=v_user and status='QUEUED' order by queued_at,job_id for update loop
      v_cursor:=v_cursor+interval '30 seconds';
      update private.online_craft_jobs set status=case when v_first then 'ACTIVE' else 'QUEUED' end,ready_at=v_cursor
      where user_id=v_user and job_id=v_next.job_id;
      v_first:=false;
    end loop;
  end if;
  perform private.persist_market_economy_to_save(v_user);
  return jsonb_build_object('record',private.cloud_record_json(v_user));
end;$$;

create or replace function public.claim_online_craft(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
  p_job_id text,p_item_id text default null
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_job private.online_craft_jobs%rowtype;v_gear jsonb;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  select * into v_job from private.online_craft_jobs where user_id=v_user and job_id=p_job_id for update;
  if not found or v_job.status not in ('ACTIVE','QUEUED') then raise exception 'CRAFT_NOT_CLAIMABLE';end if;
  if now()<v_job.ready_at then raise exception 'CRAFT_NOT_READY';end if;

  if v_job.field<>'alchemy' then
    if p_item_id is null or p_item_id!~'^item-[0-9]+$' then raise exception 'CRAFT_ITEM_ID_INVALID';end if;
    if exists(select 1 from private.market_assets where user_id=v_user and item_id='gear:'||p_item_id) then raise exception 'CRAFT_ITEM_ID_EXISTS';end if;
    v_gear:=jsonb_build_object('id',p_item_id,'kind',v_job.kind,'tier',v_job.tier,'enhancement',0);
    insert into private.market_assets(user_id,item_id,quantity,gear,updated_at)
    values(v_user,'gear:'||p_item_id,1,v_gear,now());
  elsif p_item_id is not null then raise exception 'CRAFT_ITEM_ID_INVALID';
  end if;

  update private.online_craft_jobs set status='CLAIMED',claimed_at=now(),gear_item_id=p_item_id
  where user_id=v_user and job_id=p_job_id;

  update private.online_craft_jobs j set status='ACTIVE'
  where j.user_id=v_user and j.status='QUEUED' and j.job_id=(
    select q.job_id from private.online_craft_jobs q
    where q.user_id=v_user and q.status='QUEUED' order by q.queued_at,q.job_id limit 1
  );

  perform private.persist_market_economy_to_save(v_user);
  return jsonb_build_object('record',private.cloud_record_json(v_user),'itemId',p_item_id);
end;$$;

create or replace function public.enhance_online_equipment(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_item_id text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid;v_asset private.market_assets%rowtype;v_save public.game_saves%rowtype;v_kind text;v_category text;v_tower text;
  v_tier integer;v_level integer;v_silver_cost bigint;v_material_cost bigint;v_mat private.market_assets%rowtype;
  v_roll numeric;v_outcome text;v_next integer;v_payload jsonb;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.sync_market_economy_from_latest_save(v_user);
  select * into v_save from public.game_saves where user_id=v_user for update;
  if jsonb_typeof(v_save.payload->'expedition') is distinct from 'null' then raise exception 'ENHANCE_EXPEDITION_BLOCKED';end if;

  select * into v_asset from private.market_assets where user_id=v_user and item_id='gear:'||p_item_id for update;
  if not found or v_asset.gear is null then raise exception 'ENHANCE_ITEM_NOT_FOUND';end if;
  if p_item_id='starter' then raise exception 'ENHANCE_ITEM_INVALID';end if;

  v_kind:=v_asset.gear->>'kind';
  begin v_tier:=(v_asset.gear->>'tier')::integer;v_level:=(v_asset.gear->>'enhancement')::integer;
  exception when others then raise exception 'ENHANCE_ITEM_INVALID';end;
  if v_tier<1 or v_tier>5 or v_level<0 or v_level>2 then raise exception 'ENHANCE_ITEM_INVALID';end if;

  if v_kind in ('sword','dagger','bow','staff') then v_category:='weapon';v_tower:='ore';
  elsif v_kind='armor' then v_category:='armor';v_tower:='leather';
  elsif v_kind='boots' then v_category:='boots';v_tower:='leather';
  elsif v_kind in ('vampire','unyielding','berserker') then v_category:='accessory';v_tower:='gem';
  else raise exception 'ENHANCE_ITEM_INVALID';
  end if;

  v_silver_cost:=(case v_level when 0 then 100 when 1 then 250 else 600 end)*v_tier;
  v_material_cost:=(case v_level when 0 then 4 when 1 then 8 else 16 end)*v_tier;

  if (select silver from private.player_wallets where user_id=v_user for update)<v_silver_cost then raise exception 'ENHANCE_SILVER_SHORTAGE';end if;
  select * into v_mat from private.market_assets where user_id=v_user and item_id='material:'||v_tower||':'||v_tier::text for update;
  if not found or v_mat.quantity<v_material_cost then raise exception 'ENHANCE_MATERIAL_SHORTAGE';end if;

  update private.player_wallets set silver=silver-v_silver_cost,updated_at=now() where user_id=v_user;
  if v_mat.quantity=v_material_cost then delete from private.market_assets where user_id=v_user and item_id=v_mat.item_id;
  else update private.market_assets set quantity=quantity-v_material_cost,updated_at=now() where user_id=v_user and item_id=v_mat.item_id;end if;

  v_roll:=random();
  if v_level=0 then v_outcome:=case when v_roll<0.50 then 'SUCCESS' else 'FAIL_KEEP' end;
  elsif v_level=1 then v_outcome:=case when v_roll<0.35 then 'SUCCESS' when v_roll<0.75 then 'FAIL_KEEP' when v_roll<0.95 then 'FAIL_DOWNGRADE' else 'FAIL_DESTROYED' end;
  else v_outcome:=case when v_roll<0.20 then 'SUCCESS' when v_roll<0.55 then 'FAIL_KEEP' when v_roll<0.85 then 'FAIL_DOWNGRADE' else 'FAIL_DESTROYED' end;
  end if;

  if v_outcome='SUCCESS' then
    v_next:=v_level+1;update private.market_assets set gear=jsonb_set(gear,'{enhancement}',to_jsonb(v_next),true),updated_at=now() where user_id=v_user and item_id='gear:'||p_item_id;
  elsif v_outcome='FAIL_DOWNGRADE' then
    v_next:=greatest(0,v_level-1);update private.market_assets set gear=jsonb_set(gear,'{enhancement}',to_jsonb(v_next),true),updated_at=now() where user_id=v_user and item_id='gear:'||p_item_id;
  elsif v_outcome='FAIL_DESTROYED' then
    delete from private.market_assets where user_id=v_user and item_id='gear:'||p_item_id;
    v_payload:=v_save.payload;
    v_payload:=jsonb_set(v_payload,'{equipped,weapon}',case when v_payload->'equipped'->>'weapon'=p_item_id then 'null'::jsonb else v_payload->'equipped'->'weapon' end,true);
    v_payload:=jsonb_set(v_payload,'{equipped,armor}',case when v_payload->'equipped'->>'armor'=p_item_id then 'null'::jsonb else v_payload->'equipped'->'armor' end,true);
    v_payload:=jsonb_set(v_payload,'{equipped,boots}',case when v_payload->'equipped'->>'boots'=p_item_id then 'null'::jsonb else v_payload->'equipped'->'boots' end,true);
    v_payload:=jsonb_set(v_payload,'{equipped,accessory}',case when v_payload->'equipped'->>'accessory'=p_item_id then 'null'::jsonb else v_payload->'equipped'->'accessory' end,true);
    perform private.persist_client_payload_with_server_economy(v_user,v_payload,'0.1.49');
    return jsonb_build_object('outcome',v_outcome,'record',private.cloud_record_json(v_user));
  end if;

  perform private.persist_market_economy_to_save(v_user);
  return jsonb_build_object('outcome',v_outcome,'record',private.cloud_record_json(v_user));
end;$$;

create or replace function public.spend_online_association_fee(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_save public.game_saves%rowtype;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  select * into v_save from public.game_saves where user_id=v_user for update;
  if coalesce((v_save.payload->'market'->>'traderCertified')::boolean,false) is not true then raise exception 'ASSOCIATION_NOT_CERTIFIED';end if;
  if v_save.payload->'association'->>'currentId' is not null then raise exception 'ASSOCIATION_ALREADY_JOINED';end if;
  if (select silver from private.player_wallets where user_id=v_user for update)<1000 then raise exception 'ASSOCIATION_SILVER_SHORTAGE';end if;
  update private.player_wallets set silver=silver-1000,updated_at=now() where user_id=v_user;
  perform private.persist_market_economy_to_save(v_user);
  return jsonb_build_object('record',private.cloud_record_json(v_user));
end;$$;

revoke all on function public.start_online_craft(uuid,bigint,text,text,text,text,integer,integer) from public,anon;
revoke all on function public.cancel_online_craft(uuid,bigint,text,text,text) from public,anon;
revoke all on function public.claim_online_craft(uuid,bigint,text,text,text,text) from public,anon;
revoke all on function public.enhance_online_equipment(uuid,bigint,text,text,text) from public,anon;
revoke all on function public.spend_online_association_fee(uuid,bigint,text,text) from public,anon;

grant execute on function public.start_online_craft(uuid,bigint,text,text,text,text,integer,integer) to authenticated;
grant execute on function public.cancel_online_craft(uuid,bigint,text,text,text) to authenticated;
grant execute on function public.claim_online_craft(uuid,bigint,text,text,text,text) to authenticated;
grant execute on function public.enhance_online_equipment(uuid,bigint,text,text,text) to authenticated;
grant execute on function public.spend_online_association_fee(uuid,bigint,text,text) to authenticated;
