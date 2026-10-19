-- Production function snapshot before phase 5, for behavioral regression tests.
create schema private;create schema auth;
create table auth.sessions(id uuid primary key,user_id uuid);
create function auth.uid() returns uuid language sql as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
create function auth.jwt() returns jsonb language sql as $$select current_setting('request.jwt.claims',true)::jsonb$$;
create table private.active_game_sessions(user_id uuid primary key,lease_id uuid,generation bigint,auth_session_id uuid,client_instance_id text,device_id text,expires_at timestamptz);
create table public.game_saves(user_id uuid primary key,revision bigint,updated_at timestamptz,save_schema integer,app_version text,payload jsonb,payload_hash text,device_id text);
create table private.online_expeditions(user_id uuid,status text);
create table private.online_combat_states(user_id uuid);
create function private.cloud_record_json(uuid) returns jsonb language sql as $$select '{}'::jsonb$$;
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
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  begin v_auth_session := v_session_text::uuid;
  exception when others then raise exception 'AUTH_SESSION_INVALID' using errcode='42501'; end;
  if not exists(select 1 from auth.sessions s where s.id=v_auth_session and s.user_id=v_user) then
    raise exception 'AUTH_SESSION_INVALID' using errcode='42501';
  end if;
  select * into v_active from private.active_game_sessions where user_id=v_user for update;
  if not found or v_active.expires_at<=now() or v_active.lease_id<>p_lease_id
     or v_active.generation<>p_generation or v_active.auth_session_id<>v_auth_session
     or v_active.device_id<>p_device_id or v_active.client_instance_id<>p_client_instance_id then
    raise exception 'GAME_SESSION_LOST';
  end if;
  return v_user;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.save_game_state(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_base_revision bigint, p_save_schema integer, p_app_version text, p_payload jsonb, p_payload_hash text, p_device_id text)
 RETURNS TABLE(revision bigint, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid:=auth.uid();v_auth_session uuid;v_session_text text:=auth.jwt()->>'session_id';v_game_session private.active_game_sessions%rowtype;v_current public.game_saves%rowtype;v_revision bigint;v_updated_at timestamptz;v_payload jsonb;v_hash text;
begin
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
  begin v_auth_session:=v_session_text::uuid;exception when others then raise exception 'AUTH_SESSION_INVALID' using errcode='42501';end;
  if not exists(select 1 from auth.sessions s where s.id=v_auth_session and s.user_id=v_user) then raise exception 'AUTH_SESSION_INVALID' using errcode='42501';end if;
  select * into v_game_session from private.active_game_sessions where user_id=v_user for update;
  if not found or v_game_session.expires_at<=now() or v_game_session.lease_id<>p_lease_id or v_game_session.generation<>p_generation or v_game_session.auth_session_id<>v_auth_session or v_game_session.device_id<>p_device_id or v_game_session.client_instance_id<>p_client_instance_id then raise exception 'GAME_SESSION_LOST';end if;
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
;
CREATE OR REPLACE FUNCTION public.settle_online_expedition_v2(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_outcome text, p_client_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;s public.game_saves%rowtype;
  gross bigint:=0;share bigint:=0;net bigint:=0;mat bigint:=0;tickets bigint:=0;asset text;
  remaining jsonb;loot jsonb;receipt jsonb;payload jsonb;tier_idx int;elapsed bigint;equipment jsonb:='[]'::jsonb;eq jsonb;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  select * into r from private.online_expeditions where user_id=u for update;
  if not found then return private.cloud_record_json(u);end if;
  if r.status in('RETURNED','DEAD') then return private.cloud_record_json(u);end if;
  if p_outcome not in('returned','dead') then raise exception 'EXPEDITION_RECEIPT_INVALID';end if;
  select * into c from private.online_combat_states where user_id=u and run_id=r.run_id for update;
  if not found then raise exception 'EXPEDITION_COMBAT_STATE_MISSING';end if;
  if r.stronghold is not null and r.stronghold->>'status' in('ACTIVE','CONTESTED') then raise exception 'RESOURCE_STRONGHOLD_ACTIVE';end if;

  if p_outcome='returned' then
    if not coalesce(c.return_authorized,false) or c.player_hp<=0 then raise exception 'EXPEDITION_RETURN_NOT_AUTHORIZED';end if;
  elsif p_outcome='dead' then
    if c.phase<>'PLAYER_DEAD' or c.player_hp<>0 or coalesce(c.pending_revival,false) then raise exception 'EXPEDITION_DEATH_NOT_CONFIRMED';end if;
  end if;

  gross:=coalesce((r.temporary_loot->>'silver')::bigint,0);
  mat:=coalesce((r.temporary_loot->>'material')::bigint,0);
  tickets:=coalesce((r.temporary_loot->>'tickets')::bigint,0);
  equipment:=coalesce(r.temporary_loot->'equipment','[]'::jsonb);
  if jsonb_typeof(equipment)<>'array' then raise exception 'EXPEDITION_EQUIPMENT_LOOT_INVALID';end if;
  remaining:=jsonb_build_object(
    'healing_lesser',greatest(0,coalesce(r.potion_lesser,0)),
    'healing_standard',greatest(0,coalesce(r.potion_standard,0)),
    'healing_greater',greatest(0,coalesce(r.potion_greater,0)),
    'healing_supreme',greatest(0,coalesce(r.potion_supreme,0)),
    'revival',greatest(0,coalesce(r.revival_count,0))
  );

  if p_outcome='returned' then
    share:=floor(gross*r.revenue_share_rate/100.0);net:=gross-share;
    update private.player_wallets set silver=silver+net,updated_at=now() where user_id=u;
    if mat>0 then
      asset:='material:'||r.tower||':'||(case when r.floor<=3 then 1 when r.floor<=6 then 2 else 3 end)::text;
      insert into private.market_assets(user_id,item_id,quantity,updated_at) values(u,asset,mat,now())
      on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+excluded.quantity,updated_at=now();
    end if;
    if tickets>0 and r.floor<10 then
      insert into private.market_assets(user_id,item_id,quantity,updated_at)
      values(u,'ticket:'||r.tower||':'||(r.floor+1)::text,tickets,now())
      on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+excluded.quantity,updated_at=now();
    end if;
    for eq in select value from jsonb_array_elements(equipment) loop
      if jsonb_typeof(eq)<>'object'
         or coalesce(eq->>'id','')=''
         or eq->>'kind' not in(
           'association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff',
           'expedition_iron_helmet','return_corps_plate_armor','mining_detail_reinforced_gloves',
           'survey_corps_dust_boots','association_registration_tag','expedition_merit_ring'
         )
         or eq->>'grade' not in('common','uncommon','rare','heroic','legendary')
         or coalesce((eq->>'enhancement')::int,-1)<>0
      then raise exception 'EXPEDITION_EQUIPMENT_LOOT_INVALID';end if;
      insert into private.market_assets(user_id,item_id,quantity,gear,updated_at)
      values(u,'equipment_v2:'||(eq->>'id'),1,eq,now())
      on conflict(user_id,item_id) do nothing;
    end loop;

    insert into private.player_consumables(user_id,item_id,quantity,updated_at) values
      (u,'healing_lesser',coalesce(r.potion_lesser,0),now()),
      (u,'healing_standard',coalesce(r.potion_standard,0),now()),
      (u,'healing_greater',coalesce(r.potion_greater,0),now()),
      (u,'healing_supreme',coalesce(r.potion_supreme,0),now()),
      (u,'revival',coalesce(r.revival_count,0),now())
    on conflict(user_id,item_id) do update
      set quantity=private.player_consumables.quantity+excluded.quantity,updated_at=now();

    update private.online_expeditions set status='RETURNED',settled_at=now(),
      temporary_loot='{"silver":0,"material":0,"tickets":0,"equipment":[]}'::jsonb,
      potion_lesser=0,potion_standard=0,potion_greater=0,potion_supreme=0,revival_count=0,run_version=run_version+1
    where user_id=u returning * into r;
  elsif p_outcome='dead' then
    update private.online_expeditions set status='DEAD',settled_at=now(),
      temporary_loot='{"silver":0,"material":0,"tickets":0,"equipment":[]}'::jsonb,
      potion_lesser=0,potion_standard=0,potion_greater=0,potion_supreme=0,revival_count=0,run_version=run_version+1
    where user_id=u returning * into r;
  end if;

  update private.online_combat_states set return_authorized=false,state_version=state_version+1,updated_at=now()
    where user_id=u and run_id=r.run_id;

  select * into s from public.game_saves where user_id=u for update;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
  payload:=private.server_authoritative_payload(u,s.payload);
  payload:=jsonb_set(payload,'{expedition}','null'::jsonb,true);

  loot:=jsonb_build_object(
    'silver',gross,
    'materials',jsonb_build_object('ore',jsonb_build_array(0,0,0,0,0),'leather',jsonb_build_array(0,0,0,0,0),
      'gem',jsonb_build_array(0,0,0,0,0),'kaleon',jsonb_build_array(0,0,0,0,0)),
    'tickets',jsonb_build_object('ore',jsonb_build_array(0,0,0,0,0,0,0,0,0,0),
      'leather',jsonb_build_array(0,0,0,0,0,0,0,0,0,0),'gem',jsonb_build_array(0,0,0,0,0,0,0,0,0,0),
      'kaleon',jsonb_build_array(0,0,0,0,0,0,0,0,0,0)),
    'skillBooks','{}'::jsonb,'items','{}'::jsonb,'equipment',equipment
  );
  tier_idx:=(case when r.floor<=3 then 1 when r.floor<=6 then 2 else 3 end)-1;
  if mat>0 then loot:=jsonb_set(loot,array['materials',r.tower,tier_idx::text],to_jsonb(mat),true);end if;
  if tickets>0 and r.floor<10 then loot:=jsonb_set(loot,array['tickets',r.tower,r.floor::text],to_jsonb(tickets),true);end if;
  elapsed:=greatest(0,floor(extract(epoch from (coalesce(r.settled_at,now())-r.started_at)))::bigint);
  receipt:=jsonb_build_object('outcome',p_outcome,'tower',r.tower,'floor',r.floor,'time',elapsed,
    'kills',r.confirmed_kills,'loot',loot,'remainingPotions',remaining);
  payload:=jsonb_set(payload,'{lastExpedition}',receipt,true);

  if p_outcome='returned' then
    payload:=jsonb_set(payload,array['exploration','highestReturned',r.tower],
      to_jsonb(greatest(coalesce((payload->'exploration'->'highestReturned'->>r.tower)::int,0),r.floor)),true);
    payload:=jsonb_set(payload,array['progress',r.tower],
      to_jsonb(greatest(coalesce((payload->'progress'->>r.tower)::int,1),r.floor)),true);
    if r.floor=10 and r.boss_defeated then payload:=jsonb_set(payload,'{market,traderCertified}','true'::jsonb,true);end if;
  end if;

  perform private.persist_client_payload_with_server_economy(u,payload,'0.1.51');
  return private.cloud_record_json(u);
end $function$
;

