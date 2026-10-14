-- Former guild members can reclaim their own unsold listed equipment without an active guild state.
CREATE OR REPLACE FUNCTION public.recover_guild_auction_item(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_listing_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
   'state',case when exists(select 1 from private.online_association_members where user_id=u) then private.guild_auction_state_json(u) else null end);end if;
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
  'state',case when exists(select 1 from private.online_association_members where user_id=u) then private.guild_auction_state_json(u) else null end);
end;$function$;
