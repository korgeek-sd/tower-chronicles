-- Bound presence writes without changing the existing RPC signature.
-- One lock/counter per account also serializes concurrent registration attempts.
create table if not exists private.websocket_presence_limits(
 user_id uuid primary key references auth.users(id) on delete cascade,
 window_started_at timestamptz not null,
 calls integer not null check(calls between 0 and 60)
);
alter table private.websocket_presence_limits enable row level security;
revoke all on private.websocket_presence_limits from public,anon,authenticated;
delete from private.websocket_connection_leases where expires_at<=now();

create or replace function public.set_websocket_presence(
 p_client_instance_id text,p_socket_kind text,p_platform text,p_connected boolean
) returns boolean
language plpgsql security definer set search_path=''
as $$
declare
 v_user uuid:=auth.uid();
 v_session uuid;
 v_now timestamptz:=clock_timestamp();
 v_limit private.websocket_presence_limits%rowtype;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 begin v_session:=(auth.jwt()->>'session_id')::uuid;
 exception when invalid_text_representation then raise exception 'AUTH_SESSION_INVALID' using errcode='42501'; end;
 if v_session is null or not exists(select 1 from auth.sessions where id=v_session and user_id=v_user) then
  raise exception 'AUTH_SESSION_INVALID' using errcode='42501';
 end if;
 if p_client_instance_id is null or char_length(p_client_instance_id) not between 16 and 80
  or p_client_instance_id !~ '^[A-Za-z0-9_-]+$'
  or p_socket_kind is null or p_socket_kind not in ('session','market','chat') or p_connected is null then
  raise exception 'WEBSOCKET_PRESENCE_INVALID' using errcode='22023';
 end if;
 insert into private.websocket_presence_limits(user_id,window_started_at,calls)
 values(v_user,v_now,0) on conflict(user_id) do nothing;
 select * into v_limit from private.websocket_presence_limits where user_id=v_user for update;
 -- Set time after acquiring the lock; a queued request must use the current window.
 v_now:=clock_timestamp();
 if v_limit.window_started_at<=v_now-interval '1 minute' then
  v_limit.window_started_at:=v_now;v_limit.calls:=0;
 end if;
 if v_limit.calls>=60 then raise exception 'WEBSOCKET_PRESENCE_RATE_LIMIT' using errcode='P0001'; end if;
 update private.websocket_presence_limits set window_started_at=v_limit.window_started_at,calls=v_limit.calls+1 where user_id=v_user;
 delete from private.websocket_connection_leases where user_id=v_user and expires_at<=v_now;
 if not p_connected then
  delete from private.websocket_connection_leases where user_id=v_user and auth_session_id=v_session
   and client_instance_id=p_client_instance_id and socket_kind=p_socket_kind;
  return true;
 end if;
 -- Session signals must also work for tabs waiting to acquire/take over gameplay.
 -- Market/chat registrations must belong to the current active gameplay client.
 if p_socket_kind in ('market','chat') and not exists(
  select 1 from private.active_game_sessions where user_id=v_user and auth_session_id=v_session
   and client_instance_id=p_client_instance_id and expires_at>v_now
 ) then raise exception 'GAME_SESSION_LOST' using errcode='42501'; end if;
 if not exists(select 1 from private.websocket_connection_leases where user_id=v_user and auth_session_id=v_session
  and client_instance_id=p_client_instance_id and socket_kind=p_socket_kind) then
  if (select count(*) from private.websocket_connection_leases where user_id=v_user)>=12
   or (select count(*) from private.websocket_connection_leases where user_id=v_user and auth_session_id=v_session)>=6 then
   raise exception 'WEBSOCKET_PRESENCE_LIMIT' using errcode='P0001';
  end if;
 end if;
 insert into private.websocket_connection_leases(user_id,auth_session_id,client_instance_id,socket_kind,platform,connected_at,updated_at,expires_at)
 values(v_user,v_session,p_client_instance_id,p_socket_kind,left(coalesce(p_platform,'Web'),40),v_now,v_now,v_now+interval '5 minutes')
 on conflict(user_id,auth_session_id,client_instance_id,socket_kind) do update
 set platform=excluded.platform,updated_at=excluded.updated_at,expires_at=excluded.expires_at;
 return true;
end;
$$;
revoke all on function public.set_websocket_presence(text,text,text,boolean) from public,anon;
grant execute on function public.set_websocket_presence(text,text,text,boolean) to authenticated;
