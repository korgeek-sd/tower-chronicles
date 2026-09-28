-- v0.1.68: resource stronghold queue promotion, disconnect recovery and combat turn deadlines.
alter table private.resource_stronghold_contests
 add column if not exists turn_ends_at timestamptz;

create or replace function private.resource_stronghold_turn_deadline()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.status='FIGHTING' and (
  tg_op='INSERT'
  or old.status is distinct from 'FIGHTING'
  or new.action_nonce is distinct from old.action_nonce
 ) then
  new.turn_ends_at:=clock_timestamp()+interval '30 seconds';
 elsif new.status in('RESOLVED','CANCELLED') then
  new.turn_ends_at:=null;
 end if;
 return new;
end $$;
revoke all on function private.resource_stronghold_turn_deadline() from public,anon,authenticated;

drop trigger if exists resource_stronghold_turn_deadline on private.resource_stronghold_contests;
create trigger resource_stronghold_turn_deadline
before insert or update of status,action_nonce on private.resource_stronghold_contests
for each row execute function private.resource_stronghold_turn_deadline();

update private.resource_stronghold_contests
 set turn_ends_at=clock_timestamp()+interval '30 seconds'
 where status='FIGHTING' and turn_ends_at is null;

create or replace function private.advance_resource_stronghold_slot(
 p_tower text,p_floor integer,p_now timestamptz default clock_timestamp())
returns void language plpgsql security definer set search_path=''
as $$
declare
 v_sh private.resource_strongholds%rowtype;
 v_contest private.resource_stronghold_contests%rowtype;
 v_request private.resource_stronghold_requests%rowtype;
 v_run private.online_expeditions%rowtype;
 v_stats jsonb;
 v_remaining_ms bigint;
 v_decision_end timestamptz;
 v_owner_online boolean;
 v_winner uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('resource-stronghold:'||p_tower||':'||p_floor,0));
 select * into v_sh from private.resource_strongholds
  where tower=p_tower and floor=p_floor and status in('ACTIVE','CONTESTED')
  order by updated_at desc limit 1 for update;
 if not found then return;end if;

 if v_sh.status='CONTESTED' and v_sh.active_contest_id is not null then
  select * into v_contest from private.resource_stronghold_contests
   where contest_id=v_sh.active_contest_id for update;
  if found and v_contest.status='PENDING' and v_contest.decision_ends_at<=p_now then
   select exists(
    select 1 from private.active_game_sessions
     where user_id=v_contest.owner_user_id and expires_at>p_now
   ) into v_owner_online;
   if not v_owner_online then
    perform private.finish_resource_stronghold_contest(v_contest.contest_id,v_contest.challenger_user_id,p_now);
   else
    update private.resource_stronghold_contests
     set status='FIGHTING',owner_response='AUTO_DEFEND',started_at=p_now,current_actor=challenger_user_id
     where contest_id=v_contest.contest_id;
    perform realtime.send(jsonb_build_object('contestId',v_contest.contest_id,'reason','OWNER_AUTO_DEFEND'),
     'resource_stronghold_changed','resource_stronghold',true);
   end if;
  elsif found and v_contest.status='FIGHTING' and v_contest.turn_ends_at<=p_now then
   v_winner:=case when v_contest.current_actor=v_contest.owner_user_id
    then v_contest.challenger_user_id else v_contest.owner_user_id end;
   perform private.finish_resource_stronghold_contest(v_contest.contest_id,v_winner,p_now);
  end if;
 end if;

 select * into v_sh from private.resource_strongholds
  where stronghold_id=v_sh.stronghold_id for update;
 if v_sh.status<>'ACTIVE' or v_sh.active_contest_id is not null or v_sh.capture_ends_at<=p_now then return;end if;

 for v_request in
  select * from private.resource_stronghold_requests
   where stronghold_id=v_sh.stronghold_id and status='QUEUED'
   order by requested_at asc,request_id asc for update
 loop
  if v_request.requester_user_id=v_sh.owner_user_id then
   update private.resource_stronghold_requests set status='RESOLVED',resolved_at=p_now,
    result=jsonb_build_object('role','OWNER','reason','OWNER_AFTER_TAKEOVER')
    where request_id=v_request.request_id;
   continue;
  end if;
  select * into v_run from private.online_expeditions
   where user_id=v_request.requester_user_id and run_id=v_request.requester_run_id for update;
  if not found or v_run.status<>'ACTIVE' or v_run.tower<>v_sh.tower or v_run.floor<>v_sh.floor then
   update private.resource_stronghold_requests set status='REJECTED',resolved_at=p_now,
    result=jsonb_build_object('role','NONE','reason','EXPEDITION_INACTIVE')
    where request_id=v_request.request_id;
   continue;
  end if;

  v_remaining_ms:=greatest(0,floor(extract(epoch from(v_sh.capture_ends_at-p_now))*1000)::bigint);
  v_decision_end:=case when v_remaining_ms<=60000
   then p_now+(v_remaining_ms*1.5)*interval '1 millisecond'
   else p_now+interval '30 seconds' end;
  v_stats:=private.occupation_stats(v_sh.owner_user_id);
  insert into private.resource_stronghold_contests(
   stronghold_id,request_id,owner_user_id,challenger_user_id,owner_run_id,challenger_run_id,
   decision_ends_at,original_capture_ends_at,owner_hp,challenger_hp,owner_attack,challenger_attack,
   owner_defense,challenger_defense,current_actor)
  values(
   v_sh.stronghold_id,v_request.request_id,v_sh.owner_user_id,v_request.requester_user_id,
   v_sh.owner_run_id,v_run.run_id,v_decision_end,v_sh.capture_ends_at,
   coalesce((v_stats->>'hp')::bigint,100),coalesce((private.occupation_stats(v_request.requester_user_id)->>'hp')::bigint,100),
   coalesce((v_stats->>'attack')::bigint,12),coalesce((private.occupation_stats(v_request.requester_user_id)->>'attack')::bigint,12),
   coalesce((v_stats->>'defense')::bigint,4),coalesce((private.occupation_stats(v_request.requester_user_id)->>'defense')::bigint,4),
   v_sh.owner_user_id)
  returning * into v_contest;
  update private.resource_strongholds set status='CONTESTED',active_contest_id=v_contest.contest_id,
   version=version+1,updated_at=p_now where stronghold_id=v_sh.stronghold_id returning * into v_sh;
  update private.resource_stronghold_requests set status='SELECTED',
   result=jsonb_build_object('role','CHALLENGER','stronghold',private.resource_stronghold_json(v_sh),'contest',to_jsonb(v_contest))
   where request_id=v_request.request_id;
  update private.online_expeditions set stronghold=private.resource_stronghold_json(v_sh),run_version=run_version+1
   where (user_id=v_sh.owner_user_id and run_id=v_sh.owner_run_id)
      or (user_id=v_request.requester_user_id and run_id=v_request.requester_run_id);
  perform realtime.send(jsonb_build_object('strongholdId',v_sh.stronghold_id,'contestId',v_contest.contest_id,'reason','QUEUE_PROMOTED'),
   'resource_stronghold_changed','resource_stronghold',true);
  return;
 end loop;
end $$;
revoke all on function private.advance_resource_stronghold_slot(text,integer,timestamptz) from public,anon,authenticated;

create or replace function public.advance_resource_stronghold_state(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_tower text,p_floor integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_user uuid;
 v_run private.online_expeditions%rowtype;
 v_sh private.resource_strongholds%rowtype;
 v_contest private.resource_stronghold_contests%rowtype;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into v_run from private.online_expeditions where user_id=v_user and status='ACTIVE';
 if not found or v_run.tower<>p_tower or v_run.floor<>p_floor then raise exception 'RESOURCE_STRONGHOLD_SLOT_INVALID';end if;
 perform private.advance_resource_stronghold_slot(p_tower,p_floor,clock_timestamp());
 select * into v_sh from private.resource_strongholds
  where tower=p_tower and floor=p_floor and status in('ACTIVE','CONTESTED')
  order by updated_at desc limit 1;
 if not found then
  return jsonb_build_object('role','NONE','stronghold',null,'contest',null,'serverNow',clock_timestamp());
 end if;
 if v_sh.active_contest_id is not null then
  select * into v_contest from private.resource_stronghold_contests where contest_id=v_sh.active_contest_id;
 end if;
 return jsonb_build_object(
  'role',case
   when v_sh.owner_user_id=v_user then 'OWNER'
   when v_contest.challenger_user_id=v_user then 'CHALLENGER'
   when exists(select 1 from private.resource_stronghold_requests
    where stronghold_id=v_sh.stronghold_id and requester_user_id=v_user and status='QUEUED') then 'QUEUED'
   else 'OBSERVER' end,
  'stronghold',private.resource_stronghold_json(v_sh),
  'contest',case when v_contest.contest_id is null then null else to_jsonb(v_contest) end,
  'serverNow',clock_timestamp());
end $$;
revoke all on function public.advance_resource_stronghold_state(uuid,bigint,text,text,text,integer) from public,anon;
grant execute on function public.advance_resource_stronghold_state(uuid,bigint,text,text,text,integer) to authenticated;
