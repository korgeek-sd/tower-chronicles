create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.active_game_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lease_id uuid not null default gen_random_uuid(),
  auth_session_id uuid not null,
  device_id text not null,
  client_instance_id text not null,
  platform text not null,
  app_version text not null,
  generation bigint not null check (generation >= 1),
  acquired_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  expires_at timestamptz not null,
  takeover_requested_at timestamptz,
  takeover_by_auth_session_id uuid,
  takeover_by_device_id text,
  takeover_by_client_instance_id text,
  updated_at timestamptz not null default now()
);
alter table private.active_game_sessions enable row level security;
revoke all on private.active_game_sessions from public, anon, authenticated;

CREATE OR REPLACE FUNCTION private.broadcast_game_session_signal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform realtime.send(
    jsonb_build_object(
      'generation', new.generation,
      'platform', new.platform,
      'heartbeat_at', new.heartbeat_at,
      'expires_at', new.expires_at,
      'takeover_requested_at', new.takeover_requested_at
    ),
    'session_changed',
    'game-session:' || new.user_id::text,
    true
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.acquire_game_session(p_device_id text, p_client_instance_id text, p_platform text, p_app_version text)
 RETURNS TABLE(status text, lease_id uuid, generation bigint, expires_at timestamp with time zone, active_platform text, heartbeat_at timestamp with time zone, takeover_requested_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_auth_session uuid;
  v_session_text text := auth.jwt() ->> 'session_id';
  v_current private.active_game_sessions%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if nullif(v_session_text,'') is null then raise exception 'AUTH_SESSION_REQUIRED' using errcode='42501'; end if;
  begin v_auth_session := v_session_text::uuid;
  exception when invalid_text_representation then raise exception 'AUTH_SESSION_INVALID' using errcode='42501'; end;
  if not exists(select 1 from auth.sessions s where s.id=v_auth_session and s.user_id=v_user) then
    raise exception 'AUTH_SESSION_INVALID' using errcode='42501';
  end if;
  if nullif(p_device_id,'') is null or nullif(p_client_instance_id,'') is null then
    raise exception 'CLIENT_ID_REQUIRED';
  end if;

  select * into v_current from private.active_game_sessions where user_id=v_user for update;

  if not found then
    insert into private.active_game_sessions(
      user_id,lease_id,auth_session_id,device_id,client_instance_id,platform,app_version,
      generation,acquired_at,heartbeat_at,expires_at,updated_at
    ) values (
      v_user,gen_random_uuid(),v_auth_session,p_device_id,p_client_instance_id,
      coalesce(nullif(p_platform,''),'Web'),coalesce(nullif(p_app_version,''),'unknown'),
      1,now(),now(),now()+interval '90 seconds',now()
    ) returning * into v_current;
    return query select 'ACTIVE'::text,v_current.lease_id,v_current.generation,v_current.expires_at,
      v_current.platform,v_current.heartbeat_at,v_current.takeover_requested_at;
    return;
  end if;

  if v_current.expires_at <= now()
     or (v_current.auth_session_id=v_auth_session and v_current.device_id=p_device_id and v_current.client_instance_id<>p_client_instance_id) then
    update private.active_game_sessions
    set lease_id=gen_random_uuid(),
        auth_session_id=v_auth_session,
        device_id=p_device_id,
        client_instance_id=p_client_instance_id,
        platform=coalesce(nullif(p_platform,''),'Web'),
        app_version=coalesce(nullif(p_app_version,''),'unknown'),
        generation=v_current.generation+1,
        acquired_at=now(),
        heartbeat_at=now(),
        expires_at=now()+interval '90 seconds',
        takeover_requested_at=null,
        takeover_by_auth_session_id=null,
        takeover_by_device_id=null,
        takeover_by_client_instance_id=null,
        updated_at=now()
    where user_id=v_user
    returning * into v_current;
    return query select 'ACTIVE'::text,v_current.lease_id,v_current.generation,v_current.expires_at,
      v_current.platform,v_current.heartbeat_at,v_current.takeover_requested_at;
    return;
  end if;

  if v_current.auth_session_id=v_auth_session
     and v_current.device_id=p_device_id
     and v_current.client_instance_id=p_client_instance_id then
    update private.active_game_sessions
    set heartbeat_at=now(),
        expires_at=now()+interval '90 seconds',
        platform=coalesce(nullif(p_platform,''),platform),
        app_version=coalesce(nullif(p_app_version,''),app_version),
        updated_at=now()
    where user_id=v_user
    returning * into v_current;
    return query select 'ACTIVE'::text,v_current.lease_id,v_current.generation,v_current.expires_at,
      v_current.platform,v_current.heartbeat_at,v_current.takeover_requested_at;
    return;
  end if;

  return query select 'LOCKED'::text,null::uuid,v_current.generation,v_current.expires_at,
    v_current.platform,v_current.heartbeat_at,v_current.takeover_requested_at;
end;
$function$;

CREATE OR REPLACE FUNCTION public.force_takeover_game_session(p_device_id text, p_client_instance_id text, p_platform text, p_app_version text)
 RETURNS TABLE(status text, lease_id uuid, generation bigint, expires_at timestamp with time zone, active_platform text, heartbeat_at timestamp with time zone, takeover_requested_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_auth_session uuid;
  v_session_text text := auth.jwt() ->> 'session_id';
  v_current private.active_game_sessions%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  begin v_auth_session := v_session_text::uuid;
  exception when others then raise exception 'AUTH_SESSION_INVALID' using errcode='42501'; end;
  if not exists(select 1 from auth.sessions s where s.id=v_auth_session and s.user_id=v_user) then
    raise exception 'AUTH_SESSION_INVALID' using errcode='42501';
  end if;

  select * into v_current from private.active_game_sessions where user_id=v_user for update;
  if not found then raise exception 'GAME_SESSION_MISSING'; end if;

  if v_current.expires_at>now() then
    if v_current.takeover_by_auth_session_id is distinct from v_auth_session
       or v_current.takeover_by_device_id is distinct from p_device_id
       or v_current.takeover_by_client_instance_id is distinct from p_client_instance_id then
      raise exception 'TAKEOVER_NOT_OWNER';
    end if;
    if v_current.takeover_requested_at is null
       or v_current.takeover_requested_at > now()-interval '3 seconds' then
      raise exception 'TAKEOVER_GRACE_ACTIVE';
    end if;
  end if;

  update private.active_game_sessions
  set lease_id=gen_random_uuid(),auth_session_id=v_auth_session,device_id=p_device_id,
      client_instance_id=p_client_instance_id,platform=coalesce(nullif(p_platform,''),'Web'),
      app_version=coalesce(nullif(p_app_version,''),'unknown'),
      generation=v_current.generation+1,acquired_at=now(),heartbeat_at=now(),
      expires_at=now()+interval '90 seconds',takeover_requested_at=null,
      takeover_by_auth_session_id=null,takeover_by_device_id=null,
      takeover_by_client_instance_id=null,updated_at=now()
  where user_id=v_user returning * into v_current;

  return query select 'ACTIVE'::text,v_current.lease_id,v_current.generation,v_current.expires_at,
    v_current.platform,v_current.heartbeat_at,v_current.takeover_requested_at;
end;
$function$;

CREATE OR REPLACE FUNCTION public.heartbeat_game_session(p_lease_id uuid, p_generation bigint, p_device_id text, p_client_instance_id text)
 RETURNS TABLE(expires_at timestamp with time zone, takeover_requested_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_auth_session uuid;
  v_session_text text := auth.jwt() ->> 'session_id';
  v_current private.active_game_sessions%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  begin v_auth_session := v_session_text::uuid;
  exception when others then raise exception 'AUTH_SESSION_INVALID' using errcode='42501'; end;
  if not exists(select 1 from auth.sessions s where s.id=v_auth_session and s.user_id=v_user) then
    raise exception 'AUTH_SESSION_INVALID' using errcode='42501';
  end if;

  select * into v_current from private.active_game_sessions where user_id=v_user for update;
  if not found
     or v_current.expires_at <= now()
     or v_current.lease_id<>p_lease_id
     or v_current.generation<>p_generation
     or v_current.auth_session_id<>v_auth_session
     or v_current.device_id<>p_device_id
     or v_current.client_instance_id<>p_client_instance_id then
    raise exception 'GAME_SESSION_LOST';
  end if;

  update private.active_game_sessions
  set heartbeat_at=now(),expires_at=now()+interval '90 seconds',updated_at=now()
  where user_id=v_user
  returning * into v_current;

  return query select v_current.expires_at,v_current.takeover_requested_at;
end;
$function$;

CREATE OR REPLACE FUNCTION public.inspect_game_session(p_device_id text, p_client_instance_id text)
 RETURNS TABLE(status text, generation bigint, expires_at timestamp with time zone, active_platform text, heartbeat_at timestamp with time zone, takeover_requested_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_auth_session uuid;
  v_session_text text := auth.jwt() ->> 'session_id';
  v_current private.active_game_sessions%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  begin v_auth_session := v_session_text::uuid;
  exception when others then raise exception 'AUTH_SESSION_INVALID' using errcode='42501'; end;
  if not exists(select 1 from auth.sessions s where s.id=v_auth_session and s.user_id=v_user) then
    raise exception 'AUTH_SESSION_INVALID' using errcode='42501';
  end if;

  select * into v_current from private.active_game_sessions where user_id=v_user;
  if not found or v_current.expires_at<=now() then
    return query select 'EXPIRED'::text,coalesce(v_current.generation,0),v_current.expires_at,
      v_current.platform,v_current.heartbeat_at,v_current.takeover_requested_at;
  elsif v_current.auth_session_id=v_auth_session
        and v_current.device_id=p_device_id
        and v_current.client_instance_id=p_client_instance_id then
    return query select 'OWNER'::text,v_current.generation,v_current.expires_at,
      v_current.platform,v_current.heartbeat_at,v_current.takeover_requested_at;
  else
    return query select 'LOCKED'::text,v_current.generation,v_current.expires_at,
      v_current.platform,v_current.heartbeat_at,v_current.takeover_requested_at;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.release_game_session(p_lease_id uuid, p_generation bigint, p_device_id text, p_client_instance_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_auth_session uuid;
  v_session_text text := auth.jwt() ->> 'session_id';
begin
  if v_user is null then return false; end if;
  begin v_auth_session := v_session_text::uuid;
  exception when others then return false; end;

  update private.active_game_sessions
  set expires_at=now(),heartbeat_at=now(),takeover_requested_at=null,
      takeover_by_auth_session_id=null,takeover_by_device_id=null,
      takeover_by_client_instance_id=null,updated_at=now()
  where user_id=v_user
    and lease_id=p_lease_id and generation=p_generation
    and auth_session_id=v_auth_session
    and device_id=p_device_id and client_instance_id=p_client_instance_id;
  return found;
end;
$function$;

CREATE OR REPLACE FUNCTION public.request_game_session_takeover(p_device_id text, p_client_instance_id text, p_platform text, p_app_version text)
 RETURNS TABLE(status text, lease_id uuid, generation bigint, expires_at timestamp with time zone, active_platform text, heartbeat_at timestamp with time zone, takeover_requested_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_auth_session uuid;
  v_session_text text := auth.jwt() ->> 'session_id';
  v_current private.active_game_sessions%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  begin v_auth_session := v_session_text::uuid;
  exception when others then raise exception 'AUTH_SESSION_INVALID' using errcode='42501'; end;
  if not exists(select 1 from auth.sessions s where s.id=v_auth_session and s.user_id=v_user) then
    raise exception 'AUTH_SESSION_INVALID' using errcode='42501';
  end if;

  select * into v_current from private.active_game_sessions where user_id=v_user for update;

  if not found then
    insert into private.active_game_sessions(
      user_id,lease_id,auth_session_id,device_id,client_instance_id,platform,app_version,
      generation,acquired_at,heartbeat_at,expires_at,updated_at
    ) values (
      v_user,gen_random_uuid(),v_auth_session,p_device_id,p_client_instance_id,
      coalesce(nullif(p_platform,''),'Web'),coalesce(nullif(p_app_version,''),'unknown'),
      1,now(),now(),now()+interval '90 seconds',now()
    ) returning * into v_current;
    return query select 'ACTIVE'::text,v_current.lease_id,v_current.generation,v_current.expires_at,
      v_current.platform,v_current.heartbeat_at,v_current.takeover_requested_at;
    return;
  end if;

  if v_current.expires_at<=now()
     or (v_current.auth_session_id=v_auth_session and v_current.device_id=p_device_id) then
    update private.active_game_sessions
    set lease_id=gen_random_uuid(),auth_session_id=v_auth_session,device_id=p_device_id,
        client_instance_id=p_client_instance_id,platform=coalesce(nullif(p_platform,''),'Web'),
        app_version=coalesce(nullif(p_app_version,''),'unknown'),
        generation=v_current.generation+1,acquired_at=now(),heartbeat_at=now(),
        expires_at=now()+interval '90 seconds',takeover_requested_at=null,
        takeover_by_auth_session_id=null,takeover_by_device_id=null,
        takeover_by_client_instance_id=null,updated_at=now()
    where user_id=v_user returning * into v_current;
    return query select 'ACTIVE'::text,v_current.lease_id,v_current.generation,v_current.expires_at,
      v_current.platform,v_current.heartbeat_at,v_current.takeover_requested_at;
    return;
  end if;

  update private.active_game_sessions
  set takeover_requested_at=now(),
      takeover_by_auth_session_id=v_auth_session,
      takeover_by_device_id=p_device_id,
      takeover_by_client_instance_id=p_client_instance_id,
      updated_at=now()
  where user_id=v_user
  returning * into v_current;

  return query select 'PENDING'::text,null::uuid,v_current.generation,v_current.expires_at,
    v_current.platform,v_current.heartbeat_at,v_current.takeover_requested_at;
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_game_state(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_base_revision bigint, p_save_schema integer, p_app_version text, p_payload jsonb, p_payload_hash text, p_device_id text)
 RETURNS TABLE(revision bigint, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_auth_session uuid;
  v_session_text text := auth.jwt() ->> 'session_id';
  v_game_session private.active_game_sessions%rowtype;
  v_current public.game_saves%rowtype;
  v_revision bigint;
  v_updated_at timestamptz;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  begin v_auth_session := v_session_text::uuid;
  exception when others then raise exception 'AUTH_SESSION_INVALID' using errcode='42501'; end;
  if not exists(select 1 from auth.sessions s where s.id=v_auth_session and s.user_id=v_user) then
    raise exception 'AUTH_SESSION_INVALID' using errcode='42501';
  end if;

  select * into v_game_session
  from private.active_game_sessions
  where user_id=v_user
  for update;

  if not found
     or v_game_session.expires_at<=now()
     or v_game_session.lease_id<>p_lease_id
     or v_game_session.generation<>p_generation
     or v_game_session.auth_session_id<>v_auth_session
     or v_game_session.device_id<>p_device_id
     or v_game_session.client_instance_id<>p_client_instance_id then
    raise exception 'GAME_SESSION_LOST';
  end if;

  select * into v_current
  from public.game_saves
  where user_id=v_user
  for update;

  if not found then
    if p_base_revision<>0 then raise exception 'SAVE_CONFLICT'; end if;
    insert into public.game_saves(user_id,revision,save_schema,app_version,payload,payload_hash,device_id,client_saved_at)
    values(v_user,1,p_save_schema,p_app_version,p_payload,p_payload_hash,p_device_id,now())
    returning game_saves.revision,game_saves.updated_at into v_revision,v_updated_at;
  else
    if v_current.revision<>p_base_revision then raise exception 'SAVE_CONFLICT'; end if;
    insert into public.game_save_versions(user_id,revision,save_schema,app_version,payload,payload_hash,device_id,created_at)
    values(v_current.user_id,v_current.revision,v_current.save_schema,v_current.app_version,v_current.payload,v_current.payload_hash,v_current.device_id,v_current.updated_at)
    on conflict on constraint game_save_versions_user_id_revision_key do nothing;

    update public.game_saves
    set revision=v_current.revision+1,save_schema=p_save_schema,app_version=p_app_version,
        payload=p_payload,payload_hash=p_payload_hash,device_id=p_device_id,
        client_saved_at=now(),updated_at=now()
    where user_id=v_user
    returning game_saves.revision,game_saves.updated_at into v_revision,v_updated_at;
  end if;

  return query select v_revision,v_updated_at;
end;
$function$;

drop trigger if exists active_game_session_signal on private.active_game_sessions;
create trigger active_game_session_signal
after insert or update on private.active_game_sessions
for each row execute function private.broadcast_game_session_signal();

drop policy if exists "game session broadcasts are private to user" on realtime.messages;
create policy "game session broadcasts are private to user"
on realtime.messages for select to authenticated
using (
  realtime.messages.extension='broadcast'
  and realtime.topic()=('game-session:' || (select auth.uid())::text)
);

revoke all on function public.acquire_game_session(text,text,text,text) from public, anon;
revoke all on function public.heartbeat_game_session(uuid,bigint,text,text) from public, anon;
revoke all on function public.inspect_game_session(text,text) from public, anon;
revoke all on function public.request_game_session_takeover(text,text,text,text) from public, anon;
revoke all on function public.force_takeover_game_session(text,text,text,text) from public, anon;
revoke all on function public.release_game_session(uuid,bigint,text,text) from public, anon;
revoke all on function public.save_game_state(uuid,bigint,text,bigint,integer,text,jsonb,text,text) from public, anon;

grant execute on function public.acquire_game_session(text,text,text,text) to authenticated;
grant execute on function public.heartbeat_game_session(uuid,bigint,text,text) to authenticated;
grant execute on function public.inspect_game_session(text,text) to authenticated;
grant execute on function public.request_game_session_takeover(text,text,text,text) to authenticated;
grant execute on function public.force_takeover_game_session(text,text,text,text) to authenticated;
grant execute on function public.release_game_session(uuid,bigint,text,text) to authenticated;
grant execute on function public.save_game_state(uuid,bigint,text,bigint,integer,text,jsonb,text,text) to authenticated;

drop function if exists public.save_game_state(bigint,integer,text,jsonb,text,text);
