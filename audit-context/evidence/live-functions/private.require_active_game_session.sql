CREATE OR REPLACE FUNCTION private.require_active_game_session(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_session_text text := auth.jwt() ->> 'session_id';
  v_auth_session uuid;
  v_active private.active_game_sessions%rowtype;
begin
  if p_lease_id is null or p_generation is null or p_client_instance_id is null or p_device_id is null then raise exception 'GAME_SESSION_LOST';end if;
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  begin v_auth_session := v_session_text::uuid;
  exception when others then raise exception 'AUTH_SESSION_INVALID' using errcode='42501'; end;
  if not exists(select 1 from auth.sessions s where s.id=v_auth_session and s.user_id=v_user) then
    raise exception 'AUTH_SESSION_INVALID' using errcode='42501';
  end if;
  select * into v_active from private.active_game_sessions where user_id=v_user for update;
  if not found or v_active.expires_at<=now() or v_active.lease_id is distinct from p_lease_id
     or v_active.generation is distinct from p_generation or v_active.auth_session_id is distinct from v_auth_session
     or v_active.device_id is distinct from p_device_id or v_active.client_instance_id is distinct from p_client_instance_id then
    raise exception 'GAME_SESSION_LOST';
  end if;
  return v_user;
end;
$function$

