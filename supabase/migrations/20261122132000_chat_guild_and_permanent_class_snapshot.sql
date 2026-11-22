-- Chat attribution is a server-generated snapshot, not a user-supplied guild badge.
-- "association_id" continues to identify the chat channel; never reuse it as the sender's guild.
alter table public.game_chat_messages
 add column if not exists sender_guild_id uuid,
 add column if not exists sender_guild_name text,
 add column if not exists sender_guild_emblem jsonb,
 add column if not exists sender_class_id text;

alter table public.game_chat_messages
 drop constraint if exists game_chat_sender_class_check;
alter table public.game_chat_messages
 add constraint game_chat_sender_class_check
 check (sender_class_id is null or sender_class_id in ('warrior','mage','archer'));

create or replace function private.snapshot_chat_identity()
returns trigger language plpgsql security definer set search_path to ''
as $$
declare v_user uuid;
begin
 -- The existing prepare_game_chat_message trigger has already verified membership
 -- and derived new.user_id and new.nickname from the authenticated user.
 v_user:=auth.uid();
 if v_user is null or v_user<>new.user_id then
  raise exception 'CHAT_AUTH_REQUIRED' using errcode='42501';
 end if;
 new.sender_class_id:=null;
 new.sender_guild_id:=null;
 new.sender_guild_name:=null;
 new.sender_guild_emblem:=null;
 select c.class_id into new.sender_class_id
 from public.game_initial_classes c where c.user_id=v_user
 and c.class_id in ('warrior','mage','archer') limit 1;
 select a.association_id,a.name,a.emblem
  into new.sender_guild_id,new.sender_guild_name,new.sender_guild_emblem
 from private.online_association_members m
 join private.online_associations a on a.association_id=m.association_id
 where m.user_id=v_user and a.status='ACTIVE' limit 1;
 return new;
end;
$$;

drop trigger if exists zz_snapshot_chat_identity on public.game_chat_messages;
create trigger zz_snapshot_chat_identity
 before insert on public.game_chat_messages
 for each row execute function private.snapshot_chat_identity();

-- No client-supplied attribution values: the authenticated role retains INSERT
-- only on body, client_id and channel association_id.
revoke all on function private.snapshot_chat_identity() from public,anon,authenticated;
grant select (sender_guild_id,sender_guild_name,sender_guild_emblem,sender_class_id)
 on public.game_chat_messages to authenticated;
