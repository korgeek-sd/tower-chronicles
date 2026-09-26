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


-- Supersede the combat finisher so a kill, its deterministic loot, and progression are committed together.
create or replace function private.finish_server_player_action(p_user uuid,p_run private.online_expeditions,p_combat private.online_combat_states,p_nonce bigint,p_damage bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare direct_damage bigint:=p_damage;monster_absorb numeric:=0;player_absorb numeric:=0;step_absorb numeric:=0;heal bigint:=0;player_delta bigint:=0;monster_delta bigint:=0;ret bigint:=0;reactive_damage bigint:=0;kill_no bigint;phase text:='PLAYER_TURN';turn_result jsonb;monster_action jsonb;reaction_id text;drop jsonb;tl jsonb;boss boolean:=false;
begin
 if p_combat.monster_shield_hits>0 and direct_damage>0 then p_combat.monster_shield_hits:=p_combat.monster_shield_hits-1;monster_absorb:=direct_damage;direct_damage:=0;
 else monster_absorb:=least(p_combat.monster_shield,direct_damage);p_combat.monster_shield:=p_combat.monster_shield-monster_absorb;direct_damage:=direct_damage-monster_absorb;end if;
 p_combat.monster_hp:=greatest(0,p_combat.monster_hp-direct_damage);
 if p_combat.accessory_passive='vampire' and direct_damage>0 then heal:=floor(direct_damage*p_combat.accessory_value);p_combat.player_hp:=least(p_combat.player_max_hp,p_combat.player_hp+heal);end if;
 if direct_damage>0 and p_combat.monster_hp>0 and p_combat.monster_reactive_action is not null then reaction_id:=p_combat.monster_reactive_action;p_combat.monster_reactive_action:=null;reactive_damage:=private.combat_damage(p_combat.monster_attack*greatest(.05,1+private.effect_modifier(p_combat.monster_effects,'attack')),p_combat.player_defense*greatest(.05,1+private.effect_modifier(p_combat.player_effects,'defense')),private.server_reactive_multiplier(reaction_id),1,greatest(0,1+private.effect_modifier(p_combat.player_effects,'receivedDamage')));
  if p_combat.player_shield_hits>0 then p_combat.player_shield_hits:=p_combat.player_shield_hits-1;player_absorb:=player_absorb+reactive_damage;reactive_damage:=0;else step_absorb:=least(p_combat.player_shield,reactive_damage);player_absorb:=player_absorb+step_absorb;p_combat.player_shield:=p_combat.player_shield-step_absorb;reactive_damage:=reactive_damage-step_absorb;end if;p_combat.player_hp:=greatest(0,p_combat.player_hp-reactive_damage);end if;
 if p_combat.monster_hp>0 and p_combat.player_hp>0 then player_delta:=private.effect_periodic_delta(p_combat.player_effects,p_combat.player_max_hp,p_combat.player_turn);
  if player_delta<0 and p_combat.player_shield_hits>0 then p_combat.player_shield_hits:=p_combat.player_shield_hits-1;player_absorb:=player_absorb-player_delta;player_delta:=0;elsif player_delta<0 and p_combat.player_shield>0 then step_absorb:=least(p_combat.player_shield,-player_delta);player_absorb:=player_absorb+step_absorb;p_combat.player_shield:=p_combat.player_shield-step_absorb;player_delta:=player_delta+step_absorb;end if;
  p_combat.player_hp:=greatest(0,least(p_combat.player_max_hp,p_combat.player_hp+player_delta));p_combat.player_effects:=private.effect_tick(p_combat.player_effects,p_combat.player_turn);end if;
 if p_combat.monster_hp>0 and p_combat.player_hp>0 then turn_result:=private.resolve_server_monster_turn(p_combat);select * into p_combat from jsonb_populate_record(null::private.online_combat_states,turn_result->'state');monster_action:=turn_result->'action';ret:=coalesce((turn_result->>'damage')::bigint,0);player_absorb:=player_absorb+coalesce((turn_result->>'absorbed')::numeric,0);
  monster_delta:=private.effect_periodic_delta(p_combat.monster_effects,p_combat.monster_max_hp,p_combat.monster_turn);
  if monster_delta<0 and p_combat.monster_shield_hits>0 then p_combat.monster_shield_hits:=p_combat.monster_shield_hits-1;monster_absorb:=monster_absorb-monster_delta;monster_delta:=0;elsif monster_delta<0 and p_combat.monster_shield>0 then step_absorb:=least(p_combat.monster_shield,-monster_delta);monster_absorb:=monster_absorb+step_absorb;p_combat.monster_shield:=p_combat.monster_shield-step_absorb;monster_delta:=monster_delta+step_absorb;end if;
  p_combat.monster_hp:=greatest(0,least(p_combat.monster_max_hp,p_combat.monster_hp+monster_delta));p_combat.monster_effects:=private.effect_tick(p_combat.monster_effects,p_combat.monster_turn);end if;
 if p_combat.monster_hp=0 then
  kill_no:=p_run.confirmed_kills+1;boss:=private.server_boss_id(p_run.tower,p_run.floor)=p_combat.monster_id;
  insert into private.online_expedition_kills(user_id,run_id,kill_index,monster_id) values(p_user,p_run.run_id,kill_no,p_combat.monster_id) on conflict do nothing;
  drop:=private.server_kill_loot(p_run,kill_no);tl:=jsonb_set(jsonb_set(jsonb_set(coalesce(p_run.temporary_loot,'{}'),'{silver}',to_jsonb(coalesce((p_run.temporary_loot->>'silver')::bigint,0)+coalesce((drop->>'silver')::bigint,0)),true),'{material}',to_jsonb(coalesce((p_run.temporary_loot->>'material')::bigint,0)+coalesce((drop->>'material')::bigint,0)),true),'{tickets}',to_jsonb(coalesce((p_run.temporary_loot->>'tickets')::bigint,0)+coalesce((drop->>'tickets')::bigint,0)),true);
  update private.online_expeditions set confirmed_kills=greatest(confirmed_kills,kill_no),last_confirmed_kill_at=now(),temporary_loot=tl,boss_progress=case when boss then 0 else boss_progress+1 end,boss_defeated=case when boss then true else boss_defeated end,run_version=run_version+1 where user_id=p_user;phase:='DEFEATED';
 elsif p_combat.player_hp=0 then phase:='PLAYER_DEAD';p_combat.pending_revival:=p_combat.revival_count>0;
 else p_combat.player_turn:=p_combat.player_turn+1;phase:='PLAYER_TURN';end if;
 update private.online_combat_states set monster_hp=p_combat.monster_hp,player_hp=p_combat.player_hp,player_shield=p_combat.player_shield,monster_shield=p_combat.monster_shield,player_shield_hits=p_combat.player_shield_hits,monster_shield_hits=p_combat.monster_shield_hits,player_effects=p_combat.player_effects,monster_effects=p_combat.monster_effects,monster_cooldowns=p_combat.monster_cooldowns,monster_prepared_action=p_combat.monster_prepared_action,monster_reactive_action=p_combat.monster_reactive_action,player_turn=p_combat.player_turn,monster_turn=p_combat.monster_turn,turn_no=turn_no+1,phase=phase,pending_revival=p_combat.pending_revival,action_nonce=p_nonce,updated_at=now() where user_id=p_user;
 return jsonb_build_object('damage',direct_damage,'absorbed',monster_absorb,'healing',heal,'monsterReaction',case when reaction_id is null then null else jsonb_build_object('id',reaction_id,'damage',reactive_damage) end,'monsterAction',monster_action,'retaliation',ret,'playerAbsorbed',player_absorb,'periodicPlayer',player_delta,'periodicMonster',monster_delta,'monsterHp',p_combat.monster_hp,'playerHp',p_combat.player_hp,'playerShield',p_combat.player_shield,'monsterShield',p_combat.monster_shield,'phase',phase,'pendingRevival',p_combat.pending_revival,'confirmedKills',coalesce(kill_no,p_run.confirmed_kills),'drop',drop,'actionNonce',p_nonce);
end $$;
