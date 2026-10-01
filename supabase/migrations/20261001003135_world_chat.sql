-- Immutable, server-attributed world chat. Browser keys cannot forge sender/time/name.
create table public.game_chat_messages (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.game_player_profiles(user_id) on delete cascade,
 nickname text not null,
 body text not null check(char_length(body) between 1 and 200),
 client_id uuid not null,
 created_at timestamptz not null default now(),
 unique(user_id,client_id)
);
create index game_chat_history_idx on public.game_chat_messages(created_at desc,id);
create index game_chat_sender_cooldown_idx on public.game_chat_messages(user_id,created_at desc);
alter table public.game_chat_messages enable row level security;
revoke all on public.game_chat_messages from public,anon,authenticated;
grant select on public.game_chat_messages to authenticated;
grant insert(body,client_id) on public.game_chat_messages to authenticated;
grant all on public.game_chat_messages to service_role;
create policy chat_member_read on public.game_chat_messages for select to authenticated
 using ((select auth.uid()) is not null and not coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)
 and exists(select 1 from public.game_player_profiles where user_id=(select auth.uid())));
create policy chat_own_insert on public.game_chat_messages for insert to authenticated
 with check (user_id=(select auth.uid()) and not coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false));
-- A private definer trigger is necessary to lock the immutable profile row and enforce
-- a shared account cooldown without granting clients profile UPDATE or sender columns.
create function private.prepare_chat_message() returns trigger
 language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_name text; v_last timestamptz;
begin
 if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
  raise exception 'CHAT_AUTH_REQUIRED' using errcode='42501';
 end if;
 select nickname into v_name from public.game_player_profiles where user_id=v_user for update;
 if not found then raise exception 'CHAT_PROFILE_REQUIRED' using errcode='42501';end if;
 -- Retries of an already committed request hit UNIQUE and recover the original through REST.
 if not exists(select 1 from public.game_chat_messages where user_id=v_user and client_id=new.client_id) then
  select created_at into v_last from public.game_chat_messages where user_id=v_user order by created_at desc limit 1;
  if v_last is not null and clock_timestamp()<v_last+interval '2 seconds' then
   raise exception 'CHAT_RATE_LIMIT' using errcode='P0001';
  end if;
 end if;
 new.body:=btrim(normalize(new.body,NFC));
 if new.body is null or char_length(new.body) not between 1 and 200 or new.body ~ '[[:cntrl:]]'
 or new.body ~ U&'[\200B-\200F\202A-\202E\2060-\206F\FEFF]' then
  raise exception 'CHAT_BODY_INVALID' using errcode='23514';
 end if;
 new.user_id:=v_user;new.nickname:=v_name;new.created_at:=clock_timestamp();
 return new;
end;$$;
revoke all on function private.prepare_chat_message() from public,anon,authenticated;
create trigger prepare_game_chat_message before insert on public.game_chat_messages
 for each row execute function private.prepare_chat_message();
alter publication supabase_realtime add table public.game_chat_messages;
-- Expire stored world-chat history after seven days. Existing project already uses pg_cron.
select cron.schedule('tower-world-chat-retention','17 * * * *',
 $$delete from public.game_chat_messages where created_at < now()-interval '7 days'$$);

-- Include the extra chat socket in existing operational monitoring.
alter table private.websocket_connection_leases drop constraint websocket_connection_leases_socket_kind_check;
alter table private.websocket_connection_leases add constraint websocket_connection_leases_socket_kind_check check(socket_kind in ('session','market','chat'));
create or replace function public.set_websocket_presence(
  p_client_instance_id text,p_socket_kind text,p_platform text,p_connected boolean
) returns boolean
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_session_text text:=auth.jwt()->>'session_id';
  v_session uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  begin v_session:=v_session_text::uuid;
  exception when others then raise exception 'AUTH_SESSION_INVALID' using errcode='42501'; end;
  if not exists(select 1 from auth.sessions s where s.id=v_session and s.user_id=v_user) then
    raise exception 'AUTH_SESSION_INVALID' using errcode='42501';
  end if;
  if nullif(p_client_instance_id,'') is null or p_socket_kind not in ('session','market','chat') then
    raise exception 'WEBSOCKET_PRESENCE_INVALID';
  end if;
  if p_connected then
    insert into private.websocket_connection_leases(
      user_id,auth_session_id,client_instance_id,socket_kind,platform,connected_at,updated_at,expires_at
    ) values(
      v_user,v_session,p_client_instance_id,p_socket_kind,left(coalesce(p_platform,'Web'),40),now(),now(),now()+interval '5 minutes'
    )
    on conflict(user_id,auth_session_id,client_instance_id,socket_kind) do update
    set platform=excluded.platform,updated_at=now(),expires_at=now()+interval '5 minutes';
  else
    delete from private.websocket_connection_leases
    where user_id=v_user and auth_session_id=v_session
      and client_instance_id=p_client_instance_id and socket_kind=p_socket_kind;
  end if;
  return true;
end;
$$;
revoke all on function public.set_websocket_presence(text,text,text,boolean) from public,anon;
grant execute on function public.set_websocket_presence(text,text,text,boolean) to authenticated;

