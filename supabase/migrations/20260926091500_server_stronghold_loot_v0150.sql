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
  if p_combat.player_shield_hits>0 then p_combat.player_shield_hits:=p_combat.player_shield_hits-1;player_absorb:=player_absorb+reactive_damage;reactive_damage:=0;else step_absorb:=least(p_combat.player_shield,reactive_damage);player_absorb:=player_absorb+step_absorb;p_combat.player_shield:=p_combat.player_shield-step_absorb;reactive_damage:=reactive_damage-step_absorb;end if;p_combat.player_hp:=greatest(0,p_combat.player_hp-reactive_damage);p_combat:=private.server_after_player_damage(p_combat,reactive_damage,p_nonce);end if;
 if p_combat.monster_hp>0 and p_combat.player_hp>0 then player_delta:=private.effect_periodic_delta(p_combat.player_effects,p_combat.player_max_hp,p_combat.player_turn);
  if player_delta<0 and p_combat.player_shield_hits>0 then p_combat.player_shield_hits:=p_combat.player_shield_hits-1;player_absorb:=player_absorb-player_delta;player_delta:=0;elsif player_delta<0 and p_combat.player_shield>0 then step_absorb:=least(p_combat.player_shield,-player_delta);player_absorb:=player_absorb+step_absorb;p_combat.player_shield:=p_combat.player_shield-step_absorb;player_delta:=player_delta+step_absorb;end if;
  p_combat.player_hp:=greatest(0,least(p_combat.player_max_hp,p_combat.player_hp+player_delta));p_combat.player_effects:=private.effect_tick(p_combat.player_effects,p_combat.player_turn);end if;
 if p_combat.monster_hp>0 and p_combat.player_hp>0 then turn_result:=private.resolve_server_monster_turn(p_combat);select * into p_combat from jsonb_populate_record(null::private.online_combat_states,turn_result->'state');monster_action:=turn_result->'action';ret:=coalesce((turn_result->>'damage')::bigint,0);player_absorb:=player_absorb+coalesce((turn_result->>'absorbed')::numeric,0);p_combat:=private.server_after_player_damage(p_combat,ret,p_nonce);
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


-- Settlement consumes only canonical temporary loot; confirmed_kills is no longer recomputed into rewards.
create or replace function public.settle_online_expedition_v2(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_outcome text,p_client_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
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
  update private.online_expeditions set status='RETURNED',settled_at=now(),temporary_loot='{"silver":0,"material":0,"tickets":0}'::jsonb,run_version=run_version+1 where user_id=u;
 else update private.online_expeditions set status='DEAD',settled_at=now(),temporary_loot='{"silver":0,"material":0,"tickets":0}'::jsonb,run_version=run_version+1 where user_id=u;end if;
 payload:=jsonb_set(p_client_payload,'{lastExpedition,kills}',to_jsonb(r.confirmed_kills),true);perform private.persist_client_payload_with_server_economy(u,payload,'0.1.50');
 return private.cloud_record_json(u);
end $$;
revoke all on function public.settle_online_expedition_v2(uuid,bigint,text,text,text,jsonb) from public,anon;
grant execute on function public.settle_online_expedition_v2(uuid,bigint,text,text,text,jsonb) to authenticated;

create or replace function public.restore_online_expedition(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u;
 if not found or r.status<>'ACTIVE' then return jsonb_build_object('active',false);end if;
 select * into c from private.online_combat_states where user_id=u;
 return jsonb_build_object('active',true,'run',jsonb_build_object('runId',r.run_id,'tower',r.tower,'floor',r.floor,'confirmedKills',r.confirmed_kills,'encounterIndex',r.encounter_index,'bossProgress',r.boss_progress,'bossDefeated',r.boss_defeated,'pendingEvent',r.pending_event,'temporaryLoot',r.temporary_loot,'stronghold',r.stronghold,'runVersion',r.run_version,'potions',jsonb_build_object('lesser',r.potion_lesser,'standard',r.potion_standard,'greater',r.potion_greater,'supreme',r.potion_supreme,'revival',r.revival_count)),
 'combat',case when c.user_id is null then null else jsonb_build_object('monsterId',c.monster_id,'monsterHp',c.monster_hp,'monsterMaxHp',c.monster_max_hp,'playerHp',c.player_hp,'playerMaxHp',c.player_max_hp,'playerShield',c.player_shield,'monsterShield',c.monster_shield,'playerShieldHits',c.player_shield_hits,'monsterShieldHits',c.monster_shield_hits,'playerEffects',c.player_effects,'monsterEffects',c.monster_effects,'monsterCooldowns',c.monster_cooldowns,'monsterPreparedAction',c.monster_prepared_action,'monsterReactiveAction',c.monster_reactive_action,'jobId',c.job_id,'jobResource',c.job_resource,'jobFlags',c.job_flags,'playerCooldowns',c.cooldowns,'stateVersion',c.state_version,'playerTurn',c.player_turn,'monsterTurn',c.monster_turn,'turnNo',c.turn_no,'phase',c.phase,'pendingRevival',c.pending_revival,'actionNonce',c.action_nonce) end);
end $$;
revoke all on function public.restore_online_expedition(uuid,bigint,text,text) from public,anon;
grant execute on function public.restore_online_expedition(uuid,bigint,text,text) to authenticated;


-- Final five-job passive parity for incoming damage, first aid, potion knowledge, rage, and duelist reactions.
create or replace function private.server_job_received_multiplier(p_combat private.online_combat_states)
returns numeric language plpgsql immutable set search_path='' as $$
declare r numeric:=p_combat.player_hp::numeric/nullif(p_combat.player_max_hp,0);m numeric:=1;
begin
 if p_combat.job_id='contract_mercenary' then m:=m*.92;end if;
 if p_combat.job_id='berserker' and r<=.30 then m:=m*.85;end if;
 return m;
end $$;
revoke all on function private.server_job_received_multiplier(private.online_combat_states) from public,anon,authenticated;

create or replace function private.server_after_player_damage(p_combat private.online_combat_states,p_actual bigint,p_nonce bigint)
returns private.online_combat_states language plpgsql security definer set search_path=''
as $$
declare gain int;heal bigint;counter bigint;
begin
 if p_actual<=0 then return p_combat;end if;
 if p_combat.job_id='berserker' then gain:=floor((p_actual::numeric/nullif(p_combat.player_max_hp,0))*100);p_combat.job_resource:=least(100,p_combat.job_resource+greatest(0,gain));end if;
 if p_combat.job_id='field_medic' and not coalesce((p_combat.job_flags->>'first_aid_used')::boolean,false) and p_combat.player_hp>0 and p_combat.player_hp::numeric/nullif(p_combat.player_max_hp,0)<=.30 then
  heal:=round(p_combat.player_max_hp*.15);p_combat.player_hp:=least(p_combat.player_max_hp,p_combat.player_hp+heal);p_combat.job_flags:=p_combat.job_flags||'{"first_aid_used":true}'::jsonb;
 end if;
 if p_combat.job_id='duelist' and p_combat.monster_hp>0 and private.server_roll(p_combat.rng_seed,p_combat.encounter_index,p_nonce,p_combat.monster_turn+701)<.20 then
  counter:=private.combat_damage(private.combat_effective_attack(p_combat),p_combat.monster_defense*greatest(.05,1+private.effect_modifier(p_combat.monster_effects,'defense')),.60*p_combat.skill_power,1,greatest(0,1+private.effect_modifier(p_combat.monster_effects,'receivedDamage')));
  p_combat.monster_hp:=greatest(0,p_combat.monster_hp-counter);
 end if;
 return p_combat;
end $$;
revoke all on function private.server_after_player_damage(private.online_combat_states,bigint,bigint) from public,anon,authenticated;

-- Potion override: field medic healing bonus and canonical bag deduction.
create or replace function public.apply_online_potion(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_action_nonce bigint,p_potion text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;ratio numeric;heal bigint;col text;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);select * into r from private.online_expeditions where user_id=u for update;select * into c from private.online_combat_states where user_id=u for update;
 if not found or r.status<>'ACTIVE' or c.run_id<>r.run_id or c.phase<>'PLAYER_TURN' then raise exception 'COMBAT_PHASE_INVALID';end if;if p_action_nonce<>c.action_nonce+1 then raise exception 'COMBAT_ACTION_SEQUENCE_INVALID';end if;
 ratio:=case p_potion when 'lesser' then .20 when 'standard' then .35 when 'greater' then .50 when 'supreme' then .75 else null end;if ratio is null then raise exception 'COMBAT_POTION_INVALID';end if;
 if p_potion='lesser' and r.potion_lesser>0 then r.potion_lesser:=r.potion_lesser-1;elsif p_potion='standard' and r.potion_standard>0 then r.potion_standard:=r.potion_standard-1;elsif p_potion='greater' and r.potion_greater>0 then r.potion_greater:=r.potion_greater-1;elsif p_potion='supreme' and r.potion_supreme>0 then r.potion_supreme:=r.potion_supreme-1;else raise exception 'COMBAT_POTION_EMPTY';end if;
 if c.job_id='field_medic' then ratio:=ratio*1.2;end if;heal:=round(c.player_max_hp*ratio);c.player_hp:=least(c.player_max_hp,c.player_hp+heal);
 update private.online_expeditions set potion_lesser=r.potion_lesser,potion_standard=r.potion_standard,potion_greater=r.potion_greater,potion_supreme=r.potion_supreme,run_version=run_version+1 where user_id=u returning * into r;perform private.persist_run_bag_to_save(u,r);
 update private.online_combat_states set player_hp=c.player_hp where user_id=u returning * into c;
 return private.finish_server_player_action(u,r,c,p_action_nonce,0)||jsonb_build_object('healing',heal,'jobResource',c.job_resource,'jobFlags',c.job_flags);
end $$;
revoke all on function public.apply_online_potion(uuid,bigint,text,text,bigint,text) from public,anon;
grant execute on function public.apply_online_potion(uuid,bigint,text,text,bigint,text) to authenticated;


-- Resolve player multihit packets one hit at a time so hit shields and reactive attacks
-- observe the same boundaries as the local combat engine.
create or replace function private.server_apply_player_hit(p_combat private.online_combat_states,p_raw bigint,p_nonce bigint,p_hit_index int)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare hp_damage bigint:=greatest(0,p_raw);absorbed bigint:=0;reaction bigint:=0;reaction_id text;
begin
 if hp_damage>0 and p_combat.monster_shield_hits>0 then
  p_combat.monster_shield_hits:=p_combat.monster_shield_hits-1;absorbed:=hp_damage;hp_damage:=0;
 elsif hp_damage>0 and p_combat.monster_shield>0 then
  absorbed:=least(p_combat.monster_shield,hp_damage);p_combat.monster_shield:=p_combat.monster_shield-absorbed;hp_damage:=hp_damage-absorbed;
 end if;
 p_combat.monster_hp:=greatest(0,p_combat.monster_hp-hp_damage);
 if p_combat.accessory_passive='vampire' and hp_damage>0 then p_combat.player_hp:=least(p_combat.player_max_hp,p_combat.player_hp+floor(hp_damage*p_combat.accessory_value));end if;
 if hp_damage>0 and p_combat.monster_hp>0 and p_combat.monster_reactive_action is not null then
  reaction_id:=p_combat.monster_reactive_action;p_combat.monster_reactive_action:=null;
  reaction:=private.combat_damage(p_combat.monster_attack*greatest(.05,1+private.effect_modifier(p_combat.monster_effects,'attack')),p_combat.player_defense*greatest(.05,1+private.effect_modifier(p_combat.player_effects,'defense')),private.server_reactive_multiplier(reaction_id),1,greatest(0,1+private.effect_modifier(p_combat.player_effects,'receivedDamage'))*private.server_job_received_multiplier(p_combat));
  if p_combat.player_shield_hits>0 then p_combat.player_shield_hits:=p_combat.player_shield_hits-1;reaction:=0;
  elsif p_combat.player_shield>0 then absorbed:=absorbed+least(p_combat.player_shield,reaction);reaction:=reaction-least(p_combat.player_shield,reaction);p_combat.player_shield:=greatest(0,p_combat.player_shield+reaction-private.combat_damage(p_combat.monster_attack*greatest(.05,1+private.effect_modifier(p_combat.monster_effects,'attack')),p_combat.player_defense*greatest(.05,1+private.effect_modifier(p_combat.player_effects,'defense')),private.server_reactive_multiplier(reaction_id),1,greatest(0,1+private.effect_modifier(p_combat.player_effects,'receivedDamage'))*private.server_job_received_multiplier(p_combat)));end if;
  p_combat.player_hp:=greatest(0,p_combat.player_hp-reaction);p_combat:=private.server_after_player_damage(p_combat,reaction,p_nonce*100+p_hit_index);
 end if;
 return jsonb_build_object('state',to_jsonb(p_combat),'hpDamage',hp_damage,'absorbed',absorbed,'reactionDamage',reaction,'reactionId',reaction_id);
end $$;
revoke all on function private.server_apply_player_hit(private.online_combat_states,bigint,bigint,int) from public,anon,authenticated;

create or replace function public.apply_online_basic_attack(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_action_nonce bigint,p_attack numeric default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;i int;mult numeric;crit numeric;raw bigint;def numeric;step jsonb;total bigint:=0;absorbed bigint:=0;reaction bigint:=0;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);select * into r from private.online_expeditions where user_id=u for update;select * into c from private.online_combat_states where user_id=u for update;
 if not found or r.status<>'ACTIVE' or c.run_id<>r.run_id then raise exception 'COMBAT_SERVER_STATE_MISSING';end if;if c.phase<>'PLAYER_TURN' then raise exception 'COMBAT_PHASE_INVALID';end if;if p_action_nonce<>c.action_nonce+1 then raise exception 'COMBAT_ACTION_SEQUENCE_INVALID';end if;
 def:=c.monster_defense*greatest(.05,1+private.effect_modifier(c.monster_effects,'defense'));
 for i in 1..greatest(1,c.basic_hits) loop
  exit when c.monster_hp<=0 or c.player_hp<=0;
  mult:=case when c.basic_hits=2 then .55 else 1 end;crit:=case when private.server_roll(c.rng_seed,c.encounter_index,p_action_nonce,i)<c.crit_chance then c.crit_damage else 1 end;
  raw:=private.combat_damage(private.combat_effective_attack(c),def,mult*private.server_job_damage_multiplier(c,'BASIC'),crit,greatest(0,1+private.effect_modifier(c.monster_effects,'receivedDamage')));
  step:=private.server_apply_player_hit(c,raw,p_action_nonce,i);select * into c from jsonb_populate_record(null::private.online_combat_states,step->'state');total:=total+coalesce((step->>'hpDamage')::bigint,0);absorbed:=absorbed+coalesce((step->>'absorbed')::bigint,0);reaction:=reaction+coalesce((step->>'reactionDamage')::bigint,0);
 end loop;
 return private.finish_server_player_action(u,r,c,p_action_nonce,0)||jsonb_build_object('damage',total,'absorbed',absorbed,'hitReactionDamage',reaction,'jobResource',c.job_resource,'jobFlags',c.job_flags);
end $$;
revoke all on function public.apply_online_basic_attack(uuid,bigint,text,text,bigint,numeric) from public,anon;
grant execute on function public.apply_online_basic_attack(uuid,bigint,text,text,bigint,numeric) to authenticated;


-- Override job skills so multihit skills consume shields/reactions per hit.
create or replace function public.apply_online_job_skill(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_action_nonce bigint,p_skill_id text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;mult numeric:=0;hits int:=0;cd int:=0;i int;raw bigint;total bigint:=0;attack numeric;ratio numeric;heal bigint:=0;step jsonb;absorbed bigint:=0;reaction bigint:=0;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);select * into r from private.online_expeditions where user_id=u for update;select * into c from private.online_combat_states where user_id=u for update;
 if not found or r.status<>'ACTIVE' or c.run_id<>r.run_id or c.phase<>'PLAYER_TURN' then raise exception 'COMBAT_PHASE_INVALID';end if;if p_action_nonce<>c.action_nonce+1 then raise exception 'COMBAT_ACTION_SEQUENCE_INVALID';end if;if coalesce((c.cooldowns->>('turn:'||p_skill_id))::int,0)>0 then raise exception 'COMBAT_SKILL_COOLDOWN';end if;
 ratio:=c.monster_hp::numeric/nullif(c.monster_max_hp,0);
 if c.job_id='contract_mercenary' then if p_skill_id='mercenary_skill_1' then mult:=1.8;hits:=1;cd:=3;elsif p_skill_id='mercenary_skill_2' then c.player_effects:=private.apply_server_effect(c.player_effects,'mercenary_guard',c.player_turn);cd:=5;elsif p_skill_id='mercenary_skill_3' then mult:=case when ratio<=.4 then 2 else 1.3 end;hits:=1;cd:=4;else raise exception 'COMBAT_SKILL_INVALID';end if;
 elsif c.job_id='hunter' then if p_skill_id='hunter_skill_1' then c.monster_effects:=private.apply_server_effect(c.monster_effects,'hunter_mark',c.monster_turn);cd:=5;elsif p_skill_id='hunter_skill_2' then mult:=.7;hits:=case when exists(select 1 from jsonb_array_elements(c.monster_effects)e where e->>'effectId'='hunter_mark') then 3 else 2 end;elsif p_skill_id='hunter_skill_3' then mult:=case when ratio<=.35 and exists(select 1 from jsonb_array_elements(c.monster_effects)e where e->>'effectId'='hunter_mark') then 2.8 else 1.7 end;hits:=1;cd:=5;else raise exception 'COMBAT_SKILL_INVALID';end if;
 elsif c.job_id='field_medic' then if p_skill_id='field_medic_skill_1' then heal:=round(c.player_max_hp*.2);c.player_hp:=least(c.player_max_hp,c.player_hp+heal);cd:=5;elsif p_skill_id='field_medic_skill_2' then c.player_effects:=(select coalesce(jsonb_agg(e),'[]') from jsonb_array_elements(c.player_effects)e where e->>'effectId' not in('bleed','fang_wound'));c.player_effects:=private.apply_server_effect(c.player_effects,'field_medic_regen',c.player_turn);elsif p_skill_id='field_medic_skill_3' then c.player_effects:=private.apply_server_effect(c.player_effects,'field_medic_analgesic',c.player_turn);cd:=6;else raise exception 'COMBAT_SKILL_INVALID';end if;
 elsif c.job_id='duelist' then if p_skill_id='duelist_skill_1' then mult:=1.6;hits:=1;cd:=2;elsif p_skill_id='duelist_skill_2' then c.player_effects:=private.apply_server_effect(c.player_effects,'duelist_counter_stance',c.player_turn);cd:=5;elsif p_skill_id='duelist_skill_3' then mult:=case when ratio<=.3 then 3.2 else 2.2 end;hits:=1;cd:=6;else raise exception 'COMBAT_SKILL_INVALID';end if;
 elsif c.job_id='berserker' then if p_skill_id='berserker_skill_1' then c.job_resource:=least(100,c.job_resource+10);mult:=.75;hits:=2;elsif p_skill_id='berserker_skill_2' then c.player_hp:=greatest(1,c.player_hp-round(c.player_max_hp*.1));c.job_resource:=least(100,c.job_resource+25);c.player_effects:=private.apply_server_effect(c.player_effects,'berserker_blood_boost',c.player_turn);elsif p_skill_id='berserker_skill_3' then if c.job_resource<60 then raise exception 'COMBAT_SKILL_CONDITION';end if;c.job_resource:=c.job_resource-60;mult:=1;hits:=3;else raise exception 'COMBAT_SKILL_INVALID';end if;else raise exception 'COMBAT_SKILL_INVALID';end if;
 c.cooldowns:=(select coalesce(jsonb_object_agg(key,to_jsonb(greatest(0,(value#>>'{}')::int-1))),'{}') from jsonb_each(c.cooldowns));if cd>0 then c.cooldowns:=c.cooldowns||jsonb_build_object('turn:'||p_skill_id,cd);end if;
 if hits>0 then attack:=private.combat_effective_attack(c)*private.server_job_damage_multiplier(c,'SKILL');for i in 1..hits loop exit when c.monster_hp<=0 or c.player_hp<=0;raw:=private.combat_damage(attack,c.monster_defense*greatest(.05,1+private.effect_modifier(c.monster_effects,'defense')),(case when c.job_id='berserker' and p_skill_id='berserker_skill_3' and i=hits and c.monster_hp::numeric/nullif(c.monster_max_hp,0)<=.3 then 1.5 else mult end)*c.skill_power,1,greatest(0,1+private.effect_modifier(c.monster_effects,'receivedDamage')));step:=private.server_apply_player_hit(c,raw,p_action_nonce,i);select * into c from jsonb_populate_record(null::private.online_combat_states,step->'state');total:=total+coalesce((step->>'hpDamage')::bigint,0);absorbed:=absorbed+coalesce((step->>'absorbed')::bigint,0);reaction:=reaction+coalesce((step->>'reactionDamage')::bigint,0);end loop;end if;
 update private.online_combat_states set player_hp=c.player_hp,player_effects=c.player_effects,monster_effects=c.monster_effects,cooldowns=c.cooldowns,job_resource=c.job_resource,job_flags=c.job_flags,state_version=state_version+1 where user_id=u returning * into c;
 return private.finish_server_player_action(u,r,c,p_action_nonce,0)||jsonb_build_object('damage',total,'absorbed',absorbed,'hitReactionDamage',reaction,'healing',heal,'jobResource',c.job_resource,'jobFlags',c.job_flags,'stateVersion',c.state_version,'playerEffects',c.player_effects,'monsterEffects',c.monster_effects,'playerCooldowns',c.cooldowns);
end $$;
revoke all on function public.apply_online_job_skill(uuid,bigint,text,text,bigint,text) from public,anon;
grant execute on function public.apply_online_job_skill(uuid,bigint,text,text,bigint,text) to authenticated;


-- Canonical battle-opening effects used by production bosses.
create or replace function private.server_initial_monster_effects(p_monster_id text,p_turn bigint default 0)
returns jsonb language plpgsql immutable set search_path=''
as $$
declare e jsonb:='[]'::jsonb;
begin
 if p_monster_id='black_vein_armor_breaker' then e:=private.apply_server_effect(e,'iron_armor',p_turn);
 elsif p_monster_id='sanctuary_talon_bishop' then e:=private.apply_server_effect(e,'blood_rite_ward',p_turn);
 end if;
 return e;
end $$;
revoke all on function private.server_initial_monster_effects(text,bigint) from public,anon,authenticated;

-- Apply opening effects exactly once when a fresh encounter state is created.
create or replace function public.begin_online_combat_state_v2(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;s public.game_saves%rowtype;r private.online_expeditions%rowtype;result jsonb;power numeric;passive jsonb;j text;c private.online_combat_states%rowtype;fresh boolean:=false;initial jsonb;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into c from private.online_combat_states where user_id=u;fresh:=not found or c.run_id is distinct from (select run_id from private.online_expeditions where user_id=u) or c.phase in('DEFEATED','PLAYER_DEAD');
 result:=public.begin_online_combat_state(p_lease_id,p_generation,p_client_instance_id,p_device_id,null,null,null);
 select * into r from private.online_expeditions where user_id=u for update;if not found then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;r:=private.ensure_run_consumables(u,r);
 select * into s from public.game_saves where user_id=u;if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 power:=private.combat_skill_power(s.payload);passive:=private.combat_accessory_passive(s.payload);j:=private.server_job_id(s.payload);
 select * into c from private.online_combat_states where user_id=u for update;
 if fresh then
  initial:=private.server_initial_monster_effects(c.monster_id,c.monster_turn);c.monster_effects:=initial;
  c.monster_shield:=case c.monster_id when 'sanctuary_talon_bishop' then 60 else 0 end;
  c.monster_shield_hits:=0;
 end if;
 update private.online_combat_states set skill_power=power,revival_count=r.revival_count,potion_lesser=r.potion_lesser,potion_standard=r.potion_standard,potion_greater=r.potion_greater,potion_supreme=r.potion_supreme,
 accessory_passive=passive->>'kind',accessory_value=coalesce((passive->>'value')::numeric,0),job_id=j,job_resource=case when j='berserker' then c.job_resource else 0 end,
 monster_effects=c.monster_effects,monster_shield=c.monster_shield,monster_shield_hits=c.monster_shield_hits,state_version=state_version+1 where user_id=u returning * into c;
 return result||jsonb_build_object('jobId',c.job_id,'jobResource',c.job_resource,'jobFlags',c.job_flags,'stateVersion',c.state_version,'playerEffects',c.player_effects,'monsterEffects',c.monster_effects,'playerShield',c.player_shield,'monsterShield',c.monster_shield,'playerShieldHits',c.player_shield_hits,'monsterShieldHits',c.monster_shield_hits,'playerCooldowns',c.cooldowns,'playerTurn',c.player_turn,'monsterTurn',c.monster_turn,'revivalCount',c.revival_count,'potions',jsonb_build_object('healing_lesser',c.potion_lesser,'healing_standard',c.potion_standard,'healing_greater',c.potion_greater,'healing_supreme',c.potion_supreme));
end $$;
revoke all on function public.begin_online_combat_state_v2(uuid,bigint,text,text) from public,anon;
grant execute on function public.begin_online_combat_state_v2(uuid,bigint,text,text) to authenticated;
