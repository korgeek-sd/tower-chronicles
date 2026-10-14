-- Leader-registered equipment is removed from the server wallet into auction escrow.
-- Unsold personal lots can be reclaimed, unsold boss loot can be relisted; no treasury auto-purchase.
alter table private.guild_auction_listings add column if not exists seller_id uuid references auth.users(id);
alter table private.guild_auction_listings add column if not exists registration_request_id uuid;
alter table private.guild_auction_listings add column if not exists asset_item_id text;
alter table private.guild_auction_listings add column if not exists cancelled_at timestamptz;
alter table private.guild_auction_listings add column if not exists returned_at timestamptz;
alter table private.guild_auction_listings drop constraint if exists guild_auction_listings_source_check;
alter table private.guild_auction_listings add constraint guild_auction_listings_source_check
 check(source in ('BOSS','TREASURY','LEADER'));
create unique index if not exists guild_auction_manual_request_key
 on private.guild_auction_listings(seller_id,registration_request_id)
 where registration_request_id is not null;
create unique index if not exists guild_auction_escrow_asset_key
 on private.guild_auction_listings(asset_item_id)
 where asset_item_id is not null;


-- Register only an owned, unequipped, server-verified gear item. All operations are atomic.
create or replace function public.register_guild_auction_item(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_request_id uuid,p_item_id text,p_starting_bid bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;aid uuid;a private.market_assets%rowtype;s public.game_saves%rowtype;
 old private.guild_auction_listings%rowtype;listing uuid;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null or p_item_id is null or p_item_id not like 'equipment_v2:%'
  or p_starting_bid is null or p_starting_bid<1 or p_starting_bid>1000000000 then
  raise exception 'GUILD_AUCTION_INVALID_LISTING';end if;
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 select * into s from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 perform private.sync_market_economy_from_latest_save(u);
 if jsonb_typeof(s.payload->'expedition')='object'
  or exists(select 1 from private.online_expeditions e where e.user_id=u and e.status='ACTIVE') then
  raise exception 'GUILD_BOSS_EXPEDITION_ACTIVE';end if;
 select m.association_id into aid from private.online_association_members m
 join private.online_associations g on g.association_id=m.association_id
 where m.user_id=u and m.role='LEADER' and g.leader_user_id=u and g.status='ACTIVE';
 if not found then raise exception 'GUILD_AUCTION_LEADER_ONLY';end if;
 select * into old from private.guild_auction_listings
 where seller_id=u and registration_request_id=p_request_id;
 if found then
  if old.association_id<>aid or old.asset_item_id<>p_item_id or old.starting_bid<>p_starting_bid
  then raise exception 'GUILD_AUCTION_REQUEST_CONFLICT';end if;
  return jsonb_build_object('replayed',true,'listingId',old.listing_id,
   'record',private.cloud_record_json(u),'state',private.guild_auction_state_json(u));
 end if;
 select * into a from private.market_assets
 where user_id=u and item_id=p_item_id and quantity=1 and gear is not null for update;
 if not found or nullif(a.gear->>'id','') is null or p_item_id<>'equipment_v2:'||(a.gear->>'id')
  or (a.gear->>'kind') is null or (a.gear->>'grade') not in ('common','uncommon','rare','heroic','legendary') then
  raise exception 'GUILD_AUCTION_ITEM_UNAVAILABLE';end if;
 if exists(select 1 from jsonb_each_text(coalesce(s.payload->'equipped','{}'::jsonb)) x
  where x.value=a.gear->>'id') then raise exception 'GUILD_AUCTION_ITEM_EQUIPPED';end if;
 delete from private.market_assets where user_id=u and item_id=p_item_id and quantity=1;
 if not found then raise exception 'GUILD_AUCTION_ITEM_UNAVAILABLE';end if;
 insert into private.guild_auction_listings(
  association_id,source,gear,starting_bid,seller_id,registration_request_id,asset_item_id
 ) values(aid,'LEADER',a.gear,p_starting_bid,u,p_request_id,p_item_id)
 returning listing_id into listing;
 perform private.persist_market_economy_to_save(u);
 perform private.association_activity(aid,u,'AUCTION','길드장 경매 등록 · 시작가 '||p_starting_bid::text||' 공헌도');
 perform private.broadcast_association_change(aid);
 return jsonb_build_object('replayed',false,'listingId',listing,
  'record',private.cloud_record_json(u),'state',private.guild_auction_state_json(u));
end;$$;

-- Cancel before the first bid, or reclaim the original item after an unsold close.
-- The same owner is allowed to recover even after leaving the guild.
create or replace function public.recover_guild_auction_item(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_listing_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;s public.game_saves%rowtype;l private.guild_auction_listings%rowtype;
 reclaim_before_close boolean;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 select * into s from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 perform private.sync_market_economy_from_latest_save(u);
 select * into l from private.guild_auction_listings where listing_id=p_listing_id and seller_id=u for update;
 if not found or l.source<>'LEADER' then raise exception 'GUILD_AUCTION_NOT_OWNER';end if;
 if l.returned_at is not null then
  return jsonb_build_object('replayed',true,'record',private.cloud_record_json(u),
   'state',private.guild_auction_state_json(u));end if;
 if l.top_user_id is not null or l.top_bid>0 or l.claimed_at is not null or l.cancelled_at is not null
  then raise exception 'GUILD_AUCTION_CANNOT_CANCEL';end if;
 if jsonb_typeof(s.payload->'expedition')='object'
  or exists(select 1 from private.online_expeditions e where e.user_id=u and e.status='ACTIVE') then
  raise exception 'GUILD_BOSS_EXPEDITION_ACTIVE';end if;
 reclaim_before_close:=l.ends_at>now();
 insert into private.market_assets(user_id,item_id,quantity,gear)
 values(u,l.asset_item_id,1,l.gear);
 update private.guild_auction_listings set returned_at=now(),
  cancelled_at=case when reclaim_before_close then now() else null end
 where listing_id=l.listing_id;
 perform private.persist_market_economy_to_save(u);
 perform private.association_activity(l.association_id,u,'AUCTION',
  case when reclaim_before_close then '길드장 경매 취소 · 장비 반환' else '유찰 장비 반환' end);
 perform private.broadcast_association_change(l.association_id);
 return jsonb_build_object('replayed',false,'record',private.cloud_record_json(u),
  'state',private.guild_auction_state_json(u));
end;$$;

-- Unbid boss loot remains in guild custody until the leader starts another 24h auction.
create or replace function public.relist_guild_boss_auction_item(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_listing_id uuid,p_starting_bid bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;aid uuid;l private.guild_auction_listings%rowtype;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_starting_bid is null or p_starting_bid<1 or p_starting_bid>1000000000
 then raise exception 'GUILD_AUCTION_INVALID_LISTING';end if;
 select m.association_id into aid from private.online_association_members m
 join private.online_associations a on a.association_id=m.association_id
 where m.user_id=u and m.role='LEADER' and a.leader_user_id=u and a.status='ACTIVE';
 if not found then raise exception 'GUILD_AUCTION_LEADER_ONLY';end if;
 select * into l from private.guild_auction_listings
 where listing_id=p_listing_id and association_id=aid for update;
 if not found or l.source<>'BOSS' or l.ends_at>now() or l.top_user_id is not null
  or l.cancelled_at is not null or l.returned_at is not null or l.claimed_at is not null then
  raise exception 'GUILD_AUCTION_CANNOT_RELIST';end if;
 update private.guild_auction_listings set
  started_at=now(),ends_at=now()+interval '24 hours',starting_bid=p_starting_bid
 where listing_id=p_listing_id;
 perform private.association_activity(aid,u,'AUCTION','유찰 보스 전리품 재경매 · 시작가 '||p_starting_bid::text||' 공헌도');
 perform private.broadcast_association_change(aid);
 return jsonb_build_object('state',private.guild_auction_state_json(u));
end;$$;

revoke all on function public.register_guild_auction_item(uuid,bigint,text,text,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.register_guild_auction_item(uuid,bigint,text,text,uuid,text,bigint) to authenticated;
revoke all on function public.recover_guild_auction_item(uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.recover_guild_auction_item(uuid,bigint,text,text,uuid) to authenticated;
revoke all on function public.relist_guild_boss_auction_item(uuid,bigint,text,text,uuid,bigint) from public,anon,authenticated;
grant execute on function public.relist_guild_boss_auction_item(uuid,bigint,text,text,uuid,bigint) to authenticated;

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
  'listingId',x.listing_id,'source',x.source,'gear',x.gear,'startingBid',x.starting_bid,
  'sellerId',x.seller_id,'isMyListing',x.seller_id=p_user,
  'cancelledAt',x.cancelled_at,'returnedAt',x.returned_at,
  'canCancel',x.source='LEADER' and x.seller_id=p_user and x.ends_at>now() and x.top_user_id is null and x.cancelled_at is null and x.returned_at is null,
  'canReturn',x.source='LEADER' and x.seller_id=p_user and x.ends_at<=now() and x.top_user_id is null and x.cancelled_at is null and x.returned_at is null,
  'canRelist',leader and x.source='BOSS' and x.ends_at<=now() and x.top_user_id is null and x.cancelled_at is null and x.returned_at is null,
  'topBid',x.top_bid,'nextBid',case when x.top_bid=0 then x.starting_bid else x.top_bid+greatest(10,ceil(x.top_bid*.05)::bigint) end,
  'topUserId',x.top_user_id,'startedAt',x.started_at,'endsAt',x.ends_at,'claimedAt',x.claimed_at,
  'status',case when x.returned_at is not null then 'RETURNED' when x.cancelled_at is not null then 'CANCELLED'
  when x.claimed_at is not null then 'CLAIMED' when x.ends_at>now() then 'OPEN' when x.top_user_id is null then 'UNSOLD' else 'SOLD' end,
  'isMyTopBid',x.top_user_id=p_user) order by x.started_at desc),'[]'::jsonb)
 into items from (select * from private.guild_auction_listings where association_id=aid
  and (ends_at>now()-interval '30 days' or (top_user_id=p_user and claimed_at is null)
  or (seller_id=p_user and returned_at is null and top_user_id is null)
  or (leader and source='BOSS' and top_user_id is null and cancelled_at is null and returned_at is null))
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
end;$function$;

CREATE OR REPLACE FUNCTION public.bid_guild_auction(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_request_id uuid, p_listing_id uuid, p_bid bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid;aid uuid;l private.guild_auction_listings%rowtype;
 previous private.guild_auction_bid_receipts%rowtype;required_bid bigint;debit bigint;points bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('tc-guild-auction-bids',0));
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null or p_bid is null or p_bid<=0 then raise exception 'GUILD_AUCTION_INVALID_BID';end if;
 select * into previous from private.guild_auction_bid_receipts where user_id=u and request_id=p_request_id;
 if found then
  if previous.listing_id<>p_listing_id or previous.bid<>p_bid then raise exception 'GUILD_AUCTION_REQUEST_CONFLICT';end if;
  return jsonb_build_object('replayed',true,'state',private.guild_auction_state_json(u));
 end if;
 select m.association_id into aid from private.online_association_members m join private.online_associations a
 on a.association_id=m.association_id and a.status='ACTIVE' where m.user_id=u;
 if not found then raise exception 'ASSOCIATION_NOT_JOINED';end if;
 select * into l from private.guild_auction_listings where listing_id=p_listing_id and association_id=aid for update;
 if not found or l.ends_at<=now() or l.claimed_at is not null or l.cancelled_at is not null or l.returned_at is not null
  then raise exception 'GUILD_AUCTION_CLOSED';end if;
 if l.seller_id=u then raise exception 'GUILD_AUCTION_SELF_BID';end if;
 required_bid:=case when l.top_bid=0 then l.starting_bid else l.top_bid+greatest(10,ceil(l.top_bid*.05)::bigint) end;
 if p_bid<required_bid or p_bid>1000000000 then raise exception 'GUILD_AUCTION_BID_TOO_LOW';end if;
 debit:=p_bid-case when l.top_user_id=u then l.top_bid else 0 end;
 select contribution_point into points from private.online_association_member_progression
 where association_id=aid and user_id=u for update;
 if coalesce(points,0)<debit then raise exception 'ASSOCIATION_CONTRIBUTION_SHORTAGE';end if;
 update private.online_association_member_progression set contribution_point=contribution_point-debit,updated_at=now()
 where association_id=aid and user_id=u;
 if l.top_user_id is not null and l.top_user_id<>u then
  update private.online_association_member_progression set contribution_point=contribution_point+l.top_bid,updated_at=now()
  where association_id=aid and user_id=l.top_user_id;
 end if;
 update private.guild_auction_listings set top_user_id=u,top_bid=p_bid where listing_id=l.listing_id;
 insert into private.guild_auction_bid_receipts(user_id,request_id,listing_id,bid)
 values(u,p_request_id,l.listing_id,p_bid);
 perform private.broadcast_association_change(aid);
 return jsonb_build_object('replayed',false,'state',private.guild_auction_state_json(u));
end;$function$;

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
 perform private.sync_market_economy_from_latest_save(u);
 insert into private.market_assets(user_id,item_id,quantity,gear)
 values(u,'equipment_v2:'||(l.gear->>'id'),1,l.gear);
 update private.guild_auction_listings set claimed_at=now() where listing_id=l.listing_id;
 perform private.persist_server_association_to_save(u);
 return jsonb_build_object('replayed',false,'gear',l.gear,'record',private.cloud_record_json(u),
  'state',private.guild_auction_state_json(u));
end;$function$;
