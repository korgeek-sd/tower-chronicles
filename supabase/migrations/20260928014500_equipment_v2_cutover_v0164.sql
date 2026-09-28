-- v0.1.64: one-way cutover from legacy tier gear to V2 drop equipment.
-- Preserve currencies/progression and already-owned equipment_v2 assets.

-- Ensure every saved account has an authoritative wallet before refunds.
insert into private.player_wallets(user_id,silver,gold,last_synced_revision,updated_at)
select g.user_id,
       greatest(0,coalesce((g.payload->>'silver')::bigint,0)),
       greatest(0,coalesce((g.payload->'market'->>'gold')::bigint,0)),
       g.revision,
       now()
from public.game_saves g
on conflict(user_id) do nothing;

-- Return Silver reserved by open legacy BUY orders.
with refunds as (
  select user_id,coalesce(sum(remaining_quantity*limit_price),0)::bigint amount
  from private.market_orders
  where item_id like 'gear:%' and side='BUY' and status in ('OPEN','PARTIAL')
  group by user_id
)
update private.player_wallets w
set silver=w.silver+r.amount,updated_at=now()
from refunds r
where w.user_id=r.user_id and r.amount>0;

-- Return unclaimed Silver proceeds from legacy SELL storage rows.
with refunds as (
  select user_id,coalesce(sum(silver),0)::bigint amount
  from private.market_storage
  where item_id like 'gear:%' and side='SELL'
  group by user_id
)
update private.player_wallets w
set silver=w.silver+r.amount,updated_at=now()
from refunds r
where w.user_id=r.user_id and r.amount>0;

-- Return materials consumed by unfinished legacy equipment crafting.
insert into private.market_assets(user_id,item_id,quantity,updated_at)
select user_id,'material:'||material_tower||':'||tier::text,sum(material_cost)::bigint,now()
from private.online_craft_jobs
where field<>'alchemy' and status in ('ACTIVE','QUEUED')
group by user_id,material_tower,tier
on conflict(user_id,item_id) do update
set quantity=private.market_assets.quantity+excluded.quantity,updated_at=now();

-- Remove every legacy equipment entry point. Historical trades may remain as history.
delete from private.market_orders where item_id like 'gear:%';
delete from private.market_storage where item_id like 'gear:%';
delete from private.market_assets where item_id like 'gear:%';
delete from private.online_craft_jobs where field<>'alchemy';

-- Give every saved account one deterministic V2 starter sword.
insert into private.market_assets(user_id,item_id,quantity,gear,updated_at)
select g.user_id,'equipment_v2:starter-v2',1,
       jsonb_build_object(
         'id','starter-v2',
         'kind','association_supply_iron_sword',
         'grade','common',
         'enhancement',0
       ),
       now()
from public.game_saves g
on conflict(user_id,item_id) do update
set quantity=1,gear=excluded.gear,updated_at=now();

-- Keep a pre-cutover cloud revision.
insert into public.game_save_versions(
 user_id,revision,save_schema,app_version,payload,payload_hash,device_id,created_at
)
select user_id,revision,save_schema,app_version,payload,payload_hash,device_id,updated_at
from public.game_saves
on conflict on constraint game_save_versions_user_id_revision_key do nothing;

-- Rewrite cloud saves to schema 23. Existing V2 drops are preserved from server assets.
with prepared as (
 select
  g.user_id,
  jsonb_build_object(
    'weapon','starter-v2',
    'helmet',null,
    'armor',null,
    'gloves',null,
    'boots',null,
    'necklace',null,
    'ring',null
  ) as loadout,
  coalesce((
    select jsonb_agg(a.gear order by a.item_id)
    from private.market_assets a
    where a.user_id=g.user_id
      and a.item_id like 'equipment_v2:%'
      and a.quantity=1
      and a.gear is not null
  ),'[]'::jsonb) as equipment_items
 from public.game_saves g
),
rewritten as (
 select
  g.user_id,
  p.loadout,
  jsonb_set(
   jsonb_set(
    jsonb_set(
     jsonb_set(
      jsonb_set(
       jsonb_set(
        jsonb_set(
         g.payload,
         '{version}',to_jsonb(23),true
        ),
        '{items}','[]'::jsonb,true
       ),
       '{equipmentItems}',p.equipment_items,true
      ),
      '{equipped}',p.loadout,true
     ),
     '{market,orders}',
     coalesce((
       select jsonb_agg(value order by ord)
       from jsonb_array_elements(coalesce(g.payload->'market'->'orders','[]'::jsonb)) with ordinality e(value,ord)
       where coalesce(value->>'itemId','') not like 'gear:%'
     ),'[]'::jsonb),true
    ),
    '{market,storage}',
    coalesce((
      select jsonb_agg(value order by ord)
      from jsonb_array_elements(coalesce(g.payload->'market'->'storage','[]'::jsonb)) with ordinality e(value,ord)
      where coalesce(value->>'itemId','') not like 'gear:%'
    ),'[]'::jsonb),true
   ),
   '{crafting,jobs}',
   coalesce((
     select jsonb_agg(value order by ord)
     from jsonb_array_elements(coalesce(g.payload->'crafting'->'jobs','[]'::jsonb)) with ordinality e(value,ord)
     where value->>'field'='alchemy'
   ),'[]'::jsonb),true
  ) as payload
 from public.game_saves g
 join prepared p on p.user_id=g.user_id
),
with_presets as (
 select
  r.user_id,
  r.loadout,
  jsonb_set(
    r.payload,
    '{expeditionPresets}',
    coalesce((
      select jsonb_agg(
        case when value='null'::jsonb then value
             else jsonb_set(value,'{equipment}',r.loadout,true)
        end
        order by ord
      )
      from jsonb_array_elements(coalesce(r.payload->'expeditionPresets','[]'::jsonb)) with ordinality p(value,ord)
    ),'[]'::jsonb),
    true
  ) as payload
 from rewritten r
),
final_payload as (
 select
  w.user_id,
  case
    when jsonb_typeof(w.payload->'expedition')='object'
      then jsonb_set(w.payload,'{expedition,equipment}',w.loadout,true)
    else w.payload
  end as payload
 from with_presets w
)
update public.game_saves g
set revision=g.revision+1,
    save_schema=23,
    app_version='0.1.64',
    payload=f.payload,
    payload_hash=encode(
      extensions.digest(convert_to(private.stable_json_string(f.payload),'UTF8'),'sha256'),
      'hex'
    ),
    updated_at=now()
from final_payload f
where g.user_id=f.user_id;

-- Active runs retain temporary loot and current combat state, but subsequent encounters use the V2 starter snapshot.
update private.online_expeditions
set equipment_snapshot=jsonb_build_object(
  'weapon','starter-v2',
  'helmet',null,
  'armor',null,
  'gloves',null,
  'boots',null,
  'necklace',null,
  'ring',null,
  'accessory',null
)
where status='ACTIVE';

update private.player_wallets w
set last_synced_revision=g.revision,updated_at=now()
from public.game_saves g
where g.user_id=w.user_id;

-- Never import legacy gear from client save payloads again.
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
  from public.game_saves
  where user_id=p_user;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED'; end if;

  select last_synced_revision into v_last
  from private.player_wallets
  where user_id=p_user;

  if found then
    if v_last>=v_revision then return v_revision; end if;
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
    v_revision,
    now()
  );

  insert into private.market_assets(user_id,item_id,quantity)
  select p_user,'material:'||m.key||':'||q.ord::text,(q.value#>>'{}')::bigint
  from jsonb_each(coalesce(v_payload->'materials','{}'::jsonb)) m
  cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord)
  where (q.value#>>'{}')::bigint>0
  on conflict(user_id,item_id) do nothing;

  insert into private.market_assets(user_id,item_id,quantity)
  select p_user,'ticket:'||m.key||':'||q.ord::text,(q.value#>>'{}')::bigint
  from jsonb_each(coalesce(v_payload->'tickets','{}'::jsonb)) m
  cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord)
  where (q.value#>>'{}')::bigint>0
  on conflict(user_id,item_id) do nothing;

  insert into private.market_assets(user_id,item_id,quantity)
  select p_user,'skillbook:'||kv.key,(kv.value)::bigint
  from jsonb_each_text(coalesce(v_payload->'skillBooks','{}'::jsonb)) kv
  where (kv.value)::bigint>0
  on conflict(user_id,item_id) do nothing;

  insert into private.market_assets(user_id,item_id,quantity)
  select p_user,'other:'||kv.key,(kv.value)::bigint
  from jsonb_each_text(coalesce(v_payload->'lootItems','{}'::jsonb)) kv
  where (kv.value)::bigint>0
  on conflict(user_id,item_id) do nothing;

  return v_revision;
end $$;
revoke all on function private.sync_market_economy_from_latest_save(uuid) from public,anon,authenticated;

-- Server payloads no longer expose legacy gear.
create or replace function private.server_economy_payload(p_user uuid,p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
 v_wallet private.player_wallets%rowtype;
 v_payload jsonb:=p_payload;
 v_materials jsonb;v_tickets jsonb;v_skillbooks jsonb;v_loot_items jsonb;v_equipment_items jsonb;
begin
 select * into v_wallet from private.player_wallets where user_id=p_user;
 if not found then return p_payload;end if;
 select coalesce(jsonb_object_agg(x.tower,x.values),'{}'::jsonb) into v_materials from (
  select m.key tower,jsonb_agg(to_jsonb(coalesce(a.quantity,0)) order by q.ord) values
  from jsonb_each(coalesce(p_payload->'materials','{}'::jsonb)) m
  cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord)
  left join private.market_assets a on a.user_id=p_user and a.item_id='material:'||m.key||':'||q.ord::text group by m.key
 )x;
 select coalesce(jsonb_object_agg(x.tower,x.values),'{}'::jsonb) into v_tickets from (
  select m.key tower,jsonb_agg(to_jsonb(coalesce(a.quantity,0)) order by q.ord) values
  from jsonb_each(coalesce(p_payload->'tickets','{}'::jsonb)) m
  cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord)
  left join private.market_assets a on a.user_id=p_user and a.item_id='ticket:'||m.key||':'||q.ord::text group by m.key
 )x;
 select coalesce(jsonb_object_agg(substr(item_id,11),quantity),'{}'::jsonb) into v_skillbooks
 from private.market_assets where user_id=p_user and item_id like 'skillbook:%' and quantity>0;
 select coalesce(jsonb_object_agg(substr(item_id,7),quantity),'{}'::jsonb) into v_loot_items
 from private.market_assets where user_id=p_user and item_id like 'other:%' and quantity>0;
 select coalesce(jsonb_agg(gear order by item_id),'[]'::jsonb) into v_equipment_items
 from private.market_assets where user_id=p_user and item_id like 'equipment_v2:%' and quantity=1 and gear is not null;
 v_payload:=jsonb_set(v_payload,'{version}',to_jsonb(23),true);
 v_payload:=jsonb_set(v_payload,'{silver}',to_jsonb(v_wallet.silver),true);
 v_payload:=jsonb_set(v_payload,'{market,gold}',to_jsonb(v_wallet.gold),true);
 v_payload:=jsonb_set(v_payload,'{materials}',v_materials,true);
 v_payload:=jsonb_set(v_payload,'{tickets}',v_tickets,true);
 v_payload:=jsonb_set(v_payload,'{skillBooks}',v_skillbooks,true);
 v_payload:=jsonb_set(v_payload,'{lootItems}',v_loot_items,true);
 v_payload:=jsonb_set(v_payload,'{items}','[]'::jsonb,true);
 v_payload:=jsonb_set(v_payload,'{equipmentItems}',v_equipment_items,true);
 return v_payload;
end $$;
revoke all on function private.server_economy_payload(uuid,jsonb) from public,anon,authenticated;

-- Equipment crafting is retired; potion crafting remains.
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

  if p_kind not in ('healing_lesser','healing_standard','healing_greater','healing_supreme') then
    raise exception 'EQUIPMENT_CRAFTING_REMOVED';
  end if;
  if p_job_id!~'^craft-[0-9]+$' or p_tier<1 or p_tier>4 or p_quantity<>10 then raise exception 'CRAFT_INPUT_INVALID';end if;
  if (p_kind='healing_lesser' and p_tier<>1)
     or (p_kind='healing_standard' and p_tier<>2)
     or (p_kind='healing_greater' and p_tier<>3)
     or (p_kind='healing_supreme' and p_tier<>4) then raise exception 'CRAFT_INPUT_INVALID';end if;
  if exists(select 1 from private.online_craft_jobs where user_id=v_user and job_id=p_job_id) then raise exception 'CRAFT_JOB_EXISTS';end if;

  v_mastery:=v_save.payload->'mastery'->'alchemy';
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
  where user_id=v_user and item_id='material:kaleon:'||p_tier::text for update;
  if not found or v_asset.quantity<v_cost then raise exception 'CRAFT_MATERIAL_SHORTAGE';end if;
  if v_asset.quantity=v_cost then delete from private.market_assets where user_id=v_user and item_id=v_asset.item_id;
  else update private.market_assets set quantity=quantity-v_cost,updated_at=now() where user_id=v_user and item_id=v_asset.item_id;end if;

  select greatest(now(),coalesce(max(ready_at),now()))+interval '30 seconds' into v_ready
  from private.online_craft_jobs where user_id=v_user and status in ('ACTIVE','QUEUED');
  v_status:=case when v_outstanding=0 then 'ACTIVE' else 'QUEUED' end;

  insert into private.online_craft_jobs(
    user_id,job_id,kind,tier,quantity,field,material_tower,material_cost,status,queued_at,ready_at
  )
  values(v_user,p_job_id,p_kind,p_tier,p_quantity,'alchemy','kaleon',v_cost,v_status,now(),v_ready);

  perform private.persist_market_economy_to_save(v_user);
  return jsonb_build_object('jobId',p_job_id,'materialCost',v_cost,'readyAt',extract(epoch from v_ready)*1000,'record',private.cloud_record_json(v_user));
end $$;
revoke all on function public.start_online_craft(uuid,bigint,text,text,text,text,integer,integer) from public,anon;
grant execute on function public.start_online_craft(uuid,bigint,text,text,text,text,integer,integer) to authenticated;

-- Keep market persistence on the new save/app version.
create or replace function private.persist_market_economy_to_save(p_user uuid)
returns bigint
language plpgsql security definer set search_path=''
as $$
declare
  v_current public.game_saves%rowtype;
  v_payload jsonb;
  v_hash text;
  v_revision bigint;
begin
 select * into v_current from public.game_saves where user_id=p_user for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED'; end if;
 v_payload:=private.server_economy_payload(p_user,v_current.payload);
 v_hash:=encode(extensions.digest(convert_to(private.stable_json_string(v_payload),'UTF8'),'sha256'),'hex');
 insert into public.game_save_versions(user_id,revision,save_schema,app_version,payload,payload_hash,device_id,created_at)
 values(v_current.user_id,v_current.revision,v_current.save_schema,v_current.app_version,v_current.payload,v_current.payload_hash,v_current.device_id,v_current.updated_at)
 on conflict on constraint game_save_versions_user_id_revision_key do nothing;
 v_revision:=v_current.revision+1;
 update public.game_saves
 set revision=v_revision,save_schema=23,app_version='0.1.64',payload=v_payload,payload_hash=v_hash,updated_at=now()
 where user_id=p_user;
 update private.player_wallets
 set last_synced_revision=v_revision,updated_at=now()
 where user_id=p_user;
 return v_revision;
end $$;
revoke all on function private.persist_market_economy_to_save(uuid) from public,anon,authenticated;


-- Final V2 combat stats: all seven slots use the same deterministic base * grade * enhancement rule as the client.
create or replace function private.combat_equipment_stats(p_user uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_eq jsonb:=coalesce(p_payload->'expedition'->'equipment','{}'::jsonb);
  v_modern jsonb:=coalesce(p_payload->'equipmentItems','[]'::jsonb);
  v_weapon jsonb;v_helmet jsonb;v_armor jsonb;v_gloves jsonb;v_boots jsonb;v_necklace jsonb;v_ring jsonb;
  v_kind text:='sword';v_mult numeric:=1;
  v_attack numeric:=8;v_def numeric:=3;v_hp numeric:=180;v_crit numeric:=.05;
  v_seal_level integer:=0;v_seal_bonus jsonb;
begin
  select i into v_weapon from jsonb_array_elements(v_modern)i
   where i->>'id'=v_eq->>'weapon'
     and i->>'kind' in('association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff') limit 1;
  select i into v_helmet from jsonb_array_elements(v_modern)i
   where i->>'id'=v_eq->>'helmet' and i->>'kind'='expedition_iron_helmet' limit 1;
  select i into v_armor from jsonb_array_elements(v_modern)i
   where i->>'id'=v_eq->>'armor' and i->>'kind'='return_corps_plate_armor' limit 1;
  select i into v_gloves from jsonb_array_elements(v_modern)i
   where i->>'id'=v_eq->>'gloves' and i->>'kind'='mining_detail_reinforced_gloves' limit 1;
  select i into v_boots from jsonb_array_elements(v_modern)i
   where i->>'id'=v_eq->>'boots' and i->>'kind'='survey_corps_dust_boots' limit 1;
  select i into v_necklace from jsonb_array_elements(v_modern)i
   where i->>'id'=v_eq->>'necklace' and i->>'kind'='association_registration_tag' limit 1;
  select i into v_ring from jsonb_array_elements(v_modern)i
   where i->>'id'=v_eq->>'ring' and i->>'kind'='expedition_merit_ring' limit 1;

  if v_weapon is not null then
    v_kind:=case v_weapon->>'kind'
      when 'outer_guard_longbow' then 'bow'
      when 'archive_standard_arcane_staff' then 'staff'
      else 'sword'
    end;
    v_mult:=private.v2_equipment_multiplier(v_weapon);
    v_attack:=v_attack+(case v_kind when 'bow' then 12 when 'staff' then 6 else 10 end)*v_mult;
    v_def:=v_def+(case v_kind when 'bow' then 1 when 'sword' then 4 else 0 end)*v_mult;
  else
    -- Client bare-hand fallback retains 40% of the sword identity.
    v_attack:=v_attack+10*.4;
    v_def:=v_def+4*.4;
  end if;

  if v_helmet is not null then
    v_mult:=private.v2_equipment_multiplier(v_helmet);
    v_hp:=v_hp+20*v_mult;v_def:=v_def+5*v_mult;
  end if;
  if v_armor is not null then
    v_mult:=private.v2_equipment_multiplier(v_armor);
    v_hp:=v_hp+55*v_mult;v_def:=v_def+7*v_mult;
  end if;
  if v_gloves is not null then
    v_mult:=private.v2_equipment_multiplier(v_gloves);
    v_attack:=v_attack+3*v_mult;v_def:=v_def+2*v_mult;
  end if;
  if v_boots is not null then
    v_mult:=private.v2_equipment_multiplier(v_boots);
    v_hp:=v_hp+15*v_mult;v_def:=v_def+3*v_mult;
  end if;
  if v_necklace is not null then
    v_mult:=private.v2_equipment_multiplier(v_necklace);
    v_attack:=v_attack+2*v_mult;v_hp:=v_hp+25*v_mult;
  end if;
  if v_ring is not null then
    v_mult:=private.v2_equipment_multiplier(v_ring);
    v_attack:=v_attack+4*v_mult;
    v_crit:=v_crit+.03;
  end if;

  select level into v_seal_level from private.player_association_seals where user_id=p_user;
  v_seal_bonus:=private.association_seal_bonus_json(coalesce(v_seal_level,0));
  v_hp:=v_hp*(1+coalesce((v_seal_bonus->>'hpPercent')::numeric,0)/100);
  v_attack:=v_attack*(1+coalesce((v_seal_bonus->>'attackPercent')::numeric,0)/100);
  v_def:=v_def*(1+coalesce((v_seal_bonus->>'defensePercent')::numeric,0)/100);

  return jsonb_build_object(
    'attack',v_attack,'defense',v_def,'hp',round(v_hp),'weapon',v_kind,'critChance',v_crit
  );
end $$;
revoke all on function private.combat_equipment_stats(uuid,jsonb) from public,anon,authenticated;

create or replace function private.server_start_encounter(
 p_user uuid,p_run private.online_expeditions,p_profile jsonb,p_prior private.online_combat_states
) returns private.online_combat_states
language plpgsql security definer set search_path=''
as $$
declare
 s public.game_saves%rowtype;combat_payload jsonb;st jsonb;passive jsonb;j text;c private.online_combat_states%rowtype;
 hp bigint;mh bigint;ma numeric;md numeric;weapon text;crit numeric;hits int;
 pe jsonb:='[]'::jsonb;me jsonb:='[]'::jsonb;nextcd jsonb:='{}'::jsonb;statev bigint:=1;
begin
 select * into s from public.game_saves where user_id=p_user;if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 combat_payload:=private.server_authoritative_payload(p_user,s.payload);
 combat_payload:=jsonb_set(combat_payload,'{expedition,equipment}',coalesce(p_run.equipment_snapshot,'{}'::jsonb),true);
 combat_payload:=jsonb_set(combat_payload,'{currentJobId}',
   case when p_run.job_snapshot_id is null then 'null'::jsonb else to_jsonb(p_run.job_snapshot_id) end,true);
 st:=private.combat_equipment_stats(p_user,combat_payload);
 passive:=private.combat_accessory_passive(combat_payload);
 j:=case when p_run.job_snapshot_id in('contract_mercenary','hunter','field_medic','duelist','berserker') then p_run.job_snapshot_id else null end;

 if p_prior.user_id is not null then
   pe:=(select coalesce(jsonb_agg(e),'[]'::jsonb) from jsonb_array_elements(coalesce(p_prior.player_effects,'[]'::jsonb))e where e->>'scope'='EXPEDITION');
   select coalesce(jsonb_object_agg(key,to_jsonb(greatest(0,(value#>>'{}')::int-1))),'{}'::jsonb)
   into nextcd from jsonb_each(coalesce(p_prior.cooldowns,'{}'::jsonb));
   statev:=p_prior.state_version+1;
 end if;
 hp:=least((st->>'hp')::bigint,greatest(1,coalesce(p_prior.player_hp,(st->>'hp')::bigint)));
 mh:=round(private.server_monster_hp(p_run.floor)*(p_profile->>'hpMultiplier')::numeric);
 ma:=private.server_monster_attack(p_run.floor)*(p_profile->>'attackMultiplier')::numeric;
 md:=private.server_monster_defense(p_run.floor)+coalesce((p_profile->>'defenseBonus')::numeric,0);
 weapon:=st->>'weapon';crit:=coalesce((st->>'critChance')::numeric,.05);hits:=case when weapon='bow' then 2 else 1 end;
 me:=private.server_initial_monster_effects(p_profile->>'id',coalesce(p_prior.monster_turn,0));

 insert into private.online_combat_states(
   user_id,run_id,encounter_index,monster_id,player_hp,player_max_hp,player_attack,player_defense,
   monster_hp,monster_max_hp,monster_attack,monster_defense,turn_no,phase,action_nonce,
   potion_lesser,potion_standard,potion_greater,potion_supreme,cooldowns,rng_seed,crit_chance,crit_damage,basic_hits,
   skill_power,guard_turns,revival_count,pending_revival,accessory_passive,accessory_value,
   player_effects,monster_effects,player_shield,monster_shield,monster_cooldowns,monster_prepared_action,
   job_id,job_resource,job_flags,state_version,player_turn,monster_turn,player_shield_hits,monster_shield_hits,
   monster_reactive_action,return_authorized,updated_at
 ) values(
   p_user,p_run.run_id,p_run.encounter_index,p_profile->>'id',hp,(st->>'hp')::bigint,(st->>'attack')::numeric,(st->>'defense')::numeric,
   mh,mh,ma,md,1,'PLAYER_TURN',0,
   coalesce(p_run.potion_lesser,0),coalesce(p_run.potion_standard,0),coalesce(p_run.potion_greater,0),coalesce(p_run.potion_supreme,0),
   nextcd,p_run.reward_seed,crit,1.5,hits,private.combat_skill_power(combat_payload),0,coalesce(p_run.revival_count,0),false,
   passive->>'kind',coalesce((passive->>'value')::numeric,0),
   pe,me,0,0,'{}'::jsonb,null,j,case when j='berserker' then coalesce(p_prior.job_resource,0) else 0 end,
   coalesce(p_prior.job_flags,'{}'::jsonb),statev,coalesce(p_prior.player_turn,0)+1,coalesce(p_prior.monster_turn,0),0,0,null,false,now()
 )
 on conflict(user_id) do update set
   run_id=excluded.run_id,encounter_index=excluded.encounter_index,monster_id=excluded.monster_id,
   player_hp=excluded.player_hp,player_max_hp=excluded.player_max_hp,player_attack=excluded.player_attack,player_defense=excluded.player_defense,
   monster_hp=excluded.monster_hp,monster_max_hp=excluded.monster_max_hp,monster_attack=excluded.monster_attack,monster_defense=excluded.monster_defense,
   turn_no=1,phase='PLAYER_TURN',action_nonce=0,potion_lesser=excluded.potion_lesser,potion_standard=excluded.potion_standard,
   potion_greater=excluded.potion_greater,potion_supreme=excluded.potion_supreme,cooldowns=excluded.cooldowns,rng_seed=excluded.rng_seed,
   crit_chance=excluded.crit_chance,crit_damage=excluded.crit_damage,basic_hits=excluded.basic_hits,skill_power=excluded.skill_power,
   guard_turns=0,revival_count=excluded.revival_count,pending_revival=false,accessory_passive=excluded.accessory_passive,
   accessory_value=excluded.accessory_value,player_effects=excluded.player_effects,monster_effects=excluded.monster_effects,
   player_shield=0,monster_shield=0,monster_cooldowns='{}'::jsonb,monster_prepared_action=null,job_id=excluded.job_id,
   job_resource=excluded.job_resource,job_flags=excluded.job_flags,state_version=excluded.state_version,
   player_turn=excluded.player_turn,monster_turn=excluded.monster_turn,player_shield_hits=0,monster_shield_hits=0,
   monster_reactive_action=null,return_authorized=false,updated_at=now()
 returning * into c;

 if c.monster_id='sanctuary_talon_bishop' then c:=private.sync_server_shield(c,'monster','blood_rite_ward');end if;
 update private.online_combat_states set
   monster_shield=c.monster_shield,monster_shield_hits=c.monster_shield_hits,monster_effects=c.monster_effects
 where user_id=p_user returning * into c;
 return c;
end $$;
revoke all on function private.server_start_encounter(uuid,private.online_expeditions,jsonb,private.online_combat_states)
from public,anon,authenticated;
