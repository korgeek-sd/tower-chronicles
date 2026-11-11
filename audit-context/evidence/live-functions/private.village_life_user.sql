CREATE OR REPLACE FUNCTION private.village_life_user(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if p_lease_id is null or p_generation is null or p_client_instance_id is null or p_device_id is null then raise exception 'GAME_SESSION_LOST';end if;
 return private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
end $function$

