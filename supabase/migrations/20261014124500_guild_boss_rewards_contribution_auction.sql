-- Guild raid rewards and twenty-four-hour contribution-only auctions.
create table private.guild_boss_reward_claims(
 encounter_id uuid not null references private.guild_boss_encounters(encounter_id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 silver bigint not null,contribution bigint not null,
 potions bigint not null,vitality_potions bigint not null,
 claimed_at timestamptz not null default now(),primary key(encounter_id,user_id)
);
alter table private.guild_boss_reward_claims enable row level security;
revoke all on private.guild_boss_reward_claims from public,anon,authenticated;

create table private.guild_auction_listings(
 listing_id uuid primary key default gen_random_uuid(),
 association_id uuid not null references private.online_associations(association_id) on delete cascade,
 source_encounter_id uuid unique references private.guild_boss_encounters(encounter_id) on delete set null,
 source text not null check(source in('BOSS','TREASURY')),
 gear jsonb not null,starting_bid bigint not null check(starting_bid>=1),
 top_bid bigint not null default 0 check(top_bid>=0),
 top_user_id uuid references auth.users(id) on delete set null,
 started_at timestamptz not null default now(),
 ends_at timestamptz not null default (now()+interval '24 hours'),
 claimed_at timestamptz,
 created_at timestamptz not null default now(),
 check(ends_at>started_at),
 check((top_user_id is null and top_bid=0) or (top_user_id is not null and top_bid>=starting_bid))
);
create index guild_auction_listings_recent on private.guild_auction_listings(association_id,started_at desc);
alter table private.guild_auction_listings enable row level security;
revoke all on private.guild_auction_listings from public,anon,authenticated;

create table private.guild_auction_bid_receipts(
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 listing_id uuid not null references private.guild_auction_listings(listing_id) on delete cascade,
 bid bigint not null,
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table private.guild_auction_bid_receipts enable row level security;
revoke all on private.guild_auction_bid_receipts from public,anon,authenticated;

create or replace function private.guild_boss_generate_loot()
returns trigger language plpgsql security definer set search_path='' as $$
declare rarity text;roll numeric;gear jsonb;item_kind text;cost bigint;
 kinds text[]:=array['association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff','expedition_iron_helmet','return_corps_plate_armor','mining_detail_reinforced_gloves','survey_corps_dust_boots','association_registration_tag','expedition_merit_ring'];
begin
 if old.remaining_hp<=0 or new.remaining_hp<>0 then return new;end if;
 roll:=random();
 if new.kind='DAILY' then
  rarity:=case when roll<.80 then null when roll<.98 then 'uncommon' else 'rare' end;
 else rarity:=case when roll<.97 then 'rare' else 'heroic' end;
 end if;
 if rarity is null then return new;end if;
 item_kind:=kinds[1+floor(random()*array_length(kinds,1))::integer];
 gear:=jsonb_build_object('id',gen_random_uuid()::text,'kind',item_kind,'grade',rarity,'enhancement',0);
 cost:=case rarity when 'uncommon' then 200 when 'rare' then 1000 else 4000 end;
 insert into private.guild_auction_listings(association_id,source_encounter_id,source,gear,starting_bid)
 values(new.association_id,new.encounter_id,'BOSS',gear,cost)
 on conflict(source_encounter_id) do nothing;
 perform private.association_activity(new.association_id,null,'RAID','길드 보스 '||new.boss_name||' 토벌 완료 · 전리품 경매 등록');
 return new;
end;$$;
create trigger guild_boss_generate_loot_on_kill
after update of remaining_hp on private.guild_boss_encounters
for each row when(old.remaining_hp>0 and new.remaining_hp=0)
execute function private.guild_boss_generate_loot();

-- Read-only member view. Closing time is authoritative, no cron worker required.
create or replace function private.guild_auction_state_json(p_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare aid uuid;points bigint;items jsonb;rewards jsonb;
begin
 select association_id into aid from private.online_association_members where user_id=p_user;
 if not found then raise exception 'ASSOCIATION_NOT_JOINED';end if;
 select coalesce(contribution_point,0) into points from private.online_association_member_progression
 where association_id=aid and user_id=p_user;
 select coalesce(jsonb_agg(jsonb_build_object(
  'listingId',x.listing_id,'source',x.source,'gear',x.gear,'startingBid',x.starting_bid,
  'topBid',x.top_bid,'nextBid',case when x.top_bid=0 then x.starting_bid else x.top_bid+greatest(10,ceil(x.top_bid*.05)::bigint) end,
  'topUserId',x.top_user_id,'startedAt',x.started_at,'endsAt',x.ends_at,'claimedAt',x.claimed_at,
  'status',case when x.claimed_at is not null then 'CLAIMED' when x.ends_at>now() then 'OPEN' when x.top_user_id is null then 'UNSOLD' else 'SOLD' end,
  'isMyTopBid',x.top_user_id=p_user) order by x.started_at desc),'[]'::jsonb)
 into items from (select * from private.guild_auction_listings where association_id=aid
  and (ends_at>now()-interval '30 days' or (top_user_id=p_user and claimed_at is null))
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
 return jsonb_build_object('associationId',aid,'points',coalesce(points,0),'listings',items,'claimableRewards',rewards);
end;$$;

create or replace function public.get_guild_auction_state(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 return private.guild_auction_state_json(u);
end;$$;

create or replace function public.claim_guild_boss_reward(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_encounter_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;aid uuid;e private.guild_boss_encounters%rowtype;s public.game_saves%rowtype;
 silver_gain bigint;points_gain bigint;potions_gain bigint;vitality_gain bigint;life private.village_life_players%rowtype;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into s from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 perform private.sync_market_economy_from_latest_save(u);
 select m.association_id into aid from private.online_association_members m join private.online_associations a
 on a.association_id=m.association_id and a.status='ACTIVE' where m.user_id=u;
 if not found then raise exception 'ASSOCIATION_NOT_JOINED';end if;
 select * into e from private.guild_boss_encounters where encounter_id=p_encounter_id and association_id=aid;
 if not found or e.defeated_at is null then raise exception 'GUILD_BOSS_REWARD_UNAVAILABLE';end if;
 if not exists(select 1 from private.guild_boss_attacks where encounter_id=e.encounter_id and user_id=u and damage>0)
 then raise exception 'GUILD_BOSS_REWARD_NOT_ELIGIBLE';end if;
 if exists(select 1 from private.guild_boss_reward_claims where encounter_id=e.encounter_id and user_id=u)
 then return jsonb_build_object('replayed',true,'record',private.cloud_record_json(u),'state',private.guild_auction_state_json(u));end if;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE')
 or coalesce(s.payload->>'expedition','null')<>'null' then raise exception 'GUILD_BOSS_EXPEDITION_ACTIVE';end if;
 silver_gain:=case when e.kind='DAILY' then 3000 else 10000 end;
 points_gain:=case when e.kind='DAILY' then 30 else 100 end;
 potions_gain:=case when e.kind='DAILY' then 10 else 30 end;
 vitality_gain:=case when e.kind='DAILY' then 0 else 1 end;
 insert into private.guild_boss_reward_claims(encounter_id,user_id,silver,contribution,potions,vitality_potions)
 values(e.encounter_id,u,silver_gain,points_gain,potions_gain,vitality_gain);
 update private.player_wallets set silver=silver+silver_gain,updated_at=now() where user_id=u;
 insert into private.online_association_member_progression(association_id,user_id,contribution_point)
 values(aid,u,points_gain) on conflict(association_id,user_id) do update
 set contribution_point=private.online_association_member_progression.contribution_point+excluded.contribution_point,updated_at=now();
 perform private.refresh_village_life(u);
 select * into life from private.village_life_players where user_id=u for update;
 update private.village_life_players set products=
  jsonb_set(jsonb_set(coalesce(life.products,'{}'::jsonb),'{potion}',
    to_jsonb(coalesce((life.products->>'potion')::bigint,0)+potions_gain),true),
    '{vitality_potion}',to_jsonb(coalesce((life.products->>'vitality_potion')::bigint,0)+vitality_gain),true)
 where user_id=u;
 perform private.persist_server_association_to_save(u);
 return jsonb_build_object('replayed',false,'silver',silver_gain,'contribution',points_gain,
 'potions',potions_gain,'vitalityPotions',vitality_gain,
 'record',private.cloud_record_json(u),'state',private.guild_auction_state_json(u));
end;$$;

-- Bid escrow: only the incremental difference is spent by a current leading bidder.
-- Global advisory lock prevents cyclic refunds when two bidders compete on two lots.
create or replace function public.bid_guild_auction(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_request_id uuid,p_listing_id uuid,p_bid bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
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
 if not found or l.ends_at<=now() or l.claimed_at is not null then raise exception 'GUILD_AUCTION_CLOSED';end if;
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
end;$$;

create or replace function public.claim_guild_auction_item(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_listing_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;l private.guild_auction_listings%rowtype;s public.game_saves%rowtype;aid uuid;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into s from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 select m.association_id into aid from private.online_association_members m where m.user_id=u;
 if not found then raise exception 'ASSOCIATION_NOT_JOINED';end if;
 select * into l from private.guild_auction_listings
 where listing_id=p_listing_id and association_id=aid for update;
 if not found or l.top_user_id is distinct from u or l.ends_at>now() then raise exception 'GUILD_AUCTION_NOT_WINNER';end if;
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
end;$$;

revoke all on function private.guild_boss_generate_loot() from public,anon,authenticated;
revoke all on function private.guild_auction_state_json(uuid) from public,anon,authenticated;
revoke all on function public.get_guild_auction_state(uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function public.get_guild_auction_state(uuid,bigint,text,text) to authenticated;
revoke all on function public.claim_guild_boss_reward(uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.claim_guild_boss_reward(uuid,bigint,text,text,uuid) to authenticated;
revoke all on function public.bid_guild_auction(uuid,bigint,text,text,uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.bid_guild_auction(uuid,bigint,text,text,uuid,uuid,bigint) to authenticated;
revoke all on function public.claim_guild_auction_item(uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.claim_guild_auction_item(uuid,bigint,text,text,uuid) to authenticated;
