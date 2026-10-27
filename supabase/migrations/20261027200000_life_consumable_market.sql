-- Validated life consumables only. Vitality potions remain nontradeable.
create or replace function private.market_life_product_id(p_item text)
returns text language sql immutable set search_path='' as $function$
 select case when p_item in ('product:life:potion','product:life:attack_food','product:life:defense_food','product:life:experience_food')
 then split_part(p_item,':',3) else null end
$function$;
revoke all on function private.market_life_product_id(text) from public,anon,authenticated;

-- private.market_state_json
CREATE OR REPLACE FUNCTION private.market_state_json(p_user uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
select jsonb_build_object(
  'lifeMaterials',coalesce((select jsonb_build_object(
    'herb',coalesce((l.materials->>'herb')::bigint,0),
    'pepper',coalesce((l.materials->>'pepper')::bigint,0),
    'potato',coalesce((l.materials->>'potato')::bigint,0),
    'wheat',coalesce((l.materials->>'wheat')::bigint,0),
    'stone',coalesce((l.materials->>'stone')::bigint,0))
    from private.village_life_players l where l.user_id=p_user),
    '{"herb":0,"pepper":0,"potato":0,"wheat":0,"stone":0}'::jsonb),
  'lifeProducts',coalesce((select jsonb_build_object(
    'potion',coalesce((l.products->>'potion')::bigint,0),
    'attack_food',coalesce((l.products->>'attack_food')::bigint,0),
    'defense_food',coalesce((l.products->>'defense_food')::bigint,0),
    'experience_food',coalesce((l.products->>'experience_food')::bigint,0))
    from private.village_life_players l where l.user_id=p_user),
    '{"potion":0,"attack_food":0,"defense_food":0,"experience_food":0}'::jsonb),
  'wallet',coalesce((select jsonb_build_object('silver',w.silver,'gold',w.gold,'revision',w.last_synced_revision)
    from private.player_wallets w where w.user_id=p_user),jsonb_build_object('silver',0,'gold',0,'revision',0)),
  'assets',coalesce((select jsonb_agg(jsonb_build_object('itemId',a.item_id,'quantity',a.quantity,'gear',a.gear) order by a.item_id)
    from private.market_assets a where a.user_id=p_user and a.quantity>0),'[]'::jsonb),
  'orders',coalesce((select jsonb_agg(jsonb_build_object(
    'orderId',o.order_id,'itemId',o.item_id,'side',o.side,'limitPrice',o.limit_price,
    'originalQuantity',o.original_quantity,'remainingQuantity',o.remaining_quantity,'status',o.status,
    'expiresAt',extract(epoch from o.expires_at)*1000,'gear',o.gear,'createdAt',extract(epoch from o.created_at)*1000,'mine',o.user_id=p_user
  ) order by o.created_at,o.order_id) from private.market_orders o where o.status in ('OPEN','PARTIAL') and o.expires_at>now()),'[]'::jsonb),
  'trades',coalesce((select jsonb_agg(jsonb_build_object(
    'tradeId',t.trade_id,'itemId',t.item_id,'price',t.price,'quantity',t.quantity,
    'buyOrderId',t.buy_order_id,'sellOrderId',t.sell_order_id,'executedAt',extract(epoch from t.executed_at)*1000,
    'buyerMine',t.buyer_id=p_user,'sellerMine',t.seller_id=p_user
  ) order by t.executed_at desc,t.trade_id) from (
    select * from private.market_trades order by executed_at desc limit 200
  ) t),'[]'::jsonb),
  'storage',coalesce((select jsonb_agg(jsonb_build_object(
    'storageId',s.storage_id,'tradeId',s.trade_id,'side',s.side,'itemId',s.item_id,
    'quantity',s.quantity,'silver',s.silver,'gear',s.gear,'createdAt',extract(epoch from s.created_at)*1000
  ) order by s.created_at desc,s.storage_id) from private.market_storage s where s.user_id=p_user),'[]'::jsonb),
  'equipmentPolicy',jsonb_build_object(
    'registrationFeeBps',100,
    'minRegistrationFee',100,
    'maxRegistrationFee',100000,
    'sellerFeeBps',private.premium_fee_bps(p_user),
    'durationHours',720
  ),
  'equipmentListings',coalesce((select jsonb_agg(jsonb_build_object(
    'listingId',l.listing_id,
    'itemId',replace(l.asset_item_id,'equipment_v2:',''),
    'assetItemId',l.asset_item_id,
    'marketKey',l.market_key,
    'kind',l.kind,
    'grade',l.grade,
    'enhancement',l.enhancement,
    'price',l.list_price,
    'registrationFee',l.registration_fee,
    'sellerFeeBps',l.seller_fee_bps,
    'gear',l.gear,
    'createdAt',extract(epoch from l.created_at)*1000,
    'expiresAt',extract(epoch from l.expires_at)*1000,
    'mine',l.seller_id=p_user
  ) order by l.list_price,l.created_at,l.listing_id)
  from private.equipment_market_listings l
  where l.status='OPEN' and l.expires_at>now()),'[]'::jsonb),
  'equipmentTrades',coalesce((select jsonb_agg(jsonb_build_object(
    'tradeId',t.trade_id,
    'listingId',t.listing_id,
    'marketKey',t.market_key,
    'kind',t.kind,
    'grade',t.grade,
    'enhancement',t.enhancement,
    'price',t.price,
    'sellerFeeSilver',t.seller_fee_silver,
    'sellerNetSilver',t.seller_net_silver,
    'executedAt',extract(epoch from t.executed_at)*1000,
    'buyerMine',t.buyer_id=p_user,
    'sellerMine',t.seller_id=p_user
  ) order by t.executed_at desc,t.trade_id)
  from (select * from private.equipment_market_trades order by executed_at desc limit 100)t),'[]'::jsonb)
);
$function$;

-- private.deliver_market_asset
CREATE OR REPLACE FUNCTION private.deliver_market_asset(p_user uuid, p_item text, p_qty bigint, p_gear jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_item text:=p_item;
begin
 if p_item like 'equipment:%' then v_item:='equipment_v2:'||(p_gear->>'id');end if;
 if v_item is null or p_qty<=0 then raise exception 'MAIL_ATTACHMENT_INVALID';end if;
 if p_item like 'material:life:%' then
  if private.market_life_material_id(p_item) is null then raise exception 'MARKET_MATERIAL_RETIRED';end if;
  perform private.refresh_village_life(p_user);
  update private.village_life_players set materials=jsonb_set(materials,array[private.market_life_material_id(p_item)],
    to_jsonb(coalesce((materials->>private.market_life_material_id(p_item))::bigint,0)+p_qty),true)
  where user_id=p_user;
  return;
 end if;
 if p_item like 'product:life:%' then
  if private.market_life_product_id(p_item) is null then raise exception 'MARKET_PRODUCT_INVALID';end if;
  perform private.refresh_village_life(p_user);
  update private.village_life_players
  set products=jsonb_set(products,array[private.market_life_product_id(p_item)],
   to_jsonb(coalesce((products->>private.market_life_product_id(p_item))::bigint,0)+p_qty),true)
  where user_id=p_user;
  return;
 end if;
 insert into private.market_assets(user_id,item_id,quantity,gear) values(p_user,v_item,p_qty,p_gear)
 on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+excluded.quantity,gear=coalesce(excluded.gear,private.market_assets.gear),updated_at=now();
end $function$;

-- private.close_market_order
CREATE OR REPLACE FUNCTION private.close_market_order(p_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o private.market_orders%rowtype;
begin
 select * into o from private.market_orders where order_id=p_id for update;
 if o.status not in('OPEN','PARTIAL') then return;end if;
 if o.side='BUY' then
 perform 1 from public.game_saves where user_id=o.user_id for update;
 update private.player_wallets set silver=silver+o.limit_price*o.remaining_quantity,updated_at=now() where user_id=o.user_id;
 perform private.persist_market_economy_to_save(o.user_id);
 end if;
 if o.side='SELL' and (o.item_id like 'material:life:%' or o.item_id like 'product:life:%') and o.remaining_quantity>0 then
  perform private.deliver_market_asset(o.user_id,o.item_id,o.remaining_quantity,null);
 end if;
 perform private.market_order_mail(p_id,p_reason);
 update private.market_orders set status='CANCELLED',updated_at=now() where order_id=p_id;
end $function$;

-- private.market_order_mail
CREATE OR REPLACE FUNCTION private.market_order_mail(p_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o private.market_orders%rowtype;v_total bigint;v_item text;v_title text;
begin
 select * into o from private.market_orders where order_id=p_id;
 select coalesce(sum(price*quantity),0) into v_total from private.market_trades where (o.side='BUY' and buy_order_id=p_id) or(o.side='SELL' and sell_order_id=p_id);
 v_title:=case when o.side='BUY' then '구매' else '판매' end||case p_reason when 'FILLED' then ' 완료' when 'EXPIRED' then ' 주문 만료' else ' 주문 취소' end;
 v_item:=case when o.item_id like 'equipment:%' then 'equipment_v2:'||(o.gear->>'id') else o.item_id end;
 insert into private.game_mail(user_id,event_key,category,title,details,attachment_item_id,attachment_quantity,attachment_gear,attachment_assets)
 values(o.user_id,'order:'||o.order_id,'trade',v_title,
 jsonb_build_object('itemId',o.item_id,'gear',o.gear,'original',o.original_quantity,'filled',o.original_quantity-o.remaining_quantity,'remaining',o.remaining_quantity,'total',v_total,'fee',case when o.side='SELL' then coalesce((select sum(seller_fee_silver) from private.market_trades where sell_order_id=p_id),0) else 0 end,'refund',case when o.side='BUY' and p_reason<>'FILLED' then o.limit_price*o.remaining_quantity else 0 end),
 case when o.side='SELL' and p_reason<>'FILLED' and (o.item_id not like 'material:life:%' and o.item_id not like 'product:life:%') then v_item end,
 case when o.side='SELL' and p_reason<>'FILLED' and (o.item_id not like 'material:life:%' and o.item_id not like 'product:life:%') then o.remaining_quantity else 0 end,
 case when o.side='SELL' and p_reason<>'FILLED' and (o.item_id not like 'material:life:%' and o.item_id not like 'product:life:%') then o.gear end,case when o.side='SELL' and p_reason<>'FILLED' and (o.item_id not like 'material:life:%' and o.item_id not like 'product:life:%') then o.escrow_gear else '[]'::jsonb end)
 on conflict(user_id,event_key) do nothing;
end $function$;

-- public.place_online_market_order
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
  v_is_life_sell boolean:=false;
  v_is_life_product_sell boolean:=false;
  v_life_product_key text;
  v_life_key text;
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
  elsif p_item_id like 'material:life:%' then
    v_life_key:=private.market_life_material_id(p_item_id);
    if v_life_key is null then raise exception 'MARKET_MATERIAL_RETIRED';end if;
    v_is_life_sell:=p_side='SELL';
  elsif p_item_id like 'product:life:%' then
    v_life_product_key:=private.market_life_product_id(p_item_id);
    if v_life_product_key is null then raise exception 'MARKET_PRODUCT_INVALID';end if;
    v_is_life_product_sell:=p_side='SELL';
  elsif p_item_id like 'material:%' or p_item_id='other:split_stone' then
    raise exception 'MARKET_MATERIAL_RETIRED';
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
    if not v_is_v2_sell and not v_is_life_sell and not v_is_life_product_sell then
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
    elsif v_is_life_sell then
      perform private.refresh_village_life(v_user);
      update private.village_life_players
      set materials=jsonb_set(materials,array[v_life_key],
        to_jsonb(coalesce((materials->>v_life_key)::bigint,0)-p_quantity),true)
      where user_id=v_user and coalesce((materials->>v_life_key)::bigint,0)>=p_quantity;
      if not found then raise exception 'INSUFFICIENT_MARKET_ASSET';end if;
    elsif v_is_life_product_sell then
      perform private.refresh_village_life(v_user);
      update private.village_life_players
      set products=jsonb_set(products,array[v_life_product_key],
        to_jsonb(coalesce((products->>v_life_product_key)::bigint,0)-p_quantity),true)
      where user_id=v_user and coalesce((products->>v_life_product_key)::bigint,0)>=p_quantity;
      if not found then raise exception 'INSUFFICIENT_MARKET_ASSET';end if;
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
    returning trade_id into v_trade_id; update private.market_trades set seller_fee_silver=floor(v_price::numeric*v_qty*private.premium_fee_bps(v_sell.user_id)/10000)::bigint where trade_id=v_trade_id;

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
    update private.player_wallets set silver=silver+v_price*v_qty-floor(v_price::numeric*v_qty*private.premium_fee_bps(v_sell.user_id)/10000)::bigint,updated_at=now() where user_id=v_sell.user_id;

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

-- public.claim_online_market_storage
CREATE OR REPLACE FUNCTION public.claim_online_market_storage(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_storage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid;v_entry private.market_storage%rowtype;v_expedition_type text;v_asset_id text;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.sync_market_economy_from_latest_save(v_user);
  select jsonb_typeof(payload->'expedition') into v_expedition_type from public.game_saves where user_id=v_user;
  if coalesce(v_expedition_type,'null')<>'null' then raise exception 'MARKET_EXPEDITION_BLOCKED'; end if;
  select * into v_entry from private.market_storage where storage_id=p_storage_id and user_id=v_user for update;
  if not found then raise exception 'MARKET_STORAGE_NOT_FOUND'; end if;

  if v_entry.side='SELL' then
    update private.player_wallets set silver=silver+v_entry.silver,updated_at=now() where user_id=v_user;
  elsif (v_entry.item_id like 'material:life:%' or v_entry.item_id like 'product:life:%') then
    perform private.deliver_market_asset(v_user,v_entry.item_id,v_entry.quantity,v_entry.gear);
  elsif v_entry.item_id like 'equipment:%' then
    if v_entry.gear is null or nullif(v_entry.gear->>'id','') is null then raise exception 'EQUIPMENT_MARKET_ITEM_INVALID'; end if;
    v_asset_id:='equipment_v2:'||(v_entry.gear->>'id');
    insert into private.market_assets(user_id,item_id,quantity,gear,updated_at)
    values(v_user,v_asset_id,1,v_entry.gear,now())
    on conflict(user_id,item_id) do update set quantity=1,gear=excluded.gear,updated_at=now();
  else
    insert into private.market_assets(user_id,item_id,quantity,gear,updated_at)
    values(v_user,v_entry.item_id,v_entry.quantity,v_entry.gear,now())
    on conflict(user_id,item_id) do update set
      quantity=case when excluded.item_id like 'gear:%' then 1 else private.market_assets.quantity+excluded.quantity end,
      gear=coalesce(excluded.gear,private.market_assets.gear),updated_at=now();
  end if;

  delete from private.market_storage where storage_id=p_storage_id;
  perform private.persist_market_economy_to_save(v_user);
  return private.market_state_json(v_user);
end;$function$;

-- public.claim_all_online_market_storage
CREATE OR REPLACE FUNCTION public.claim_all_online_market_storage(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid;v_entry private.market_storage%rowtype;v_expedition_type text;v_asset_id text;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.sync_market_economy_from_latest_save(v_user);
  select jsonb_typeof(payload->'expedition') into v_expedition_type from public.game_saves where user_id=v_user;
  if coalesce(v_expedition_type,'null')<>'null' then raise exception 'MARKET_EXPEDITION_BLOCKED'; end if;

  for v_entry in select * from private.market_storage where user_id=v_user order by created_at,storage_id for update loop
    if v_entry.side='SELL' then
      update private.player_wallets set silver=silver+v_entry.silver,updated_at=now() where user_id=v_user;
    elsif (v_entry.item_id like 'material:life:%' or v_entry.item_id like 'product:life:%') then
    perform private.deliver_market_asset(v_user,v_entry.item_id,v_entry.quantity,v_entry.gear);
  elsif v_entry.item_id like 'equipment:%' then
      if v_entry.gear is null or nullif(v_entry.gear->>'id','') is null then raise exception 'EQUIPMENT_MARKET_ITEM_INVALID'; end if;
      v_asset_id:='equipment_v2:'||(v_entry.gear->>'id');
      insert into private.market_assets(user_id,item_id,quantity,gear,updated_at)
      values(v_user,v_asset_id,1,v_entry.gear,now())
      on conflict(user_id,item_id) do update set quantity=1,gear=excluded.gear,updated_at=now();
    else
      insert into private.market_assets(user_id,item_id,quantity,gear,updated_at)
      values(v_user,v_entry.item_id,v_entry.quantity,v_entry.gear,now())
      on conflict(user_id,item_id) do update set
        quantity=case when excluded.item_id like 'gear:%' then 1 else private.market_assets.quantity+excluded.quantity end,
        gear=coalesce(excluded.gear,private.market_assets.gear),updated_at=now();
    end if;
    delete from private.market_storage where storage_id=v_entry.storage_id;
  end loop;

  perform private.persist_market_economy_to_save(v_user);
  return private.market_state_json(v_user);
end;$function$;
