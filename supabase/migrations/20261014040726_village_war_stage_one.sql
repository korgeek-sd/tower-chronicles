-- Stage-one infrastructure stays disabled until automatic PvP and settlement are connected.
create table private.village_war_settings(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into private.village_war_settings values(true,false);
create table private.village_war_owners(town_id text primary key references private.village_life_towns(id),association_id uuid references private.online_associations(association_id) on delete set null,occupied_at timestamptz);
create table private.village_war_events(
 event_id uuid primary key default gen_random_uuid(),cycle_key date not null,town_id text not null references private.village_life_towns(id),
 owner_association_id uuid references private.online_associations(association_id) on delete set null,
 deployment_starts_at timestamptz not null,battle_starts_at timestamptz not null,battle_ends_at timestamptz not null,
 frozen boolean not null default false,unique(cycle_key,town_id));
create table private.village_war_fronts(
 event_id uuid not null references private.village_war_events(event_id) on delete cascade,front_id int not null check(front_id between 1 and 5),
 association_id uuid references private.online_associations(association_id) on delete set null,defender_user_id uuid references auth.users(id) on delete set null,
 snapshot jsonb,hp numeric,max_hp numeric,mp numeric,max_mp numeric,
 defender_epoch bigint not null default 0,revision bigint not null default 0,occupied_at timestamptz,
 primary key(event_id,front_id));
create unique index village_war_event_defender_unique on private.village_war_fronts(event_id,defender_user_id) where defender_user_id is not null;
create index village_war_defender_lookup on private.village_war_fronts(defender_user_id) where defender_user_id is not null;
create table private.village_war_actor_state(user_id uuid primary key references auth.users(id) on delete cascade,event_id uuid,front_id int,next_attack_at timestamptz);
create table private.village_war_receipts(user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,request jsonb not null,result jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(user_id,request_id));
alter table private.village_war_settings enable row level security;
alter table private.village_war_owners enable row level security;
alter table private.village_war_events enable row level security;
alter table private.village_war_fronts enable row level security;
alter table private.village_war_actor_state enable row level security;
alter table private.village_war_receipts enable row level security;
revoke all on private.village_war_settings,private.village_war_owners,private.village_war_events,private.village_war_fronts,private.village_war_actor_state,private.village_war_receipts from public,anon,authenticated;

create function private.village_war_clock() returns timestamptz language sql volatile set search_path='' as $$select clock_timestamp()$$;
revoke all on function private.village_war_clock() from public,anon,authenticated;

create function private.village_war_snapshot(u uuid) returns jsonb language plpgsql set search_path='' as $$
declare p jsonb;st jsonb;h private.hunting_states%rowtype;gear jsonb;skills jsonb;
begin
 select payload into p from public.game_saves where user_id=u for share;
 if p is null then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 p:=private.server_authoritative_payload(u,p);
 select * into h from private.hunting_states where user_id=u;
 st:=private.combat_equipment_stats(u,jsonb_set(p,'{expedition}',jsonb_build_object('equipment',p->'equipped'),true));
 select coalesce(jsonb_agg(a.gear order by a.item_id),'[]') into gear from private.market_assets a
 where a.user_id=u and a.quantity=1 and a.item_id in(select 'equipment_v2:'||value from jsonb_each_text(coalesce(p->'equipped','{}')));
 select coalesce(jsonb_agg(jsonb_build_object('id',s.skill_id,'enhancement',s.enhancement_level) order by array_position(h.skills,s.skill_id)),'[]') into skills from private.learned_catalog_skills s where s.user_id=u and s.skill_id=any(coalesce(h.skills,'{}'));
 return jsonb_build_object('name',coalesce((select nickname from public.game_player_profiles where user_id=u),'탐사자'),'stats',st,'equipment',gear,'loadout',to_jsonb(coalesce(h.skills,'{}')),'skills',skills,'appearanceId',p->'cosmetics'->>'selectedAppearanceId','maxHp',greatest(1,(st->>'hp')::numeric),'maxMp',100+10*coalesce((h.stat_allocation->>'mp')::int,0));
end $$;
revoke all on function private.village_war_snapshot(uuid) from public,anon,authenticated;

-- Canonical writes and initial deployment serialize on the same actor key.
-- Use a try-lock because existing RPCs may already hold save or hunting row locks.
create function private.village_war_guard_snapshot() returns trigger language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 if exists(select 1 from private.village_war_settings where enabled) and exists(select 1 from private.village_war_events where deployment_starts_at<=private.village_war_clock() and battle_starts_at>private.village_war_clock() and not frozen) then
  u:=case when TG_OP='DELETE' then old.user_id else new.user_id end;
  if not pg_try_advisory_xact_lock(hashtextextended('village-actor:'||u::text,0)) then raise exception 'WAR_ACTOR_BUSY';end if;
 end if;
 if TG_OP='DELETE' then return old;else return new;end if;
end $$;
revoke all on function private.village_war_guard_snapshot() from public,anon,authenticated;

create function private.village_war_refresh_snapshot() returns trigger language plpgsql security definer set search_path='' as $$
declare u uuid;s jsonb;f record;
begin
 if not exists(select 1 from private.village_war_settings where enabled) then return null;end if;
 u:=case when TG_OP='DELETE' then old.user_id else new.user_id end;
 if not exists(select 1 from private.village_war_fronts q join private.village_war_events e using(event_id) where q.defender_user_id=u and private.village_war_clock()<e.battle_starts_at and not e.frozen) then return null;end if;
 s:=private.village_war_snapshot(u);
 -- Snapshot may block on a save row. Recheck time only after it completes.
 for f in select q.event_id,q.front_id,e.battle_starts_at from private.village_war_fronts q join private.village_war_events e using(event_id)
 where q.defender_user_id=u and private.village_war_clock()<e.battle_starts_at and not e.frozen
 order by q.event_id,q.front_id for update of q nowait loop
  if private.village_war_clock()>=f.battle_starts_at then continue;end if;
  update private.village_war_fronts set snapshot=s,hp=(s->>'maxHp')::numeric,max_hp=(s->>'maxHp')::numeric,mp=(s->>'maxMp')::numeric,max_mp=(s->>'maxMp')::numeric,revision=revision+1 where event_id=f.event_id and front_id=f.front_id;
 end loop;
 return null;
exception when lock_not_available then raise exception 'WAR_FRONT_BUSY';
end $$;
revoke all on function private.village_war_refresh_snapshot() from public,anon,authenticated;
create trigger village_war_save_guard before update on public.game_saves for each row execute function private.village_war_guard_snapshot();
create trigger village_war_save_snapshot after update on public.game_saves for each row execute function private.village_war_refresh_snapshot();
create trigger village_war_hunting_guard before insert or update or delete on private.hunting_states for each row execute function private.village_war_guard_snapshot();
create trigger village_war_hunting_snapshot after insert or update or delete on private.hunting_states for each row execute function private.village_war_refresh_snapshot();
create trigger village_war_gear_guard before insert or update or delete on private.market_assets for each row execute function private.village_war_guard_snapshot();
create trigger village_war_gear_snapshot after insert or update or delete on private.market_assets for each row execute function private.village_war_refresh_snapshot();
create trigger village_war_skill_guard before insert or update or delete on private.learned_catalog_skills for each row execute function private.village_war_guard_snapshot();
create trigger village_war_skill_snapshot after insert or update or delete on private.learned_catalog_skills for each row execute function private.village_war_refresh_snapshot();
create trigger village_war_seal_guard before insert or update or delete on private.player_association_seals for each row execute function private.village_war_guard_snapshot();
create trigger village_war_seal_snapshot after insert or update or delete on private.player_association_seals for each row execute function private.village_war_refresh_snapshot();

create function private.village_war_event(town text) returns uuid language plpgsql set search_path='' as $$
declare cycle date;start_at timestamptz;e private.village_war_events%rowtype;aid uuid;
begin
 if not exists(select 1 from private.village_war_settings where enabled) then raise exception 'WAR_FEATURE_DISABLED';end if;
 if not exists(select 1 from private.village_life_towns where id=town) then raise exception 'WAR_TOWN_INVALID';end if;
 cycle:=date_trunc('week',private.village_war_clock() at time zone 'Asia/Seoul')::date;
 start_at:=(cycle::timestamp+interval '5 days 22 hours') at time zone 'Asia/Seoul';
 select * into e from private.village_war_events where cycle_key=cycle and town_id=town;
 if not found then
  if not pg_try_advisory_xact_lock(hashtextextended('village-event:'||cycle::text||':'||town,0)) then raise exception 'WAR_EVENT_BUSY';end if;
  select * into e from private.village_war_events where cycle_key=cycle and town_id=town;
  if not found then
   select association_id into aid from private.village_war_owners where town_id=town;
   insert into private.village_war_events(cycle_key,town_id,owner_association_id,deployment_starts_at,battle_starts_at,battle_ends_at)
   values(cycle,town,aid,start_at-interval '5 minutes',start_at,start_at+interval '1 hour') returning * into e;
   insert into private.village_war_fronts(event_id,front_id) select e.event_id,generate_series(1,5);
  end if;
 end if;
 if not e.frozen and private.village_war_clock()>=e.battle_starts_at then
  if not pg_try_advisory_xact_lock(hashtextextended('village-freeze:'||e.event_id::text,0)) then raise exception 'WAR_EVENT_BUSY';end if;
  perform 1 from private.village_war_events where event_id=e.event_id for update nowait;
  perform 1 from private.village_war_fronts where event_id=e.event_id order by front_id for update nowait;
  update private.village_war_events set frozen=true where event_id=e.event_id;
  update private.village_war_fronts set occupied_at=e.battle_starts_at where event_id=e.event_id and defender_user_id is not null and occupied_at is null;
 end if;
 return e.event_id;
exception when lock_not_available then raise exception 'WAR_EVENT_BUSY';
end $$;
revoke all on function private.village_war_event(text) from public,anon,authenticated;

create function public.get_village_war_state(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_town_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;eid uuid;e private.village_war_events%rowtype;aid uuid;myrole text;actor private.village_war_actor_state%rowtype;phase text;tickets bigint;fronts jsonb;stamp timestamptz;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if not exists(select 1 from private.village_war_settings where enabled) then return jsonb_build_object('enabled',false,'fronts','[]'::jsonb,'phase','WAITING','serverNow',extract(epoch from private.village_war_clock())*1000);end if;
 eid:=private.village_war_event(p_town_id);select * into e from private.village_war_events where event_id=eid;
 stamp:=private.village_war_clock();phase:=case when stamp<e.deployment_starts_at then 'WAITING' when stamp<e.battle_starts_at then 'DEPLOYMENT' when stamp<e.battle_ends_at then 'BATTLE' else 'ENDED' end;
 select m.association_id,m.role into aid,myrole from private.online_association_members m join private.online_associations a on a.association_id=m.association_id and a.status='ACTIVE' where m.user_id=u;
 select * into actor from private.village_war_actor_state where user_id=u;
 if actor.event_id is not null and not exists(select 1 from private.village_war_events where event_id=actor.event_id and battle_ends_at>stamp) then actor.event_id:=null;actor.front_id:=null;end if;
 select coalesce((products->>'challenge_ticket')::bigint,0) into tickets from private.village_life_players where user_id=u;
 select jsonb_agg(jsonb_build_object('frontId',f.front_id,'defenderUserId',f.defender_user_id,'defenderName',f.snapshot->>'name','associationId',f.association_id,'associationName',a.name,'defenderEpoch',f.defender_epoch,'revision',f.revision,'hp',f.hp,'maxHp',f.max_hp,'mp',f.mp,'maxMp',f.max_mp,'occupiedAt',f.occupied_at) order by f.front_id) into fronts from private.village_war_fronts f left join private.online_associations a on a.association_id=f.association_id where f.event_id=eid;
 return jsonb_build_object('enabled',true,'serverNow',extract(epoch from stamp)*1000,'eventId',eid,'cycleKey',e.cycle_key,'phase',phase,'deploymentStartsAt',e.deployment_starts_at,'battleStartsAt',e.battle_starts_at,'battleEndsAt',e.battle_ends_at,'ownerAssociationId',e.owner_association_id,'myAssociationId',aid,'myRole',myrole,'tickets',coalesce(tickets,0),'nextAttackAt',actor.next_attack_at,'myDefendingFront',case when actor.event_id is null then null else jsonb_build_object('eventId',actor.event_id,'frontId',actor.front_id) end,'canAttack',aid is not null and (aid=e.owner_association_id or exists(select 1 from private.village_war_declarations where cycle_key=e.cycle_key and town_id=e.town_id and association_id=aid)),'fronts',fronts);
end $$;
revoke all on function public.get_village_war_state(uuid,bigint,text,text,text) from public,anon;
grant execute on function public.get_village_war_state(uuid,bigint,text,text,text) to authenticated;

create function private.village_war_mutate(u uuid,request_id uuid,town text,front int,epoch bigint,action text,expected_event uuid) returns jsonb language plpgsql set search_path='' as $$
declare eid uuid;e private.village_war_events%rowtype;aid uuid;myrole text;f private.village_war_fronts%rowtype;actor private.village_war_actor_state%rowtype;r private.village_war_receipts%rowtype;payload jsonb;s jsonb;result jsonb;target uuid;stamp timestamptz;
begin
 if expected_event is null or request_id is null or town is null or front is null or front not between 1 and 5 or epoch is null or epoch<0 or action not in('PLACE','REMOVE','CLAIM_EMPTY') then raise exception 'WAR_REQUEST_INVALID';end if;
 payload:=jsonb_build_object('eventId',expected_event,'townId',town,'frontId',front,'expectedEpoch',epoch,'action',action);
 if not pg_try_advisory_xact_lock(hashtextextended('village-request:'||u::text||':'||request_id::text,0)) then raise exception 'WAR_REQUEST_BUSY';end if;
 select * into r from private.village_war_receipts receipt where receipt.user_id=u and receipt.request_id=village_war_mutate.request_id;
 if found then if r.request<>payload then raise exception 'WAR_REQUEST_CONFLICT';end if;return jsonb_build_object('result',r.result,'replayed',true);end if;
 eid:=private.village_war_event(town);if eid<>expected_event then raise exception 'WAR_EVENT_CHANGED';end if;select * into e from private.village_war_events where event_id=eid for share nowait;
 stamp:=private.village_war_clock();
 if action in('PLACE','REMOVE') and (stamp<e.deployment_starts_at or stamp>=e.battle_starts_at) or action='CLAIM_EMPTY' and (stamp<e.battle_starts_at or stamp>=e.battle_ends_at) then raise exception 'WAR_PHASE_INVALID';end if;
 select m.association_id,m.role into aid,myrole from private.online_association_members m join private.online_associations a on a.association_id=m.association_id and a.status='ACTIVE' where m.user_id=u for share of m;
 if aid is null then raise exception 'WAR_GUILD_REQUIRED';end if;
 if action in('PLACE','REMOVE') and aid is distinct from e.owner_association_id then raise exception 'WAR_OWNER_REQUIRED';end if;
 if action='REMOVE' and myrole<>'LEADER' then raise exception 'WAR_LEADER_REQUIRED';end if;
 if action='CLAIM_EMPTY' and aid is distinct from e.owner_association_id and not exists(select 1 from private.village_war_declarations where cycle_key=e.cycle_key and town_id=town and association_id=aid) then raise exception 'WAR_NOT_DECLARED';end if;
 if not pg_try_advisory_xact_lock(hashtextextended('village-actor:'||u::text,0)) then raise exception 'WAR_ACTOR_BUSY';end if;
 insert into private.village_war_actor_state(user_id) values(u) on conflict(user_id) do nothing;
 select * into actor from private.village_war_actor_state where user_id=u for update nowait;
 if actor.event_id is not null and not exists(select 1 from private.village_war_events where event_id=actor.event_id and battle_ends_at>stamp) then
  update private.village_war_actor_state set event_id=null,front_id=null where user_id=u;actor.event_id:=null;actor.front_id:=null;
 end if;
 if action<>'REMOVE' and actor.event_id is not null then raise exception 'WAR_ALREADY_DEFENDING';end if;
 if action='CLAIM_EMPTY' and actor.next_attack_at>stamp then raise exception 'WAR_ATTACK_COOLDOWN';end if;
 -- Snapshot shares the save before the front lock, matching canonical update triggers.
 if action<>'REMOVE' then s:=private.village_war_snapshot(u);end if;
 begin select * into f from private.village_war_fronts where event_id=eid and front_id=front for update nowait;
 exception when lock_not_available then raise exception 'WAR_FRONT_BUSY';end;
 if f.defender_epoch<>epoch then raise exception 'WAR_DEFENDER_CHANGED';end if;
 stamp:=private.village_war_clock();
 if action in('PLACE','REMOVE') and stamp>=e.battle_starts_at or action='CLAIM_EMPTY' and stamp>=e.battle_ends_at then raise exception 'WAR_PHASE_INVALID';end if;
 if action='REMOVE' then
  target:=f.defender_user_id;
  if target is null then raise exception 'WAR_FRONT_EMPTY';end if;
  if target<>u and not pg_try_advisory_xact_lock(hashtextextended('village-actor:'||target::text,0)) then raise exception 'WAR_ACTOR_BUSY';end if;
  perform 1 from private.village_war_actor_state where user_id=target for update nowait;
  update private.village_war_fronts set defender_user_id=null,association_id=null,snapshot=null,hp=null,max_hp=null,mp=null,max_mp=null,defender_epoch=defender_epoch+1,revision=revision+1 where event_id=eid and front_id=front;
  update private.village_war_actor_state set event_id=null,front_id=null where user_id=target and event_id=eid and front_id=front;
 else
  if f.defender_user_id is not null then raise exception 'WAR_FRONT_NOT_EMPTY';end if;
  if action='CLAIM_EMPTY' then
   perform 1 from private.village_life_players where user_id=u for update nowait;
   update private.village_life_players set products=jsonb_set(products,'{challenge_ticket}',to_jsonb((products->>'challenge_ticket')::bigint-1),true) where user_id=u and coalesce((products->>'challenge_ticket')::bigint,0)>=1;
   if not found then raise exception 'WAR_TICKETS_SHORT';end if;
  end if;
  stamp:=private.village_war_clock();
  if action='PLACE' and stamp>=e.battle_starts_at or action='CLAIM_EMPTY' and stamp>=e.battle_ends_at then raise exception 'WAR_PHASE_INVALID';end if;
  update private.village_war_fronts set defender_user_id=u,association_id=aid,snapshot=s,hp=(s->>'maxHp')::numeric,max_hp=(s->>'maxHp')::numeric,mp=(s->>'maxMp')::numeric,max_mp=(s->>'maxMp')::numeric,occupied_at=case when action='CLAIM_EMPTY' then stamp else null end,defender_epoch=defender_epoch+1,revision=revision+1 where event_id=eid and front_id=front;
  update private.village_war_actor_state set event_id=eid,front_id=front,next_attack_at=case when action='CLAIM_EMPTY' then stamp+interval '30 seconds' else next_attack_at end where user_id=u;
 end if;
 result:=jsonb_build_object('action',action,'frontId',front,'defenderEpoch',epoch+1,'ticketsSpent',case when action='CLAIM_EMPTY' then 1 else 0 end,'cooldownUntil',case when action='CLAIM_EMPTY' then stamp+interval '30 seconds' else null end);
 insert into private.village_war_receipts values(u,request_id,payload,result,private.village_war_clock());
 return jsonb_build_object('result',result,'replayed',false);
exception when lock_not_available then raise exception 'WAR_ACTOR_BUSY';
end $$;
revoke all on function private.village_war_mutate(uuid,uuid,text,int,bigint,text,uuid) from public,anon,authenticated;

create function public.place_village_war_defender(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid,p_town_id text,p_front_id int,p_expected_epoch bigint,p_expected_event_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;r jsonb;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 r:=private.village_war_mutate(u,p_request_id,p_town_id,p_front_id,p_expected_epoch,'PLACE',p_expected_event_id);
 return r||jsonb_build_object('state',public.get_village_war_state(p_lease_id,p_generation,p_client_instance_id,p_device_id,p_town_id));
end $$;
revoke all on function public.place_village_war_defender(uuid,bigint,text,text,uuid,text,int,bigint,uuid) from public,anon;
grant execute on function public.place_village_war_defender(uuid,bigint,text,text,uuid,text,int,bigint,uuid) to authenticated;

create function public.remove_village_war_defender(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid,p_town_id text,p_front_id int,p_expected_epoch bigint,p_expected_event_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;r jsonb;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 r:=private.village_war_mutate(u,p_request_id,p_town_id,p_front_id,p_expected_epoch,'REMOVE',p_expected_event_id);
 return r||jsonb_build_object('state',public.get_village_war_state(p_lease_id,p_generation,p_client_instance_id,p_device_id,p_town_id));
end $$;
revoke all on function public.remove_village_war_defender(uuid,bigint,text,text,uuid,text,int,bigint,uuid) from public,anon;
grant execute on function public.remove_village_war_defender(uuid,bigint,text,text,uuid,text,int,bigint,uuid) to authenticated;

create function public.claim_empty_village_war_front(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid,p_town_id text,p_front_id int,p_expected_epoch bigint,p_expected_event_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;r jsonb;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 r:=private.village_war_mutate(u,p_request_id,p_town_id,p_front_id,p_expected_epoch,'CLAIM_EMPTY',p_expected_event_id);
 return r||jsonb_build_object('state',public.get_village_war_state(p_lease_id,p_generation,p_client_instance_id,p_device_id,p_town_id));
end $$;
revoke all on function public.claim_empty_village_war_front(uuid,bigint,text,text,uuid,text,int,bigint,uuid) from public,anon;
grant execute on function public.claim_empty_village_war_front(uuid,bigint,text,text,uuid,text,int,bigint,uuid) to authenticated;
