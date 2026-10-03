CREATE OR REPLACE FUNCTION private.finish_server_player_action(p_user uuid, p_run private.online_expeditions, p_combat private.online_combat_states, p_nonce bigint, p_damage bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 direct_damage numeric:=greatest(0,p_damage);monster_absorb numeric:=0;player_absorb numeric:=0;step_absorb numeric:=0;
 heal bigint:=0;player_delta bigint:=0;monster_delta bigint:=0;ret numeric:=0;reactive_damage bigint:=0;
 kill_no bigint;inserted_kill bigint;next_phase text:='PLAYER_TURN';turn_result jsonb;monster_action jsonb;
 reaction_id text;drop jsonb;tl jsonb;boss boolean:=false;step jsonb;
begin
 p_combat:=private.combat_v2_round(p_combat,p_nonce);
 monster_action:=p_combat.engine_runtime->'monsterAction';
 select coalesce(sum((x->>'hpDamage')::numeric),0) into direct_damage from jsonb_array_elements(coalesce(p_combat.engine_runtime->'events','[]'))x where x->>'kind'='DIRECT_DAMAGE' and x->>'attacker'='player' and x->>'origin'='ACTION';
 select coalesce(sum((x->>'hpDamage')::numeric),0) into ret from jsonb_array_elements(coalesce(p_combat.engine_runtime->'events','[]'))x where x->>'kind'='DIRECT_DAMAGE' and x->>'attacker'='monster' and x->>'origin'='ACTION';
 if p_combat.monster_hp=0 then
   kill_no:=p_run.confirmed_kills+1;boss:=private.server_boss_id(p_run.tower,p_run.floor)=p_combat.monster_id;
   insert into private.online_expedition_kills(user_id,run_id,kill_index,monster_id)
   values(p_user,p_run.run_id,kill_no,p_combat.monster_id)
   on conflict do nothing returning kill_index into inserted_kill;
   if inserted_kill is not null then
     drop:=private.server_kill_loot(p_run,kill_no);
     tl:=jsonb_set(
       jsonb_set(
         jsonb_set(coalesce(p_run.temporary_loot,'{}'::jsonb),'{silver}',
           to_jsonb(coalesce((p_run.temporary_loot->>'silver')::bigint,0)+coalesce((drop->>'silver')::bigint,0)),true),
         '{material}',to_jsonb(coalesce((p_run.temporary_loot->>'material')::bigint,0)+coalesce((drop->>'material')::bigint,0)),true),
       '{tickets}',to_jsonb(coalesce((p_run.temporary_loot->>'tickets')::bigint,0)+coalesce((drop->>'tickets')::bigint,0)),true);
     if drop->'equipment' is not null and jsonb_typeof(drop->'equipment')='object' then
       tl:=jsonb_set(
         tl,'{equipment}',
         coalesce(tl->'equipment','[]'::jsonb)||jsonb_build_array(drop->'equipment'),true
       );
     end if;
     update private.online_expeditions set
       confirmed_kills=greatest(confirmed_kills,kill_no),last_confirmed_kill_at=now(),temporary_loot=tl,
       boss_progress=case when boss then 0 else boss_progress+1 end,
       boss_defeated=case when boss then true else boss_defeated end,
       run_version=run_version+1
     where user_id=p_user returning * into p_run;
   else
     select * into p_run from private.online_expeditions where user_id=p_user;
   end if;
   next_phase:='DEFEATED';
 elsif p_combat.player_hp=0 then
   next_phase:='PLAYER_DEAD';p_combat.pending_revival:=p_combat.revival_count>0;
 else
   next_phase:='PLAYER_TURN';
 end if;

 if next_phase='DEFEATED' then
   p_combat.player_hp:=least(p_combat.player_hp,p_combat.player_max_hp);p_combat.job_resource:=0;p_combat.job_flags:='{}';p_combat.cooldowns:='{}';p_combat.monster_cooldowns:='{}';p_combat.player_effects:='[]';p_combat.monster_effects:='[]';p_combat.player_shield:=0;p_combat.monster_shield:=0;p_combat.monster_reactive_action:=null;p_combat.monster_prepared_action:=null;
   p_combat.engine_runtime:=p_combat.engine_runtime||'{"playerReady":{},"monsterReady":{}}';
 end if;
 update private.online_combat_states set
   engine_runtime=p_combat.engine_runtime,cooldowns=p_combat.cooldowns,
   potion_lesser=p_combat.potion_lesser,potion_standard=p_combat.potion_standard,potion_greater=p_combat.potion_greater,potion_supreme=p_combat.potion_supreme,revival_count=p_combat.revival_count,
   monster_hp=p_combat.monster_hp,player_hp=p_combat.player_hp,
   player_shield=p_combat.player_shield,monster_shield=p_combat.monster_shield,
   player_shield_hits=p_combat.player_shield_hits,monster_shield_hits=p_combat.monster_shield_hits,
   player_effects=p_combat.player_effects,monster_effects=p_combat.monster_effects,
   monster_cooldowns=p_combat.monster_cooldowns,monster_prepared_action=p_combat.monster_prepared_action,
   monster_reactive_action=p_combat.monster_reactive_action,player_turn=p_combat.player_turn,monster_turn=p_combat.monster_turn,
   job_resource=p_combat.job_resource,job_flags=p_combat.job_flags,
   turn_no=turn_no+1,phase=next_phase,pending_revival=p_combat.pending_revival,
   action_nonce=p_nonce,return_authorized=false,state_version=state_version+1,updated_at=now()
 where user_id=p_user returning * into p_combat;

 return private.combat_v2_payload(p_combat,p_run)||jsonb_build_object(
   'damage',direct_damage,'absorbed',monster_absorb,'healing',heal,
   'monsterReaction',case when reaction_id is null then null else jsonb_build_object('id',reaction_id,'damage',reactive_damage) end,
   'monsterAction',monster_action,'retaliation',ret,'playerAbsorbed',player_absorb,
   'periodicPlayer',player_delta,'periodicMonster',monster_delta,
   'monsterId',p_combat.monster_id,'monsterHp',p_combat.monster_hp,'monsterMaxHp',p_combat.monster_max_hp,
   'playerHp',p_combat.player_hp,'playerMaxHp',p_combat.player_max_hp,
   'playerShield',p_combat.player_shield,'monsterShield',p_combat.monster_shield,
   'playerShieldHits',p_combat.player_shield_hits,'monsterShieldHits',p_combat.monster_shield_hits,
   'playerEffects',p_combat.player_effects,'monsterEffects',p_combat.monster_effects,
   'playerCooldowns',p_combat.cooldowns,'monsterCooldowns',p_combat.monster_cooldowns,
   'monsterPreparedAction',p_combat.monster_prepared_action,'monsterReactiveAction',p_combat.monster_reactive_action,
   'jobId',p_combat.job_id,'jobResource',p_combat.job_resource,'jobFlags',p_combat.job_flags,
   'playerTurn',p_combat.player_turn,'monsterTurn',p_combat.monster_turn,'turnNo',p_combat.turn_no,
   'phase',next_phase,'pendingRevival',p_combat.pending_revival,
   'confirmedKills',coalesce(kill_no,p_run.confirmed_kills),'drop',drop,
   'actionNonce',p_nonce,'stateVersion',p_combat.state_version,'runVersion',p_run.run_version
 );
end $function$
;


create or replace function public.apply_online_basic_attack(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_action_nonce bigint,p_attack numeric default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;i int;mult numeric;success boolean:=false;event jsonb;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u for update;select * into c from private.online_combat_states where user_id=u for update;c:=private.combat_v2_require_action(c,r,p_action_nonce,'BASIC');
 for i in 1..greatest(1,c.basic_hits) loop
  exit when c.player_hp<=0 or c.monster_hp<=0 or coalesce(c.pending_revival,false);mult:=case when c.basic_hits=2 then .55 else 1 end;
  c:=private.combat_v2_hit(c,'player',mult*private.server_job_damage_multiplier(c,'BASIC'),p_action_nonce,i,greatest(1,c.basic_hits));
  select value into event from jsonb_array_elements(c.engine_runtime->'events') where value->>'attacker'='player' and value->>'origin'='ACTION' and (value->>'hitIndex')::int=i limit 1;
  success:=success or coalesce((event->>'incomingDamage')::numeric,0)>0;
 end loop;
 if success then c.job_resource:=least(4,c.job_resource+1);end if;
 return private.finish_server_player_action(u,r,c,p_action_nonce,0);
end $$;

create or replace function public.apply_online_job_skill(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_action_nonce bigint,p_skill_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u for update;select * into c from private.online_combat_states where user_id=u for update;c:=private.combat_v2_require_action(c,r,p_action_nonce,'SKILL');
 c:=private.combat_v2_job_skill(c,p_skill_id,p_action_nonce);
 return private.finish_server_player_action(u,r,c,p_action_nonce,0);
end $$;

create or replace function public.apply_online_flee(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_action_nonce bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;result jsonb;authorized boolean;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u for update;select * into c from private.online_combat_states where user_id=u for update;c:=private.combat_v2_require_action(c,r,p_action_nonce,'FLEE');
 result:=private.finish_server_player_action(u,r,c,p_action_nonce,0);authorized:=coalesce((result->>'playerHp')::numeric,0)>0 and not coalesce((result->>'pendingRevival')::boolean,false) and result->>'phase' in ('PLAYER_TURN','DEFEATED');
 update private.online_combat_states set return_authorized=authorized where user_id=u;return result||jsonb_build_object('fled',authorized,'returnAuthorized',authorized);
end $$;

create or replace function public.apply_online_potion(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_action_nonce bigint,p_potion text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;key text;ratio numeric;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u for update;select * into c from private.online_combat_states where user_id=u for update;c:=private.combat_v2_require_action(c,r,p_action_nonce,'POTION');r:=private.ensure_run_consumables(u,r);
 if r.healing_potion_uses>=5 then raise exception 'COMBAT_POTION_LIMIT';end if;
 key:=regexp_replace(p_potion,'^healing_','');ratio:=case key when 'lesser' then .2 when 'standard' then .35 when 'greater' then .5 when 'supreme' then .75 else null end;
 if ratio is null then raise exception 'COMBAT_POTION_INVALID';end if;
 if key='lesser' and coalesce(r.potion_lesser,0)>0 then r.potion_lesser:=r.potion_lesser-1;
 elsif key='standard' and coalesce(r.potion_standard,0)>0 then r.potion_standard:=r.potion_standard-1;
 elsif key='greater' and coalesce(r.potion_greater,0)>0 then r.potion_greater:=r.potion_greater-1;
 elsif key='supreme' and coalesce(r.potion_supreme,0)>0 then r.potion_supreme:=r.potion_supreme-1;else raise exception 'COMBAT_POTION_EMPTY';end if;
 if c.job_id='field_medic' then ratio:=ratio*1.2;end if;
 c:=private.combat_v2_heal(c,'player',round(c.player_max_hp*ratio),false,p_action_nonce,1100);
 update private.online_expeditions set potion_lesser=r.potion_lesser,potion_standard=r.potion_standard,potion_greater=r.potion_greater,potion_supreme=r.potion_supreme,healing_potion_uses=healing_potion_uses+1,run_version=run_version+1 where user_id=u returning * into r;
 perform private.persist_run_bag_to_save(u,r);c.potion_lesser:=r.potion_lesser;c.potion_standard:=r.potion_standard;c.potion_greater:=r.potion_greater;c.potion_supreme:=r.potion_supreme;
 return private.finish_server_player_action(u,r,c,p_action_nonce,0)||jsonb_build_object('potions',jsonb_build_object('healing_lesser',r.potion_lesser,'healing_standard',r.potion_standard,'healing_greater',r.potion_greater,'healing_supreme',r.potion_supreme));
end $$;

create or replace function public.resolve_online_revival(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_use boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;result jsonb;resume text;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);select * into r from private.online_expeditions where user_id=u for update;select * into c from private.online_combat_states where user_id=u for update;
 if c.user_id is null or r.status<>'ACTIVE' or c.run_id<>r.run_id or not coalesce(c.pending_revival,false) or c.player_hp<>0 then raise exception 'COMBAT_REVIVAL_INVALID';end if;
 if not p_use then update private.online_combat_states set pending_revival=false,phase='PLAYER_DEAD',updated_at=now() where user_id=u returning * into c;return private.combat_v2_payload(c,r);end if;
 r:=private.ensure_run_consumables(u,r);if coalesce(r.revival_count,0)<1 then raise exception 'COMBAT_REVIVAL_INVALID';end if;
 update private.online_expeditions set revival_count=revival_count-1,run_version=run_version+1 where user_id=u returning * into r;perform private.persist_run_bag_to_save(u,r);
 c.player_hp:=round(c.player_max_hp*.3);c.revival_count:=r.revival_count;c.pending_revival:=false;c.player_shield:=0;c.player_shield_hits:=0;c.player_effects:=private.combat_v2_remove(c.player_effects,'DEBUFF');c.player_effects:=(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(c.player_effects)x where x->>'behavior'<>'SHIELD' and x->>'effectId'<>'duelist_counter_stance');
 resume:=coalesce(c.engine_runtime->>'resumeTurn','PLAYER_TURN');c.engine_runtime:=c.engine_runtime||jsonb_build_object('events',jsonb_build_array(jsonb_build_object('kind','HEAL','attacker','player','target','player','healing',c.player_hp,'critical',false,'incomingDamage',0,'absorbedByShield',0,'hpDamage',0,'hitIndex',1,'hitCount',1)),'eventFlags',coalesce(c.engine_runtime->'eventFlags','{}')||'{"revived":true}');
 if r.pending_event is not null or c.monster_hp<=0 then
  c.phase:=case when c.monster_hp<=0 then 'DEFEATED' else 'PLAYER_TURN' end;
  update private.online_combat_states set player_hp=c.player_hp,player_shield=0,player_shield_hits=0,player_effects=c.player_effects,engine_runtime=c.engine_runtime,revival_count=c.revival_count,pending_revival=false,phase=c.phase,state_version=state_version+1,updated_at=now() where user_id=u returning * into c;
  return private.combat_v2_payload(c,r)||jsonb_build_object('revivalCount',r.revival_count);
 end if;
 if resume='MONSTER_TURN' then c.engine_runtime:=c.engine_runtime||'{"skipPlayerEnd":true}';
 else c.monster_effects:=private.combat_v2_tick(c.monster_effects,c.monster_turn);c:=private.combat_v2_player_start(c);c.engine_runtime:=c.engine_runtime||'{"skipRound":true}';end if;
 result:=private.finish_server_player_action(u,r,c,c.action_nonce,0);return result||jsonb_build_object('revivalCount',r.revival_count);
end $$;
