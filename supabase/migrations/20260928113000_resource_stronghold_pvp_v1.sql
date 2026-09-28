-- v0.1.67 resource stronghold PvP V1.
-- Shared ownership, serialized requests, intervention combat and one-time loot receipts.

create table if not exists private.resource_strongholds (
 stronghold_id uuid primary key default gen_random_uuid(),
 tower text not null check(tower in('ore','fang','gem','kaleon')),
 floor integer not null check(floor between 3 and 10),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 owner_run_id uuid not null,
 status text not null check(status in('ACTIVE','CONTESTED','COMPLETED','ABANDONED')),
 version bigint not null default 1,
 captured_at timestamptz not null default clock_timestamp(),
 capture_ends_at timestamptz not null,
 reward jsonb not null,
 active_contest_id uuid,
 updated_at timestamptz not null default clock_timestamp()
);
create unique index if not exists resource_strongholds_active_slot_uq
 on private.resource_strongholds(tower,floor) where status in('ACTIVE','CONTESTED');
create index if not exists resource_strongholds_owner_idx
 on private.resource_strongholds(owner_user_id,status,capture_ends_at);
alter table private.resource_strongholds enable row level security;
revoke all on private.resource_strongholds from public,anon,authenticated;

create table if not exists private.resource_stronghold_requests (
 request_pk bigint generated always as identity primary key,
 request_id uuid not null,
 stronghold_id uuid references private.resource_strongholds(stronghold_id) on delete cascade,
 requester_user_id uuid not null references auth.users(id) on delete cascade,
 requester_run_id uuid not null,
 tower text not null,
 floor integer not null,
 kind text not null check(kind in('CLAIM','CONTEST')),
 status text not null check(status in('RECEIVED','CLAIMED','SELECTED','QUEUED','RESOLVED','REJECTED')),
 requested_at timestamptz not null default clock_timestamp(),
 resolved_at timestamptz,
 result jsonb,
 constraint resource_stronghold_requests_request_uq unique(request_id)
);
create index if not exists resource_stronghold_requests_priority_idx
 on private.resource_stronghold_requests(tower,floor,status,requested_at,request_id);
alter table private.resource_stronghold_requests enable row level security;
revoke all on private.resource_stronghold_requests from public,anon,authenticated;

create table if not exists private.resource_stronghold_contests (
 contest_id uuid primary key default gen_random_uuid(),
 stronghold_id uuid not null references private.resource_strongholds(stronghold_id) on delete cascade,
 request_id uuid not null references private.resource_stronghold_requests(request_id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 challenger_user_id uuid not null references auth.users(id) on delete cascade,
 owner_run_id uuid not null,
 challenger_run_id uuid not null,
 status text not null check(status in('PENDING','FIGHTING','RESOLVED','CANCELLED')),
 owner_response text check(owner_response in('DEFEND','ABANDON')),
 decision_ends_at timestamptz not null,
 original_capture_ends_at timestamptz not null,
 owner_hp bigint not null default 100,
 challenger_hp bigint not null default 100,
 owner_attack bigint not null default 12,
 challenger_attack bigint not null default 12,
 owner_defense bigint not null default 4,
 challenger_defense bigint not null default 4,
 owner_guard boolean not null default false,
 challenger_guard boolean not null default false,
 current_actor uuid not null,
 action_nonce bigint not null default 0,
 winner_user_id uuid references auth.users(id) on delete set null,
 started_at timestamptz,
 resolved_at timestamptz,
 created_at timestamptz not null default clock_timestamp()
);
create unique index if not exists resource_stronghold_contests_open_uq
 on private.resource_stronghold_contests(stronghold_id) where status in('PENDING','FIGHTING');
create index if not exists resource_stronghold_contests_user_idx
 on private.resource_stronghold_contests(owner_user_id,challenger_user_id,status);
alter table private.resource_stronghold_contests enable row level security;
revoke all on private.resource_stronghold_contests from public,anon,authenticated;

alter table private.resource_strongholds
 drop constraint if exists resource_strongholds_active_contest_fk;
alter table private.resource_strongholds
 add constraint resource_strongholds_active_contest_fk foreign key(active_contest_id)
 references private.resource_stronghold_contests(contest_id) on delete set null;

create table if not exists private.resource_stronghold_loot_receipts (
 receipt_id uuid primary key default gen_random_uuid(),
 contest_id uuid not null references private.resource_stronghold_contests(contest_id) on delete cascade,
 recipient_user_id uuid not null references auth.users(id) on delete cascade,
 material_amount bigint not null default 0,
 equipment jsonb,
 destroyed boolean not null default false,
 created_at timestamptz not null default clock_timestamp(),
 unique(contest_id,recipient_user_id)
);
alter table private.resource_stronghold_loot_receipts enable row level security;
revoke all on private.resource_stronghold_loot_receipts from public,anon,authenticated;

create or replace function private.resource_stronghold_json(p_row private.resource_strongholds)
returns jsonb language sql stable set search_path=''
as $$
 select jsonb_build_object(
  'strongholdId',p_row.stronghold_id,'instanceId','shared-'||p_row.stronghold_id::text,
  'status',p_row.status,'ownerUserId',p_row.owner_user_id,'tower',p_row.tower,'floor',p_row.floor,
  'version',p_row.version,'captureStartedAt',p_row.captured_at,'captureEndsAt',p_row.capture_ends_at,
  'reward',p_row.reward,'activeContestId',p_row.active_contest_id)
$$;
revoke all on function private.resource_stronghold_json(private.resource_strongholds) from public,anon,authenticated;

create or replace function private.finish_resource_stronghold_contest(
 p_contest_id uuid,p_winner uuid,p_now timestamptz default clock_timestamp())
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_contest private.resource_stronghold_contests%rowtype;v_sh private.resource_strongholds%rowtype;
 v_owner private.online_expeditions%rowtype;v_challenger private.online_expeditions%rowtype;
 v_remaining_ms bigint;v_new_end timestamptz;v_material bigint:=0;v_equipment jsonb;v_destroyed boolean:=false;
 v_owner_loot jsonb;v_challenger_loot jsonb;
begin
 select * into v_contest from private.resource_stronghold_contests where contest_id=p_contest_id for update;
 if not found then raise exception 'RESOURCE_STRONGHOLD_CONTEST_MISSING';end if;
 if v_contest.status='RESOLVED' then
  select * into v_sh from private.resource_strongholds where stronghold_id=v_contest.stronghold_id;
  return jsonb_build_object('contest',to_jsonb(v_contest),'stronghold',private.resource_stronghold_json(v_sh));
 end if;
 select * into v_sh from private.resource_strongholds where stronghold_id=v_contest.stronghold_id for update;
 if p_winner not in(v_contest.owner_user_id,v_contest.challenger_user_id) then raise exception 'RESOURCE_STRONGHOLD_WINNER_INVALID';end if;

 if p_winner=v_contest.challenger_user_id then
  select * into v_owner from private.online_expeditions where user_id=v_contest.owner_user_id and run_id=v_contest.owner_run_id for update;
  select * into v_challenger from private.online_expeditions where user_id=v_contest.challenger_user_id and run_id=v_contest.challenger_run_id for update;
  v_owner_loot:=coalesce(v_owner.temporary_loot,'{}'::jsonb);
  v_challenger_loot:=coalesce(v_challenger.temporary_loot,'{}'::jsonb);
  v_material:=least(coalesce((v_owner_loot->>'material')::bigint,0),2+v_sh.floor);
  if jsonb_array_length(coalesce(v_owner_loot->'equipment','[]'::jsonb))>0 then
   v_equipment:=v_owner_loot->'equipment'->0;
   v_destroyed:=(abs(hashtextextended(v_contest.contest_id::text,0))%100)<15;
   v_owner_loot:=jsonb_set(v_owner_loot,'{equipment}',(v_owner_loot->'equipment')-0,true);
   if not v_destroyed then v_challenger_loot:=jsonb_set(v_challenger_loot,'{equipment}',coalesce(v_challenger_loot->'equipment','[]'::jsonb)||jsonb_build_array(v_equipment),true);end if;
  end if;
  v_owner_loot:=jsonb_set(v_owner_loot,'{material}',to_jsonb(greatest(0,coalesce((v_owner_loot->>'material')::bigint,0)-v_material)),true);
  v_challenger_loot:=jsonb_set(v_challenger_loot,'{material}',to_jsonb(coalesce((v_challenger_loot->>'material')::bigint,0)+v_material),true);
  update private.online_expeditions set temporary_loot=v_owner_loot,
   stronghold=coalesce(stronghold,'{}'::jsonb)||jsonb_build_object('status','DELETED','deletedAt',p_now,'version',coalesce((stronghold->>'version')::bigint,1)+1),
   run_version=run_version+1 where user_id=v_contest.owner_user_id and run_id=v_contest.owner_run_id;
  v_remaining_ms:=greatest(0,floor(extract(epoch from(v_contest.original_capture_ends_at-p_now))*1000)::bigint);
  v_new_end:=p_now+(v_remaining_ms*1.5)*interval '1 millisecond';
  update private.resource_strongholds set owner_user_id=v_contest.challenger_user_id,owner_run_id=v_contest.challenger_run_id,
   status='ACTIVE',active_contest_id=null,captured_at=p_now,capture_ends_at=v_new_end,version=version+1,updated_at=p_now
   where stronghold_id=v_sh.stronghold_id returning * into v_sh;
  update private.online_expeditions set temporary_loot=v_challenger_loot,stronghold=private.resource_stronghold_json(v_sh),
   run_version=run_version+1 where user_id=v_contest.challenger_user_id and run_id=v_contest.challenger_run_id;
  insert into private.resource_stronghold_loot_receipts(contest_id,recipient_user_id,material_amount,equipment,destroyed)
   values(v_contest.contest_id,v_contest.challenger_user_id,v_material,v_equipment,v_destroyed)
   on conflict(contest_id,recipient_user_id) do nothing;
 else
  update private.resource_strongholds set status='ACTIVE',active_contest_id=null,version=version+1,updated_at=p_now
   where stronghold_id=v_sh.stronghold_id returning * into v_sh;
 end if;
 update private.resource_stronghold_contests set status='RESOLVED',winner_user_id=p_winner,resolved_at=p_now
  where contest_id=v_contest.contest_id returning * into v_contest;
 update private.resource_stronghold_requests set status='RESOLVED',resolved_at=p_now,
  result=jsonb_build_object('winnerUserId',p_winner,'strongholdId',v_sh.stronghold_id)
  where request_id=v_contest.request_id;
 perform realtime.send(jsonb_build_object('strongholdId',v_sh.stronghold_id,'contestId',v_contest.contest_id),
  'resource_stronghold_changed','resource_stronghold',true);
 return jsonb_build_object('contest',to_jsonb(v_contest),'stronghold',private.resource_stronghold_json(v_sh),
  'loot',jsonb_build_object('material',v_material,'equipment',v_equipment,'destroyed',v_destroyed));
end $$;
revoke all on function private.finish_resource_stronghold_contest(uuid,uuid,timestamptz) from public,anon,authenticated;

create or replace function public.get_resource_stronghold_state(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_tower text,p_floor integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_sh private.resource_strongholds%rowtype;v_contest private.resource_stronghold_contests%rowtype;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into v_sh from private.resource_strongholds where tower=p_tower and floor=p_floor and status in('ACTIVE','CONTESTED') limit 1;
 if not found then return jsonb_build_object('role','NONE','stronghold',null,'contest',null,'serverNow',clock_timestamp());end if;
 if v_sh.active_contest_id is not null then select * into v_contest from private.resource_stronghold_contests where contest_id=v_sh.active_contest_id;end if;
 return jsonb_build_object('role',case when v_sh.owner_user_id=v_user then 'OWNER' when v_contest.challenger_user_id=v_user then 'CHALLENGER' else 'OBSERVER' end,
  'stronghold',private.resource_stronghold_json(v_sh),'contest',case when v_contest.contest_id is null then null else to_jsonb(v_contest) end,'serverNow',clock_timestamp());
end $$;
revoke all on function public.get_resource_stronghold_state(uuid,bigint,text,text,text,integer) from public,anon;
grant execute on function public.get_resource_stronghold_state(uuid,bigint,text,text,text,integer) to authenticated;

create or replace function public.request_resource_stronghold(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_tower text,p_floor integer,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_run private.online_expeditions%rowtype;v_sh private.resource_strongholds%rowtype;
 v_request private.resource_stronghold_requests%rowtype;v_first uuid;v_now timestamptz:=clock_timestamp();
 v_remaining_ms bigint;v_decision_end timestamptz;v_contest private.resource_stronghold_contests%rowtype;v_stats jsonb;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'RESOURCE_STRONGHOLD_REQUEST_REQUIRED';end if;
 select * into v_run from private.online_expeditions where user_id=v_user for update;
 if not found or v_run.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 if v_run.tower<>p_tower or v_run.floor<>p_floor or p_floor<3 or p_floor>10 then raise exception 'RESOURCE_STRONGHOLD_SLOT_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('resource-stronghold:'||p_tower||':'||p_floor,0));
 insert into private.resource_stronghold_requests(request_id,requester_user_id,requester_run_id,tower,floor,kind,status)
 values(p_request_id,v_user,v_run.run_id,p_tower,p_floor,'CLAIM','RECEIVED')
 on conflict(request_id) do nothing;
 select * into v_request from private.resource_stronghold_requests where request_id=p_request_id for update;
 if v_request.requester_user_id<>v_user then raise exception 'RESOURCE_STRONGHOLD_REQUEST_CONFLICT';end if;
 if v_request.status in('CLAIMED','SELECTED','QUEUED','RESOLVED','REJECTED') then return coalesce(v_request.result,to_jsonb(v_request));end if;

 update private.resource_strongholds set status='COMPLETED',updated_at=v_now
  where tower=p_tower and floor=p_floor and status='ACTIVE' and capture_ends_at<=v_now;
 select * into v_sh from private.resource_strongholds where tower=p_tower and floor=p_floor and status in('ACTIVE','CONTESTED') for update;
 if not found then
  insert into private.resource_strongholds(tower,floor,owner_user_id,owner_run_id,status,capture_ends_at,reward)
   values(p_tower,p_floor,v_user,v_run.run_id,'ACTIVE',v_now+interval '15 minutes',private.stronghold_reward(p_tower,p_floor))
   returning * into v_sh;
  update private.resource_stronghold_requests set stronghold_id=v_sh.stronghold_id,kind='CLAIM',status='CLAIMED',resolved_at=v_now,
   result=jsonb_build_object('role','OWNER','stronghold',private.resource_stronghold_json(v_sh),'contest',null) where request_id=p_request_id;
  update private.online_expeditions set stronghold=private.resource_stronghold_json(v_sh),pending_event=null,run_version=run_version+1 where user_id=v_user;
  perform realtime.send(jsonb_build_object('strongholdId',v_sh.stronghold_id),'resource_stronghold_changed','resource_stronghold',true);
  return jsonb_build_object('role','OWNER','stronghold',private.resource_stronghold_json(v_sh),'contest',null);
 end if;
 if v_sh.owner_user_id=v_user then
  update private.resource_stronghold_requests set stronghold_id=v_sh.stronghold_id,status='RESOLVED',resolved_at=v_now,
   result=jsonb_build_object('role','OWNER','stronghold',private.resource_stronghold_json(v_sh),'contest',null) where request_id=p_request_id;
  return jsonb_build_object('role','OWNER','stronghold',private.resource_stronghold_json(v_sh),'contest',null);
 end if;
 update private.resource_stronghold_requests set stronghold_id=v_sh.stronghold_id,kind='CONTEST' where request_id=p_request_id;
 select request_id into v_first from private.resource_stronghold_requests
  where stronghold_id=v_sh.stronghold_id and status='RECEIVED' and requester_user_id<>v_sh.owner_user_id
  order by requested_at asc,request_id asc limit 1 for update;
 if v_first<>p_request_id or v_sh.status='CONTESTED' then
  update private.resource_stronghold_requests set status='QUEUED',
   result=jsonb_build_object('role','QUEUED','stronghold',private.resource_stronghold_json(v_sh)) where request_id=p_request_id;
  return jsonb_build_object('role','QUEUED','stronghold',private.resource_stronghold_json(v_sh),'contest',null);
 end if;
 v_remaining_ms:=greatest(0,floor(extract(epoch from(v_sh.capture_ends_at-v_now))*1000)::bigint);
 v_decision_end:=case when v_remaining_ms<=60000 then v_now+(v_remaining_ms*1.5)*interval '1 millisecond' else v_now+interval '30 seconds' end;
 v_stats:=private.occupation_stats(v_sh.owner_user_id);
 insert into private.resource_stronghold_contests(stronghold_id,request_id,owner_user_id,challenger_user_id,owner_run_id,challenger_run_id,
  decision_ends_at,original_capture_ends_at,owner_hp,challenger_hp,owner_attack,challenger_attack,owner_defense,challenger_defense,current_actor)
 values(v_sh.stronghold_id,p_request_id,v_sh.owner_user_id,v_user,v_sh.owner_run_id,v_run.run_id,v_decision_end,v_sh.capture_ends_at,
  coalesce((v_stats->>'hp')::bigint,100),coalesce((private.occupation_stats(v_user)->>'hp')::bigint,100),
  coalesce((v_stats->>'attack')::bigint,12),coalesce((private.occupation_stats(v_user)->>'attack')::bigint,12),
  coalesce((v_stats->>'defense')::bigint,4),coalesce((private.occupation_stats(v_user)->>'defense')::bigint,4),v_sh.owner_user_id)
 returning * into v_contest;
 update private.resource_strongholds set status='CONTESTED',active_contest_id=v_contest.contest_id,version=version+1,updated_at=v_now
  where stronghold_id=v_sh.stronghold_id returning * into v_sh;
 update private.resource_stronghold_requests set status='SELECTED',
  result=jsonb_build_object('role','CHALLENGER','stronghold',private.resource_stronghold_json(v_sh),'contest',to_jsonb(v_contest)) where request_id=p_request_id;
 perform realtime.send(jsonb_build_object('strongholdId',v_sh.stronghold_id,'contestId',v_contest.contest_id),
  'resource_stronghold_changed','resource_stronghold',true);
 return jsonb_build_object('role','CHALLENGER','stronghold',private.resource_stronghold_json(v_sh),'contest',to_jsonb(v_contest));
end $$;
revoke all on function public.request_resource_stronghold(uuid,bigint,text,text,text,integer,uuid) from public,anon;
grant execute on function public.request_resource_stronghold(uuid,bigint,text,text,text,integer,uuid) to authenticated;

create or replace function public.respond_resource_stronghold_contest(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_contest_id uuid,p_response text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_contest private.resource_stronghold_contests%rowtype;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into v_contest from private.resource_stronghold_contests where contest_id=p_contest_id for update;
 if not found or v_contest.status<>'PENDING' then raise exception 'RESOURCE_STRONGHOLD_CONTEST_MISSING';end if;
 if v_contest.owner_user_id<>v_user then raise exception 'RESOURCE_STRONGHOLD_OWNER_REQUIRED';end if;
 if p_response not in('DEFEND','ABANDON') then raise exception 'RESOURCE_STRONGHOLD_RESPONSE_INVALID';end if;
 if p_response='ABANDON' then return private.finish_resource_stronghold_contest(p_contest_id,v_contest.challenger_user_id,clock_timestamp());end if;
 update private.resource_stronghold_contests set owner_response='DEFEND',status='FIGHTING',started_at=clock_timestamp()
  where contest_id=p_contest_id returning * into v_contest;
 perform realtime.send(jsonb_build_object('contestId',p_contest_id),'resource_stronghold_changed','resource_stronghold',true);
 return jsonb_build_object('contest',to_jsonb(v_contest));
end $$;
revoke all on function public.respond_resource_stronghold_contest(uuid,bigint,text,text,uuid,text) from public,anon;
grant execute on function public.respond_resource_stronghold_contest(uuid,bigint,text,text,uuid,text) to authenticated;

create or replace function public.apply_resource_stronghold_contest_action(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_contest_id uuid,p_action_nonce bigint,p_action text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_contest private.resource_stronghold_contests%rowtype;v_damage bigint;v_target uuid;v_winner uuid;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into v_contest from private.resource_stronghold_contests where contest_id=p_contest_id for update;
 if not found or v_contest.status not in('PENDING','FIGHTING') then raise exception 'RESOURCE_STRONGHOLD_CONTEST_MISSING';end if;
 if v_user not in(v_contest.owner_user_id,v_contest.challenger_user_id) then raise exception 'RESOURCE_STRONGHOLD_CONTEST_MEMBER_REQUIRED';end if;
 if v_contest.status='PENDING' and clock_timestamp()>=v_contest.decision_ends_at then
  v_contest.status:='FIGHTING';v_contest.owner_response:='DEFEND';v_contest.started_at:=clock_timestamp();
 end if;
 if v_contest.status<>'FIGHTING' then raise exception 'RESOURCE_STRONGHOLD_DECISION_PENDING';end if;
 if v_contest.current_actor<>v_user then raise exception 'RESOURCE_STRONGHOLD_NOT_YOUR_TURN';end if;
 if p_action_nonce<>v_contest.action_nonce+1 then raise exception 'RESOURCE_STRONGHOLD_ACTION_SEQUENCE';end if;
 if p_action not in('BASIC','GUARD') then raise exception 'RESOURCE_STRONGHOLD_ACTION_INVALID';end if;
 if v_user=v_contest.owner_user_id then
  v_target:=v_contest.challenger_user_id;
  if p_action='GUARD' then v_contest.owner_guard:=true;
  else v_damage:=greatest(1,v_contest.owner_attack-v_contest.challenger_defense);if v_contest.challenger_guard then v_damage:=greatest(1,floor(v_damage*.5));v_contest.challenger_guard:=false;end if;v_contest.challenger_hp:=greatest(0,v_contest.challenger_hp-v_damage);end if;
 else
  v_target:=v_contest.owner_user_id;
  if p_action='GUARD' then v_contest.challenger_guard:=true;
  else v_damage:=greatest(1,v_contest.challenger_attack-v_contest.owner_defense);if v_contest.owner_guard then v_damage:=greatest(1,floor(v_damage*.5));v_contest.owner_guard:=false;end if;v_contest.owner_hp:=greatest(0,v_contest.owner_hp-v_damage);end if;
 end if;
 v_contest.action_nonce:=p_action_nonce;v_contest.current_actor:=v_target;
 update private.resource_stronghold_contests set status=v_contest.status,owner_response=v_contest.owner_response,started_at=v_contest.started_at,
  owner_hp=v_contest.owner_hp,challenger_hp=v_contest.challenger_hp,owner_guard=v_contest.owner_guard,challenger_guard=v_contest.challenger_guard,
  current_actor=v_contest.current_actor,action_nonce=v_contest.action_nonce where contest_id=p_contest_id;
 if v_contest.owner_hp=0 then v_winner:=v_contest.challenger_user_id;elsif v_contest.challenger_hp=0 then v_winner:=v_contest.owner_user_id;end if;
 if v_winner is not null then return private.finish_resource_stronghold_contest(p_contest_id,v_winner,clock_timestamp());end if;
 perform realtime.send(jsonb_build_object('contestId',p_contest_id,'actionNonce',p_action_nonce),
  'resource_stronghold_changed','resource_stronghold',true);
 return jsonb_build_object('contest',to_jsonb(v_contest),'damage',coalesce(v_damage,0));
end $$;
revoke all on function public.apply_resource_stronghold_contest_action(uuid,bigint,text,text,uuid,bigint,text) from public,anon;
grant execute on function public.apply_resource_stronghold_contest_action(uuid,bigint,text,text,uuid,bigint,text) to authenticated;

create or replace function public.abandon_resource_stronghold(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_stronghold_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_sh private.resource_strongholds%rowtype;v_contest private.resource_stronghold_contests%rowtype;v_now timestamptz:=clock_timestamp();
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into v_sh from private.resource_strongholds where stronghold_id=p_stronghold_id for update;
 if not found or v_sh.status not in('ACTIVE','CONTESTED') then raise exception 'RESOURCE_STRONGHOLD_NOT_ACTIVE';end if;
 if v_sh.owner_user_id<>v_user then raise exception 'RESOURCE_STRONGHOLD_OWNER_REQUIRED';end if;
 if v_sh.active_contest_id is not null then
  select * into v_contest from private.resource_stronghold_contests where contest_id=v_sh.active_contest_id for update;
  return private.finish_resource_stronghold_contest(v_contest.contest_id,v_contest.challenger_user_id,v_now);
 end if;
 update private.resource_strongholds set status='ABANDONED',active_contest_id=null,version=version+1,updated_at=v_now
  where stronghold_id=p_stronghold_id returning * into v_sh;
 update private.online_expeditions set stronghold=coalesce(stronghold,'{}'::jsonb)||jsonb_build_object('status','DELETED','abandonedAt',v_now,'deletedAt',v_now),
  run_version=run_version+1 where user_id=v_user and run_id=v_sh.owner_run_id;
 perform realtime.send(jsonb_build_object('strongholdId',p_stronghold_id),'resource_stronghold_changed','resource_stronghold',true);
 return jsonb_build_object('role','NONE','stronghold',private.resource_stronghold_json(v_sh),'contest',null);
end $$;
revoke all on function public.abandon_resource_stronghold(uuid,bigint,text,text,uuid) from public,anon;
grant execute on function public.abandon_resource_stronghold(uuid,bigint,text,text,uuid) to authenticated;

-- Existing timer settlement now also consumes the shared ownership record.
create or replace function public.settle_online_resource_stronghold(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_run private.online_expeditions%rowtype;v_sh private.resource_strongholds%rowtype;
 v_reward jsonb;v_material bigint;v_silver bigint;v_loot jsonb;v_now timestamptz:=clock_timestamp();
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into v_run from private.online_expeditions where user_id=v_user for update;
 if not found or v_run.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 if v_run.run_version<>p_expected_version then raise exception 'EXPEDITION_VERSION_CONFLICT';end if;
 select * into v_sh from private.resource_strongholds where owner_user_id=v_user and owner_run_id=v_run.run_id and status='ACTIVE' for update;
 if not found then raise exception 'RESOURCE_STRONGHOLD_NOT_ACTIVE';end if;
 if v_now<v_sh.capture_ends_at then raise exception 'RESOURCE_STRONGHOLD_NOT_READY';end if;
 v_reward:=v_sh.reward;v_material:=coalesce((v_reward->>'materialAmount')::bigint,0);v_silver:=coalesce((v_reward->>'silver')::bigint,0);
 v_loot:=jsonb_set(jsonb_set(coalesce(v_run.temporary_loot,'{}'::jsonb),'{material}',to_jsonb(coalesce((v_run.temporary_loot->>'material')::bigint,0)+v_material),true),
  '{silver}',to_jsonb(coalesce((v_run.temporary_loot->>'silver')::bigint,0)+v_silver),true);
 update private.resource_strongholds set status='COMPLETED',active_contest_id=null,version=version+1,updated_at=v_now where stronghold_id=v_sh.stronghold_id returning * into v_sh;
 update private.online_expeditions set temporary_loot=v_loot,stronghold=coalesce(stronghold,'{}'::jsonb)||jsonb_build_object('status','DELETED','completedAt',v_now,'deletedAt',v_now),
  run_version=run_version+1 where user_id=v_user returning * into v_run;
 perform realtime.send(jsonb_build_object('strongholdId',v_sh.stronghold_id),'resource_stronghold_changed','resource_stronghold',true);
 return jsonb_build_object('reward',v_reward,'stronghold',v_run.stronghold,'temporaryLoot',v_run.temporary_loot,'runVersion',v_run.run_version);
end $$;
revoke all on function public.settle_online_resource_stronghold(uuid,bigint,text,text,bigint) from public,anon;
grant execute on function public.settle_online_resource_stronghold(uuid,bigint,text,text,bigint) to authenticated;
