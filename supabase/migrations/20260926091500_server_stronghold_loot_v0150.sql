-- v0.1.50 server-authoritative resource strongholds and per-kill temporary loot.
alter table private.online_expeditions
 add column if not exists stronghold jsonb,
 add column if not exists stronghold_sequence bigint not null default 0;

create or replace function private.stronghold_reward(p_tower text,p_floor int)
returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('tower',p_tower,'tier',case when p_floor<=3 then 1 when p_floor<=6 then 2 else 3 end,'materialAmount',6+p_floor*2,'silver',0)
$$;
revoke all on function private.stronghold_reward(text,int) from public,anon,authenticated;

create or replace function private.server_kill_loot(p_run private.online_expeditions,p_kill bigint)
returns jsonb language plpgsql immutable set search_path=''
as $$
declare s bigint:=10+p_run.floor*3;m bigint:=2;t bigint:=0;
begin
 if p_run.floor<10 and private.expedition_ticket_drop(p_run.reward_seed,p_kill) then t:=1;end if;
 return jsonb_build_object('silver',s,'material',m,'tickets',t);
end $$;
revoke all on function private.server_kill_loot(private.online_expeditions,bigint) from public,anon,authenticated;

create or replace function public.claim_online_resource_stronghold(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;r private.online_expeditions%rowtype;e jsonb;started timestamptz:=clock_timestamp();seq bigint;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u for update;
 if not found or r.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 if r.run_version<>p_expected_version then raise exception 'EXPEDITION_VERSION_CONFLICT';end if;
 if r.pending_event is null or r.pending_event->>'id'<>'resource_stronghold' then raise exception 'RESOURCE_STRONGHOLD_EVENT_MISSING';end if;
 if r.floor<3 or r.floor>10 then raise exception 'RESOURCE_STRONGHOLD_FLOOR_INVALID';end if;
 if r.stronghold is not null and r.stronghold->>'status' in('ACTIVE','CONTESTED') then raise exception 'RESOURCE_STRONGHOLD_ALREADY_ACTIVE';end if;
 seq:=r.stronghold_sequence+1;
 e:=jsonb_build_object('instanceId','stronghold-'||r.run_id::text||'-'||seq,'status','ACTIVE','tower',r.tower,'floor',r.floor,'version',1,'captureStartedAt',started,'captureEndsAt',started+interval '15 minutes','reward',private.stronghold_reward(r.tower,r.floor));
 update private.online_expeditions set stronghold=e,stronghold_sequence=seq,pending_event=null,run_version=run_version+1 where user_id=u returning * into r;
 return jsonb_build_object('stronghold',r.stronghold,'runVersion',r.run_version);
end $$;
revoke all on function public.claim_online_resource_stronghold(uuid,bigint,text,text,bigint) from public,anon;
grant execute on function public.claim_online_resource_stronghold(uuid,bigint,text,text,bigint) to authenticated;

create or replace function public.settle_online_resource_stronghold(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;r private.online_expeditions%rowtype;sh jsonb;reward jsonb;mat bigint;sil bigint;tl jsonb;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u for update;
 if not found or r.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 if r.run_version<>p_expected_version then raise exception 'EXPEDITION_VERSION_CONFLICT';end if;
 sh:=r.stronghold;if sh is null or sh->>'status'<>'ACTIVE' then raise exception 'RESOURCE_STRONGHOLD_NOT_ACTIVE';end if;
 if clock_timestamp()<(sh->>'captureEndsAt')::timestamptz then raise exception 'RESOURCE_STRONGHOLD_NOT_READY';end if;
 reward:=sh->'reward';mat:=coalesce((reward->>'materialAmount')::bigint,0);sil:=coalesce((reward->>'silver')::bigint,0);
 tl:=jsonb_set(jsonb_set(coalesce(r.temporary_loot,'{}'),'{material}',to_jsonb(coalesce((r.temporary_loot->>'material')::bigint,0)+mat),true),'{silver}',to_jsonb(coalesce((r.temporary_loot->>'silver')::bigint,0)+sil),true);
 sh:=sh||jsonb_build_object('status','DELETED','completedAt',clock_timestamp(),'deletedAt',clock_timestamp(),'version',coalesce((sh->>'version')::int,1)+2);
 update private.online_expeditions set stronghold=sh,temporary_loot=tl,run_version=run_version+1 where user_id=u returning * into r;
 return jsonb_build_object('reward',reward,'stronghold',r.stronghold,'temporaryLoot',r.temporary_loot,'runVersion',r.run_version);
end $$;
revoke all on function public.settle_online_resource_stronghold(uuid,bigint,text,text,bigint) from public,anon;
grant execute on function public.settle_online_resource_stronghold(uuid,bigint,text,text,bigint) to authenticated;

create or replace function public.abandon_online_resource_stronghold(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;r private.online_expeditions%rowtype;sh jsonb;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u for update;
 if not found or r.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 if r.run_version<>p_expected_version then raise exception 'EXPEDITION_VERSION_CONFLICT';end if;
 sh:=r.stronghold;if sh is null or sh->>'status'<>'ACTIVE' then raise exception 'RESOURCE_STRONGHOLD_NOT_ACTIVE';end if;
 sh:=sh||jsonb_build_object('status','DELETED','abandonedAt',clock_timestamp(),'deletedAt',clock_timestamp(),'version',coalesce((sh->>'version')::int,1)+2);
 update private.online_expeditions set stronghold=sh,run_version=run_version+1 where user_id=u returning * into r;
 return jsonb_build_object('stronghold',r.stronghold,'runVersion',r.run_version);
end $$;
revoke all on function public.abandon_online_resource_stronghold(uuid,bigint,text,text,bigint) from public,anon;
grant execute on function public.abandon_online_resource_stronghold(uuid,bigint,text,text,bigint) to authenticated;
