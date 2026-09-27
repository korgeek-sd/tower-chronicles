create table if not exists private.gold_exchange_orders (
 order_id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 side text not null check(side in ('BUY_GOLD','SELL_GOLD')),
 price_silver_per_gold bigint not null check(price_silver_per_gold>0),
 original_gold_quantity bigint not null check(original_gold_quantity>0),
 remaining_gold_quantity bigint not null check(remaining_gold_quantity>=0 and remaining_gold_quantity<=original_gold_quantity),
 status text not null check(status in ('OPEN','PARTIAL','FILLED','CANCELLED')),
 seller_fee_bps smallint not null default 0 check(seller_fee_bps between 0 and 10000),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table private.gold_exchange_orders enable row level security;
revoke all on private.gold_exchange_orders from public,anon,authenticated;

create table if not exists private.gold_exchange_trades (
 trade_id uuid primary key default gen_random_uuid(),
 price_silver_per_gold bigint not null check(price_silver_per_gold>0),
 gold_quantity bigint not null check(gold_quantity>0),
 gross_silver bigint not null check(gross_silver>=0),
 seller_fee_silver bigint not null check(seller_fee_silver>=0),
 seller_net_silver bigint not null check(seller_net_silver>=0),
 seller_fee_bps smallint not null check(seller_fee_bps between 0 and 10000),
 buy_order_id uuid not null references private.gold_exchange_orders(order_id),
 sell_order_id uuid not null references private.gold_exchange_orders(order_id),
 buyer_id uuid not null references auth.users(id) on delete cascade,
 seller_id uuid not null references auth.users(id) on delete cascade,
 executed_at timestamptz not null default now()
);
alter table private.gold_exchange_trades enable row level security;
revoke all on private.gold_exchange_trades from public,anon,authenticated;

create table if not exists private.gold_exchange_order_requests (
 user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,
 side text not null check(side in ('BUY_GOLD','SELL_GOLD')),price_silver_per_gold bigint not null,gold_quantity bigint not null,
 order_id uuid not null references private.gold_exchange_orders(order_id),created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table private.gold_exchange_order_requests enable row level security;
revoke all on private.gold_exchange_order_requests from public,anon,authenticated;

create table if not exists private.gold_exchange_cancel_requests (
 user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,
 order_id uuid not null references private.gold_exchange_orders(order_id),created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table private.gold_exchange_cancel_requests enable row level security;
revoke all on private.gold_exchange_cancel_requests from public,anon,authenticated;

create index if not exists gold_exchange_sell_book_idx on private.gold_exchange_orders(price_silver_per_gold asc,created_at asc,order_id)
 where side='SELL_GOLD' and status in ('OPEN','PARTIAL') and remaining_gold_quantity>0;
create index if not exists gold_exchange_buy_book_idx on private.gold_exchange_orders(price_silver_per_gold desc,created_at asc,order_id)
 where side='BUY_GOLD' and status in ('OPEN','PARTIAL') and remaining_gold_quantity>0;
create index if not exists gold_exchange_user_orders_idx on private.gold_exchange_orders(user_id,created_at desc);
create index if not exists gold_exchange_trades_executed_idx on private.gold_exchange_trades(executed_at desc);
create index if not exists gold_exchange_trades_buyer_idx on private.gold_exchange_trades(buyer_id,executed_at desc);
create index if not exists gold_exchange_trades_seller_idx on private.gold_exchange_trades(seller_id,executed_at desc);

create or replace function private.gold_exchange_seller_fee_bps(p_user uuid)
returns integer language sql stable security definer set search_path='' as $$
 select case when coalesce((g.payload#>>'{goldenRecorder,expiresAt}')::numeric,0)>extract(epoch from now())*1000 then 100 else 200 end
 from public.game_saves g where g.user_id=p_user
$$;
revoke all on function private.gold_exchange_seller_fee_bps(uuid) from public,anon,authenticated;

create or replace function private.gold_exchange_state_json(p_user uuid)
returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object(
 'wallet',coalesce((select jsonb_build_object('silver',w.silver,'gold',w.gold,'revision',w.last_synced_revision) from private.player_wallets w where w.user_id=p_user),jsonb_build_object('silver',0,'gold',0,'revision',0)),
 'sellerFeeBps',coalesce(private.gold_exchange_seller_fee_bps(p_user),200),'registrationFeeBps',0,
 'orders',coalesce((select jsonb_agg(jsonb_build_object('orderId',o.order_id,'side',o.side,'priceSilverPerGold',o.price_silver_per_gold,'originalGoldQuantity',o.original_gold_quantity,'remainingGoldQuantity',o.remaining_gold_quantity,'status',o.status,'sellerFeeBps',o.seller_fee_bps,'createdAt',extract(epoch from o.created_at)*1000,'mine',o.user_id=p_user) order by o.created_at,o.order_id)
  from private.gold_exchange_orders o where o.status in ('OPEN','PARTIAL') and o.remaining_gold_quantity>0),'[]'::jsonb),
 'trades',coalesce((select jsonb_agg(jsonb_build_object('tradeId',t.trade_id,'priceSilverPerGold',t.price_silver_per_gold,'goldQuantity',t.gold_quantity,'grossSilver',t.gross_silver,'sellerFeeSilver',t.seller_fee_silver,'sellerNetSilver',t.seller_net_silver,'sellerFeeBps',t.seller_fee_bps,'buyOrderId',t.buy_order_id,'sellOrderId',t.sell_order_id,'executedAt',extract(epoch from t.executed_at)*1000,'buyerMine',t.buyer_id=p_user,'sellerMine',t.seller_id=p_user) order by t.executed_at desc,t.trade_id)
  from (select * from private.gold_exchange_trades order by executed_at desc limit 200)t),'[]'::jsonb)
);
$$;
revoke all on function private.gold_exchange_state_json(uuid) from public,anon,authenticated;

create or replace function private.persist_market_economy_to_save(p_user uuid)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_current public.game_saves%rowtype;v_payload jsonb;v_hash text;v_revision bigint;
begin
 select * into v_current from public.game_saves where user_id=p_user for update;if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 v_payload:=private.server_economy_payload(p_user,v_current.payload);
 v_hash:=encode(extensions.digest(convert_to(private.stable_json_string(v_payload),'UTF8'),'sha256'),'hex');
 insert into public.game_save_versions(user_id,revision,save_schema,app_version,payload,payload_hash,device_id,created_at)
 values(v_current.user_id,v_current.revision,v_current.save_schema,v_current.app_version,v_current.payload,v_current.payload_hash,v_current.device_id,v_current.updated_at)
 on conflict on constraint game_save_versions_user_id_revision_key do nothing;
 v_revision:=v_current.revision+1;
 update public.game_saves set revision=v_revision,app_version='0.1.59',payload=v_payload,payload_hash=v_hash,updated_at=now() where user_id=p_user;
 update private.player_wallets set last_synced_revision=v_revision,updated_at=now() where user_id=p_user;
 return v_revision;
end;$$;
revoke all on function private.persist_market_economy_to_save(uuid) from public,anon,authenticated;

create or replace function public.get_online_gold_exchange_state()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();
begin if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;perform private.sync_market_economy_from_latest_save(v_user);return private.gold_exchange_state_json(v_user);end;$$;
revoke all on function public.get_online_gold_exchange_state() from public,anon,authenticated;
grant execute on function public.get_online_gold_exchange_state() to authenticated;

create or replace function public.place_online_gold_exchange_order(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid,p_side text,p_price_silver_per_gold bigint,p_gold_quantity bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_user uuid;v_wallet private.player_wallets%rowtype;v_incoming private.gold_exchange_orders%rowtype;v_resting private.gold_exchange_orders%rowtype;
 v_buy private.gold_exchange_orders%rowtype;v_sell private.gold_exchange_orders%rowtype;v_existing private.gold_exchange_order_requests%rowtype;
 v_qty bigint;v_price bigint;v_gross bigint;v_fee bigint;v_net bigint;v_reserve numeric;v_expedition_type text;v_touched uuid[];v_fee_bps integer;v_id uuid;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 perform private.sync_market_economy_from_latest_save(v_user);
 if p_request_id is null then raise exception 'GOLD_EXCHANGE_REQUEST_REQUIRED';end if;
 if p_side not in ('BUY_GOLD','SELL_GOLD') then raise exception 'GOLD_EXCHANGE_SIDE_INVALID';end if;
 if p_price_silver_per_gold is null or p_price_silver_per_gold<=0 or p_price_silver_per_gold>1000000000 then raise exception 'GOLD_EXCHANGE_PRICE_INVALID';end if;
 if p_gold_quantity is null or p_gold_quantity<=0 or p_gold_quantity>1000000 then raise exception 'GOLD_EXCHANGE_QUANTITY_INVALID';end if;
 select jsonb_typeof(payload->'expedition') into v_expedition_type from public.game_saves where user_id=v_user;
 if coalesce(v_expedition_type,'null')<>'null' then raise exception 'GOLD_EXCHANGE_EXPEDITION_BLOCKED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,31));
 select * into v_existing from private.gold_exchange_order_requests where user_id=v_user and request_id=p_request_id;
 if found then
  if v_existing.side<>p_side or v_existing.price_silver_per_gold<>p_price_silver_per_gold or v_existing.gold_quantity<>p_gold_quantity then raise exception 'GOLD_EXCHANGE_REQUEST_CONFLICT';end if;
  return private.gold_exchange_state_json(v_user);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('GOLD/SILVER',32));
 select * into v_wallet from private.player_wallets where user_id=v_user for update;if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 if p_side='BUY_GOLD' then
  v_reserve:=p_price_silver_per_gold::numeric*p_gold_quantity::numeric;if v_reserve>9223372036854775807 then raise exception 'GOLD_EXCHANGE_TOTAL_INVALID';end if;
  if v_wallet.silver<v_reserve::bigint then raise exception 'INSUFFICIENT_SILVER';end if;
  update private.player_wallets set silver=silver-v_reserve::bigint,updated_at=now() where user_id=v_user;v_fee_bps:=0;
 else
  if v_wallet.gold<p_gold_quantity then raise exception 'INSUFFICIENT_GOLD';end if;
  update private.player_wallets set gold=gold-p_gold_quantity,updated_at=now() where user_id=v_user;
  v_fee_bps:=coalesce(private.gold_exchange_seller_fee_bps(v_user),200);
 end if;
 insert into private.gold_exchange_orders(user_id,side,price_silver_per_gold,original_gold_quantity,remaining_gold_quantity,status,seller_fee_bps)
 values(v_user,p_side,p_price_silver_per_gold,p_gold_quantity,p_gold_quantity,'OPEN',v_fee_bps) returning * into v_incoming;
 insert into private.gold_exchange_order_requests(user_id,request_id,side,price_silver_per_gold,gold_quantity,order_id)
 values(v_user,p_request_id,p_side,p_price_silver_per_gold,p_gold_quantity,v_incoming.order_id);
 v_touched:=array[v_user];
 loop
  exit when v_incoming.remaining_gold_quantity<=0;
  if v_incoming.side='BUY_GOLD' then
   select * into v_resting from private.gold_exchange_orders where side='SELL_GOLD' and status in ('OPEN','PARTIAL') and remaining_gold_quantity>0 and price_silver_per_gold<=v_incoming.price_silver_per_gold and user_id<>v_user order by price_silver_per_gold asc,created_at asc,order_id asc limit 1 for update;
  else
   select * into v_resting from private.gold_exchange_orders where side='BUY_GOLD' and status in ('OPEN','PARTIAL') and remaining_gold_quantity>0 and price_silver_per_gold>=v_incoming.price_silver_per_gold and user_id<>v_user order by price_silver_per_gold desc,created_at asc,order_id asc limit 1 for update;
  end if;
  exit when not found;
  if v_incoming.side='BUY_GOLD' then v_buy:=v_incoming;v_sell:=v_resting;else v_buy:=v_resting;v_sell:=v_incoming;end if;
  v_qty:=least(v_buy.remaining_gold_quantity,v_sell.remaining_gold_quantity);v_price:=v_resting.price_silver_per_gold;v_gross:=v_price*v_qty;
  v_fee:=floor(v_gross::numeric*v_sell.seller_fee_bps::numeric/10000)::bigint;v_net:=v_gross-v_fee;
  if v_buy.price_silver_per_gold>v_price then update private.player_wallets set silver=silver+(v_buy.price_silver_per_gold-v_price)*v_qty,updated_at=now() where user_id=v_buy.user_id;end if;
  update private.player_wallets set gold=gold+v_qty,updated_at=now() where user_id=v_buy.user_id;
  update private.player_wallets set silver=silver+v_net,updated_at=now() where user_id=v_sell.user_id;
  insert into private.gold_exchange_trades(price_silver_per_gold,gold_quantity,gross_silver,seller_fee_silver,seller_net_silver,seller_fee_bps,buy_order_id,sell_order_id,buyer_id,seller_id)
  values(v_price,v_qty,v_gross,v_fee,v_net,v_sell.seller_fee_bps,v_buy.order_id,v_sell.order_id,v_buy.user_id,v_sell.user_id);
  update private.gold_exchange_orders set remaining_gold_quantity=remaining_gold_quantity-v_qty,status=case when remaining_gold_quantity-v_qty=0 then 'FILLED' when remaining_gold_quantity-v_qty<original_gold_quantity then 'PARTIAL' else 'OPEN' end,updated_at=now() where order_id=v_buy.order_id;
  update private.gold_exchange_orders set remaining_gold_quantity=remaining_gold_quantity-v_qty,status=case when remaining_gold_quantity-v_qty=0 then 'FILLED' when remaining_gold_quantity-v_qty<original_gold_quantity then 'PARTIAL' else 'OPEN' end,updated_at=now() where order_id=v_sell.order_id;
  if not(v_resting.user_id=any(v_touched)) then v_touched:=array_append(v_touched,v_resting.user_id);end if;
  select * into v_incoming from private.gold_exchange_orders where order_id=v_incoming.order_id;
 end loop;
 foreach v_id in array v_touched loop perform private.persist_market_economy_to_save(v_id);end loop;
 perform realtime.send(jsonb_build_object('pair','GOLD/SILVER'),'gold_exchange_changed','market',true);
 return private.gold_exchange_state_json(v_user);
end;$$;
revoke all on function public.place_online_gold_exchange_order(uuid,bigint,text,text,uuid,text,bigint,bigint) from public,anon,authenticated;
grant execute on function public.place_online_gold_exchange_order(uuid,bigint,text,text,uuid,text,bigint,bigint) to authenticated;

create or replace function public.cancel_online_gold_exchange_order(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid,p_order_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid;v_order private.gold_exchange_orders%rowtype;v_existing private.gold_exchange_cancel_requests%rowtype;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 perform private.sync_market_economy_from_latest_save(v_user);
 if p_request_id is null then raise exception 'GOLD_EXCHANGE_CANCEL_REQUEST_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,33));
 select * into v_existing from private.gold_exchange_cancel_requests where user_id=v_user and request_id=p_request_id;
 if found then if v_existing.order_id<>p_order_id then raise exception 'GOLD_EXCHANGE_CANCEL_REQUEST_CONFLICT';end if;return private.gold_exchange_state_json(v_user);end if;
 perform pg_advisory_xact_lock(hashtextextended('GOLD/SILVER',32));
 select * into v_order from private.gold_exchange_orders where order_id=p_order_id for update;
 if not found or v_order.user_id<>v_user or v_order.status not in ('OPEN','PARTIAL') or v_order.remaining_gold_quantity<=0 then raise exception 'GOLD_EXCHANGE_ORDER_NOT_CANCELLABLE';end if;
 if v_order.side='BUY_GOLD' then update private.player_wallets set silver=silver+v_order.price_silver_per_gold*v_order.remaining_gold_quantity,updated_at=now() where user_id=v_user;
 else update private.player_wallets set gold=gold+v_order.remaining_gold_quantity,updated_at=now() where user_id=v_user;end if;
 update private.gold_exchange_orders set status='CANCELLED',updated_at=now() where order_id=p_order_id;
 insert into private.gold_exchange_cancel_requests(user_id,request_id,order_id) values(v_user,p_request_id,p_order_id);
 perform private.persist_market_economy_to_save(v_user);
 perform realtime.send(jsonb_build_object('pair','GOLD/SILVER'),'gold_exchange_changed','market',true);
 return private.gold_exchange_state_json(v_user);
end;$$;
revoke all on function public.cancel_online_gold_exchange_order(uuid,bigint,text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.cancel_online_gold_exchange_order(uuid,bigint,text,text,uuid,uuid) to authenticated;
