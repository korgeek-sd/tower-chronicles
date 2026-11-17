-- Tradable adventurer boxes use the server-owned life product ledger, never client grants.
CREATE OR REPLACE FUNCTION private.market_life_product_id(p_item text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select case when p_item in ('product:life:potion','product:life:attack_food','product:life:defense_food','product:life:experience_food','product:life:adventurer_box')
 then split_part(p_item,':',3) else null end
$function$;
revoke all on function private.market_life_product_id(text) from public,anon,authenticated;
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
    'experience_food',coalesce((l.products->>'experience_food')::bigint,0),
    'adventurer_box',coalesce((l.products->>'adventurer_box')::bigint,0))
    from private.village_life_players l where l.user_id=p_user),
    '{"potion":0,"attack_food":0,"defense_food":0,"experience_food":0,"adventurer_box":0}'::jsonb),
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
CREATE OR REPLACE FUNCTION public.buy_online_association_shop_item(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_request_id uuid, p_item_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid; a uuid; level integer; points bigint; bought integer; item private.online_association_shop_items%rowtype;
 previous private.association_operation_requests%rowtype; result jsonb; gear jsonb; gear_id text; kind text;
 kinds text[]:=array['association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff','expedition_iron_helmet','return_corps_plate_armor','mining_detail_reinforced_gloves','survey_corps_dust_boots','association_registration_tag','expedition_merit_ring'];
begin
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'ASSOCIATION_REQUEST_REQUIRED';end if;
 select * into previous from private.association_operation_requests where user_id=u and request_id=p_request_id;
 if found then
  if previous.operation<>'BUY' or previous.input<>jsonb_build_object('itemId',p_item_id) then raise exception 'ASSOCIATION_REQUEST_CONFLICT';end if;
  return previous.result||jsonb_build_object('state',private.association_shop_json(u),'record',private.cloud_record_json(u),'replayed',true);
 end if;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') then raise exception 'ASSOCIATION_DURING_EXPEDITION';end if;
 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 perform 1 from private.player_wallets where user_id=u for update;
 if not found then raise exception 'SERVER_WALLET_REQUIRED';end if;
 select m.association_id,x.association_level into a,level from private.online_association_members m join private.online_associations x using(association_id)
 where m.user_id=u and x.status='ACTIVE' for share of m,x;
 if not found then raise exception 'ASSOCIATION_NOT_JOINED';end if;
 select * into item from private.online_association_shop_items where item_id=p_item_id and enabled;
 if not found then raise exception 'ASSOCIATION_ITEM_NOT_FOUND';end if;
 if level<item.required_level then raise exception 'ASSOCIATION_LEVEL_REQUIRED';end if;
 select contribution_point into points from private.online_association_member_progression where association_id=a and user_id=u for update;
 if coalesce(points,0)<item.contribution_cost then raise exception 'ASSOCIATION_CONTRIBUTION_SHORTAGE';end if;
 select count(*) into bought from private.online_association_shop_purchases where user_id=u and item_id=p_item_id and purchased_at>=private.association_period_start(item.shop_type);
 if bought>=item.purchase_limit then raise exception 'ASSOCIATION_PURCHASE_LIMIT';end if;
 update private.online_association_member_progression set contribution_point=contribution_point-item.contribution_cost,updated_at=now() where association_id=a and user_id=u;
 if item.reward_type in('SILVER','GOLD') then
  update private.player_wallets set silver=silver+case when item.reward_type='SILVER' then item.reward_quantity else 0 end,
  gold=gold+case when item.reward_type='GOLD' then item.reward_quantity else 0 end,updated_at=now() where user_id=u;
 elsif item.reward_type='VITALITY_POTION' then
  insert into private.village_life_players(user_id) values(u) on conflict(user_id) do nothing;
  perform private.grant_vitality_potions(u,item.reward_quantity);
 elsif item.reward_type='APPEARANCE_TICKET' then
  insert into private.appearance_ticket_wallets(user_id,quantity) values(u,item.reward_quantity)
  on conflict(user_id) do update set quantity=private.appearance_ticket_wallets.quantity+excluded.quantity;
 elsif item.reward_type='POTION' then
  insert into private.player_consumables(user_id,item_id,quantity,updated_at) values(u,'healing_greater',item.reward_quantity,now())
  on conflict(user_id,item_id) do update set quantity=private.player_consumables.quantity+excluded.quantity,updated_at=now();
 elsif item.reward_type in('STONE','TICKET') then
  insert into private.market_assets(user_id,item_id,quantity,updated_at)
  values(u,case when item.reward_type='STONE' then 'other:enhancement_stone' else 'other:job_draw_ticket' end,item.reward_quantity,now())
  on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+excluded.quantity,updated_at=now();
 elsif item.item_id='rare_equipment_weekly' and item.reward_type='EQUIPMENT' then
  perform private.deliver_market_asset(u,'product:life:adventurer_box',item.reward_quantity,null);
 elsif item.reward_type='EQUIPMENT' then
  gear_id:=gen_random_uuid()::text;kind:=kinds[1+floor(private.job_registration_secure_unit()*9)::integer];
  gear:=jsonb_build_object('id',gear_id,'kind',kind,'grade','rare','enhancement',0);
  insert into private.market_assets(user_id,item_id,quantity,gear) values(u,'equipment_v2:'||gear_id,1,gear);
 else raise exception 'ASSOCIATION_ITEM_NOT_FOUND';end if;
 insert into private.online_association_shop_purchases(association_id,user_id,item_id,cost) values(a,u,p_item_id,item.contribution_cost);
 perform private.persist_server_association_to_save(u);
 result:=jsonb_build_object('reward',jsonb_build_object('name',item.item_name,'type',case when item.item_id='rare_equipment_weekly' then 'ADVENTURER_BOX' else item.reward_type end,'quantity',item.reward_quantity,'equipment',gear),'replayed',false);
 insert into private.association_operation_requests(user_id,request_id,operation,input,result) values(u,p_request_id,'BUY',jsonb_build_object('itemId',p_item_id),result);
 return result||jsonb_build_object('state',private.association_shop_json(u),'record',private.cloud_record_json(u));
end;$function$;
revoke all on function public.buy_online_association_shop_item(uuid,bigint,text,text,uuid,text) from public,anon;
grant execute on function public.buy_online_association_shop_item(uuid,bigint,text,text,uuid,text) to authenticated;
-- Keep the original weekly item ID so historical purchase limits remain intact.
update private.online_association_shop_items set item_name='모험가 상자 ×5',
 description='개봉 시 무작위 장비 1개씩 획득 · 거래 가능',reward_quantity=5
 where item_id='rare_equipment_weekly' and reward_type='EQUIPMENT';

create table if not exists private.adventurer_box_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 quantity integer not null check(quantity between 1 and 10),
 rewards jsonb not null check(jsonb_typeof(rewards)='array' and jsonb_array_length(rewards)=quantity),
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table private.adventurer_box_receipts enable row level security;
revoke all on private.adventurer_box_receipts from public,anon,authenticated;

create or replace function private.adventurer_box_grade(p_roll integer)
returns text language sql immutable strict set search_path='' as $$
 select case when p_roll between 0 and 499 then 'common'
  when p_roll between 500 and 849 then 'uncommon'
  when p_roll between 850 and 979 then 'rare'
  when p_roll between 980 and 998 then 'heroic'
  when p_roll=999 then 'legendary' else null end
$$;
revoke all on function private.adventurer_box_grade(integer) from public,anon,authenticated;

create or replace function public.open_adventurer_boxes(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid,p_quantity integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid; previous private.adventurer_box_receipts%rowtype;
 gear jsonb; rewards jsonb:='[]'::jsonb; gear_id text; kind text; grade text;
 kinds text[]:=array['association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff','expedition_iron_helmet','return_corps_plate_armor','mining_detail_reinforced_gloves','survey_corps_dust_boots','association_registration_tag','expedition_merit_ring'];
begin
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if u is null or u<>auth.uid() then raise exception 'AUTH_REQUIRED';end if;
 if p_request_id is null or p_quantity is null or p_quantity not between 1 and 10 then raise exception 'BOX_COUNT_INVALID';end if;
 perform 1 from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 select * into previous from private.adventurer_box_receipts where user_id=u and request_id=p_request_id;
 if found then
  if previous.quantity<>p_quantity then raise exception 'BOX_REQUEST_CONFLICT';end if;
  perform private.refresh_village_life(u);
  return jsonb_build_object('replayed',true,'rewards',previous.rewards,'state',private.village_life_snapshot(u),'record',private.cloud_record_json(u));
 end if;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') then raise exception 'BOX_EXPEDITION_BLOCKED';end if;
 perform private.sync_market_economy_from_latest_save(u);
 perform private.refresh_village_life(u);
 update private.village_life_players set products=jsonb_set(products,array['adventurer_box'],
  to_jsonb(coalesce((products->>'adventurer_box')::bigint,0)-p_quantity),true)
 where user_id=u and coalesce((products->>'adventurer_box')::bigint,0)>=p_quantity;
 if not found then raise exception 'BOX_INSUFFICIENT';end if;
 for i in 1..p_quantity loop
  gear_id:=gen_random_uuid()::text;
  kind:=kinds[1+floor(private.job_registration_secure_unit()*9)::integer];
  grade:=private.adventurer_box_grade(floor(private.job_registration_secure_unit()*1000)::integer);
  gear:=jsonb_build_object('id',gear_id,'kind',kind,'grade',grade,'enhancement',0);
  insert into private.market_assets(user_id,item_id,quantity,gear) values(u,'equipment_v2:'||gear_id,1,gear);
  rewards:=rewards||jsonb_build_array(gear);
 end loop;
 insert into private.adventurer_box_receipts(user_id,request_id,quantity,rewards) values(u,p_request_id,p_quantity,rewards);
 perform private.persist_market_economy_to_save(u);
 return jsonb_build_object('replayed',false,'rewards',rewards,'state',private.village_life_snapshot(u),'record',private.cloud_record_json(u));
end
$$;
revoke all on function public.open_adventurer_boxes(uuid,bigint,text,text,uuid,integer) from public,anon;
grant execute on function public.open_adventurer_boxes(uuid,bigint,text,text,uuid,integer) to authenticated;
