-- Multiple equivalent equipment instances retain their original IDs in escrow.
alter table private.market_orders add column escrow_gear jsonb not null default '[]';
alter table private.game_mail add column attachment_assets jsonb not null default '[]';
update private.market_orders set escrow_gear=jsonb_build_array(gear) where side='SELL' and item_id like 'equipment:%' and status in('OPEN','PARTIAL');


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
    begin v_level:=(v_asset.gear->>'enhancement')::integer;
    exception when others then raise exception 'EQUIPMENT_MARKET_ITEM_INVALID'; end;

    if v_kind not in(
      'association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff',
      'expedition_iron_helmet','return_corps_plate_armor','mining_detail_reinforced_gloves',
      'survey_corps_dust_boots','association_registration_tag','expedition_merit_ring'
    ) or v_grade not in('common','uncommon','rare','heroic','legendary') or v_level<0 or v_level>10 then
      raise exception 'EQUIPMENT_MARKET_ITEM_INVALID';
    end if;

    v_order_item_id:=private.equipment_market_key(v_asset.gear);
    v_is_v2_sell:=true;
  elsif p_item_id like 'equipment:%' then
    if p_side<>'BUY' then raise exception 'EQUIPMENT_ORDER_SELL_INSTANCE_REQUIRED'; end if;
    v_kind:=split_part(p_item_id,':',2);
    v_grade:=split_part(p_item_id,':',3);
    begin v_level:=replace(split_part(p_item_id,':',4),'+','')::integer;
    exception when others then raise exception 'EQUIPMENT_MARKET_ITEM_INVALID'; end;
    if p_item_id<>('equipment:'||v_kind||':'||v_grade||':+'||v_level)
      or v_kind not in(
        'association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff',
        'expedition_iron_helmet','return_corps_plate_armor','mining_detail_reinforced_gloves',
        'survey_corps_dust_boots','association_registration_tag','expedition_merit_ring'
      )
      or v_grade not in('common','uncommon','rare','heroic','legendary')
      or v_level<0 or v_level>10 then
      raise exception 'EQUIPMENT_MARKET_ITEM_INVALID';
    end if;
  elsif p_item_id like 'gear:%' and p_quantity<>1 then
    raise exception 'GEAR_QUANTITY_INVALID';
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

create or replace function private.market_order_mail(p_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare o private.market_orders%rowtype;v_total bigint;v_item text;v_title text;
begin
 select * into o from private.market_orders where order_id=p_id;
 select coalesce(sum(price*quantity),0) into v_total from private.market_trades where (o.side='BUY' and buy_order_id=p_id) or(o.side='SELL' and sell_order_id=p_id);
 v_title:=case when o.side='BUY' then '구매' else '판매' end||case p_reason when 'FILLED' then ' 완료' when 'EXPIRED' then ' 주문 만료' else ' 주문 취소' end;
 v_item:=case when o.item_id like 'equipment:%' then 'equipment_v2:'||(o.gear->>'id') else o.item_id end;
 insert into private.game_mail(user_id,event_key,category,title,details,attachment_item_id,attachment_quantity,attachment_gear,attachment_assets)
 values(o.user_id,'order:'||o.order_id,'trade',v_title,
 jsonb_build_object('itemId',o.item_id,'gear',o.gear,'original',o.original_quantity,'filled',o.original_quantity-o.remaining_quantity,'remaining',o.remaining_quantity,'total',v_total,'fee',0,'refund',case when o.side='BUY' and p_reason<>'FILLED' then o.limit_price*o.remaining_quantity else 0 end),
 case when o.side='SELL' and p_reason<>'FILLED' then v_item end,
 case when o.side='SELL' and p_reason<>'FILLED' then o.remaining_quantity else 0 end,
 case when o.side='SELL' and p_reason<>'FILLED' then o.gear end,case when o.side='SELL' and p_reason<>'FILLED' then o.escrow_gear else '[]'::jsonb end)
 on conflict(user_id,event_key) do nothing;
end $$;

create or replace function public.manage_game_mail(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_action text,p_mail_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;m private.game_mail%rowtype;v_changed boolean:=false;g jsonb;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_action not in('read','claim','claim_all','delete','delete_read') or p_action is null then raise exception 'MAIL_ACTION_INVALID';end if;
 if p_action in('claim','claim_all') then
 perform 1 from public.game_saves where user_id=u for update;
 perform private.sync_market_economy_from_latest_save(u);
 if exists(select 1 from public.game_saves where user_id=u and jsonb_typeof(payload->'expedition') is distinct from 'null') or exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') then raise exception 'MAIL_EXPEDITION_BLOCKED';end if;
 -- Lock canonical save before assets, matching other player economy operations.
 perform 1 from public.game_saves where user_id=u for update;
 end if;
 if p_action in('read','claim','delete') and not exists(select 1 from private.game_mail where mail_id=p_mail_id and user_id=u and expires_at>now()) then raise exception 'MAIL_NOT_FOUND';end if;
 for m in select * from private.game_mail where user_id=u and expires_at>now() and (mail_id=p_mail_id or p_action in('claim_all','delete_read')) order by mail_id for update loop
 if p_action='read' then update private.game_mail set read_at=coalesce(read_at,now()) where mail_id=m.mail_id;
 elsif p_action in('claim','claim_all') then
 if m.attachment_item_id is not null and m.claimed_at is null then
 if jsonb_array_length(m.attachment_assets)>0 then
   for g in select value from jsonb_array_elements(m.attachment_assets) loop perform private.deliver_market_asset(u,'equipment_v2:'||(g->>'id'),1,g);end loop;
 else perform private.deliver_market_asset(u,m.attachment_item_id,m.attachment_quantity,m.attachment_gear);end if;
 update private.game_mail set claimed_at=now(),read_at=coalesce(read_at,now()) where mail_id=m.mail_id;v_changed:=true;
 end if;
 elsif p_action='delete' then
 if m.attachment_item_id is not null and m.claimed_at is null then raise exception 'MAIL_UNCLAIMED';end if;
 delete from private.game_mail where mail_id=m.mail_id;
 elsif p_action='delete_read' and m.read_at is not null and (m.attachment_item_id is null or m.claimed_at is not null) then delete from private.game_mail where mail_id=m.mail_id;
 end if;
 end loop;
 if v_changed then perform private.persist_market_economy_to_save(u);end if;
 return public.get_game_mail()||jsonb_build_object('economy',case when p_action in('claim','claim_all') then private.market_state_json(u) end);
end $$;

create or replace function private.close_market_order(p_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare o private.market_orders%rowtype;
begin
 select * into o from private.market_orders where order_id=p_id for update;
 if o.status not in('OPEN','PARTIAL') then return;end if;
 if o.side='BUY' then
 perform 1 from public.game_saves where user_id=o.user_id for update;
 update private.player_wallets set silver=silver+o.limit_price*o.remaining_quantity,updated_at=now() where user_id=o.user_id;
 perform private.persist_market_economy_to_save(o.user_id);
 end if;
 perform private.market_order_mail(p_id,p_reason);
 update private.market_orders set status='CANCELLED',updated_at=now() where order_id=p_id;
end $$;

CREATE OR REPLACE FUNCTION public.cancel_online_market_order(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid;v_order private.market_orders%rowtype;v_asset_id text;
begin
  perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform 1 from public.game_saves where user_id=v_user for update;
  perform private.sync_market_economy_from_latest_save(v_user);
  select * into v_order from private.market_orders where order_id=p_order_id for update;
  if not found or v_order.user_id<>v_user or v_order.status not in ('OPEN','PARTIAL') or v_order.remaining_quantity<=0 then
    raise exception 'ORDER_NOT_CANCELLABLE';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_order.item_id,0));

  perform private.close_market_order(p_order_id,case when v_order.expires_at<=now() then 'EXPIRED' else 'CANCELLED' end);
  perform realtime.send(jsonb_build_object('itemId',v_order.item_id),'market_changed','market',true);
  return private.market_state_json(v_user);
end;$function$;

CREATE OR REPLACE FUNCTION public.cancel_online_equipment_listing(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_listing_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid;
  v_listing private.equipment_market_listings%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.expire_equipment_market_listings();
  perform 1 from public.game_saves where user_id=v_user for update;
  perform private.sync_market_economy_from_latest_save(v_user);

  select * into v_listing
  from private.equipment_market_listings
  where listing_id=p_listing_id
  for update;
  if not found or v_listing.seller_id<>v_user or v_listing.status<>'OPEN' then
    raise exception 'EQUIPMENT_MARKET_LISTING_NOT_CANCELLABLE';
  end if;

  perform private.equipment_listing_mail(p_listing_id,'CANCELLED');

  update private.equipment_market_listings
  set status='CANCELLED',updated_at=now()
  where listing_id=v_listing.listing_id;

  perform private.persist_market_economy_to_save(v_user);
  perform realtime.send(jsonb_build_object('itemId',v_listing.market_key),'market_changed','market',true);
  return private.market_state_json(v_user);
end;$function$;

CREATE OR REPLACE FUNCTION public.buy_online_equipment_listing(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_listing_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid;
  v_listing private.equipment_market_listings%rowtype;
  v_wallet private.player_wallets%rowtype;
  v_trade_id uuid;
  v_seller_fee bigint;
  v_seller_net bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.expire_equipment_market_listings();
  perform 1 from public.game_saves where user_id=v_user for update;
  perform private.sync_market_economy_from_latest_save(v_user);

  if exists(select 1 from public.game_saves g where g.user_id=v_user and jsonb_typeof(g.payload->'expedition') is distinct from 'null')
     or exists(select 1 from private.online_expeditions e where e.user_id=v_user and e.status='ACTIVE') then
    raise exception 'EQUIPMENT_MARKET_EXPEDITION_BLOCKED';
  end if;

  select * into v_listing
  from private.equipment_market_listings
  where listing_id=p_listing_id and status='OPEN' and expires_at>now()
  for update;
  if not found then raise exception 'EQUIPMENT_MARKET_LISTING_UNAVAILABLE';end if;
  if v_listing.seller_id=v_user then raise exception 'EQUIPMENT_MARKET_SELF_BUY';end if;

  perform 1 from public.game_saves where user_id=v_listing.seller_id for update;
  select * into v_wallet from private.player_wallets where user_id=v_user for update;
  if not found or v_wallet.silver<v_listing.list_price then raise exception 'INSUFFICIENT_SILVER';end if;

  update private.player_wallets
  set silver=silver-v_listing.list_price,updated_at=now()
  where user_id=v_user;

  v_seller_fee:=floor(v_listing.list_price::numeric*500/10000)::bigint;
  v_seller_net:=v_listing.list_price-v_seller_fee;

  insert into private.equipment_market_trades(
    listing_id,asset_item_id,market_key,kind,grade,enhancement,price,
    seller_fee_silver,seller_net_silver,seller_id,buyer_id,gear
  ) values(
    v_listing.listing_id,v_listing.asset_item_id,v_listing.market_key,v_listing.kind,v_listing.grade,v_listing.enhancement,
    v_listing.list_price,v_seller_fee,v_seller_net,v_listing.seller_id,v_user,v_listing.gear
  ) returning trade_id into v_trade_id;

  insert into private.market_assets(user_id,item_id,quantity,gear,updated_at)
  values(v_user,v_listing.asset_item_id,1,v_listing.gear,now())
  on conflict(user_id,item_id) do update
  set quantity=1,gear=excluded.gear,updated_at=now();

  update private.player_wallets set silver=silver+v_seller_net,updated_at=now() where user_id=v_listing.seller_id;

  update private.equipment_market_listings
  set status='SOLD',buyer_id=v_user,sold_at=now(),updated_at=now()
  where listing_id=v_listing.listing_id;

  perform private.equipment_listing_mail(p_listing_id,'SOLD');
  perform private.persist_market_economy_to_save(v_listing.seller_id);
  perform private.persist_market_economy_to_save(v_user);
  perform realtime.send(jsonb_build_object('itemId',v_listing.market_key),'market_changed','market',true);
  return private.market_state_json(v_user);
end;$function$;

CREATE OR REPLACE FUNCTION public.list_online_equipment(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_item_id text, p_list_price bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid;
  v_save public.game_saves%rowtype;
  v_asset private.market_assets%rowtype;
  v_wallet private.player_wallets%rowtype;
  v_fee bigint;
  v_kind text;
  v_grade text;
  v_level integer;
  v_slot text;
  v_market_key text;
  v_payload jsonb;
  v_presets jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.expire_equipment_market_listings();
  perform 1 from public.game_saves where user_id=v_user for update;
  perform private.sync_market_economy_from_latest_save(v_user);

  if p_item_id='starter-v2' then raise exception 'EQUIPMENT_MARKET_STARTER_PROTECTED';end if;
  if p_list_price is null or p_list_price<=0 or p_list_price>1000000000000 then
    raise exception 'EQUIPMENT_MARKET_PRICE_INVALID';
  end if;

  select * into v_save from public.game_saves where user_id=v_user for update;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
  if jsonb_typeof(v_save.payload->'expedition') is distinct from 'null'
     or exists(select 1 from private.online_expeditions e where e.user_id=v_user and e.status='ACTIVE') then
    raise exception 'EQUIPMENT_MARKET_EXPEDITION_BLOCKED';
  end if;

  if exists(
    select 1 from jsonb_each_text(coalesce(v_save.payload->'equipped','{}'::jsonb)) x
    where x.value=p_item_id
  ) then raise exception 'EQUIPMENT_MARKET_EQUIPPED';end if;

  select * into v_asset
  from private.market_assets
  where user_id=v_user and item_id='equipment_v2:'||p_item_id and quantity=1 and gear is not null
  for update;
  if not found then raise exception 'EQUIPMENT_MARKET_ITEM_NOT_FOUND';end if;

  v_kind:=v_asset.gear->>'kind';
  v_grade:=v_asset.gear->>'grade';
  begin v_level:=(v_asset.gear->>'enhancement')::integer;
  exception when others then raise exception 'EQUIPMENT_MARKET_ITEM_INVALID';end;

  if v_kind not in(
    'association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff',
    'expedition_iron_helmet','return_corps_plate_armor','mining_detail_reinforced_gloves',
    'survey_corps_dust_boots','association_registration_tag','expedition_merit_ring'
  ) or v_grade not in('common','uncommon','rare','heroic','legendary') or v_level<0 or v_level>10 then
    raise exception 'EQUIPMENT_MARKET_ITEM_INVALID';
  end if;

  v_fee:=private.equipment_market_registration_fee(p_list_price);
  select * into v_wallet from private.player_wallets where user_id=v_user for update;
  if not found or v_wallet.silver<v_fee then raise exception 'EQUIPMENT_MARKET_REGISTRATION_FEE_SHORTAGE';end if;

  update private.player_wallets set silver=silver-v_fee,updated_at=now() where user_id=v_user;
  delete from private.market_assets where user_id=v_user and item_id='equipment_v2:'||p_item_id;

  v_market_key:=private.equipment_market_key(v_asset.gear);
  insert into private.equipment_market_listings(
    seller_id,asset_item_id,market_key,kind,grade,enhancement,list_price,registration_fee,seller_fee_bps,gear,status,expires_at
  ) values(
    v_user,'equipment_v2:'||p_item_id,v_market_key,v_kind,v_grade,v_level,p_list_price,v_fee,500,v_asset.gear,'OPEN',now()+interval '30 days'
  );

  v_payload:=v_save.payload;
  v_slot:=case v_kind
    when 'association_supply_iron_sword' then 'weapon'
    when 'outer_guard_longbow' then 'weapon'
    when 'archive_standard_arcane_staff' then 'weapon'
    when 'expedition_iron_helmet' then 'helmet'
    when 'return_corps_plate_armor' then 'armor'
    when 'mining_detail_reinforced_gloves' then 'gloves'
    when 'survey_corps_dust_boots' then 'boots'
    when 'association_registration_tag' then 'necklace'
    when 'expedition_merit_ring' then 'ring'
  end;

  if jsonb_typeof(v_payload->'expeditionPresets')='array' then
    select coalesce(jsonb_agg(
      case
        when value='null'::jsonb then value
        when value->'equipment'->>v_slot=p_item_id then jsonb_set(value,array['equipment',v_slot],'null'::jsonb,true)
        else value
      end order by ord
    ),'[]'::jsonb)
    into v_presets
    from jsonb_array_elements(v_payload->'expeditionPresets') with ordinality x(value,ord);
    v_payload:=jsonb_set(v_payload,'{expeditionPresets}',v_presets,true);
  end if;

  perform private.persist_client_payload_with_server_economy(v_user,v_payload,'0.1.64');
  perform realtime.send(jsonb_build_object('itemId',v_market_key),'market_changed','market',true);
  return private.market_state_json(v_user);
end;$function$;

create or replace function private.maintain_game_mail()
returns void language plpgsql security definer set search_path='' as $$
declare o record;
begin
 -- One maintenance worker. Market matching also checks the deadline directly.
 if not pg_try_advisory_xact_lock(hashtextextended('tc-market-mutations',0)) then return;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('tc-mail-maintenance',0)) then return;end if;
 for o in select order_id,item_id from private.market_orders where status in('OPEN','PARTIAL') and expires_at<=now() order by item_id,order_id loop
 if pg_try_advisory_xact_lock(hashtextextended(o.item_id,0)) then perform private.close_market_order(o.order_id,'EXPIRED');end if;
 end loop;
 perform private.expire_equipment_market_listings();
 delete from private.game_mail where expires_at<=now();
end $$;