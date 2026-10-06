CREATE OR REPLACE FUNCTION private.server_start_encounter(p_user uuid, p_run private.online_expeditions, p_profile jsonb, p_prior private.online_combat_states)
 RETURNS private.online_combat_states
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 s public.game_saves%rowtype;combat_payload jsonb;st jsonb;passive jsonb;j text;c private.online_combat_states%rowtype;
 hp bigint;mh bigint;ma numeric;md numeric;weapon text;crit numeric;hits int;
 pe jsonb:='[]'::jsonb;me jsonb:='[]'::jsonb;nextcd jsonb:='{}'::jsonb;statev bigint:=1;
begin
 select * into s from public.game_saves where user_id=p_user;if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 combat_payload:=private.server_authoritative_payload(p_user,s.payload);
 combat_payload:=jsonb_set(combat_payload,'{expedition,equipment}',coalesce(p_run.equipment_snapshot,'{}'::jsonb),true);
 combat_payload:=jsonb_set(combat_payload,'{currentJobId}',
   case when p_run.job_snapshot_id is null then 'null'::jsonb else to_jsonb(p_run.job_snapshot_id) end,true);
 st:=private.combat_equipment_stats(p_user,combat_payload);
 passive:=private.combat_accessory_passive(combat_payload);
 j:=private.server_job_id(jsonb_build_object('expedition',jsonb_build_object('jobSnapshotId',p_run.job_snapshot_id)));

 if p_prior.user_id is not null then
   pe:=(select coalesce(jsonb_agg(e),'[]'::jsonb) from jsonb_array_elements(coalesce(p_prior.player_effects,'[]'::jsonb))e where e->>'scope'='EXPEDITION');
   select coalesce(jsonb_object_agg(key,to_jsonb(greatest(0,(value#>>'{}')::int-1))),'{}'::jsonb)
   into nextcd from jsonb_each(coalesce(p_prior.cooldowns,'{}'::jsonb));
   statev:=p_prior.state_version+1;
 end if;
 hp:=least((st->>'hp')::bigint,greatest(1,coalesce(p_prior.player_hp,(st->>'hp')::bigint)));
 mh:=round(private.server_monster_hp(p_run.floor)*(p_profile->>'hpMultiplier')::numeric);
 ma:=private.server_monster_attack(p_run.floor)*(p_profile->>'attackMultiplier')::numeric;
 md:=private.server_monster_defense(p_run.floor)+coalesce((p_profile->>'defenseBonus')::numeric,0);
 weapon:=st->>'weapon';crit:=case weapon when 'dagger' then .2 else .05 end;hits:=case when weapon='bow' then 2 else 1 end;
 me:=private.server_initial_monster_effects(p_profile->>'id',coalesce(p_prior.monster_turn,0));

 insert into private.online_combat_states(
   user_id,run_id,encounter_index,monster_id,player_hp,player_max_hp,player_attack,player_defense,
   monster_hp,monster_max_hp,monster_attack,monster_defense,turn_no,phase,action_nonce,
   potion_lesser,potion_standard,potion_greater,potion_supreme,cooldowns,rng_seed,crit_chance,crit_damage,basic_hits,
   skill_power,guard_turns,revival_count,pending_revival,accessory_passive,accessory_value,
   player_effects,monster_effects,player_shield,monster_shield,monster_cooldowns,monster_prepared_action,
   job_id,job_resource,job_flags,state_version,player_turn,monster_turn,player_shield_hits,monster_shield_hits,
   monster_reactive_action,return_authorized,updated_at
 ) values(
   p_user,p_run.run_id,p_run.encounter_index,p_profile->>'id',hp,(st->>'hp')::bigint,(st->>'attack')::numeric,(st->>'defense')::numeric,
   mh,mh,ma,md,1,'PLAYER_TURN',0,
   coalesce(p_run.potion_lesser,0),coalesce(p_run.potion_standard,0),coalesce(p_run.potion_greater,0),coalesce(p_run.potion_supreme,0),
   nextcd,p_run.reward_seed,crit,1.5,hits,private.combat_skill_power(combat_payload),0,coalesce(p_run.revival_count,0),false,
   passive->>'kind',coalesce((passive->>'value')::numeric,0),
   pe,me,0,0,'{}'::jsonb,null,j,case when j='berserker' then coalesce(p_prior.job_resource,0) else 0 end,
   coalesce(p_prior.job_flags,'{}'::jsonb),statev,coalesce(p_prior.player_turn,0)+1,coalesce(p_prior.monster_turn,0),0,0,null,false,now()
 )
 on conflict(user_id) do update set
   run_id=excluded.run_id,encounter_index=excluded.encounter_index,monster_id=excluded.monster_id,
   player_hp=excluded.player_hp,player_max_hp=excluded.player_max_hp,player_attack=excluded.player_attack,player_defense=excluded.player_defense,
   monster_hp=excluded.monster_hp,monster_max_hp=excluded.monster_max_hp,monster_attack=excluded.monster_attack,monster_defense=excluded.monster_defense,
   turn_no=1,phase='PLAYER_TURN',action_nonce=0,potion_lesser=excluded.potion_lesser,potion_standard=excluded.potion_standard,
   potion_greater=excluded.potion_greater,potion_supreme=excluded.potion_supreme,cooldowns=excluded.cooldowns,rng_seed=excluded.rng_seed,
   crit_chance=excluded.crit_chance,crit_damage=excluded.crit_damage,basic_hits=excluded.basic_hits,skill_power=excluded.skill_power,
   guard_turns=0,revival_count=excluded.revival_count,pending_revival=false,accessory_passive=excluded.accessory_passive,
   accessory_value=excluded.accessory_value,player_effects=excluded.player_effects,monster_effects=excluded.monster_effects,
   player_shield=0,monster_shield=0,monster_cooldowns='{}'::jsonb,monster_prepared_action=null,job_id=excluded.job_id,
   job_resource=excluded.job_resource,job_flags=excluded.job_flags,state_version=excluded.state_version,
   player_turn=excluded.player_turn,monster_turn=excluded.monster_turn,player_shield_hits=0,monster_shield_hits=0,
   monster_reactive_action=null,return_authorized=false,updated_at=now()
 returning * into c;

 if c.monster_id='sanctuary_talon_bishop' then c:=private.sync_server_shield(c,'monster','blood_rite_ward');end if;
 update private.online_combat_states set
   monster_shield=c.monster_shield,monster_shield_hits=c.monster_shield_hits,monster_effects=c.monster_effects
 where user_id=p_user returning * into c;
 c:=private.combat_v2_initialize(c,true);
 update private.online_combat_states set engine_runtime=c.engine_runtime,player_hp=c.player_hp,player_turn=c.player_turn,monster_turn=c.monster_turn,cooldowns=c.cooldowns,monster_cooldowns=c.monster_cooldowns,job_resource=0,job_flags='{}',player_effects=c.player_effects,monster_effects=c.monster_effects,player_shield=0,monster_shield=c.monster_shield,monster_prepared_action=null,monster_reactive_action=null where user_id=p_user returning * into c;
 return c;
end $function$
;
CREATE OR REPLACE FUNCTION public.begin_online_combat_state_v2(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;
 prior private.online_combat_states%rowtype;profile jsonb;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u for update;
 if not found or r.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 r:=private.ensure_run_consumables(u,r);
 select * into c from private.online_combat_states where user_id=u for update;

 if c.user_id is not null and c.run_id=r.run_id then
   if c.phase='DEFEATED' then raise exception 'EXPEDITION_CONTINUE_REQUIRED';end if;
   return private.combat_v2_payload(c,r)||jsonb_build_object(
    'encounterIndex',c.encounter_index,'monsterId',c.monster_id,'monsterHp',c.monster_hp,'monsterMaxHp',c.monster_max_hp,
    'monsterAttack',c.monster_attack,'monsterDefense',c.monster_defense,
    'playerHp',c.player_hp,'playerMaxHp',c.player_max_hp,'playerShield',c.player_shield,'monsterShield',c.monster_shield,
    'playerShieldHits',c.player_shield_hits,'monsterShieldHits',c.monster_shield_hits,
    'playerEffects',c.player_effects,'monsterEffects',c.monster_effects,'playerCooldowns',c.cooldowns,
    'monsterCooldowns',c.monster_cooldowns,'monsterPreparedAction',c.monster_prepared_action,
    'monsterReactiveAction',c.monster_reactive_action,'jobId',c.job_id,'jobResource',c.job_resource,'jobFlags',c.job_flags,
    'stateVersion',c.state_version,'playerTurn',c.player_turn,'monsterTurn',c.monster_turn,'turnNo',c.turn_no,
    'phase',c.phase,'pendingRevival',c.pending_revival,'actionNonce',c.action_nonce,'returnAuthorized',c.return_authorized,
    'confirmedKills',r.confirmed_kills,'runVersion',r.run_version
   );
 end if;

 prior:=null::private.online_combat_states;
 if r.pending_event is not null then raise exception 'EXPEDITION_EVENT_PENDING';end if;
 if r.encounter_index<1 then
   update private.online_expeditions set encounter_index=1,run_version=run_version+1 where user_id=u returning * into r;
 end if;
 profile:=private.server_monster_profile(r.tower,r.floor,r.reward_seed,r.encounter_index);
 c:=private.server_start_encounter(u,r,profile,prior);
 return private.combat_v2_payload(c,r)||jsonb_build_object(
   'encounterIndex',c.encounter_index,'monsterId',c.monster_id,'monsterHp',c.monster_hp,'monsterMaxHp',c.monster_max_hp,
   'monsterAttack',c.monster_attack,'monsterDefense',c.monster_defense,
   'playerHp',c.player_hp,'playerMaxHp',c.player_max_hp,'playerShield',c.player_shield,'monsterShield',c.monster_shield,
   'playerShieldHits',c.player_shield_hits,'monsterShieldHits',c.monster_shield_hits,
   'playerEffects',c.player_effects,'monsterEffects',c.monster_effects,'playerCooldowns',c.cooldowns,
   'monsterCooldowns',c.monster_cooldowns,'monsterPreparedAction',c.monster_prepared_action,
   'monsterReactiveAction',c.monster_reactive_action,'jobId',c.job_id,'jobResource',c.job_resource,'jobFlags',c.job_flags,
   'stateVersion',c.state_version,'playerTurn',c.player_turn,'monsterTurn',c.monster_turn,'turnNo',c.turn_no,
   'phase',c.phase,'pendingRevival',c.pending_revival,'actionNonce',c.action_nonce,'returnAuthorized',c.return_authorized,
   'confirmedKills',r.confirmed_kills,'runVersion',r.run_version
 );
end $function$
;

