-- A handover must close and open ownership intervals at exactly the same instant.
create or replace function private.village_war_track_ownership() returns trigger language plpgsql security definer set search_path='' as $$
declare e private.village_war_events%rowtype;t timestamptz;
begin
 select * into e from private.village_war_events where event_id=new.event_id;
 if not e.frozen or e.settled_at is not null then return new;end if;
 if new.association_id is distinct from old.association_id then
  t:=greatest(e.battle_starts_at,least(e.battle_ends_at,coalesce(new.occupied_at,private.village_war_clock())));
  update private.village_war_intervals set ends_at=t where event_id=new.event_id and front_id=new.front_id and ends_at is null;
 end if;
 if new.association_id is not null and new.occupied_at is not null then
  insert into private.village_war_intervals(event_id,front_id,association_id,starts_at)
  values(new.event_id,new.front_id,new.association_id,greatest(e.battle_starts_at,new.occupied_at)) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function private.village_war_track_ownership() from public,anon,authenticated;
