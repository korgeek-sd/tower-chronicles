-- v0.1.49 follow-up: keep server market economy and canonical cloud save in one transaction.

create or replace function private.stable_json_string(p_value jsonb)
returns text
language plpgsql
immutable
set search_path=''
as $$
declare
  v_type text := jsonb_typeof(p_value);
  v_result text;
begin
  if v_type='object' then
    select '{'||coalesce(string_agg(to_jsonb(e.key)::text||':'||private.stable_json_string(e.value),',' order by e.key collate "C"),'')||'}'
    into v_result
    from jsonb_each(p_value) e;
    return v_result;
  elsif v_type='array' then
    select '['||coalesce(string_agg(private.stable_json_string(a.value),',' order by a.ord),'')||']'
    into v_result
    from jsonb_array_elements(p_value) with ordinality a(value,ord);
    return v_result;
  else
    return p_value::text;
  end if;
end;
$$;

create or replace function private.persist_market_economy_to_save(p_user uuid)
returns bigint
language plpgsql
security definer
set search_path=''
as $$
declare
  v_current public.game_saves%rowtype;
  v_wallet private.player_wallets%rowtype;
  v_payload jsonb;
  v_materials jsonb;
  v_tickets jsonb;
  v_skillbooks jsonb;
  v_loot_items jsonb;
  v_items jsonb;
  v_hash text;
  v_revision bigint;
begin
  select * into v_current from public.game_saves where user_id=p_user for update;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED'; end if;
  select * into v_wallet from private.player_wallets where user_id=p_user for update;
  if not found then raise exception 'SERVER_WALLET_REQUIRED'; end if;

  select coalesce(jsonb_object_agg(x.tower,x.values),'{}'::jsonb)
  into v_materials
  from (
    select m.key as tower,jsonb_agg(to_jsonb(coalesce(a.quantity,0)) order by q.ord) as values
    from jsonb_each(coalesce(v_current.payload->'materials','{}'::jsonb)) m
    cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord)
    left join private.market_assets a
      on a.user_id=p_user and a.item_id='material:'||m.key||':'||q.ord::text
    group by m.key
  ) x;

  select coalesce(jsonb_object_agg(x.tower,x.values),'{}'::jsonb)
  into v_tickets
  from (
    select m.key as tower,jsonb_agg(to_jsonb(coalesce(a.quantity,0)) order by q.ord) as values
    from jsonb_each(coalesce(v_current.payload->'tickets','{}'::jsonb)) m
    cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord)
    left join private.market_assets a
      on a.user_id=p_user and a.item_id='ticket:'||m.key||':'||q.ord::text
    group by m.key
  ) x;

  select coalesce(jsonb_object_agg(substr(item_id,11),quantity),'{}'::jsonb)
  into v_skillbooks from private.market_assets
  where user_id=p_user and item_id like 'skillbook:%' and quantity>0;

  select coalesce(jsonb_object_agg(substr(item_id,7),quantity),'{}'::jsonb)
  into v_loot_items from private.market_assets
  where user_id=p_user and item_id like 'other:%' and quantity>0;

  select coalesce(jsonb_agg(gear order by item_id),'[]'::jsonb)
  into v_items from private.market_assets
  where user_id=p_user and item_id like 'gear:%' and quantity=1 and gear is not null;

  v_payload:=jsonb_set(v_current.payload,'{silver}',to_jsonb(v_wallet.silver),true);
  v_payload:=jsonb_set(v_payload,'{market,gold}',to_jsonb(v_wallet.gold),true);
  v_payload:=jsonb_set(v_payload,'{materials}',v_materials,true);
  v_payload:=jsonb_set(v_payload,'{tickets}',v_tickets,true);
  v_payload:=jsonb_set(v_payload,'{skillBooks}',v_skillbooks,true);
  v_payload:=jsonb_set(v_payload,'{lootItems}',v_loot_items,true);
  v_payload:=jsonb_set(v_payload,'{items}',v_items,true);
  v_hash:=encode(extensions.digest(convert_to(private.stable_json_string(v_payload),'UTF8'),'sha256'),'hex');

  insert into public.game_save_versions(user_id,revision,save_schema,app_version,payload,payload_hash,device_id,created_at)
  values(v_current.user_id,v_current.revision,v_current.save_schema,v_current.app_version,v_current.payload,v_current.payload_hash,v_current.device_id,v_current.updated_at)
  on conflict on constraint game_save_versions_user_id_revision_key do nothing;

  v_revision:=v_current.revision+1;
  update public.game_saves
  set revision=v_revision,app_version='0.1.49',payload=v_payload,payload_hash=v_hash,updated_at=now()
  where user_id=p_user;

  update private.player_wallets
  set last_synced_revision=v_revision,updated_at=now()
  where user_id=p_user;

  return v_revision;
end;
$$;

revoke all on function private.stable_json_string(jsonb) from public,anon,authenticated;
revoke all on function private.persist_market_economy_to_save(uuid) from public,anon,authenticated;

create or replace function public.place_online_market_order(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
  p_item_id text,p_side text,p_limit_price bigint,p_quantity bigint
) returns jsonb
language plpgsql security definer set search_path=''
as $$
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
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.sync_market_economy_from_latest_save(v_user);
  if nullif(p_item_id,'') is null then raise exception 'MARKET_ITEM_REQUIRED'; end if;
  if p_side not in ('BUY','SELL') then raise exception 'MARKET_SIDE_INVALID'; end if;
  if p_limit_price is null or p_limit_price<=0 or p_limit_price>1000000000000 then raise exception 'MARKET_PRICE_INVALID'; end if;
  if p_quantity is null or p_quantity<=0 or p_quantity>1000000 then raise exception 'MARKET_QUANTITY_INVALID'; end if;
  if p_item_id like 'gear:%' and p_quantity<>1 then raise exception 'GEAR_QUANTITY_INVALID'; end if;

  select jsonb_typeof(payload->'expedition') into v_expedition_type from public.game_saves where user_id=v_user;
  if coalesce(v_expedition_type,'null')<>'null' then raise exception 'MARKET_EXPEDITION_BLOCKED'; end if;

  if p_side='SELL' and p_item_id like 'gear:%' then
    v_gear_id:=substr(p_item_id,6);
    if exists(
      select 1 from public.game_saves g,
      lateral jsonb_each_text(coalesce(g.payload->'equipped','{}'::jsonb)) e
      where g.user_id=v_user and e.value=v_gear_id
    ) then raise exception 'GEAR_EQUIPPED'; end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_item_id,0));

  if p_side='BUY' then
    v_reserve:=p_limit_price::numeric*p_quantity::numeric;
    if v_reserve>9223372036854775807 then raise exception 'MARKET_TOTAL_INVALID'; end if;
    select * into v_wallet from private.player_wallets where user_id=v_user for update;
    if not found or v_wallet.silver<v_reserve::bigint then raise exception 'INSUFFICIENT_SILVER'; end if;
    update private.player_wallets set silver=silver-v_reserve::bigint,updated_at=now() where user_id=v_user;
  else
    select * into v_asset from private.market_assets where user_id=v_user and item_id=p_item_id for update;
    if not found or v_asset.quantity<p_quantity then raise exception 'INSUFFICIENT_MARKET_ASSET'; end if;
    if p_item_id like 'gear:%' and v_asset.gear is null then raise exception 'GEAR_DATA_MISSING'; end if;
    if v_asset.quantity=p_quantity then delete from private.market_assets where user_id=v_user and item_id=p_item_id;
    else update private.market_assets set quantity=quantity-p_quantity,updated_at=now() where user_id=v_user and item_id=p_item_id; end if;
  end if;

  insert into private.market_orders(user_id,item_id,side,limit_price,original_quantity,remaining_quantity,status,gear)
  values(v_user,p_item_id,p_side,p_limit_price,p_quantity,p_quantity,'OPEN',case when p_side='SELL' then v_asset.gear else null end)
  returning * into v_incoming;

  loop
    exit when v_incoming.remaining_quantity<=0;
    if v_incoming.side='BUY' then
      select * into v_resting from private.market_orders
      where item_id=v_incoming.item_id and side='SELL' and status in ('OPEN','PARTIAL')
        and remaining_quantity>0 and limit_price<=v_incoming.limit_price and user_id<>v_user
      order by limit_price asc,created_at asc,order_id asc limit 1 for update;
    else
      select * into v_resting from private.market_orders
      where item_id=v_incoming.item_id and side='BUY' and status in ('OPEN','PARTIAL')
        and remaining_quantity>0 and limit_price>=v_incoming.limit_price and user_id<>v_user
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

    if v_buy.limit_price>v_price then
      update private.player_wallets set silver=silver+(v_buy.limit_price-v_price)*v_qty,updated_at=now()
      where user_id=v_buy.user_id;
    end if;

    insert into private.market_storage(user_id,trade_id,side,item_id,quantity,silver,gear)
    values(v_buy.user_id,v_trade_id,'BUY',v_buy.item_id,v_qty,0,v_sell.gear);
    insert into private.market_storage(user_id,trade_id,side,item_id,quantity,silver,gear)
    values(v_sell.user_id,v_trade_id,'SELL',v_sell.item_id,v_qty,v_price*v_qty,null);

    update private.market_orders set remaining_quantity=remaining_quantity-v_qty,
      status=case when remaining_quantity-v_qty=0 then 'FILLED' when remaining_quantity-v_qty<original_quantity then 'PARTIAL' else 'OPEN' end,
      updated_at=now() where order_id=v_buy.order_id;
    update private.market_orders set remaining_quantity=remaining_quantity-v_qty,
      status=case when remaining_quantity-v_qty=0 then 'FILLED' when remaining_quantity-v_qty<original_quantity then 'PARTIAL' else 'OPEN' end,
      updated_at=now() where order_id=v_sell.order_id;
    select * into v_incoming from private.market_orders where order_id=v_incoming.order_id;
  end loop;

  perform private.persist_market_economy_to_save(v_user);
  perform realtime.send(jsonb_build_object('itemId',p_item_id),'market_changed','market',true);
  return private.market_state_json(v_user);
end;
$$;

create or replace function public.cancel_online_market_order(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_order_id uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_order private.market_orders%rowtype;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.sync_market_economy_from_latest_save(v_user);
  select * into v_order from private.market_orders where order_id=p_order_id for update;
  if not found or v_order.user_id<>v_user or v_order.status not in ('OPEN','PARTIAL') or v_order.remaining_quantity<=0 then
    raise exception 'ORDER_NOT_CANCELLABLE';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_order.item_id,0));
  if v_order.side='BUY' then
    update private.player_wallets set silver=silver+v_order.limit_price*v_order.remaining_quantity,updated_at=now() where user_id=v_user;
  else
    insert into private.market_assets(user_id,item_id,quantity,gear,updated_at)
    values(v_user,v_order.item_id,v_order.remaining_quantity,v_order.gear,now())
    on conflict(user_id,item_id) do update set
      quantity=case when excluded.item_id like 'gear:%' then 1 else private.market_assets.quantity+excluded.quantity end,
      gear=coalesce(excluded.gear,private.market_assets.gear),updated_at=now();
  end if;
  update private.market_orders set status='CANCELLED',updated_at=now() where order_id=p_order_id;
  perform private.persist_market_economy_to_save(v_user);
  perform realtime.send(jsonb_build_object('itemId',v_order.item_id),'market_changed','market',true);
  return private.market_state_json(v_user);
end;
$$;

create or replace function public.claim_online_market_storage(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_storage_id uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_entry private.market_storage%rowtype;v_expedition_type text;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.sync_market_economy_from_latest_save(v_user);
  select jsonb_typeof(payload->'expedition') into v_expedition_type from public.game_saves where user_id=v_user;
  if coalesce(v_expedition_type,'null')<>'null' then raise exception 'MARKET_EXPEDITION_BLOCKED'; end if;
  select * into v_entry from private.market_storage where storage_id=p_storage_id and user_id=v_user for update;
  if not found then raise exception 'MARKET_STORAGE_NOT_FOUND'; end if;
  if v_entry.side='SELL' then
    update private.player_wallets set silver=silver+v_entry.silver,updated_at=now() where user_id=v_user;
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
end;
$$;

create or replace function public.claim_all_online_market_storage(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_entry private.market_storage%rowtype;v_expedition_type text;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.sync_market_economy_from_latest_save(v_user);
  select jsonb_typeof(payload->'expedition') into v_expedition_type from public.game_saves where user_id=v_user;
  if coalesce(v_expedition_type,'null')<>'null' then raise exception 'MARKET_EXPEDITION_BLOCKED'; end if;
  for v_entry in select * from private.market_storage where user_id=v_user order by created_at,storage_id for update loop
    if v_entry.side='SELL' then
      update private.player_wallets set silver=silver+v_entry.silver,updated_at=now() where user_id=v_user;
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
end;
$$;
