-- v0.1.51 final server-authority hardening.
-- Finalizes consumable escrow, job entitlements, and canonical expedition settlement.

create table if not exists private.player_job_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id text not null,
  acquired_at timestamptz not null default now(),
  primary key(user_id,job_id)
);
alter table private.player_job_entitlements enable row level security;
revoke all on private.player_job_entitlements from public,anon,authenticated;

create table if not exists private.player_job_selection (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_job_id text,
  updated_at timestamptz not null default now()
);
alter table private.player_job_selection enable row level security;
revoke all on private.player_job_selection from public,anon,authenticated;

create or replace function private.server_owned_jobs_json(p_user uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(job_id order by acquired_at,job_id),'[]'::jsonb)
  from private.player_job_entitlements where user_id=p_user
$$;
revoke all on function private.server_owned_jobs_json(uuid) from public,anon,authenticated;

create or replace function private.server_current_job(p_user uuid)
returns text language sql stable security definer set search_path='' as $$
  select s.current_job_id
  from private.player_job_selection s
  where s.user_id=p_user
    and (s.current_job_id is null or exists(
      select 1 from private.player_job_entitlements e
      where e.user_id=p_user and e.job_id=s.current_job_id
    ))
$$;
revoke all on function private.server_current_job(uuid) from public,anon,authenticated;

create or replace function private.server_authoritative_payload(p_user uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  p jsonb;
  b jsonb:=private.server_consumables_json(p_user);
  l jsonb;
  owned jsonb:=private.server_owned_jobs_json(p_user);
  current_job text:=private.server_current_job(p_user);
begin
  p:=private.server_economy_payload(p_user,p_payload);
  l:=coalesce(p->'loadout','{}'::jsonb);
  p:=jsonb_set(p,'{potions}',b,true);
  p:=jsonb_set(p,'{loadout}',jsonb_build_object(
    'healing_lesser',least(greatest(0,coalesce((l->>'healing_lesser')::integer,0)),coalesce((b->>'healing_lesser')::integer,0)),
    'healing_standard',least(greatest(0,coalesce((l->>'healing_standard')::integer,0)),coalesce((b->>'healing_standard')::integer,0)),
    'healing_greater',least(greatest(0,coalesce((l->>'healing_greater')::integer,0)),coalesce((b->>'healing_greater')::integer,0)),
    'healing_supreme',least(greatest(0,coalesce((l->>'healing_supreme')::integer,0)),coalesce((b->>'healing_supreme')::integer,0)),
    'revival',least(1,greatest(0,coalesce((l->>'revival')::integer,0)),coalesce((b->>'revival')::integer,0))
  ),true);
  p:=jsonb_set(p,'{ownedJobIds}',owned,true);
  p:=jsonb_set(p,'{currentJobId}',case when current_job is null then 'null'::jsonb else to_jsonb(current_job) end,true);
  return p;
end $$;
revoke all on function private.server_authoritative_payload(uuid,jsonb) from public,anon,authenticated;

create or replace function private.require_server_combat_job(p_payload jsonb)
returns text language plpgsql immutable set search_path='' as $$
declare j text:=p_payload->>'currentJobId';
begin
  if j in ('contract_mercenary','hunter','field_medic','duelist','berserker') then return j;end if;
  return null;
end $$;
revoke all on function private.require_server_combat_job(jsonb) from public,anon,authenticated;

create or replace function private.grant_server_job(p_user uuid,p_job_id text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_job_id is null or length(p_job_id)=0 then raise exception 'JOB_ID_INVALID';end if;
  insert into private.player_job_entitlements(user_id,job_id)
  values(p_user,p_job_id) on conflict do nothing;
end $$;
revoke all on function private.grant_server_job(uuid,text) from public,anon,authenticated;

create or replace function public.select_online_job(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_job_id text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid;s public.game_saves%rowtype;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') then
    raise exception 'JOB_CHANGE_DURING_EXPEDITION';
  end if;
  if p_job_id is not null then
    if p_job_id not in ('contract_mercenary','hunter','field_medic','duelist','berserker') then
      raise exception 'JOB_COMBAT_NOT_READY';
    end if;
    if not exists(select 1 from private.player_job_entitlements where user_id=u and job_id=p_job_id) then
      raise exception 'JOB_NOT_OWNED';
    end if;
  end if;
  insert into private.player_job_selection(user_id,current_job_id,updated_at)
  values(u,p_job_id,now())
  on conflict(user_id) do update set current_job_id=excluded.current_job_id,updated_at=now();
  select * into s from public.game_saves where user_id=u for update;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
  perform private.persist_client_payload_with_server_economy(u,s.payload,'0.1.51');
  return private.cloud_record_json(u);
end $$;
revoke all on function public.select_online_job(uuid,bigint,text,text,text) from public,anon;
grant execute on function public.select_online_job(uuid,bigint,text,text,text) to authenticated;

-- Move only the selected loadout into a run escrow. The permanent inventory remains
-- in player_consumables and cannot be spent twice while the expedition is active.
create or replace function private.ensure_run_consumables(p_user uuid,p_run private.online_expeditions)
returns private.online_expeditions language plpgsql security definer set search_path='' as $$
declare
  r private.online_expeditions%rowtype:=p_run;
  s public.game_saves%rowtype;
  b jsonb;l jsonb;
  q_lesser int;q_standard int;q_greater int;q_supreme int;q_revival int;
  p jsonb;bag jsonb;
begin
  if r.potion_lesser is not null then return r;end if;
  select * into s from public.game_saves where user_id=p_user for update;
  if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
  b:=private.server_consumables_json(p_user);
  l:=coalesce(s.payload->'loadout','{}'::jsonb);
  q_lesser:=least(greatest(0,coalesce((l->>'healing_lesser')::int,0)),coalesce((b->>'healing_lesser')::int,0));
  q_standard:=least(greatest(0,coalesce((l->>'healing_standard')::int,0)),coalesce((b->>'healing_standard')::int,0));
  q_greater:=least(greatest(0,coalesce((l->>'healing_greater')::int,0)),coalesce((b->>'healing_greater')::int,0));
  q_supreme:=least(greatest(0,coalesce((l->>'healing_supreme')::int,0)),coalesce((b->>'healing_supreme')::int,0));
  q_revival:=least(1,greatest(0,coalesce((l->>'revival')::int,0)),coalesce((b->>'revival')::int,0));

  update private.player_consumables set quantity=quantity-q_lesser,updated_at=now()
    where user_id=p_user and item_id='healing_lesser';
  update private.player_consumables set quantity=quantity-q_standard,updated_at=now()
    where user_id=p_user and item_id='healing_standard';
  update private.player_consumables set quantity=quantity-q_greater,updated_at=now()
    where user_id=p_user and item_id='healing_greater';
  update private.player_consumables set quantity=quantity-q_supreme,updated_at=now()
    where user_id=p_user and item_id='healing_supreme';
  update private.player_consumables set quantity=quantity-q_revival,updated_at=now()
    where user_id=p_user and item_id='revival';

  update private.online_expeditions set
    potion_lesser=q_lesser,potion_standard=q_standard,potion_greater=q_greater,potion_supreme=q_supreme,revival_count=q_revival
  where user_id=p_user returning * into r;

  bag:=jsonb_build_object(
    'healing_lesser',q_lesser,'healing_standard',q_standard,'healing_greater',q_greater,
    'healing_supreme',q_supreme,'revival',q_revival
  );
  p:=private.server_authoritative_payload(p_user,s.payload);
  if jsonb_typeof(p->'expedition')='object' then p:=jsonb_set(p,'{expedition,bag}',bag,true);end if;
  update public.game_saves set payload=p,
    payload_hash=encode(extensions.digest(convert_to(private.stable_json_string(p),'UTF8'),'sha256'),'hex'),
    updated_at=now() where user_id=p_user;
  return r;
end $$;
revoke all on function private.ensure_run_consumables(uuid,private.online_expeditions) from public,anon,authenticated;

create or replace function private.persist_run_bag_to_save(p_user uuid,p_run private.online_expeditions)
returns void language plpgsql security definer set search_path='' as $$
declare s public.game_saves%rowtype;p jsonb;bag jsonb;
begin
  select * into s from public.game_saves where user_id=p_user for update;
  if not found then return;end if;
  p:=private.server_authoritative_payload(p_user,s.payload);
  if jsonb_typeof(p->'expedition')<>'object' then return;end if;
  bag:=jsonb_build_object(
    'healing_lesser',greatest(0,coalesce(p_run.potion_lesser,0)),
    'healing_standard',greatest(0,coalesce(p_run.potion_standard,0)),
    'healing_greater',greatest(0,coalesce(p_run.potion_greater,0)),
    'healing_supreme',greatest(0,coalesce(p_run.potion_supreme,0)),
    'revival',greatest(0,coalesce(p_run.revival_count,0))
  );
  p:=jsonb_set(p,'{expedition,bag}',bag,true);
  update public.game_saves set payload=p,
    payload_hash=encode(extensions.digest(convert_to(private.stable_json_string(p),'UTF8'),'sha256'),'hex'),
    updated_at=now() where user_id=p_user;
end $$;
revoke all on function private.persist_run_bag_to_save(uuid,private.online_expeditions) from public,anon,authenticated;

create or replace function public.start_online_expedition(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_tower text,p_floor integer,p_client_payload jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user uuid;v_save public.game_saves%rowtype;v_ticket_id text;v_ticket private.market_assets%rowtype;
  v_rate integer:=0;v_assoc_id text;v_exp jsonb;v_payload jsonb;r private.online_expeditions%rowtype;
  job_id text;bag jsonb;
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
  if v_ticket.quantity=1 then delete from private.market_assets where user_id=v_user and item_id=v_ticket_id;
  else update private.market_assets set quantity=quantity-1,updated_at=now() where user_id=v_user and item_id=v_ticket_id;end if;

  v_assoc_id:=v_save.payload->'association'->>'currentId';
  if v_assoc_id is not null then
    select greatest(0,least(30,coalesce((a->>'revenueShareRatePercent')::integer,0))) into v_rate
    from jsonb_array_elements(coalesce(v_save.payload->'association'->'associations','[]'::jsonb)) a
    where a->>'associationId'=v_assoc_id and a->>'status'='ACTIVE' limit 1;
    v_rate:=coalesce(v_rate,0);
  end if;

  insert into private.online_expeditions(user_id,run_id,tower,floor,status,starting_revision,revenue_share_rate,started_at,settled_at)
  values(v_user,gen_random_uuid(),p_tower,p_floor,'ACTIVE',v_save.revision,v_rate,now(),null)
  on conflict(user_id) do update set
    run_id=excluded.run_id,tower=excluded.tower,floor=excluded.floor,status='ACTIVE',
    starting_revision=excluded.starting_revision,revenue_share_rate=excluded.revenue_share_rate,
    started_at=excluded.started_at,settled_at=null,encounter_index=0,boss_progress=0,boss_defeated=false,
    pending_event=null,temporary_loot='{"silver":0,"material":0,"tickets":0}'::jsonb,run_version=1,
    recent_event_ids='{}'::text[],potion_lesser=null,potion_standard=null,potion_greater=null,potion_supreme=null,
    revival_count=null,stronghold=null,stronghold_sequence=0,confirmed_kills=0,
    reward_seed=floor(random()*2147483647)::bigint,last_confirmed_kill_at=null
  returning * into r;

  -- Authoritative payload first; then escrow the selected loadout.
  v_payload:=private.server_authoritative_payload(v_user,p_client_payload);
  job_id:=private.server_current_job(v_user);
  v_exp:=coalesce(v_payload->'expedition','{}'::jsonb)||jsonb_build_object(
    'tower',p_tower,'floor',p_floor,'equipment',v_save.payload->'equipped','jobSnapshotId',job_id
  );
  v_payload:=jsonb_set(v_payload,'{expedition}',v_exp,true);
  perform private.persist_client_payload_with_server_economy(v_user,v_payload,'0.1.51');
  select * into v_save from public.game_saves where user_id=v_user;
  r:=private.ensure_run_consumables(v_user,r);
  bag:=jsonb_build_object('healing_lesser',r.potion_lesser,'healing_standard',r.potion_standard,
    'healing_greater',r.potion_greater,'healing_supreme',r.potion_supreme,'revival',r.revival_count);
  select payload into v_payload from public.game_saves where user_id=v_user;
  v_payload:=jsonb_set(v_payload,'{expedition,bag}',bag,true);
  update public.game_saves set payload=v_payload,
    payload_hash=encode(extensions.digest(convert_to(private.stable_json_string(v_payload),'UTF8'),'sha256'),'hex'),
    updated_at=now() where user_id=v_user;
  return private.cloud_record_json(v_user);
end $$;
revoke all on function public.start_online_expedition(uuid,bigint,text,text,text,integer,jsonb) from public,anon;
grant execute on function public.start_online_expedition(uuid,bigint,text,text,text,integer,jsonb) to authenticated;

create or replace function public.settle_online_expedition_v2(
  p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_outcome text,p_client_payload jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;s public.game_saves%rowtype;
  gross bigint:=0;share bigint:=0;net bigint:=0;mat bigint:=0;tickets bigint:=0;asset text;
  remaining jsonb;loot jsonb;receipt jsonb;payload jsonb;tier_idx int;elapsed bigint;
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
  else
    if c.phase<>'PLAYER_DEAD' or c.player_hp<>0 or coalesce(c.pending_revival,false) then raise exception 'EXPEDITION_DEATH_NOT_CONFIRMED';end if;
  end if;

  gross:=coalesce((r.temporary_loot->>'silver')::bigint,0);
  mat:=coalesce((r.temporary_loot->>'material')::bigint,0);
  tickets:=coalesce((r.temporary_loot->>'tickets')::bigint,0);
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

    insert into private.player_consumables(user_id,item_id,quantity,updated_at) values
      (u,'healing_lesser',coalesce(r.potion_lesser,0),now()),
      (u,'healing_standard',coalesce(r.potion_standard,0),now()),
      (u,'healing_greater',coalesce(r.potion_greater,0),now()),
      (u,'healing_supreme',coalesce(r.potion_supreme,0),now()),
      (u,'revival',coalesce(r.revival_count,0),now())
    on conflict(user_id,item_id) do update
      set quantity=private.player_consumables.quantity+excluded.quantity,updated_at=now();

    update private.online_expeditions set status='RETURNED',settled_at=now(),
      temporary_loot='{"silver":0,"material":0,"tickets":0}'::jsonb,
      potion_lesser=0,potion_standard=0,potion_greater=0,potion_supreme=0,revival_count=0,run_version=run_version+1
    where user_id=u returning * into r;
  else
    update private.online_expeditions set status='DEAD',settled_at=now(),
      temporary_loot='{"silver":0,"material":0,"tickets":0}'::jsonb,
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
    'skillBooks','{}'::jsonb,'items','{}'::jsonb
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
end $$;
revoke all on function public.settle_online_expedition_v2(uuid,bigint,text,text,text,jsonb) from public,anon;
grant execute on function public.settle_online_expedition_v2(uuid,bigint,text,text,text,jsonb) to authenticated;
