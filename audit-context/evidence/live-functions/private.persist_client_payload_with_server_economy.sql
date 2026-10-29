CREATE OR REPLACE FUNCTION private.persist_client_payload_with_server_economy(p_user uuid, p_payload jsonb, p_app_version text DEFAULT '0.1.51'::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_current public.game_saves%rowtype;v_payload jsonb;v_hash text;v_revision bigint;
begin
  select * into v_current from public.game_saves where user_id=p_user for update;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
  v_payload:=private.server_authoritative_payload(p_user,p_payload);
  v_hash:=encode(extensions.digest(convert_to(private.stable_json_string(v_payload),'UTF8'),'sha256'),'hex');
  insert into public.game_save_versions(user_id,revision,save_schema,app_version,payload,payload_hash,device_id,created_at)
  values(v_current.user_id,v_current.revision,v_current.save_schema,v_current.app_version,v_current.payload,v_current.payload_hash,v_current.device_id,v_current.updated_at)
  on conflict on constraint game_save_versions_user_id_revision_key do nothing;
  v_revision:=v_current.revision+1;
  update public.game_saves set revision=v_revision,save_schema=coalesce((v_payload->>'version')::integer,v_current.save_schema),app_version=p_app_version,payload=v_payload,payload_hash=v_hash,updated_at=now() where user_id=p_user;
  update private.player_wallets set last_synced_revision=v_revision,updated_at=now() where user_id=p_user;
  return v_revision;
end $function$

