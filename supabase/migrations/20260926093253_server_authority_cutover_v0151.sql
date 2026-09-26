-- v0.1.51 server-authority cutover.
-- Legacy client-trusted economy/bootstrap paths are deliberately retired.

create table if not exists private.player_consumables (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null check (item_id in ('healing_lesser','healing_standard','healing_greater','healing_supreme','revival')),
  quantity integer not null check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id,item_id)
);
alter table private.player_consumables enable row level security;
revoke all on private.player_consumables from public, anon, authenticated;

create or replace function private.server_consumables_json(p_user uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'healing_lesser', coalesce((select quantity from private.player_consumables where user_id=p_user and item_id='healing_lesser'),0),
    'healing_standard', coalesce((select quantity from private.player_consumables where user_id=p_user and item_id='healing_standard'),0),
    'healing_greater', coalesce((select quantity from private.player_consumables where user_id=p_user and item_id='healing_greater'),0),
    'healing_supreme', coalesce((select quantity from private.player_consumables where user_id=p_user and item_id='healing_supreme'),0),
    'revival', coalesce((select quantity from private.player_consumables where user_id=p_user and item_id='revival'),0)
  )
$$;
revoke all on function private.server_consumables_json(uuid) from public, anon, authenticated;

create or replace function private.server_bootstrap_payload(p_payload jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare p jsonb:=coalesce(p_payload,'{}'::jsonb);
begin
  p:=p || jsonb_build_object(
    'version',22,
    'silver',0,
    'materials',jsonb_build_object('ore',jsonb_build_array(0,0,0,0,0),'leather',jsonb_build_array(0,0,0,0,0),'gem',jsonb_build_array(0,0,0,0,0),'kaleon',jsonb_build_array(0,0,0,0,0)),
    'tickets',jsonb_build_object('ore',jsonb_build_array(20,0,0,0,0,0,0,0,0,0),'leather',jsonb_build_array(20,0,0,0,0,0,0,0,0,0),'gem',jsonb_build_array(20,0,0,0,0,0,0,0,0,0),'kaleon',jsonb_build_array(20,0,0,0,0,0,0,0,0,0)),
    'items',jsonb_build_array(jsonb_build_object('id','starter','kind','sword','tier',1,'enhancement',0)),
    'equipped',jsonb_build_object('weapon','starter','armor',null,'boots',null,'accessory',null),
    'skillBooks','{}'::jsonb,
    'lootItems','{}'::jsonb,
    'potions',jsonb_build_object('healing_lesser',30,'healing_standard',5,'healing_greater',0,'healing_supreme',0,'revival',0),
    'loadout',jsonb_build_object('healing_lesser',10,'healing_standard',0,'healing_greater',0,'healing_supreme',0,'revival',0),
    'ownedJobIds','[]'::jsonb,
    'currentJobId',null,
    'learned','[]'::jsonb,
    'skills',jsonb_build_array(null,null,null),
    'market',jsonb_build_object('traderCertified',false,'ownerId','local-player','gold',1000,'orders','[]'::jsonb,'trades','[]'::jsonb,'storage','[]'::jsonb,'nextOrderId',1,'nextTradeId',1,'nextSequence',1,'nextStorageId',1),
    'goldenRecorder',jsonb_build_object('expiresAt',null),
    'crafting',jsonb_build_object('jobs','[]'::jsonb,'nextJobId',1),
    'association',jsonb_build_object('currentId',null,'associations','[]'::jsonb,'nextId',1,'nextApplicationId',1),
    'lastExpedition',null,
    'expedition',null
  );
  return p;
end $$;
revoke all on function private.server_bootstrap_payload(jsonb) from public, anon, authenticated;

create or replace function private.server_authoritative_payload(p_user uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p jsonb; b jsonb:=private.server_consumables_json(p_user); l jsonb;
begin
  p:=private.server_economy_payload(p_user,p_payload);
  l:=coalesce(p->'loadout','{}'::jsonb);
  p:=jsonb_set(p,'{potions}',b,true);
  p:=jsonb_set(p,'{loadout}',jsonb_build_object(
    'healing_lesser',least(coalesce((l->>'healing_lesser')::integer,0),coalesce((b->>'healing_lesser')::integer,0)),
    'healing_standard',least(coalesce((l->>'healing_standard')::integer,0),coalesce((b->>'healing_standard')::integer,0)),
    'healing_greater',least(coalesce((l->>'healing_greater')::integer,0),coalesce((b->>'healing_greater')::integer,0)),
    'healing_supreme',least(coalesce((l->>'healing_supreme')::integer,0),coalesce((b->>'healing_supreme')::integer,0)),
    'revival',least(1,coalesce((l->>'revival')::integer,0),coalesce((b->>'revival')::integer,0))
  ),true);
  return p;
end $$;
revoke all on function private.server_authoritative_payload(uuid,jsonb) from public, anon, authenticated;

create or replace function private.persist_client_payload_with_server_economy(p_user uuid,p_payload jsonb,p_app_version text default '0.1.51')
returns bigint language plpgsql security definer set search_path='' as $$
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
end $$;
revoke all on function private.persist_client_payload_with_server_economy(uuid,jsonb,text) from public,anon,authenticated;

create or replace function public.save_game_state(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_base_revision bigint,p_save_schema integer,p_app_version text,p_payload jsonb,p_payload_hash text,p_device_id text)
returns table(revision bigint,updated_at timestamptz) language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_auth_session uuid;v_session_text text:=auth.jwt()->>'session_id';v_game_session private.active_game_sessions%rowtype;v_current public.game_saves%rowtype;v_revision bigint;v_updated_at timestamptz;v_payload jsonb;v_hash text;
begin
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
end $$;
revoke all on function public.save_game_state(uuid,bigint,text,bigint,integer,text,jsonb,text,text) from public,anon;
grant execute on function public.save_game_state(uuid,bigint,text,bigint,integer,text,jsonb,text,text) to authenticated;

create or replace function private.ensure_run_consumables(p_user uuid,p_run private.online_expeditions)
returns private.online_expeditions language plpgsql security definer set search_path='' as $$
declare r private.online_expeditions%rowtype;b jsonb;
begin
  r:=p_run;
  if r.potion_lesser is not null then return r;end if;
  b:=private.server_consumables_json(p_user);
  update private.online_expeditions set
    potion_lesser=coalesce((b->>'healing_lesser')::integer,0),
    potion_standard=coalesce((b->>'healing_standard')::integer,0),
    potion_greater=coalesce((b->>'healing_greater')::integer,0),
    potion_supreme=coalesce((b->>'healing_supreme')::integer,0),
    revival_count=least(1,coalesce((b->>'revival')::integer,0))
  where user_id=p_user returning * into r;
  return r;
end $$;
revoke all on function private.ensure_run_consumables(uuid,private.online_expeditions) from public,anon,authenticated;

create or replace function private.persist_run_bag_to_save(p_user uuid,p_run private.online_expeditions)
returns void language plpgsql security definer set search_path='' as $$
declare s public.game_saves%rowtype;p jsonb;b jsonb;
begin
  insert into private.player_consumables(user_id,item_id,quantity,updated_at)
  values
    (p_user,'healing_lesser',greatest(0,coalesce(p_run.potion_lesser,0)),now()),
    (p_user,'healing_standard',greatest(0,coalesce(p_run.potion_standard,0)),now()),
    (p_user,'healing_greater',greatest(0,coalesce(p_run.potion_greater,0)),now()),
    (p_user,'healing_supreme',greatest(0,coalesce(p_run.potion_supreme,0)),now()),
    (p_user,'revival',greatest(0,coalesce(p_run.revival_count,0)),now())
  on conflict(user_id,item_id) do update set quantity=excluded.quantity,updated_at=now();
  select * into s from public.game_saves where user_id=p_user for update;
  if not found or jsonb_typeof(s.payload->'expedition')<>'object' then return;end if;
  p:=private.server_authoritative_payload(p_user,s.payload);
  b:=private.server_consumables_json(p_user);
  p:=jsonb_set(p,'{expedition,bag}',b,true);
  update public.game_saves set payload=p,payload_hash=encode(extensions.digest(convert_to(private.stable_json_string(p),'UTF8'),'sha256'),'hex'),updated_at=now() where user_id=p_user;
end $$;
revoke all on function private.persist_run_bag_to_save(uuid,private.online_expeditions) from public,anon,authenticated;

create or replace function private.require_server_combat_job(p_payload jsonb)
returns text language plpgsql immutable set search_path='' as $$
begin
  -- Job registration has no server entitlement record yet. Until that RPC exists,
  -- online runs are intentionally jobless rather than accepting a client snapshot.
  return null;
end $$;
revoke all on function private.require_server_combat_job(jsonb) from public,anon,authenticated;

create or replace function public.start_online_expedition(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_tower text,p_floor integer,p_client_payload jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid;v_save public.game_saves%rowtype;v_ticket_id text;v_ticket private.market_assets%rowtype;v_rate integer:=0;v_assoc_id text;v_exp jsonb;v_payload jsonb;r private.online_expeditions%rowtype;
begin
  v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  perform private.sync_market_economy_from_latest_save(v_user);
  if p_tower not in ('ore','leather','gem','kaleon') or p_floor<1 or p_floor>10 then raise exception 'EXPEDITION_TARGET_INVALID';end if;
  select * into v_save from public.game_saves where user_id=v_user for update;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
  if jsonb_typeof(v_save.payload->'expedition') is not null and jsonb_typeof(v_save.payload->'expedition')<>'null' then raise exception 'EXPEDITION_ALREADY_ACTIVE';end if;
  if exists(select 1 from private.online_expeditions where user_id=v_user and status='ACTIVE') then raise exception 'EXPEDITION_ALREADY_ACTIVE';end if;
  v_ticket_id:='ticket:'||p_tower||':'||p_floor::text;
  select * into v_ticket from private.market_assets where user_id=v_user and item_id=v_ticket_id for update;
  if not found or v_ticket.quantity<1 then raise exception 'EXPEDITION_TICKET_REQUIRED';end if;
  if v_ticket.quantity=1 then delete from private.market_assets where user_id=v_user and item_id=v_ticket_id;else update private.market_assets set quantity=quantity-1,updated_at=now() where user_id=v_user and item_id=v_ticket_id;end if;
  v_assoc_id:=v_save.payload->'association'->>'currentId';
  if v_assoc_id is not null then select greatest(0,least(30,coalesce((a->>'revenueShareRatePercent')::integer,0))) into v_rate from jsonb_array_elements(coalesce(v_save.payload->'association'->'associations','[]'::jsonb)) a where a->>'associationId'=v_assoc_id and a->>'status'='ACTIVE' limit 1;v_rate:=coalesce(v_rate,0);end if;
  v_exp:=coalesce(p_client_payload->'expedition','{}'::jsonb)||jsonb_build_object('tower',p_tower,'floor',p_floor,'equipment',v_save.payload->'equipped','jobSnapshotId',null,'bag',private.server_consumables_json(v_user));
  v_payload:=private.server_authoritative_payload(v_user,p_client_payload);
  v_payload:=jsonb_set(v_payload,'{expedition}',v_exp,true);
  insert into private.online_expeditions(user_id,run_id,tower,floor,status,starting_revision,revenue_share_rate,started_at,settled_at)
  values(v_user,gen_random_uuid(),p_tower,p_floor,'ACTIVE',v_save.revision,v_rate,now(),null)
  on conflict(user_id) do update set
    run_id=excluded.run_id,tower=excluded.tower,floor=excluded.floor,status='ACTIVE',starting_revision=excluded.starting_revision,revenue_share_rate=excluded.revenue_share_rate,started_at=excluded.started_at,settled_at=null,
    encounter_index=0,boss_progress=0,boss_defeated=false,pending_event=null,temporary_loot='{"silver":0,"material":0,"tickets":0}'::jsonb,run_version=1,recent_event_ids='{}'::text[],
    potion_lesser=null,potion_standard=null,potion_greater=null,potion_supreme=null,revival_count=null,stronghold=null,stronghold_sequence=0,confirmed_kills=0,
    reward_seed=floor(random()*2147483647)::bigint,last_confirmed_kill_at=null
  returning * into r;
  perform private.ensure_run_consumables(v_user,r);
  perform private.persist_client_payload_with_server_economy(v_user,v_payload,'0.1.51');
  return private.cloud_record_json(v_user);
end $$;
revoke all on function public.start_online_expedition(uuid,bigint,text,text,text,integer,jsonb) from public,anon;
grant execute on function public.start_online_expedition(uuid,bigint,text,text,text,integer,jsonb) to authenticated;

create or replace function public.settle_online_expedition_v2(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_outcome text,p_client_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;r private.online_expeditions%rowtype;payload jsonb;gross bigint:=0;share bigint:=0;net bigint:=0;mat bigint:=0;tickets bigint:=0;asset text;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  select * into r from private.online_expeditions where user_id=u for update;
  if not found then return private.cloud_record_json(u);end if;
  if r.status in('RETURNED','DEAD') then return private.cloud_record_json(u);end if;
  if p_outcome not in('returned','dead') then raise exception 'EXPEDITION_RECEIPT_INVALID';end if;
  if jsonb_typeof(p_client_payload->'expedition') is distinct from 'null' then raise exception 'EXPEDITION_SETTLEMENT_PAYLOAD_INVALID';end if;
  if r.stronghold is not null and r.stronghold->>'status' in('ACTIVE','CONTESTED') then raise exception 'RESOURCE_STRONGHOLD_ACTIVE';end if;
  if p_outcome='returned' then
    gross:=coalesce((r.temporary_loot->>'silver')::bigint,0);mat:=coalesce((r.temporary_loot->>'material')::bigint,0);tickets:=coalesce((r.temporary_loot->>'tickets')::bigint,0);
    share:=floor(gross*r.revenue_share_rate/100.0);net:=gross-share;
    update private.player_wallets set silver=silver+net,updated_at=now() where user_id=u;
    if mat>0 then asset:='material:'||r.tower||':'||(case when r.floor<=3 then 1 when r.floor<=6 then 2 else 3 end)::text;insert into private.market_assets(user_id,item_id,quantity,updated_at) values(u,asset,mat,now()) on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+excluded.quantity,updated_at=now();end if;
    if tickets>0 and r.floor<10 then insert into private.market_assets(user_id,item_id,quantity,updated_at) values(u,'ticket:'||r.tower||':'||(r.floor+1)::text,tickets,now()) on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+excluded.quantity,updated_at=now();end if;
    update private.online_expeditions set status='RETURNED',settled_at=now(),temporary_loot='{"silver":0,"material":0,"tickets":0}'::jsonb,run_version=run_version+1 where user_id=u returning * into r;
  else
    update private.online_expeditions set status='DEAD',settled_at=now(),temporary_loot='{"silver":0,"material":0,"tickets":0}'::jsonb,run_version=run_version+1 where user_id=u returning * into r;
  end if;
  perform private.persist_run_bag_to_save(u,r);
  payload:=jsonb_set(p_client_payload,'{lastExpedition,kills}',to_jsonb(r.confirmed_kills),true);
  perform private.persist_client_payload_with_server_economy(u,payload,'0.1.51');
  return private.cloud_record_json(u);
end $$;
revoke all on function public.settle_online_expedition_v2(uuid,bigint,text,text,text,jsonb) from public,anon;
grant execute on function public.settle_online_expedition_v2(uuid,bigint,text,text,text,jsonb) to authenticated;

-- Full trust cutover selected by the operator: retire the previous test-era economy,
-- then rebuild every account from the server-issued starter state.
delete from private.market_storage;
delete from private.market_orders;
delete from private.market_trades;
delete from private.online_craft_jobs;
delete from private.online_expedition_kills;
delete from private.online_combat_states;
delete from private.online_expeditions;
delete from private.market_assets;
delete from private.player_wallets;
delete from private.player_consumables;

update public.game_saves g
set revision=g.revision+1,
    app_version='0.1.51',
    payload=private.server_bootstrap_payload(g.payload),
    payload_hash=encode(extensions.digest(convert_to(private.stable_json_string(private.server_bootstrap_payload(g.payload)),'UTF8'),'sha256'),'hex'),
    updated_at=now();

insert into private.player_consumables(user_id,item_id,quantity)
select g.user_id,v.item_id,v.quantity
from public.game_saves g
cross join (values ('healing_lesser',30),('healing_standard',5),('healing_greater',0),('healing_supreme',0),('revival',0)) as v(item_id,quantity)
on conflict(user_id,item_id) do update set quantity=excluded.quantity,updated_at=now();

select private.sync_market_economy_from_latest_save(user_id) from public.game_saves;

drop function if exists public.settle_online_expedition(uuid,bigint,text,text,jsonb);
drop function if exists public.apply_online_skill(uuid,bigint,text,text,bigint,text);
