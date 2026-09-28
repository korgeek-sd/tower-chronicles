-- v0.1.64: irreversible cutover from legacy tier gear to V2 drop equipment.
-- Preserve currencies/materials and V2 equipment. Remove legacy gear and equipment crafting.

-- Ensure every save owner has an authoritative wallet before refunding escrow.
insert into private.player_wallets(user_id,silver,gold,last_synced_revision,updated_at)
select g.user_id,
       greatest(0,coalesce((g.payload->>'silver')::bigint,0)),
       greatest(0,coalesce((g.payload->'market'->>'gold')::bigint,0)),
       g.revision,now()
from public.game_saves g
on conflict(user_id) do nothing;

-- Refund Silver reserved by open legacy gear BUY orders and unclaimed SELL proceeds.
with legacy_refunds as (
  select user_id,sum(amount)::bigint amount
  from (
    select user_id,(limit_price*remaining_quantity)::bigint amount
    from private.market_orders
    where item_id like 'gear:%' and side='BUY' and status in('OPEN','PARTIAL') and remaining_quantity>0
    union all
    select user_id,silver::bigint amount
    from private.market_storage
    where item_id like 'gear:%' and side='SELL' and silver>0
  ) x
  group by user_id
)
update private.player_wallets w
set silver=w.silver+r.amount,updated_at=now()
from legacy_refunds r
where w.user_id=r.user_id;

-- Refund materials consumed by active/queued equipment crafts before deleting those jobs.
insert into private.market_assets(user_id,item_id,quantity,updated_at)
select user_id,'material:'||material_tower||':'||tier::text,sum(material_cost)::bigint,now()
from private.online_craft_jobs
where field<>'alchemy' and status in('ACTIVE','QUEUED')
group by user_id,material_tower,tier
on conflict(user_id,item_id) do update
set quantity=private.market_assets.quantity+excluded.quantity,updated_at=now();

delete from private.online_craft_jobs where field<>'alchemy';
delete from private.market_orders where item_id like 'gear:%';
delete from private.market_storage where item_id like 'gear:%';
delete from private.market_assets where item_id like 'gear:%';

-- Canonical V2 starter exists exactly once as a server asset for every save owner.
insert into private.market_assets(user_id,item_id,quantity,gear,updated_at)
select g.user_id,'equipment_v2:starter-v2',1,
       jsonb_build_object(
         'id','starter-v2',
         'kind','association_supply_iron_sword',
         'grade','common',
         'enhancement',0
       ),now()
from public.game_saves g
on conflict(user_id,item_id) do update
set quantity=1,gear=excluded.gear,updated_at=now();

create or replace function private.equipment_v23_payload(p_user uuid,p_payload jsonb)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_payload jsonb:=coalesce(p_payload,'{}'::jsonb);
  v_equipment jsonb;
  v_loadout jsonb:=jsonb_build_object(
    'weapon','starter-v2',
    'helmet',null,
    'armor',null,
    'gloves',null,
    'boots',null,
    'necklace',null,
    'ring',null
  );
  v_presets jsonb;
  v_jobs jsonb;
  v_orders jsonb;
  v_storage jsonb;
begin
  select coalesce(jsonb_agg(a.gear order by a.item_id),'[]'::jsonb)
  into v_equipment
  from private.market_assets a
  where a.user_id=p_user and a.item_id like 'equipment_v2:%'
    and a.quantity=1 and a.gear is not null;

  v_payload:=jsonb_set(v_payload,'{version}','23'::jsonb,true);
  v_payload:=jsonb_set(v_payload,'{items}','[]'::jsonb,true);
  v_payload:=jsonb_set(v_payload,'{equipmentItems}',v_equipment,true);
  v_payload:=jsonb_set(v_payload,'{equipped}',v_loadout,true);

  if jsonb_typeof(v_payload->'expeditionPresets')='array' then
    select coalesce(jsonb_agg(
      case when value='null'::jsonb then value
           else jsonb_set(value,'{equipment}',v_loadout,true) end
      order by ord
    ),'[]'::jsonb)
    into v_presets
    from jsonb_array_elements(v_payload->'expeditionPresets') with ordinality x(value,ord);
    v_payload:=jsonb_set(v_payload,'{expeditionPresets}',v_presets,true);
  end if;

  if jsonb_typeof(v_payload->'expedition')='object' then
    v_payload:=jsonb_set(v_payload,'{expedition,equipment}',v_loadout,true);
  end if;

  if jsonb_typeof(v_payload->'crafting'->'jobs')='array' then
    select coalesce(jsonb_agg(value order by ord),'[]'::jsonb)
    into v_jobs
    from jsonb_array_elements(v_payload->'crafting'->'jobs') with ordinality x(value,ord)
    where value->>'field'='alchemy';
    v_payload:=jsonb_set(v_payload,'{crafting,jobs}',v_jobs,true);
  end if;

  if jsonb_typeof(v_payload->'market'->'orders')='array' then
    select coalesce(jsonb_agg(value order by ord),'[]'::jsonb)
    into v_orders
    from jsonb_array_elements(v_payload->'market'->'orders') with ordinality x(value,ord)
    where coalesce(value->>'itemId','') not like 'gear:%';
    v_payload:=jsonb_set(v_payload,'{market,orders}',v_orders,true);
  end if;

  if jsonb_typeof(v_payload->'market'->'storage')='array' then
    select coalesce(jsonb_agg(value order by ord),'[]'::jsonb)
    into v_storage
    from jsonb_array_elements(v_payload->'market'->'storage') with ordinality x(value,ord)
    where coalesce(value->>'itemId','') not like 'gear:%';
    v_payload:=jsonb_set(v_payload,'{market,storage}',v_storage,true);
  end if;

  return v_payload;
end;$$;
revoke all on function private.equipment_v23_payload(uuid,jsonb) from public,anon,authenticated;

-- Rewrite cloud saves to schema v23 while retaining all non-equipment progression.
with migrated as (
  select g.user_id,g.revision,private.equipment_v23_payload(g.user_id,g.payload) payload
  from public.game_saves g
)
update public.game_saves g
set revision=m.revision+1,
    app_version='0.1.64',
    payload=m.payload,
    payload_hash=encode(extensions.digest(convert_to(private.stable_json_string(m.payload),'UTF8'),'sha256'),'hex'),
    updated_at=now()
from migrated m
where g.user_id=m.user_id;

update private.player_wallets w
set last_synced_revision=g.revision,updated_at=now()
from public.game_saves g
where g.user_id=w.user_id;

-- Active runs are also cut over to the starter loadout so a removed gear id cannot survive in a server snapshot.
update private.online_expeditions
set equipment_snapshot=jsonb_build_object(
  'weapon','starter-v2','helmet',null,'armor',null,'gloves',null,'boots',null,'necklace',null,'ring',null
),run_version=run_version+1
where status='ACTIVE';

-- First-time server economy bootstrap now imports V2 equipment and never recreates legacy gear.
create or replace function private.sync_market_economy_from_latest_save(p_user uuid)
returns bigint
language plpgsql security definer set search_path=''
as $$
declare
  v_revision bigint;
  v_payload jsonb;
  v_last bigint;
begin
  select revision,payload into v_revision,v_payload
  from public.game_saves where user_id=p_user;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;

  select last_synced_revision into v_last
  from private.player_wallets where user_id=p_user;

  if found then
    if v_last>=v_revision then return v_revision;end if;
    update private.player_wallets
    set last_synced_revision=v_revision,updated_at=now()
    where user_id=p_user;
    return v_revision;
  end if;

  insert into private.player_wallets(user_id,silver,gold,last_synced_revision,updated_at)
  values(
    p_user,
    greatest(0,coalesce((v_payload->>'silver')::bigint,0)),
    greatest(0,coalesce((v_payload->'market'->>'gold')::bigint,0)),
    v_revision,now()
  );

  insert into private.market_assets(user_id,item_id,quantity,gear)
  select p_user,'equipment_v2:'||(g->>'id'),1,g
  from jsonb_array_elements(coalesce(v_payload->'equipmentItems','[]'::jsonb)) g
  where nullif(g->>'id','') is not null
  on conflict(user_id,item_id) do update set quantity=1,gear=excluded.gear,updated_at=now();

  insert into private.market_assets(user_id,item_id,quantity)
  select p_user,'material:'||m.key||':'||q.ord::text,(q.value#>>'{}')::bigint
  from jsonb_each(coalesce(v_payload->'materials','{}'::jsonb)) m
  cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord)
  where (q.value#>>'{}')::bigint>0
  on conflict(user_id,item_id) do update set quantity=excluded.quantity,updated_at=now();

  insert into private.market_assets(user_id,item_id,quantity)
  select p_user,'ticket:'||m.key||':'||q.ord::text,(q.value#>>'{}')::bigint
  from jsonb_each(coalesce(v_payload->'tickets','{}'::jsonb)) m
  cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord)
  where (q.value#>>'{}')::bigint>0
  on conflict(user_id,item_id) do update set quantity=excluded.quantity,updated_at=now();

  insert into private.market_assets(user_id,item_id,quantity)
  select p_user,'skillbook:'||kv.key,(kv.value)::bigint
  from jsonb_each_text(coalesce(v_payload->'skillBooks','{}'::jsonb)) kv
  where (kv.value)::bigint>0
  on conflict(user_id,item_id) do update set quantity=excluded.quantity,updated_at=now();

  insert into private.market_assets(user_id,item_id,quantity)
  select p_user,'other:'||kv.key,(kv.value)::bigint
  from jsonb_each_text(coalesce(v_payload->'lootItems','{}'::jsonb)) kv
  where (kv.value)::bigint>0
  on conflict(user_id,item_id) do update set quantity=excluded.quantity,updated_at=now();

  return v_revision;
end;$$;
revoke all on function private.sync_market_economy_from_latest_save(uuid) from public,anon,authenticated;

-- Seven-slot ownership validation: V2 only. Legacy gear can no longer enter an expedition.
create or replace function private.server_equipment_snapshot(p_user uuid,p_equipped jsonb)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  eq jsonb:=coalesce(p_equipped,'{}'::jsonb);
  w jsonb;h jsonb;a jsonb;g jsonb;b jsonb;n jsonb;r jsonb;
begin
  select gear into w from private.market_assets
  where user_id=p_user and item_id='equipment_v2:'||coalesce(eq->>'weapon','') and quantity=1
    and gear->>'kind' in('association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff') limit 1;
  select gear into h from private.market_assets
  where user_id=p_user and item_id='equipment_v2:'||coalesce(eq->>'helmet','') and quantity=1
    and gear->>'kind'='expedition_iron_helmet' limit 1;
  select gear into a from private.market_assets
  where user_id=p_user and item_id='equipment_v2:'||coalesce(eq->>'armor','') and quantity=1
    and gear->>'kind'='return_corps_plate_armor' limit 1;
  select gear into g from private.market_assets
  where user_id=p_user and item_id='equipment_v2:'||coalesce(eq->>'gloves','') and quantity=1
    and gear->>'kind'='mining_detail_reinforced_gloves' limit 1;
  select gear into b from private.market_assets
  where user_id=p_user and item_id='equipment_v2:'||coalesce(eq->>'boots','') and quantity=1
    and gear->>'kind'='survey_corps_dust_boots' limit 1;
  select gear into n from private.market_assets
  where user_id=p_user and item_id='equipment_v2:'||coalesce(eq->>'necklace','') and quantity=1
    and gear->>'kind'='association_registration_tag' limit 1;
  select gear into r from private.market_assets
  where user_id=p_user and item_id='equipment_v2:'||coalesce(eq->>'ring','') and quantity=1
    and gear->>'kind'='expedition_merit_ring' limit 1;

  return jsonb_build_object(
    'weapon',case when w is null then null else w->>'id' end,
    'helmet',case when h is null then null else h->>'id' end,
    'armor',case when a is null then null else a->>'id' end,
    'gloves',case when g is null then null else g->>'id' end,
    'boots',case when b is null then null else b->>'id' end,
    'necklace',case when n is null then null else n->>'id' end,
    'ring',case when r is null then null else r->>'id' end
  );
end;$$;
revoke all on function private.server_equipment_snapshot(uuid,jsonb) from public,anon,authenticated;

-- Full V2 stat parity for all nine equipment identities.
create or replace function private.combat_equipment_stats(p_user uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_eq jsonb:=coalesce(p_payload->'expedition'->'equipment','{}'::jsonb);
  v_items jsonb:=coalesce(p_payload->'equipmentItems','[]'::jsonb);
  v_item jsonb;v_mult numeric;
  v_kind text:='sword';
  v_attack numeric:=8;v_def numeric:=3;v_hp numeric:=180;v_crit numeric:=0.05;
  v_seal_level integer:=0;v_seal_bonus jsonb;
begin
  select i into v_item from jsonb_array_elements(v_items)i where i->>'id'=v_eq->>'weapon' limit 1;
  if v_item is not null then
    v_mult:=private.v2_equipment_multiplier(v_item);
    if v_item->>'kind'='association_supply_iron_sword' then
      v_kind:='sword';v_attack:=v_attack+10*v_mult;v_def:=v_def+4*v_mult;
    elsif v_item->>'kind'='outer_guard_longbow' then
      v_kind:='bow';v_attack:=v_attack+12*v_mult;v_def:=v_def+1*v_mult;
    elsif v_item->>'kind'='archive_standard_arcane_staff' then
      v_kind:='staff';v_attack:=v_attack+6*v_mult;
    end if;
  else
    -- Preserve the client fallback when the weapon slot is intentionally empty.
    v_attack:=v_attack+10*0.4;
    v_def:=v_def+4*0.4;
  end if;

  select i into v_item from jsonb_array_elements(v_items)i where i->>'id'=v_eq->>'helmet' and i->>'kind'='expedition_iron_helmet' limit 1;
  if v_item is not null then v_mult:=private.v2_equipment_multiplier(v_item);v_hp:=v_hp+20*v_mult;v_def:=v_def+5*v_mult;end if;

  select i into v_item from jsonb_array_elements(v_items)i where i->>'id'=v_eq->>'armor' and i->>'kind'='return_corps_plate_armor' limit 1;
  if v_item is not null then v_mult:=private.v2_equipment_multiplier(v_item);v_hp:=v_hp+55*v_mult;v_def:=v_def+7*v_mult;end if;

  select i into v_item from jsonb_array_elements(v_items)i where i->>'id'=v_eq->>'gloves' and i->>'kind'='mining_detail_reinforced_gloves' limit 1;
  if v_item is not null then v_mult:=private.v2_equipment_multiplier(v_item);v_attack:=v_attack+3*v_mult;v_def:=v_def+2*v_mult;end if;

  select i into v_item from jsonb_array_elements(v_items)i where i->>'id'=v_eq->>'boots' and i->>'kind'='survey_corps_dust_boots' limit 1;
  if v_item is not null then v_mult:=private.v2_equipment_multiplier(v_item);v_hp:=v_hp+15*v_mult;v_def:=v_def+3*v_mult;end if;

  select i into v_item from jsonb_array_elements(v_items)i where i->>'id'=v_eq->>'necklace' and i->>'kind'='association_registration_tag' limit 1;
  if v_item is not null then v_mult:=private.v2_equipment_multiplier(v_item);v_attack:=v_attack+2*v_mult;v_hp:=v_hp+25*v_mult;end if;

  select i into v_item from jsonb_array_elements(v_items)i where i->>'id'=v_eq->>'ring' and i->>'kind'='expedition_merit_ring' limit 1;
  if v_item is not null then v_mult:=private.v2_equipment_multiplier(v_item);v_attack:=v_attack+4*v_mult;v_crit:=v_crit+0.03;end if;

  select level into v_seal_level from private.player_association_seals where user_id=p_user;
  v_seal_bonus:=private.association_seal_bonus_json(coalesce(v_seal_level,0));
  v_hp:=v_hp*(1+coalesce((v_seal_bonus->>'hpPercent')::numeric,0)/100);
  v_attack:=v_attack*(1+coalesce((v_seal_bonus->>'attackPercent')::numeric,0)/100);
  v_def:=v_def*(1+coalesce((v_seal_bonus->>'defensePercent')::numeric,0)/100);

  return jsonb_build_object(
    'attack',v_attack,'defense',v_def,'hp',round(v_hp),'weapon',v_kind,'critChance',v_crit
  );
end;$$;
revoke all on function private.combat_equipment_stats(uuid,jsonb) from public,anon,authenticated;

-- Enforce V2 crit chance on encounter creation/update without rewriting the large encounter state machine.
create or replace function private.enforce_v2_combat_crit()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_run private.online_expeditions%rowtype;
  v_save public.game_saves%rowtype;
  v_payload jsonb;
  v_stats jsonb;
begin
  select * into v_run from private.online_expeditions where user_id=new.user_id;
  select * into v_save from public.game_saves where user_id=new.user_id;
  if v_run.user_id is null or v_save.user_id is null then return new;end if;
  v_payload:=private.server_authoritative_payload(new.user_id,v_save.payload);
  v_payload:=jsonb_set(v_payload,'{expedition,equipment}',coalesce(v_run.equipment_snapshot,'{}'::jsonb),true);
  v_stats:=private.combat_equipment_stats(new.user_id,v_payload);
  new.crit_chance:=coalesce((v_stats->>'critChance')::numeric,0.05);
  return new;
end;$$;
revoke all on function private.enforce_v2_combat_crit() from public,anon,authenticated;

drop trigger if exists enforce_v2_combat_crit_trigger on private.online_combat_states;
create trigger enforce_v2_combat_crit_trigger
before insert or update of run_id,encounter_index on private.online_combat_states
for each row execute function private.enforce_v2_combat_crit();

-- Equipment crafting is permanently retired. Alchemy keeps the existing queue/material behavior.
create or replace function public.start_online_craft(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
  p_job_id text,p_kind text,p_tier integer,p_quantity integer
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid;v_save public.game_saves%rowtype;v_mastery jsonb;
  v_unlocked integer;v_crafts integer;v_cost bigint;v_discount numeric;v_premium numeric:=0;
  v_golden_expires bigint;v_outstanding integer;v_queued integer;v_ready timestamptz;v_status text;
  v_asset private.market_assets%rowtype;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.sync_market_economy_from_latest_save(v_user);
  select * into v_save from public.game_saves where user_id=v_user for update;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
  if jsonb_typeof(v_save.payload->'expedition') is distinct from 'null' then raise exception 'CRAFT_EXPEDITION_BLOCKED';end if;

  if p_kind in('sword','dagger','bow','staff','armor','boots','vampire','unyielding','berserker') then
    raise exception 'CRAFT_EQUIPMENT_REMOVED';
  end if;
  if p_job_id!~'^craft-[0-9]+$'
     or p_kind not in('healing_lesser','healing_standard','healing_greater','healing_supreme')
     or p_quantity<>10 then raise exception 'CRAFT_INPUT_INVALID';end if;
  if (p_kind='healing_lesser' and p_tier<>1)
     or (p_kind='healing_standard' and p_tier<>2)
     or (p_kind='healing_greater' and p_tier<>3)
     or (p_kind='healing_supreme' and p_tier<>4) then raise exception 'CRAFT_INPUT_INVALID';end if;

  v_mastery:=v_save.payload->'mastery'->'alchemy';
  begin v_unlocked:=(v_mastery->>'unlocked')::integer;v_crafts:=(v_mastery->>'crafts')::integer;
  exception when others then raise exception 'CRAFT_MASTERY_INVALID';end;
  if p_tier>v_unlocked then raise exception 'CRAFT_TIER_LOCKED';end if;
  if exists(select 1 from private.online_craft_jobs where user_id=v_user and job_id=p_job_id) then raise exception 'CRAFT_JOB_EXISTS';end if;

  begin v_golden_expires:=(v_save.payload->'goldenRecorder'->>'expiresAt')::bigint;exception when others then v_golden_expires:=null;end;
  if v_golden_expires is not null and v_golden_expires>(extract(epoch from now())*1000)::bigint then v_premium:=0.02;end if;
  v_discount:=least(0.30,greatest(0,v_crafts)*0.02);
  v_cost:=greatest(1,ceil(6*p_tier*(1-v_discount-v_premium))::bigint);

  select count(*) into v_outstanding from private.online_craft_jobs where user_id=v_user and status in('ACTIVE','QUEUED');
  select count(*) into v_queued from private.online_craft_jobs where user_id=v_user and status='QUEUED';
  if v_outstanding>0 and v_premium=0 then raise exception 'CRAFT_BUSY';end if;
  if v_premium>0 and v_queued>=3 then raise exception 'CRAFT_QUEUE_FULL';end if;

  select * into v_asset from private.market_assets
  where user_id=v_user and item_id='material:kaleon:'||p_tier::text for update;
  if not found or v_asset.quantity<v_cost then raise exception 'CRAFT_MATERIAL_SHORTAGE';end if;
  if v_asset.quantity=v_cost then delete from private.market_assets where user_id=v_user and item_id=v_asset.item_id;
  else update private.market_assets set quantity=quantity-v_cost,updated_at=now() where user_id=v_user and item_id=v_asset.item_id;end if;

  select greatest(now(),coalesce(max(ready_at),now()))+interval '30 seconds' into v_ready
  from private.online_craft_jobs where user_id=v_user and status in('ACTIVE','QUEUED');
  v_status:=case when v_outstanding=0 then 'ACTIVE' else 'QUEUED' end;

  insert into private.online_craft_jobs(
    user_id,job_id,kind,tier,quantity,field,material_tower,material_cost,status,queued_at,ready_at
  ) values(
    v_user,p_job_id,p_kind,p_tier,p_quantity,'alchemy','kaleon',v_cost,v_status,now(),v_ready
  );

  perform private.persist_market_economy_to_save(v_user);
  return jsonb_build_object(
    'jobId',p_job_id,'materialCost',v_cost,'readyAt',extract(epoch from v_ready)*1000,
    'record',private.cloud_record_json(v_user)
  );
end;$$;
revoke all on function public.start_online_craft(uuid,bigint,text,text,text,text,integer,integer) from public,anon;
grant execute on function public.start_online_craft(uuid,bigint,text,text,text,text,integer,integer) to authenticated;
