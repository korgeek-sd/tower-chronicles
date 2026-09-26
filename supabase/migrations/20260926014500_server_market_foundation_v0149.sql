-- v0.1.49: server-authoritative online market foundation.
-- Public clients can only use the authenticated RPC surface. Economy state stays in private schema.

create table if not exists private.player_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  silver bigint not null default 0 check (silver >= 0),
  gold bigint not null default 0 check (gold >= 0),
  last_synced_revision bigint not null default 0 check (last_synced_revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.player_wallets enable row level security;
revoke all on private.player_wallets from public, anon, authenticated;

create table if not exists private.market_assets (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  quantity bigint not null check (quantity >= 0),
  gear jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id,item_id),
  check ((item_id like 'gear:%' and quantity <= 1) or item_id not like 'gear:%')
);
alter table private.market_assets enable row level security;
revoke all on private.market_assets from public, anon, authenticated;

create table if not exists private.market_orders (
  order_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  side text not null check (side in ('BUY','SELL')),
  limit_price bigint not null check (limit_price > 0),
  original_quantity bigint not null check (original_quantity > 0),
  remaining_quantity bigint not null check (remaining_quantity >= 0 and remaining_quantity <= original_quantity),
  status text not null check (status in ('OPEN','PARTIAL','FILLED','CANCELLED')),
  gear jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists market_orders_book_idx on private.market_orders(item_id,status,side,limit_price,created_at);
create index if not exists market_orders_user_idx on private.market_orders(user_id,status,created_at desc);
alter table private.market_orders enable row level security;
revoke all on private.market_orders from public, anon, authenticated;

create table if not exists private.market_trades (
  trade_id uuid primary key default gen_random_uuid(),
  item_id text not null,
  price bigint not null check (price > 0),
  quantity bigint not null check (quantity > 0),
  buy_order_id uuid not null,
  sell_order_id uuid not null,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  executed_at timestamptz not null default now()
);
create index if not exists market_trades_item_idx on private.market_trades(item_id,executed_at desc);
alter table private.market_trades enable row level security;
revoke all on private.market_trades from public, anon, authenticated;

create table if not exists private.market_storage (
  storage_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_id uuid not null,
  side text not null check (side in ('BUY','SELL')),
  item_id text not null,
  quantity bigint not null check (quantity > 0),
  silver bigint not null default 0 check (silver >= 0),
  gear jsonb,
  created_at timestamptz not null default now()
);
create index if not exists market_storage_user_idx on private.market_storage(user_id,created_at desc);
alter table private.market_storage enable row level security;
revoke all on private.market_storage from public, anon, authenticated;

create or replace function private.require_active_game_session(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_session_text text := auth.jwt() ->> 'session_id';
  v_auth_session uuid;
  v_active private.active_game_sessions%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  begin v_auth_session := v_session_text::uuid;
  exception when others then raise exception 'AUTH_SESSION_INVALID' using errcode='42501'; end;
  if not exists(select 1 from auth.sessions s where s.id=v_auth_session and s.user_id=v_user) then
    raise exception 'AUTH_SESSION_INVALID' using errcode='42501';
  end if;
  select * into v_active from private.active_game_sessions where user_id=v_user for update;
  if not found or v_active.expires_at<=now() or v_active.lease_id<>p_lease_id
     or v_active.generation<>p_generation or v_active.auth_session_id<>v_auth_session
     or v_active.device_id<>p_device_id or v_active.client_instance_id<>p_client_instance_id then
    raise exception 'GAME_SESSION_LOST';
  end if;
  return v_user;
end;
$$;

create or replace function private.sync_market_economy_from_latest_save(p_user uuid)
returns bigint
language plpgsql security definer set search_path=''
as $$
declare
  v_revision bigint;
  v_payload jsonb;
  v_last bigint;
begin
  select revision,payload into v_revision,v_payload from public.game_saves where user_id=p_user;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED'; end if;

  select last_synced_revision into v_last
  from private.player_wallets where user_id=p_user for update;
  if found and v_last>=v_revision then return v_revision; end if;

  insert into private.player_wallets(user_id,silver,gold,last_synced_revision,updated_at)
  values(
    p_user,
    greatest(0,coalesce((v_payload->>'silver')::bigint,0)),
    greatest(0,coalesce((v_payload->'market'->>'gold')::bigint,0)),
    v_revision,now()
  )
  on conflict(user_id) do update
  set silver=excluded.silver,gold=excluded.gold,last_synced_revision=excluded.last_synced_revision,updated_at=now();

  delete from private.market_assets where user_id=p_user;

  insert into private.market_assets(user_id,item_id,quantity,gear)
  select p_user,'gear:'||(g->>'id'),1,g
  from jsonb_array_elements(coalesce(v_payload->'items','[]'::jsonb)) g
  where nullif(g->>'id','') is not null;

  insert into private.market_assets(user_id,item_id,quantity)
  select p_user,'material:'||m.key||':'||q.ord::text,(q.value#>>'{}')::bigint
  from jsonb_each(coalesce(v_payload->'materials','{}'::jsonb)) m
  cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord)
  where (q.value#>>'{}')::bigint>0;

  insert into private.market_assets(user_id,item_id,quantity)
  select p_user,'ticket:'||m.key||':'||q.ord::text,(q.value#>>'{}')::bigint
  from jsonb_each(coalesce(v_payload->'tickets','{}'::jsonb)) m
  cross join lateral jsonb_array_elements(m.value) with ordinality q(value,ord)
  where (q.value#>>'{}')::bigint>0;

  insert into private.market_assets(user_id,item_id,quantity)
  select p_user,'skillbook:'||kv.key,(kv.value)::bigint
  from jsonb_each_text(coalesce(v_payload->'skillBooks','{}'::jsonb)) kv
  where (kv.value)::bigint>0;

  insert into private.market_assets(user_id,item_id,quantity)
  select p_user,'other:'||kv.key,(kv.value)::bigint
  from jsonb_each_text(coalesce(v_payload->'lootItems','{}'::jsonb)) kv
  where (kv.value)::bigint>0;

  return v_revision;
end;
$$;

create or replace function private.market_state_json(p_user uuid)
returns jsonb
language sql security definer set search_path=''
as $$
select jsonb_build_object(
  'wallet',coalesce((select jsonb_build_object('silver',w.silver,'gold',w.gold,'revision',w.last_synced_revision)
    from private.player_wallets w where w.user_id=p_user),jsonb_build_object('silver',0,'gold',0,'revision',0)),
  'assets',coalesce((select jsonb_agg(jsonb_build_object('itemId',a.item_id,'quantity',a.quantity,'gear',a.gear) order by a.item_id)
    from private.market_assets a where a.user_id=p_user and a.quantity>0),'[]'::jsonb),
  'orders',coalesce((select jsonb_agg(jsonb_build_object(
    'orderId',o.order_id,'itemId',o.item_id,'side',o.side,'limitPrice',o.limit_price,
    'originalQuantity',o.original_quantity,'remainingQuantity',o.remaining_quantity,'status',o.status,
    'gear',o.gear,'createdAt',extract(epoch from o.created_at)*1000,'mine',o.user_id=p_user
  ) order by o.created_at,o.order_id) from private.market_orders o where o.status in ('OPEN','PARTIAL')),'[]'::jsonb),
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
  ) order by s.created_at desc,s.storage_id) from private.market_storage s where s.user_id=p_user),'[]'::jsonb)
);
$$;

create or replace function public.get_online_market_state()
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  perform private.sync_market_economy_from_latest_save(v_user);
  return private.market_state_json(v_user);
end;
$$;

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
    if v_asset.quantity=p_quantity then
      delete from private.market_assets where user_id=v_user and item_id=p_item_id;
    else
      update private.market_assets set quantity=quantity-p_quantity,updated_at=now()
      where user_id=v_user and item_id=p_item_id;
    end if;
  end if;

  insert into private.market_orders(user_id,item_id,side,limit_price,original_quantity,remaining_quantity,status,gear)
  values(v_user,p_item_id,p_side,p_limit_price,p_quantity,p_quantity,'OPEN',case when p_side='SELL' then v_asset.gear else null end)
  returning * into v_incoming;

  loop
    if v_incoming.remaining_quantity<=0 then exit; end if;
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

  perform realtime.send(jsonb_build_object('itemId',p_item_id),'market_changed','market',true);
  return private.market_state_json(v_user);
end;
$$;

create or replace function public.cancel_online_market_order(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_order_id uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid;
  v_order private.market_orders%rowtype;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.sync_market_economy_from_latest_save(v_user);
  select * into v_order from private.market_orders where order_id=p_order_id for update;
  if not found or v_order.user_id<>v_user or v_order.status not in ('OPEN','PARTIAL') or v_order.remaining_quantity<=0 then
    raise exception 'ORDER_NOT_CANCELLABLE';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_order.item_id,0));
  if v_order.side='BUY' then
    update private.player_wallets set silver=silver+v_order.limit_price*v_order.remaining_quantity,updated_at=now()
    where user_id=v_user;
  else
    insert into private.market_assets(user_id,item_id,quantity,gear,updated_at)
    values(v_user,v_order.item_id,v_order.remaining_quantity,v_order.gear,now())
    on conflict(user_id,item_id) do update set
      quantity=case when excluded.item_id like 'gear:%' then 1 else private.market_assets.quantity+excluded.quantity end,
      gear=coalesce(excluded.gear,private.market_assets.gear),updated_at=now();
  end if;
  update private.market_orders set status='CANCELLED',updated_at=now() where order_id=p_order_id;
  perform realtime.send(jsonb_build_object('itemId',v_order.item_id),'market_changed','market',true);
  return private.market_state_json(v_user);
end;
$$;

create or replace function public.claim_online_market_storage(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_storage_id uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid;
  v_entry private.market_storage%rowtype;
  v_expedition_type text;
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
  return private.market_state_json(v_user);
end;
$$;

create or replace function public.claim_all_online_market_storage(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid;
  v_entry private.market_storage%rowtype;
  v_expedition_type text;
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
  return private.market_state_json(v_user);
end;
$$;

drop policy if exists "authenticated can receive market broadcasts" on realtime.messages;
create policy "authenticated can receive market broadcasts"
on realtime.messages for select to authenticated
using (realtime.messages.extension='broadcast' and realtime.topic()='market');

revoke all on function private.require_active_game_session(uuid,bigint,text,text) from public,anon,authenticated;
revoke all on function private.sync_market_economy_from_latest_save(uuid) from public,anon,authenticated;
revoke all on function private.market_state_json(uuid) from public,anon,authenticated;

revoke all on function public.get_online_market_state() from public,anon;
revoke all on function public.place_online_market_order(uuid,bigint,text,text,text,text,bigint,bigint) from public,anon;
revoke all on function public.cancel_online_market_order(uuid,bigint,text,text,uuid) from public,anon;
revoke all on function public.claim_online_market_storage(uuid,bigint,text,text,uuid) from public,anon;
revoke all on function public.claim_all_online_market_storage(uuid,bigint,text,text) from public,anon;

grant execute on function public.get_online_market_state() to authenticated;
grant execute on function public.place_online_market_order(uuid,bigint,text,text,text,text,bigint,bigint) to authenticated;
grant execute on function public.cancel_online_market_order(uuid,bigint,text,text,uuid) to authenticated;
grant execute on function public.claim_online_market_storage(uuid,bigint,text,text,uuid) to authenticated;
grant execute on function public.claim_all_online_market_storage(uuid,bigint,text,text) to authenticated;
