-- Chat combat power is a server-generated send-time snapshot.
alter table public.game_chat_messages add column if not exists sender_combat_power bigint;
alter table public.game_chat_messages add constraint game_chat_sender_combat_power_check check (sender_combat_power is null or sender_combat_power between 0 and 1000000000);
create or replace function private.snapshot_chat_combat_power()
returns trigger language plpgsql security definer set search_path = ''
as $power$
declare v_user uuid;
begin
 v_user:=auth.uid();
 if v_user is null or v_user is distinct from new.user_id then
  raise exception 'CHAT_AUTH_REQUIRED' using errcode='42501';
 end if;
 new.sender_combat_power:=null;
 -- Do not make chat availability depend on growth data availability.
 begin
  if exists(select 1 from public.game_saves where user_id=v_user) then
   new.sender_combat_power:=private.member_combat_power(v_user);
  end if;
 exception when others then
  new.sender_combat_power:=null;
 end;
 return new;
end;
$power$;
revoke all on function private.snapshot_chat_combat_power() from public,anon,authenticated;
create trigger zzz_snapshot_chat_combat_power before insert on public.game_chat_messages
 for each row execute function private.snapshot_chat_combat_power();
grant select (sender_combat_power) on public.game_chat_messages to authenticated;
