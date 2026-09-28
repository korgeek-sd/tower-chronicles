-- v0.1.64: fixed-price V2 equipment marketplace.
-- Registration fee: 1%, min 100 S, max 100000 S, non-refundable.
-- Seller fee: 5% on completed sale. Buyer pays list price only.
-- Listings last 72 hours. No bidding.

create table if not exists private.equipment_market_listings (
  listing_id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  buyer_id uuid references auth.users(id) on delete set null,
  asset_item_id text not null unique,
  market_key text not null,
  kind text not null,
  grade text not null,
  enhancement integer not null check (enhancement between 0 and 10),
  list_price bigint not null check (list_price > 0),
  registration_fee bigint not null check (registration_fee >= 0),
  seller_fee_bps integer not null default 500 check (seller_fee_bps = 500),
  gear jsonb not null,
  status text not null default 'OPEN' check (status in ('OPEN','SOLD','CANCELLED','EXPIRED')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '72 hours'),
  updated_at timestamptz not null default now(),
  sold_at timestamptz
);
create index if not exists equipment_market_open_key_price_idx
on private.equipment_market_listings(market_key,list_price,created_at,listing_id)
where status='OPEN';
create index if not exists equipment_market_seller_idx
on private.equipment_market_listings(seller_id,status,created_at desc);
alter table private.equipment_market_listings enable row level security;
revoke all on private.equipment_market_listings from public,anon,authenticated;

create table if not exists private.equipment_market_trades (
  trade_id uuid primary key default gen_random_uuid(),
  listing_id uuid not null,
  asset_item_id text not null,
  market_key text not null,
  kind text not null,
  grade text not null,
  enhancement integer not null,
  price bigint not null check (price > 0),
  seller_fee_silver bigint not null check (seller_fee_silver >= 0),
  seller_net_silver bigint not null check (seller_net_silver >= 0),
  seller_id uuid not null references auth.users(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  gear jsonb not null,
  executed_at timestamptz not null default now()
);
create index if not exists equipment_market_trades_key_idx
on private.equipment_market_trades(market_key,executed_at desc);
alter table private.equipment_market_trades enable row level security;
revoke all on private.equipment_market_trades from public,anon,authenticated;

create or replace function private.equipment_market_registration_fee(p_price bigint)
returns bigint
language sql immutable set search_path=''
as $$
  select least(100000::bigint,greatest(100::bigint,ceil(p_price::numeric/100)::bigint))
$$;
revoke all on function private.equipment_market_registration_fee(bigint)
from public,anon,authenticated;

create or replace function private.equipment_market_key(p_gear jsonb)
returns text
language sql immutable set search_path=''
as $$
  select 'equipment:'||coalesce(p_gear->>'kind','')||':'||coalesce(p_gear->>'grade','')||':+'||coalesce(p_gear->>'enhancement','0')
$$;
revoke all on function private.equipment_market_key(jsonb)
from public,anon,authenticated;

create or replace function private.expire_equipment_market_listings()
returns integer
language plpgsql security definer set search_path=''
as $$
declare
  v_listing private.equipment_market_listings%rowtype;
  v_count integer:=0;
begin
  for v_listing in
    select *
    from private.equipment_market_listings
    where status='OPEN' and expires_at<=now()
    order by expires_at,listing_id
    for update skip locked
  loop
    insert into private.market_assets(user_id,item_id,quantity,gear,updated_at)
    values(v_listing.seller_id,v_listing.asset_item_id,1,v_listing.gear,now())
    on conflict(user_id,item_id) do update
    set quantity=1,gear=excluded.gear,updated_at=now();

    update private.equipment_market_listings
    set status='EXPIRED',updated_at=now()
    where listing_id=v_listing.listing_id;

    perform private.persist_market_economy_to_save(v_listing.seller_id);
    v_count:=v_count+1;
  end loop;
  return v_count;
end;$$;
revoke all on function private.expire_equipment_market_listings()
from public,anon,authenticated;

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
  ) order by s.created_at desc,s.storage_id) from private.market_storage s where s.user_id=p_user),'[]'::jsonb),
  'equipmentPolicy',jsonb_build_object(
    'registrationFeeBps',100,
    'minRegistrationFee',100,
    'maxRegistrationFee',100000,
    'sellerFeeBps',500,
    'durationHours',72
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
$$;
revoke all on function private.market_state_json(uuid)
from public,anon,authenticated;

create or replace function public.get_online_market_state()
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
  perform private.expire_equipment_market_listings();
  perform private.sync_market_economy_from_latest_save(v_user);
  return private.market_state_json(v_user);
end;$$;
revoke all on function public.get_online_market_state() from public,anon;
grant execute on function public.get_online_market_state() to authenticated;

create or replace function public.list_online_equipment(
  p_lease_id uuid,
  p_generation bigint,
  p_client_instance_id text,
  p_device_id text,
  p_item_id text,
  p_list_price bigint
) returns jsonb
language plpgsql security definer set search_path=''
as $$
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
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.expire_equipment_market_listings();
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
    v_user,'equipment_v2:'||p_item_id,v_market_key,v_kind,v_grade,v_level,p_list_price,v_fee,500,v_asset.gear,'OPEN',now()+interval '72 hours'
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
end;$$;

revoke all on function public.list_online_equipment(uuid,bigint,text,text,text,bigint)
from public,anon;
grant execute on function public.list_online_equipment(uuid,bigint,text,text,text,bigint)
to authenticated;

create or replace function public.cancel_online_equipment_listing(
  p_lease_id uuid,
  p_generation bigint,
  p_client_instance_id text,
  p_device_id text,
  p_listing_id uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid;
  v_listing private.equipment_market_listings%rowtype;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.expire_equipment_market_listings();
  perform private.sync_market_economy_from_latest_save(v_user);

  select * into v_listing
  from private.equipment_market_listings
  where listing_id=p_listing_id
  for update;
  if not found or v_listing.seller_id<>v_user or v_listing.status<>'OPEN' then
    raise exception 'EQUIPMENT_MARKET_LISTING_NOT_CANCELLABLE';
  end if;

  insert into private.market_assets(user_id,item_id,quantity,gear,updated_at)
  values(v_user,v_listing.asset_item_id,1,v_listing.gear,now())
  on conflict(user_id,item_id) do update
  set quantity=1,gear=excluded.gear,updated_at=now();

  update private.equipment_market_listings
  set status='CANCELLED',updated_at=now()
  where listing_id=v_listing.listing_id;

  perform private.persist_market_economy_to_save(v_user);
  perform realtime.send(jsonb_build_object('itemId',v_listing.market_key),'market_changed','market',true);
  return private.market_state_json(v_user);
end;$$;

revoke all on function public.cancel_online_equipment_listing(uuid,bigint,text,text,uuid)
from public,anon;
grant execute on function public.cancel_online_equipment_listing(uuid,bigint,text,text,uuid)
to authenticated;

create or replace function public.buy_online_equipment_listing(
  p_lease_id uuid,
  p_generation bigint,
  p_client_instance_id text,
  p_device_id text,
  p_listing_id uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid;
  v_listing private.equipment_market_listings%rowtype;
  v_wallet private.player_wallets%rowtype;
  v_trade_id uuid;
  v_seller_fee bigint;
  v_seller_net bigint;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.expire_equipment_market_listings();
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

  insert into private.market_storage(user_id,trade_id,side,item_id,quantity,silver,gear,created_at)
  values(v_listing.seller_id,v_trade_id,'SELL',v_listing.asset_item_id,1,v_seller_net,null,now());

  update private.equipment_market_listings
  set status='SOLD',buyer_id=v_user,sold_at=now(),updated_at=now()
  where listing_id=v_listing.listing_id;

  perform private.persist_market_economy_to_save(v_user);
  perform realtime.send(jsonb_build_object('itemId',v_listing.market_key),'market_changed','market',true);
  return private.market_state_json(v_user);
end;$$;

revoke all on function public.buy_online_equipment_listing(uuid,bigint,text,text,uuid)
from public,anon;
grant execute on function public.buy_online_equipment_listing(uuid,bigint,text,text,uuid)
to authenticated;
