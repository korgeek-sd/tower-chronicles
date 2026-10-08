-- Fixed equipment catalog: 9 kinds x 5 grades, no enhancement or random options.
create or replace function private.fixed_equipment_stats(p_kind text,p_grade text)
returns jsonb language sql immutable set search_path='' as $$
 select coalesce('{"association_supply_iron_sword":{"common":{"attack":10,"defense":4},"uncommon":{"attack":12,"defense":5},"rare":{"attack":14,"defense":6},"heroic":{"attack":17,"defense":7},"legendary":{"attack":20,"defense":8}},"outer_guard_longbow":{"common":{"attack":12,"critChance":0.02},"uncommon":{"attack":14,"critChance":0.03},"rare":{"attack":17,"critChance":0.04},"heroic":{"attack":20,"critChance":0.05},"legendary":{"attack":24,"critChance":0.06}},"archive_standard_arcane_staff":{"common":{"attack":10,"armorPenetration":0.05},"uncommon":{"attack":12,"armorPenetration":0.07},"rare":{"attack":14,"armorPenetration":0.09},"heroic":{"attack":17,"armorPenetration":0.12},"legendary":{"attack":20,"armorPenetration":0.15}},"expedition_iron_helmet":{"common":{"hp":20,"defense":5},"uncommon":{"hp":25,"defense":6},"rare":{"hp":30,"defense":7},"heroic":{"hp":40,"defense":9},"legendary":{"hp":50,"defense":11}},"return_corps_plate_armor":{"common":{"hp":55,"defense":7},"uncommon":{"hp":65,"defense":9},"rare":{"hp":80,"defense":11},"heroic":{"hp":100,"defense":14},"legendary":{"hp":125,"defense":17}},"mining_detail_reinforced_gloves":{"common":{"attack":3,"critChance":0.01},"uncommon":{"attack":4,"critChance":0.02},"rare":{"attack":5,"critChance":0.03},"heroic":{"attack":6,"critChance":0.04},"legendary":{"attack":8,"critChance":0.05}},"survey_corps_dust_boots":{"common":{"hp":15,"defense":3},"uncommon":{"hp":20,"defense":4},"rare":{"hp":25,"defense":5},"heroic":{"hp":35,"defense":6},"legendary":{"hp":45,"defense":8}},"association_registration_tag":{"common":{"hp":25,"critDamage":0.05},"uncommon":{"hp":30,"critDamage":0.07},"rare":{"hp":40,"critDamage":0.1},"heroic":{"hp":50,"critDamage":0.14},"legendary":{"hp":65,"critDamage":0.2}},"expedition_merit_ring":{"common":{"attack":4,"armorPenetration":0.02},"uncommon":{"attack":5,"armorPenetration":0.03},"rare":{"attack":6,"armorPenetration":0.04},"heroic":{"attack":8,"armorPenetration":0.06},"legendary":{"attack":10,"armorPenetration":0.08}}}'::jsonb->p_kind->p_grade,'{}'::jsonb)
$$;
revoke all on function private.fixed_equipment_stats(text,text) from public,anon,authenticated;
create or replace function private.equipment_market_key(p_gear jsonb)
returns text language sql immutable set search_path='' as $$
 select 'equipment:'||coalesce(p_gear->>'kind','')||':'||coalesce(p_gear->>'grade','')
$$;
revoke all on function private.equipment_market_key(jsonb) from public,anon,authenticated;
create or replace function private.v2_equipment_multiplier(p_item jsonb)
returns numeric language sql immutable set search_path='' as $$select 1::numeric$$;

create or replace function private.combat_equipment_stats(p_user uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 eq jsonb:=coalesce(p_payload->'expedition'->'equipment',p_payload->'equipped','{}');
 i jsonb;b jsonb;slot text;expected text;weapon text:='sword';
 hp numeric:=180;attack numeric:=8;defense numeric:=3;crit numeric:=.05;crit_damage numeric:=1.5;pen numeric:=0;
 seal_level integer:=0;bonus jsonb;
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
 select level into seal_level from private.player_association_seals where user_id=p_user;
 bonus:=private.association_seal_bonus_json(coalesce(seal_level,0));
 hp:=hp*(1+coalesce((bonus->>'hpPercent')::numeric,0)/100);
 attack:=attack*(1+coalesce((bonus->>'attackPercent')::numeric,0)/100);
 defense:=defense*(1+coalesce((bonus->>'defensePercent')::numeric,0)/100);
 return jsonb_build_object('hp',round(hp),'attack',attack,'defense',defense,'critChance',least(1,crit),'critDamage',crit_damage,'armorPenetration',least(1,pen),'weapon',weapon);
end $$;
revoke all on function private.combat_equipment_stats(uuid,jsonb) from public,anon,authenticated;

create or replace function public.enhance_online_equipment(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_item_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 raise exception 'ENHANCEMENT_REMOVED';
end $$;
revoke all on function public.enhance_online_equipment(uuid,bigint,text,text,text) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.place_online_market_order(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_item_id text, p_side text, p_limit_price bigint, p_quantity bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid;
  v_wallet private.player_wallets%rowtype;
  v_asset private.market_assets%rowtype;
  v_incoming private.market_orders%rowtype;
  v_resting private.market_orders%rowtype;
  v_buy private.market_orders%rowtype;
  v_sell private.market_orders%rowtype;
  v_trade_id uuid;
  v_qty bigint;
  v_price bigint;
  v_reserve numeric;
  v_expedition_type text;
  v_gear_id text;
  v_order_item_id text:=p_item_id;
  v_kind text;
  v_grade text;
  v_level integer;
  v_is_v2_sell boolean:=false;
  v_gears jsonb:='[]';
  v_delivery jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform 1 from public.game_saves where user_id=v_user for update;
  perform private.sync_market_economy_from_latest_save(v_user);

  if nullif(p_item_id,'') is null then raise exception 'MARKET_ITEM_REQUIRED'; end if;
  if p_side not in ('BUY','SELL') then raise exception 'MARKET_SIDE_INVALID'; end if;
  if p_limit_price is null or p_limit_price<=0 or p_limit_price>1000000000000 then raise exception 'MARKET_PRICE_INVALID'; end if;
  if p_quantity is null or p_quantity<=0 or p_quantity>1000000 then raise exception 'MARKET_QUANTITY_INVALID'; end if;

  select jsonb_typeof(payload->'expedition') into v_expedition_type
  from public.game_saves where user_id=v_user;
  if coalesce(v_expedition_type,'null')<>'null' then raise exception 'MARKET_EXPEDITION_BLOCKED'; end if;

  if p_item_id like 'equipment_v2:%' then
    if p_side<>'SELL' then raise exception 'EQUIPMENT_ORDER_SELL_INSTANCE_REQUIRED'; end if;
    v_gear_id:=substr(p_item_id,length('equipment_v2:')+1);
    if v_gear_id='starter-v2' then raise exception 'EQUIPMENT_MARKET_STARTER_PROTECTED'; end if;
    if exists(
      select 1 from public.game_saves g,
      lateral jsonb_each_text(coalesce(g.payload->'equipped','{}'::jsonb)) e
      where g.user_id=v_user and e.value=v_gear_id
    ) then raise exception 'EQUIPMENT_MARKET_EQUIPPED'; end if;

    select * into v_asset
    from private.market_assets
    where user_id=v_user and item_id=p_item_id and quantity=1 and gear is not null
    for update;
    if not found then raise exception 'EQUIPMENT_MARKET_ITEM_NOT_FOUND'; end if;

    v_kind:=v_asset.gear->>'kind';
    v_grade:=v_asset.gear->>'grade';
    begin v_level:=coalesce((v_asset.gear->>'enhancement')::integer,0);
    exception when others then raise exception 'EQUIPMENT_MARKET_ITEM_INVALID'; end;

    if v_kind not in(
      'association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff',
      'expedition_iron_helmet','return_corps_plate_armor','mining_detail_reinforced_gloves',
      'survey_corps_dust_boots','association_registration_tag','expedition_merit_ring'
    ) or v_grade not in('common','uncommon','rare','heroic','legendary') or v_level<>0 then
      raise exception 'EQUIPMENT_MARKET_ITEM_INVALID';
    end if;

    v_order_item_id:=private.equipment_market_key(v_asset.gear);
    v_is_v2_sell:=true;
  elsif p_item_id like 'equipment:%' then
    if p_side<>'BUY' then raise exception 'EQUIPMENT_ORDER_SELL_INSTANCE_REQUIRED'; end if;
    v_kind:=split_part(p_item_id,':',2);
    v_grade:=split_part(p_item_id,':',3);
    begin v_level:=0;
    exception when others then raise exception 'EQUIPMENT_MARKET_ITEM_INVALID'; end;
    if p_item_id<>('equipment:'||v_kind||':'||v_grade)
      or v_kind not in(
        'association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff',
        'expedition_iron_helmet','return_corps_plate_armor','mining_detail_reinforced_gloves',
        'survey_corps_dust_boots','association_registration_tag','expedition_merit_ring'
      )
      or v_grade not in('common','uncommon','rare','heroic','legendary')
      or v_level<>0 then
      raise exception 'EQUIPMENT_MARKET_ITEM_INVALID';
    end if;
  elsif p_item_id like 'gear:%' or p_item_id='other:enhancement_stone' then
    raise exception 'EQUIPMENT_RETIRED';
  end if;

  if p_side='SELL' and p_item_id like 'gear:%' then
    v_gear_id:=substr(p_item_id,6);
    if exists(
      select 1 from public.game_saves g,
      lateral jsonb_each_text(coalesce(g.payload->'equipped','{}'::jsonb)) e
      where g.user_id=v_user and e.value=v_gear_id
    ) then raise exception 'GEAR_EQUIPPED'; end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_order_item_id,0));

  if p_side='BUY' then
    v_reserve:=p_limit_price::numeric*p_quantity::numeric;
    if v_reserve>9223372036854775807 then raise exception 'MARKET_TOTAL_INVALID'; end if;
    select * into v_wallet from private.player_wallets where user_id=v_user for update;
    if not found or v_wallet.silver<v_reserve::bigint then raise exception 'INSUFFICIENT_SILVER'; end if;
    update private.player_wallets set silver=silver-v_reserve::bigint,updated_at=now() where user_id=v_user;
  else
    if not v_is_v2_sell then
      select * into v_asset from private.market_assets where user_id=v_user and item_id=p_item_id for update;
      if not found or v_asset.quantity<p_quantity then raise exception 'INSUFFICIENT_MARKET_ASSET'; end if;
      if p_item_id like 'gear:%' and v_asset.gear is null then raise exception 'GEAR_DATA_MISSING'; end if;
    end if;

    if v_is_v2_sell then
      select coalesce(jsonb_agg(a.gear order by a.item_id),'[]') into v_gears from (
        select a.item_id,a.gear from private.market_assets a where a.user_id=v_user and a.item_id like 'equipment_v2:%' and a.quantity=1
        and private.equipment_market_key(a.gear)=v_order_item_id and a.gear->>'id'<>'starter-v2'
        and not exists(select 1 from public.game_saves g,lateral jsonb_each_text(coalesce(g.payload->'equipped','{}')) e where g.user_id=v_user and e.value=a.gear->>'id')
        order by a.item_id limit p_quantity for update
      ) a;
      if jsonb_array_length(v_gears)<>p_quantity then raise exception 'INSUFFICIENT_MARKET_ASSET';end if;
      delete from private.market_assets where user_id=v_user and item_id in(select 'equipment_v2:'||(g->>'id') from jsonb_array_elements(v_gears) g);
    elsif v_asset.quantity=p_quantity then
      delete from private.market_assets where user_id=v_user and item_id=p_item_id;
    else
      update private.market_assets set quantity=quantity-p_quantity,updated_at=now() where user_id=v_user and item_id=p_item_id;
    end if;
  end if;

  insert into private.market_orders(user_id,item_id,side,limit_price,original_quantity,remaining_quantity,status,gear,escrow_gear)
  values(v_user,v_order_item_id,p_side,p_limit_price,p_quantity,p_quantity,'OPEN',case when p_side='SELL' then v_asset.gear else null end,v_gears)
  returning * into v_incoming;

  loop
    exit when v_incoming.remaining_quantity<=0;
    if v_incoming.side='BUY' then
      select * into v_resting from private.market_orders
      where item_id=v_incoming.item_id and side='SELL' and status in ('OPEN','PARTIAL')
        and expires_at>now() and remaining_quantity>0 and limit_price<=v_incoming.limit_price and user_id<>v_user
      order by limit_price asc,created_at asc,order_id asc limit 1 for update;
    else
      select * into v_resting from private.market_orders
      where item_id=v_incoming.item_id and side='BUY' and status in ('OPEN','PARTIAL')
        and expires_at>now() and remaining_quantity>0 and limit_price>=v_incoming.limit_price and user_id<>v_user
      order by limit_price desc,created_at asc,order_id asc limit 1 for update;
    end if;
    exit when not found;

    if v_incoming.side='BUY' then v_buy:=v_incoming;v_sell:=v_resting;
    else v_buy:=v_resting;v_sell:=v_incoming; end if;
    v_qty:=least(v_buy.remaining_quantity,v_sell.remaining_quantity);
    v_price:=v_resting.limit_price;

    insert into private.market_trades(item_id,price,quantity,buy_order_id,sell_order_id,buyer_id,seller_id)
    values(v_incoming.item_id,v_price,v_qty,v_buy.order_id,v_sell.order_id,v_buy.user_id,v_sell.user_id)
    returning trade_id into v_trade_id;

    perform 1 from public.game_saves where user_id=v_resting.user_id for update;
    if v_buy.limit_price>v_price then
      update private.player_wallets set silver=silver+(v_buy.limit_price-v_price)*v_qty,updated_at=now()
      where user_id=v_buy.user_id;
    end if;

    if v_sell.item_id like 'equipment:%' then
      if jsonb_array_length(v_sell.escrow_gear)<v_qty then raise exception 'MARKET_ESCROW_INVALID';end if;
      for v_delivery in select value from jsonb_array_elements(v_sell.escrow_gear) with ordinality g(value,n) where n<=v_qty loop
        perform private.deliver_market_asset(v_buy.user_id,v_buy.item_id,1,v_delivery);
      end loop;
      update private.market_orders set escrow_gear=coalesce((select jsonb_agg(value order by n) from jsonb_array_elements(v_sell.escrow_gear) with ordinality g(value,n) where n>v_qty),'[]') where order_id=v_sell.order_id;
    else perform private.deliver_market_asset(v_buy.user_id,v_buy.item_id,v_qty,v_sell.gear);end if;
    update private.player_wallets set silver=silver+v_price*v_qty,updated_at=now() where user_id=v_sell.user_id;

    update private.market_orders set remaining_quantity=remaining_quantity-v_qty,
      status=case when remaining_quantity-v_qty=0 then 'FILLED' when remaining_quantity-v_qty<original_quantity then 'PARTIAL' else 'OPEN' end,
      updated_at=now() where order_id=v_buy.order_id;
    update private.market_orders set remaining_quantity=remaining_quantity-v_qty,
      status=case when remaining_quantity-v_qty=0 then 'FILLED' when remaining_quantity-v_qty<original_quantity then 'PARTIAL' else 'OPEN' end,
      updated_at=now() where order_id=v_sell.order_id;
    if exists(select 1 from private.market_orders where order_id=v_buy.order_id and status='FILLED') then perform private.market_order_mail(v_buy.order_id,'FILLED');end if;
    if exists(select 1 from private.market_orders where order_id=v_sell.order_id and status='FILLED') then perform private.market_order_mail(v_sell.order_id,'FILLED');end if;
    perform private.persist_market_economy_to_save(v_buy.user_id);
    perform private.persist_market_economy_to_save(v_sell.user_id);
    select * into v_incoming from private.market_orders where order_id=v_incoming.order_id;
  end loop;

  perform private.persist_market_economy_to_save(v_user);
  perform realtime.send(jsonb_build_object('itemId',v_order_item_id),'market_changed','market',true);
  return private.market_state_json(v_user);
end;$function$;

create or replace function public.dismantle_online_equipment(
  p_lease_id uuid,
  p_generation bigint,
  p_client_instance_id text,
  p_device_id text,
  p_item_id text
) returns jsonb
language plpgsql
security definer set search_path=''
as $$
declare
  v_user uuid;
  v_save public.game_saves%rowtype;
  v_asset private.market_assets%rowtype;
  v_grade text;
  v_yield bigint;v_split bigint;
begin
  v_user:=private.village_life_user(
    p_lease_id,p_generation,p_client_instance_id,p_device_id
  );

  if nullif(p_item_id,'') is null then
    raise exception 'DISMANTLE_ITEM_NOT_FOUND';
  end if;
  if p_item_id='starter-v2' then
    raise exception 'DISMANTLE_STARTER_PROTECTED';
  end if;

  select * into v_save
  from public.game_saves
  where user_id=v_user
  for update;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;

  if jsonb_typeof(v_save.payload->'expedition') is distinct from 'null'
     or exists(
       select 1
       from private.online_expeditions e
       where e.user_id=v_user and e.status='ACTIVE'
     ) then
    raise exception 'DISMANTLE_EXPEDITION_BLOCKED';
  end if;

  if exists(
    select 1
    from jsonb_each_text(coalesce(v_save.payload->'equipped','{}'::jsonb)) equipped
    where equipped.value=p_item_id
  ) then
    raise exception 'DISMANTLE_EQUIPPED';
  end if;

  select * into v_asset
  from private.market_assets
  where user_id=v_user
    and item_id='equipment_v2:'||p_item_id
    and quantity=1
    and gear is not null
  for update;
  if not found then raise exception 'DISMANTLE_ITEM_NOT_FOUND';end if;

  v_grade:=v_asset.gear->>'grade';
  v_yield:=case v_grade
    when 'common' then 1
    when 'uncommon' then 2
    when 'rare' then 4
    when 'heroic' then 8
    when 'legendary' then 15
    else 0
  end;
  if v_yield<=0 then raise exception 'DISMANTLE_GRADE_INVALID';end if;

  delete from private.market_assets
  where user_id=v_user
    and item_id='equipment_v2:'||p_item_id;

  perform private.persist_market_economy_to_save(v_user);
  perform private.refresh_village_life(v_user);
  v_split:=v_yield;
  update private.village_life_players set materials=jsonb_set(materials,'{stone}',to_jsonb(coalesce((materials->>'stone')::bigint,0)+v_split),true) where user_id=v_user;

  return jsonb_build_object(
    'itemId',p_item_id,
    'stones',0,'splitStones',v_split,
    'record',private.cloud_record_json(v_user)
  );
end;$$;

revoke all on function public.dismantle_online_equipment(uuid,bigint,text,text,text)
from public,anon;
grant execute on function public.dismantle_online_equipment(uuid,bigint,text,text,text)
to authenticated;



-- User-authorized reset. Refund active equipment bids before deleting old equipment stock.
select pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
lock table public.game_saves,private.market_orders,private.market_assets,private.player_wallets in share row exclusive mode;
do $$declare u uuid;begin for u in select user_id from public.game_saves loop perform private.sync_market_economy_from_latest_save(u);end loop;end $$;
update private.player_wallets w set silver=w.silver+r.silver,updated_at=now()
from (select user_id,sum(limit_price*remaining_quantity)::bigint silver from private.market_orders where side='BUY' and status in ('OPEN','PARTIAL') and (item_id like 'equipment:%' or item_id like 'gear:%' or item_id='other:enhancement_stone') group by user_id) r where w.user_id=r.user_id;
update private.market_orders set status='CANCELLED',remaining_quantity=0,escrow_gear='[]',gear=null,updated_at=now() where status in ('OPEN','PARTIAL') and (item_id like 'equipment:%' or item_id like 'gear:%' or item_id='other:enhancement_stone');
update private.equipment_market_listings set status='CANCELLED',updated_at=now() where status='OPEN';
-- Preserve unclaimed sale proceeds while retiring equipment deliveries.
update private.player_wallets w set silver=w.silver+r.silver,updated_at=now() from (select user_id,sum(silver)::bigint silver from private.market_storage where (item_id like 'equipment:%' or item_id like 'gear:%' or item_id like 'equipment_v2:%') and silver>0 group by user_id) r where w.user_id=r.user_id;
delete from private.market_storage where item_id like 'equipment:%' or item_id like 'gear:%' or item_id like 'equipment_v2:%' or item_id='other:enhancement_stone';
delete from private.market_assets where item_id like 'equipment_v2:%' or item_id like 'gear:%' or item_id='other:enhancement_stone';
update private.game_mail set attachment_gear=null,attachment_item_id=null,attachment_quantity=0 where attachment_gear is not null or attachment_item_id like 'equipment:%' or attachment_item_id like 'equipment_v2:%' or attachment_item_id like 'gear:%' or attachment_item_id='other:enhancement_stone';
update private.game_mail m set attachment_assets=coalesce((select jsonb_agg(a) from jsonb_array_elements(m.attachment_assets) a where coalesce(a->>'itemId','') not like 'equipment%' and coalesce(a->>'itemId','') not like 'gear:%' and coalesce(a->>'itemId','')<>'other:enhancement_stone' and not(a ? 'kind' and a ? 'grade') and (a->'gear' is null or a->'gear'='null'::jsonb)),'[]');
-- Grant one fresh common sword so the reset does not strand players without a viable first hunt.
insert into private.market_assets(user_id,item_id,quantity,gear) select user_id,'equipment_v2:starter-v2',1,'{"id":"starter-v2","kind":"association_supply_iron_sword","grade":"common","enhancement":0}'::jsonb from public.game_saves on conflict(user_id,item_id) do update set gear=excluded.gear,quantity=1;
do $$declare u uuid;p jsonb;loadout jsonb:='{"weapon":"starter-v2","helmet":null,"armor":null,"gloves":null,"boots":null,"necklace":null,"ring":null}';begin
 for u,p in select user_id,payload from public.game_saves loop
  p:=jsonb_set(p,'{equipmentRulesVersion}','1');p:=jsonb_set(p,'{items}','[]');p:=jsonb_set(p,'{equipmentItems}','[{"id":"starter-v2","kind":"association_supply_iron_sword","grade":"common","enhancement":0}]');p:=jsonb_set(p,'{equipped}',loadout);
  if jsonb_typeof(p->'expeditionPresets')='array' then p:=jsonb_set(p,'{expeditionPresets}',(select jsonb_agg(case when e='null'::jsonb then e else jsonb_set(e,'{equipment}',loadout) end order by n) from jsonb_array_elements(p->'expeditionPresets') with ordinality x(e,n)));end if;
  if jsonb_typeof(p->'expedition')='object' then p:=jsonb_set(p,'{expedition,equipment}',loadout);p:=jsonb_set(p,'{expedition,loot,equipment}','[]');p:=jsonb_set(p,'{expedition,loot,items}',coalesce(p->'expedition'->'loot'->'items','{}')-'enhancement_stone');end if;
  p:=jsonb_set(p,'{lootItems}',coalesce(p->'lootItems','{}')-'enhancement_stone');
  perform private.persist_client_payload_with_server_economy(u,p,'0.1.94');
 end loop;
end $$;
update private.online_expeditions set equipment_snapshot='{"weapon":"starter-v2","helmet":null,"armor":null,"gloves":null,"boots":null,"necklace":null,"ring":null}',temporary_loot=(temporary_loot-'equipment'-'enhancementStones')||'{"equipment":[]}',run_version=run_version+1 where status='ACTIVE';

revoke all on function public.place_online_market_order(uuid,bigint,text,text,text,text,bigint,bigint) from public,anon;
grant execute on function public.place_online_market_order(uuid,bigint,text,text,text,text,bigint,bigint) to authenticated;
