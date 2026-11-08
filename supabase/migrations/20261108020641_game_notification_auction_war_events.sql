-- Extend the server notification feed to auction outcomes, outbid events and association wars.
create or replace function private.notify_guild_auction()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.top_user_id is distinct from new.top_user_id
   and old.top_user_id is not null and new.top_user_id is not null then
  insert into private.game_notifications(user_id,event_key,category,title,body,target)
  values(old.top_user_id,'auction-outbid:'||new.listing_id::text||':'||new.top_bid::text,
   'auction','경매 최고 입찰 갱신','참여한 경매의 최고 입찰자가 변경되었습니다.','association')
  on conflict(user_id,event_key) do nothing;
 end if;
 if old.claimed_at is null and new.claimed_at is not null and new.top_user_id is not null then
  insert into private.game_notifications(user_id,event_key,category,title,body,target)
  values(new.top_user_id,'auction-won:'||new.listing_id::text,
   'auction','원정단 경매 낙찰','낙찰된 경매 물품을 확인하세요.','association')
  on conflict(user_id,event_key) do nothing;
 end if;
 return new;
end;
$$;
revoke all on function private.notify_guild_auction() from public,anon,authenticated;
drop trigger if exists guild_auction_notify on private.guild_auction_listings;
create trigger guild_auction_notify after update of top_user_id,claimed_at on private.guild_auction_listings
for each row execute function private.notify_guild_auction();

create or replace function private.notify_village_war_declaration()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.game_notifications(user_id,event_key,category,title,body,target)
 select m.user_id,'war-declared:'||new.cycle_key::text||':'||new.town_id||':'||new.association_id::text,
        'war','원정단 전쟁 선포','원정단이 '||new.town_id||' 지역 전쟁에 참가했습니다.','association'
 from private.online_association_members m where m.association_id=new.association_id
 on conflict(user_id,event_key) do nothing;
 return new;
end;
$$;
revoke all on function private.notify_village_war_declaration() from public,anon,authenticated;
drop trigger if exists village_war_declaration_notify on private.village_war_declarations;
create trigger village_war_declaration_notify after insert on private.village_war_declarations
for each row execute function private.notify_village_war_declaration();

create or replace function private.notify_village_war_settlement()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.settled_at is null and new.settled_at is not null then
  insert into private.game_notifications(user_id,event_key,category,title,body,target)
  select m.user_id,'war-finished:'||new.event_id::text||':'||m.association_id::text,
   'war','원정단 전쟁 종료',
   case when m.association_id=new.winner_association_id
       then new.town_id||' 지역 전쟁에서 승리했습니다.'
       else new.town_id||' 지역 전쟁이 종료되었습니다. 결과를 확인하세요.' end,
   'association'
  from private.online_association_members m
  where m.association_id in (new.owner_association_id,new.winner_association_id)
  on conflict(user_id,event_key) do nothing;
 end if;
 return new;
end;
$$;
revoke all on function private.notify_village_war_settlement() from public,anon,authenticated;
drop trigger if exists village_war_settlement_notify on private.village_war_events;
create trigger village_war_settlement_notify after update of settled_at on private.village_war_events
for each row execute function private.notify_village_war_settlement();

create or replace function private.notify_bank_maturity()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.status='ACTIVE' and new.status='GRACE_PERIOD' then
  insert into private.game_notifications(user_id,event_key,category,title,body,target)
  values(new.borrower_id,'bank-due:'||new.id::text,'bank','은행 대출 만기',
   '대출 만기가 도래했습니다. 은행에서 상환 내역을 확인하세요.','bank')
  on conflict(user_id,event_key) do nothing;
 end if;
 return new;
end;
$$;
revoke all on function private.notify_bank_maturity() from public,anon,authenticated;
drop trigger if exists bank_maturity_notify on private.server_bank_loans;
create trigger bank_maturity_notify after update of status on private.server_bank_loans
for each row execute function private.notify_bank_maturity();
