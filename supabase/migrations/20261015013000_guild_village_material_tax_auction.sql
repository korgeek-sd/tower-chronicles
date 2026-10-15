
-- Guild-controlled 0–30% village gather tax and 24h contribution material auction.
-- All inventory movements occur in one server transaction, never by client-side subtraction.
create table private.guild_village_tax(
 town_id text primary key references private.village_life_towns(id),
 owner_association_id uuid not null references private.online_associations(association_id) on delete cascade,
 tax_rate integer not null default 10 check(tax_rate between 0 and 30),
 changed_at timestamptz not null default now()
);
create table private.guild_material_stock(
 association_id uuid not null references private.online_associations(association_id) on delete cascade,
 material text not null check(material in('herb','pepper','potato','wheat')),
 quantity bigint not null default 0 check(quantity>=0),
 primary key(association_id,material)
);
create table private.guild_material_ledger(
 entry_id bigint generated always as identity primary key,
 association_id uuid not null references private.online_associations(association_id) on delete cascade,
 actor_user_id uuid references auth.users(id) on delete set null,
 operation text not null check(operation in('GATHER_TAX','DEPOSIT','WITHDRAW','AUCTION_LIST','AUCTION_RETURN')),
 material text not null check(material in('herb','pepper','potato','wheat')),
 amount bigint not null,
 balance_after bigint not null check(balance_after>=0),
 town_id text references private.village_life_towns(id),
 listing_id uuid,
 detail text not null default '',
 created_at timestamptz not null default now()
);
create index guild_material_ledger_recent on private.guild_material_ledger(association_id,entry_id desc);
create table private.guild_material_request_receipts(
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 request jsonb not null,
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table private.guild_village_tax enable row level security;
alter table private.guild_material_stock enable row level security;
alter table private.guild_material_ledger enable row level security;
alter table private.guild_material_request_receipts enable row level security;
revoke all on private.guild_village_tax,private.guild_material_stock,private.guild_material_ledger,private.guild_material_request_receipts from public,anon,authenticated;
alter table private.guild_auction_listings add column material_id text;
alter table private.guild_auction_listings add column material_quantity bigint;
alter table private.guild_auction_listings add column material_request_id uuid;
alter table private.guild_auction_listings add constraint guild_auction_material_payload_chk
 check ((source='MATERIAL' and material_id in('herb','pepper','potato','wheat') and material_quantity>0)
 or (source<>'MATERIAL' and material_id is null and material_quantity is null));
alter table private.guild_auction_listings drop constraint if exists guild_auction_listings_source_check;
alter table private.guild_auction_listings add constraint guild_auction_listings_source_check
 check(source in('BOSS','TREASURY','LEADER','MATERIAL'));
create unique index guild_auction_material_request_key
 on private.guild_auction_listings(association_id,material_request_id)
 where material_request_id is not null;



create or replace function private.guild_materials_state(u uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare aid uuid;leader boolean;stock jsonb;owned jsonb;history jsonb;personal jsonb;
begin
 select m.association_id,(m.role='LEADER' and a.leader_user_id=u and a.status='ACTIVE')
 into aid,leader
 from private.online_association_members m join private.online_associations a on a.association_id=m.association_id
 where m.user_id=u and a.status='ACTIVE';
 if aid is null then raise exception 'ASSOCIATION_NOT_JOINED';end if;
 select jsonb_object_agg(k,coalesce(s.quantity,0)) into stock
 from unnest(array['herb','pepper','potato','wheat']) k
 left join private.guild_material_stock s on s.association_id=aid and s.material=k;
 select coalesce(materials,'{}'::jsonb) into personal from private.village_life_players where user_id=u;
 select coalesce(jsonb_agg(jsonb_build_object(
  'townId',t.id,'name',t.name,'owned',o.association_id=aid,
  'owner',coalesce(a.name,'중립'),'rate',case when o.association_id is null then 0 when st.owner_association_id=o.association_id then st.tax_rate else 10 end,
  'changedAt',case when st.owner_association_id=o.association_id then st.changed_at else null end
 ) order by t.y,t.x),'[]'::jsonb) into owned
 from private.village_life_towns t
 left join private.village_war_owners o on o.town_id=t.id
 left join private.online_associations a on a.association_id=o.association_id and a.status='ACTIVE'
 left join private.guild_village_tax st on st.town_id=t.id;
 select coalesce(jsonb_agg(jsonb_build_object(
  'entryId',e.entry_id,'operation',e.operation,'material',e.material,
  'amount',e.amount,'balanceAfter',e.balance_after,'townId',e.town_id,
  'detail',e.detail,'createdAt',e.created_at,
  'actorName',coalesce((select nick.nickname from public.game_player_profiles nick where nick.user_id=e.actor_user_id),'기록 없음')
 ) order by e.entry_id desc),'[]'::jsonb) into history
 from (select * from private.guild_material_ledger where association_id=aid order by entry_id desc limit 60) e;
 return jsonb_build_object('associationId',aid,'isLeader',leader,
  'materials',coalesce(stock,'{}'::jsonb),'personal',coalesce(personal,'{}'::jsonb),
  'towns',coalesce(owned,'[]'::jsonb),'ledger',coalesce(history,'[]'::jsonb));
end $$;
revoke all on function private.guild_materials_state(uuid) from public,anon,authenticated;

create or replace function public.get_guild_materials(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 perform private.refresh_village_life(u);
 return private.guild_materials_state(u);
end $$;

create or replace function public.set_guild_village_tax(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_town_id text,p_tax_rate integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;aid uuid;current_owner uuid;old private.guild_village_tax%rowtype;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_tax_rate is null or p_tax_rate<0 or p_tax_rate>30 then raise exception 'GUILD_TAX_RATE_INVALID';end if;
 -- Synchronize tax changes with gathering: both lock the town before resolving tax.
 perform 1 from private.village_life_towns where id=p_town_id for update;
 if not found then raise exception 'TOWN_INVALID';end if;
 select m.association_id into aid
 from private.online_association_members m join private.online_associations a on a.association_id=m.association_id
 where m.user_id=u and m.role='LEADER' and a.leader_user_id=u and a.status='ACTIVE';
 if aid is null then raise exception 'GUILD_LEADER_ONLY';end if;
 select association_id into current_owner from private.village_war_owners where town_id=p_town_id;
 if current_owner is distinct from aid then raise exception 'GUILD_TOWN_NOT_OWNED';end if;
 select * into old from private.guild_village_tax where town_id=p_town_id for update;
 if found and old.owner_association_id=aid and old.tax_rate=p_tax_rate then return private.guild_materials_state(u);end if;
 if found and old.owner_association_id=aid and old.changed_at>clock_timestamp()-interval '24 hours' then
  raise exception 'GUILD_TAX_COOLDOWN';end if;
 insert into private.guild_village_tax(town_id,owner_association_id,tax_rate,changed_at)
 values(p_town_id,aid,p_tax_rate,clock_timestamp())
 on conflict(town_id) do update set owner_association_id=excluded.owner_association_id,tax_rate=excluded.tax_rate,changed_at=excluded.changed_at;
 perform private.association_activity(aid,u,'AUCTION','마을 '||p_town_id||' 채집 세율 '||p_tax_rate||'% 변경');
 return private.guild_materials_state(u);
end $$;

create or replace function public.transfer_guild_material(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_request_id uuid,p_direction text,p_material text,p_amount bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;aid uuid;r jsonb;old jsonb;own bigint;balance bigint;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null or p_direction not in('DEPOSIT','WITHDRAW') or p_material not in('herb','pepper','potato','wheat')
 or p_amount is null or p_amount<1 or p_amount>1000000000 then raise exception 'GUILD_MATERIAL_INPUT_INVALID';end if;
 perform private.refresh_village_life(u);
 perform 1 from private.village_life_players where user_id=u for update;
 select m.association_id into aid
 from private.online_association_members m join private.online_associations a on a.association_id=m.association_id
 where m.user_id=u and m.role='LEADER' and a.leader_user_id=u and a.status='ACTIVE';
 if aid is null then raise exception 'GUILD_LEADER_ONLY';end if;
 r:=jsonb_build_object('direction',p_direction,'material',p_material,'amount',p_amount,'associationId',aid);
 select request into old from private.guild_material_request_receipts where user_id=u and request_id=p_request_id;
 if found then
  if old<>r then raise exception 'GUILD_MATERIAL_REQUEST_CONFLICT';end if;
  return jsonb_build_object('replayed',true,'state',private.guild_materials_state(u));
 end if;
 insert into private.guild_material_stock(association_id,material,quantity) values(aid,p_material,0) on conflict do nothing;
 if p_direction='DEPOSIT' then
  select coalesce((materials->>p_material)::bigint,0) into own from private.village_life_players where user_id=u;
  if own<p_amount then raise exception 'GUILD_MATERIAL_PERSONAL_SHORT';end if;
  update private.village_life_players set materials=jsonb_set(materials,array[p_material],to_jsonb(own-p_amount),true) where user_id=u;
  update private.guild_material_stock set quantity=quantity+p_amount where association_id=aid and material=p_material returning quantity into balance;
 else
  update private.guild_material_stock set quantity=quantity-p_amount
  where association_id=aid and material=p_material and quantity>=p_amount returning quantity into balance;
  if not found then raise exception 'GUILD_MATERIAL_STOCK_SHORT';end if;
  update private.village_life_players set materials=jsonb_set(materials,array[p_material],to_jsonb(coalesce((materials->>p_material)::bigint,0)+p_amount),true) where user_id=u;
 end if;
 insert into private.guild_material_ledger(association_id,actor_user_id,operation,material,amount,balance_after,detail)
 values(aid,u,p_direction,p_material,case when p_direction='DEPOSIT' then p_amount else -p_amount end,balance,'길드장 직접 '||case when p_direction='DEPOSIT' then '입고' else '인출' end);
 insert into private.guild_material_request_receipts(user_id,request_id,request) values(u,p_request_id,r);
 return jsonb_build_object('replayed',false,'state',private.guild_materials_state(u));
end $$;


CREATE OR REPLACE FUNCTION private.village_life_snapshot(u uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare today date:=(clock_timestamp() at time zone 'Asia/Seoul')::date;s private.village_life_players%rowtype;towns jsonb;
begin
 select * into strict s from private.village_life_players where user_id=u;
 select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'kind',t.kind,'x',t.x,'y',t.y,'owner',coalesce(g.name,'중립'),'tax',case when ow.association_id is null then 0 when ts.owner_association_id=ow.association_id then ts.tax_rate else 10 end,
 'herbCapacity',t.herb_capacity,'farmCapacity',t.farm_capacity,
 'herbRemaining',case when t.day<today then t.herb_capacity else t.herb_remaining end,
 'farmRemaining',case when t.day<today then t.farm_capacity else t.farm_remaining end) order by t.y,t.x) into towns from private.village_life_towns t
  left join private.village_war_owners ow on ow.town_id=t.id
  left join private.online_associations g on g.association_id=ow.association_id and g.status='ACTIVE'
  left join private.guild_village_tax ts on ts.town_id=t.id;
 return jsonb_build_object('location',s.location,'actionPoints',case when s.day<today then 100 else s.action_points end,'materials',s.materials||jsonb_build_object('stone',coalesce((s.materials->>'stone')::bigint,0)), 'products',s.products,'craftMastery',s.craft_mastery,'craftCarry',s.craft_carry,'foodTurns',s.food_turns,'wellReadyAt',coalesce(extract(epoch from s.well_ready_at)*1000,0),'health',(select jsonb_build_object('hp',h.current_hp,'maxHp',h.max_hp) from private.hunting_states h where h.user_id=u),'towns',towns,
 'serverNow',extract(epoch from clock_timestamp())*1000,'nextResetAt',extract(epoch from ((today+1)::timestamp at time zone 'Asia/Seoul'))*1000);
end $function$
;

CREATE OR REPLACE FUNCTION public.gather_village(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_request_id uuid, p_town_id text, p_resource text, p_count integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid;s private.village_life_players%rowtype;t private.village_life_towns%rowtype;r private.village_life_receipts%rowtype;
 today date;gains jsonb:='{}';net_gains jsonb:='{}';tax_gains jsonb:='{}';
  m jsonb;item text;i integer;total integer;result jsonb;
  tax_guild uuid;tax_rate integer:=0;gross_count bigint;tax_count bigint;balance bigint;
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'REQUEST_REQUIRED';end if;
 if p_count is null or p_count<1 or p_count>100 then raise exception 'COUNT_INVALID';end if;
 if p_resource is null or p_resource not in ('herb','farm') then raise exception 'RESOURCE_INVALID';end if;
 perform private.refresh_village_life(u);
 select * into strict s from private.village_life_players where user_id=u;
 select * into r from private.village_life_receipts where user_id=u and request_id=p_request_id;
 if found then
  if r.town_id is distinct from p_town_id or r.resource<>p_resource or r.count<>p_count then raise exception 'REQUEST_CONFLICT';end if;
  return jsonb_build_object('state',private.village_life_snapshot(u),'result',r.result,'replayed',true);
 end if;
 if s.location is distinct from p_town_id then raise exception 'LOCATION_MISMATCH';end if;
 select * into t from private.village_life_towns where id=p_town_id for update;
 if not found then raise exception 'TOWN_INVALID';end if;
 if t.kind<>p_resource and t.kind<>'city' then raise exception 'RESOURCE_INVALID';end if;
 today:=(clock_timestamp() at time zone 'Asia/Seoul')::date;
 if t.day<today then t.herb_remaining:=t.herb_capacity;t.farm_remaining:=t.farm_capacity;t.day:=today;end if;
 -- Re-evaluate the player date after waiting for shared town stock across midnight.
 if s.day<today then s.action_points:=100;s.day:=today;end if;
 if s.action_points<p_count then raise exception 'ACTION_POINTS_EMPTY';end if;
 total:=p_count*10;
 if (p_resource='herb' and t.herb_remaining<total) or (p_resource='farm' and t.farm_remaining<total) then raise exception 'TOWN_STOCK_EMPTY';end if;
 m:=s.materials;
 for i in 1..p_count loop
  item:=case when p_resource='herb' then 'herb' else (array['pepper','potato','wheat'])[floor(random()*3)::integer+1] end;
  gains:=jsonb_set(gains,array[item],to_jsonb(coalesce((gains->>item)::bigint,0)+10),true);
  m:=jsonb_set(m,array[item],to_jsonb(coalesce((m->>item)::bigint,0)+10),true);
 end loop;
 -- The town row is locked above. Tax changes also lock that town.
 select w.association_id,
   case when tx.owner_association_id=w.association_id then tx.tax_rate else 10 end
 into tax_guild,tax_rate
 from private.village_war_owners w
 join private.online_associations a on a.association_id=w.association_id and a.status='ACTIVE'
 left join private.guild_village_tax tx on tx.town_id=w.town_id
 where w.town_id=p_town_id;
 if tax_guild is null then tax_rate:=0;end if;
 for item,gross_count in select key,value::bigint from jsonb_each_text(gains) loop
  tax_count:=floor(gross_count*tax_rate/100.0)::bigint;
  net_gains:=jsonb_set(net_gains,array[item],to_jsonb(gross_count-tax_count),true);
  if tax_count>0 then
   m:=jsonb_set(m,array[item],to_jsonb(coalesce((m->>item)::bigint,0)-tax_count),true);
   tax_gains:=jsonb_set(tax_gains,array[item],to_jsonb(tax_count),true);
   insert into private.guild_material_stock(association_id,material,quantity)
   values(tax_guild,item,tax_count)
   on conflict(association_id,material) do update set quantity=private.guild_material_stock.quantity+excluded.quantity
   returning quantity into balance;
   insert into private.guild_material_ledger(association_id,actor_user_id,operation,material,amount,balance_after,town_id,detail)
   values(tax_guild,u,'GATHER_TAX',item,tax_count,balance,p_town_id,'마을 채집 세금 '||tax_rate||'%');
  end if;
 end loop;
 update private.village_life_players set action_points=s.action_points-p_count,materials=m,day=s.day where user_id=u;
 update private.village_life_towns set day=t.day,herb_remaining=t.herb_remaining-case when p_resource='herb' then total else 0 end,
 farm_remaining=t.farm_remaining-case when p_resource='farm' then total else 0 end where id=p_town_id;
 result:=jsonb_build_object('townId',p_town_id,'resource',p_resource,'count',p_count,'actionPointsSpent',p_count,'gains',net_gains,'tax',tax_gains,'taxRate',tax_rate);
 insert into private.village_life_receipts(user_id,request_id,town_id,resource,count,result) values(u,p_request_id,p_town_id,p_resource,p_count,result);
 return jsonb_build_object('state',private.village_life_snapshot(u),'result',result,'replayed',false);
end $function$
;

CREATE OR REPLACE FUNCTION private.guild_auction_state_json(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare aid uuid;points bigint;items jsonb;rewards jsonb;mine jsonb;leader boolean;
begin
 select association_id into aid from private.online_association_members where user_id=p_user;
 if not found then raise exception 'ASSOCIATION_NOT_JOINED';end if;
 select exists(select 1 from private.online_association_members m join private.online_associations a on a.association_id=m.association_id
 where m.user_id=p_user and m.association_id=aid and m.role='LEADER' and a.leader_user_id=p_user and a.status='ACTIVE') into leader;
 select coalesce(contribution_point,0) into points from private.online_association_member_progression
 where association_id=aid and user_id=p_user;
 select coalesce(jsonb_agg(jsonb_build_object(
  'listingId',x.listing_id,'source',x.source,'gear',x.gear,'materialId',x.material_id,'materialQuantity',x.material_quantity,'startingBid',x.starting_bid,
  'sellerId',x.seller_id,'isMyListing',x.seller_id=p_user,
  'cancelledAt',x.cancelled_at,'returnedAt',x.returned_at,
  'canCancel',x.source='LEADER' and x.seller_id=p_user and x.ends_at>clock_timestamp() and x.top_user_id is null and x.cancelled_at is null and x.returned_at is null,
  'canReturn',x.source='LEADER' and x.seller_id=p_user and x.ends_at<=clock_timestamp() and x.top_user_id is null and x.cancelled_at is null and x.returned_at is null,
  'canReturnMaterial',leader and x.source='MATERIAL' and x.top_user_id is null and x.returned_at is null and x.cancelled_at is null,
  'canRelist',leader and x.source='BOSS' and x.ends_at<=clock_timestamp() and x.top_user_id is null and x.cancelled_at is null and x.returned_at is null,
  'topBid',x.top_bid,'nextBid',case when x.top_bid=0 then x.starting_bid else x.top_bid+greatest(10,ceil(x.top_bid*.05)::bigint) end,
  'topUserId',x.top_user_id,'startedAt',x.started_at,'endsAt',x.ends_at,'claimedAt',x.claimed_at,
  'status',case when x.returned_at is not null then 'RETURNED' when x.cancelled_at is not null then 'CANCELLED'
  when x.claimed_at is not null then 'CLAIMED' when x.ends_at>clock_timestamp() then 'OPEN' when x.top_user_id is null then 'UNSOLD' else 'SOLD' end,
  'isMyTopBid',x.top_user_id=p_user) order by x.started_at desc),'[]'::jsonb)
 into items from (select * from private.guild_auction_listings where association_id=aid
  and (ends_at>clock_timestamp()-interval '30 days' or (top_user_id=p_user and claimed_at is null)
  or (seller_id=p_user and returned_at is null and top_user_id is null)
  or (leader and source in('BOSS','MATERIAL') and top_user_id is null and cancelled_at is null and returned_at is null))
  order by started_at desc limit 60) x;
 select coalesce(jsonb_agg(jsonb_build_object('encounterId',e.encounter_id,'name',e.boss_name,
  'kind',e.kind,'defeatedAt',e.defeated_at,'silver',case when e.kind='DAILY' then 3000 else 10000 end,
  'contribution',case when e.kind='DAILY' then 30 else 100 end,
  'potions',case when e.kind='DAILY' then 10 else 30 end,
  'vitalityPotions',case when e.kind='WEEKLY' then 1 else 0 end)
  order by e.defeated_at desc),'[]'::jsonb) into rewards
 from private.guild_boss_encounters e
 where e.association_id=aid and e.defeated_at is not null
 and exists(select 1 from private.guild_boss_attacks t where t.encounter_id=e.encounter_id and t.user_id=p_user and t.damage>0)
 and not exists(select 1 from private.guild_boss_reward_claims c where c.encounter_id=e.encounter_id and c.user_id=p_user);
 if leader then
  select coalesce(jsonb_agg(jsonb_build_object('itemId',x.item_id,'gear',x.gear) order by x.item_id),'[]'::jsonb)
  into mine from (
   select a.item_id,a.gear from private.market_assets a
   join public.game_saves s on s.user_id=a.user_id
   where a.user_id=p_user and a.item_id like 'equipment_v2:%' and a.quantity=1 and a.gear is not null
    and not exists(select 1 from jsonb_each_text(coalesce(s.payload->'equipped','{}'::jsonb)) e
     where e.value=a.gear->>'id')
   order by a.item_id limit 100
  ) x;
 else mine:='[]'::jsonb;
 end if;
 return jsonb_build_object('associationId',aid,'points',coalesce(points,0),'isLeader',leader,
  'availableEquipment',coalesce(mine,'[]'::jsonb),'listings',items,'claimableRewards',rewards);
end;$function$
;

CREATE OR REPLACE FUNCTION public.claim_guild_auction_item(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_listing_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid;l private.guild_auction_listings%rowtype;s public.game_saves%rowtype;aid uuid;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into s from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 select m.association_id into aid from private.online_association_members m where m.user_id=u;
 if not found then raise exception 'ASSOCIATION_NOT_JOINED';end if;
 select * into l from private.guild_auction_listings
 where listing_id=p_listing_id and association_id=aid for update;
 if not found or l.top_user_id is distinct from u or l.ends_at>now() or l.cancelled_at is not null or l.returned_at is not null then raise exception 'GUILD_AUCTION_NOT_WINNER';end if;
 if l.claimed_at is not null then
  return jsonb_build_object('replayed',true,'record',private.cloud_record_json(u),'state',private.guild_auction_state_json(u));
 end if;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE')
 or coalesce(s.payload->>'expedition','null')<>'null' then raise exception 'GUILD_BOSS_EXPEDITION_ACTIVE';end if;
 if l.source='MATERIAL' then
  perform private.refresh_village_life(u);
  update private.village_life_players set materials=
   jsonb_set(materials,array[l.material_id],to_jsonb(coalesce((materials->>l.material_id)::bigint,0)+l.material_quantity),true)
   where user_id=u;
 else
  perform private.sync_market_economy_from_latest_save(u);
  insert into private.market_assets(user_id,item_id,quantity,gear)
  values(u,'equipment_v2:'||(l.gear->>'id'),1,l.gear);
 end if;
 update private.guild_auction_listings set claimed_at=now() where listing_id=l.listing_id;
 perform private.persist_server_association_to_save(u);
 return jsonb_build_object('replayed',false,'gear',case when l.source='MATERIAL' then null else l.gear end,
  'materialId',l.material_id,'materialQuantity',l.material_quantity,
  'record',private.cloud_record_json(u),'state',private.guild_auction_state_json(u));
end;$function$
;


create or replace function public.register_guild_material_auction(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_request_id uuid,p_material text,p_quantity bigint,p_starting_bid bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;aid uuid;listing private.guild_auction_listings%rowtype;balance bigint;listing_id uuid;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null or p_material not in('herb','pepper','potato','wheat')
 or p_quantity is null or p_quantity<1 or p_quantity>1000000000
 or p_starting_bid is null or p_starting_bid<1 or p_starting_bid>1000000000
 then raise exception 'GUILD_MATERIAL_INPUT_INVALID';end if;
 select m.association_id into aid from private.online_association_members m
 join private.online_associations a on a.association_id=m.association_id
 where m.user_id=u and m.role='LEADER' and a.leader_user_id=u and a.status='ACTIVE';
 if aid is null then raise exception 'GUILD_LEADER_ONLY';end if;
 perform 1 from private.online_associations where association_id=aid for update;
 select * into listing from private.guild_auction_listings
 where association_id=aid and material_request_id=p_request_id;
 if found then
  if listing.material_id<>p_material or listing.material_quantity<>p_quantity or listing.starting_bid<>p_starting_bid then
   raise exception 'GUILD_MATERIAL_REQUEST_CONFLICT';end if;
  return jsonb_build_object('replayed',true,'state',private.guild_auction_state_json(u));
 end if;
 update private.guild_material_stock set quantity=quantity-p_quantity
 where association_id=aid and material=p_material and quantity>=p_quantity
 returning quantity into balance;
 if not found then raise exception 'GUILD_MATERIAL_STOCK_SHORT';end if;
 insert into private.guild_auction_listings(association_id,source,gear,starting_bid,
 material_id,material_quantity,material_request_id,started_at,ends_at)
 values(aid,'MATERIAL','{}'::jsonb,p_starting_bid,p_material,p_quantity,p_request_id,clock_timestamp(),clock_timestamp()+interval '24 hours')
 returning listing_id into listing_id;
 insert into private.guild_material_ledger(association_id,actor_user_id,operation,material,amount,balance_after,listing_id,detail)
 values(aid,u,'AUCTION_LIST',p_material,-p_quantity,balance,listing_id,'24시간 공헌도 경매 등록');
 perform private.association_activity(aid,u,'AUCTION','재료 경매 등록 · '||p_material||' ×'||p_quantity||' / 시작 '||p_starting_bid||'P');
 return jsonb_build_object('replayed',false,'state',private.guild_auction_state_json(u));
end $$;

create or replace function public.recover_guild_material_auction(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_listing_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;aid uuid;l private.guild_auction_listings%rowtype;balance bigint;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select m.association_id into aid from private.online_association_members m
 join private.online_associations a on a.association_id=m.association_id
 where m.user_id=u and m.role='LEADER' and a.leader_user_id=u and a.status='ACTIVE';
 if aid is null then raise exception 'GUILD_LEADER_ONLY';end if;
 select * into l from private.guild_auction_listings where listing_id=p_listing_id and association_id=aid for update;
 if not found or l.source<>'MATERIAL' then raise exception 'GUILD_MATERIAL_AUCTION_INVALID';end if;
 if l.returned_at is not null then
  return jsonb_build_object('replayed',true,'state',private.guild_auction_state_json(u));end if;
 if l.top_user_id is not null or l.claimed_at is not null or l.cancelled_at is not null
 then raise exception 'GUILD_AUCTION_CANNOT_CANCEL';end if;
 insert into private.guild_material_stock(association_id,material,quantity)
 values(aid,l.material_id,l.material_quantity)
 on conflict(association_id,material) do update set quantity=private.guild_material_stock.quantity+excluded.quantity
 returning quantity into balance;
 update private.guild_auction_listings
 set returned_at=clock_timestamp(),cancelled_at=case when ends_at>clock_timestamp() then clock_timestamp() else null end
 where listing_id=p_listing_id;
 insert into private.guild_material_ledger(association_id,actor_user_id,operation,material,amount,balance_after,listing_id,detail)
 values(aid,u,'AUCTION_RETURN',l.material_id,l.material_quantity,balance,l.listing_id,'취소·유찰 물품 재료 창고 반환');
 return jsonb_build_object('replayed',false,'state',private.guild_auction_state_json(u));
end $$;



revoke all on function public.get_guild_materials(uuid,bigint,text,text),
public.set_guild_village_tax(uuid,bigint,text,text,text,integer),
public.transfer_guild_material(uuid,bigint,text,text,uuid,text,text,bigint),
public.register_guild_material_auction(uuid,bigint,text,text,uuid,text,bigint,bigint),
public.recover_guild_material_auction(uuid,bigint,text,text,uuid)
from public,anon,authenticated;
grant execute on function public.get_guild_materials(uuid,bigint,text,text),
public.set_guild_village_tax(uuid,bigint,text,text,text,integer),
public.transfer_guild_material(uuid,bigint,text,text,uuid,text,text,bigint),
public.register_guild_material_auction(uuid,bigint,text,text,uuid,text,bigint,bigint),
public.recover_guild_material_auction(uuid,bigint,text,text,uuid)
to authenticated;
