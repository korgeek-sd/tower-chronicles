-- Notify the winning bidder when a guild auction actually closes, even if unclaimed.
-- The existing claim-time trigger uses the same event key, preventing duplicates.
create or replace function private.notify_finished_guild_auctions()
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
 insert into private.game_notifications(user_id,event_key,category,title,body,target)
 select a.top_user_id,'auction-won:'||a.listing_id::text,'auction',
        '원정단 경매 낙찰','낙찰된 경매 물품을 확인하세요.','association'
 from private.guild_auction_listings a
 where a.ends_at<=now() and a.ends_at>now()-interval '24 hours'
   and a.top_user_id is not null and a.cancelled_at is null
 on conflict(user_id,event_key) do nothing;
 get diagnostics v_count=row_count;
 return v_count;
end;
$$;
revoke all on function private.notify_finished_guild_auctions() from public,anon,authenticated;
select cron.schedule('tc-guild-auction-notifications','* * * * *','select private.notify_finished_guild_auctions()');
