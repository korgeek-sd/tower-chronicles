CREATE OR REPLACE FUNCTION public.save_game_state(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_base_revision bigint, p_save_schema integer, p_app_version text, p_payload jsonb, p_payload_hash text, p_device_id text)
 RETURNS TABLE(revision bigint, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid:=auth.uid();v_auth_session uuid;v_session_text text:=auth.jwt()->>'session_id';v_game_session private.active_game_sessions%rowtype;v_current public.game_saves%rowtype;v_revision bigint;v_updated_at timestamptz;v_payload jsonb;v_hash text;
begin
  if p_lease_id is null or p_generation is null or p_client_instance_id is null or p_device_id is null then raise exception 'GAME_SESSION_LOST';end if;
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
  begin v_auth_session:=v_session_text::uuid;exception when others then raise exception 'AUTH_SESSION_INVALID' using errcode='42501';end;
  if not exists(select 1 from auth.sessions s where s.id=v_auth_session and s.user_id=v_user) then raise exception 'AUTH_SESSION_INVALID' using errcode='42501';end if;
  select * into v_game_session from private.active_game_sessions where user_id=v_user for update;
  if not found or v_game_session.expires_at<=now() or v_game_session.lease_id is distinct from p_lease_id or v_game_session.generation is distinct from p_generation or v_game_session.auth_session_id is distinct from v_auth_session or v_game_session.device_id is distinct from p_device_id or v_game_session.client_instance_id is distinct from p_client_instance_id then raise exception 'GAME_SESSION_LOST';end if;
  select * into v_current from public.game_saves where user_id=v_user for update;
  if not found then
    if p_base_revision<>0 then raise exception 'SAVE_CONFLICT';end if;
    v_payload:=private.server_bootstrap_payload(p_payload);
    v_hash:=encode(extensions.digest(convert_to(private.stable_json_string(v_payload),'UTF8'),'sha256'),'hex');
    insert into public.game_saves(user_id,revision,save_schema,app_version,payload,payload_hash,device_id,client_saved_at)
    values(v_user,1,p_save_schema,p_app_version,v_payload,v_hash,p_device_id,now())
    returning game_saves.revision,game_saves.updated_at into v_revision,v_updated_at;
    insert into private.player_consumables(user_id,item_id,quantity)
    values(v_user,'healing_lesser',30),(v_user,'healing_standard',5),(v_user,'healing_greater',0),(v_user,'healing_supreme',0),(v_user,'revival',0)
    on conflict(user_id,item_id) do update set quantity=excluded.quantity,updated_at=now();
    perform private.sync_market_economy_from_latest_save(v_user);
  else
    if v_current.revision<>p_base_revision then raise exception 'SAVE_CONFLICT';end if;
    perform private.accept_client_economy_consumption(v_user,p_payload);
    v_payload:=private.server_authoritative_payload(v_user,p_payload);
    v_hash:=encode(extensions.digest(convert_to(private.stable_json_string(v_payload),'UTF8'),'sha256'),'hex');
    insert into public.game_save_versions(user_id,revision,save_schema,app_version,payload,payload_hash,device_id,created_at)
    values(v_current.user_id,v_current.revision,v_current.save_schema,v_current.app_version,v_current.payload,v_current.payload_hash,v_current.device_id,v_current.updated_at)
    on conflict on constraint game_save_versions_user_id_revision_key do nothing;
    update public.game_saves set revision=v_current.revision+1,save_schema=p_save_schema,app_version=p_app_version,payload=v_payload,payload_hash=v_hash,device_id=p_device_id,client_saved_at=now(),updated_at=now()
    where user_id=v_user returning game_saves.revision,game_saves.updated_at into v_revision,v_updated_at;
  end if;
  return query select v_revision,v_updated_at;
end $function$

