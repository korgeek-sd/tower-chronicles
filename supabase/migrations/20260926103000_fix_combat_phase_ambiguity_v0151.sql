-- v0.1.51 runtime hotfix: disambiguate the canonical combat phase variable.

create or replace function private.finish_server_player_action(
 p_user uuid,p_run private.online_expeditions,p_combat private.online_combat_states,p_nonce bigint,p_damage bigint
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
 direct_damage bigint:=greatest(0,p_damage);monster_absorb numeric:=0;player_absorb numeric:=0;step_absorb numeric:=0;
 heal bigint:=0;player_delta bigint:=0;monster_delta bigint:=0;ret bigint:=0;reactive_damage bigint:=0;
 kill_no bigint;inserted_kill bigint;next_phase text:='PLAYER_TURN';turn_result jsonb;monster_action jsonb;
 reaction_id text;drop jsonb;tl jsonb;boss boolean:=false;step jsonb;
begin
 -- Legacy single-hit skill path. Basic/job multihits already use server_apply_player_hit.
 if direct_damage>0 then
   if p_combat.monster_shield_hits>0 then
     p_combat.monster_shield_hits:=p_combat.monster_shield_hits-1;monster_absorb:=direct_damage;direct_damage:=0;
   else
     step_absorb:=least(p_combat.monster_shield,direct_damage);monster_absorb:=step_absorb;
     p_combat.monster_shield:=p_combat.monster_shield-step_absorb;direct_damage:=direct_damage-step_absorb;
   end if;
   p_combat.monster_hp:=greatest(0,p_combat.monster_hp-direct_damage);
   if p_combat.accessory_passive='vampire' and direct_damage>0 then
     heal:=floor(direct_damage*p_combat.accessory_value);
     p_combat.player_hp:=least(p_combat.player_max_hp,p_combat.player_hp+heal);
   end if;
 end if;

 if direct_damage>0 and p_combat.monster_hp>0 and p_combat.monster_reactive_action is not null then
   reaction_id:=p_combat.monster_reactive_action;p_combat.monster_reactive_action:=null;
   step:=private.server_apply_monster_hit(p_combat,private.server_reactive_multiplier(reaction_id),p_nonce,900);
   select * into p_combat from jsonb_populate_record(null::private.online_combat_states,step->'state');
   reactive_damage:=coalesce((step->>'damage')::bigint,0);
   player_absorb:=player_absorb+coalesce((step->>'absorbed')::numeric,0);
 end if;

 if p_combat.monster_hp>0 and p_combat.player_hp>0 then
   player_delta:=private.effect_periodic_delta(p_combat.player_effects,p_combat.player_max_hp,p_combat.player_turn);
   if player_delta<0 and p_combat.player_shield_hits>0 then
     p_combat.player_shield_hits:=p_combat.player_shield_hits-1;player_absorb:=player_absorb-player_delta;player_delta:=0;
   elsif player_delta<0 and p_combat.player_shield>0 then
     step_absorb:=least(p_combat.player_shield,-player_delta);player_absorb:=player_absorb+step_absorb;
     p_combat.player_shield:=p_combat.player_shield-step_absorb;player_delta:=player_delta+step_absorb;
   end if;
   p_combat.player_hp:=greatest(0,least(p_combat.player_max_hp,p_combat.player_hp+player_delta));
   p_combat.player_effects:=private.effect_tick(p_combat.player_effects,p_combat.player_turn);
 end if;

 if p_combat.monster_hp>0 and p_combat.player_hp>0 then
   turn_result:=private.resolve_server_monster_turn_v2(p_combat,p_nonce);
   select * into p_combat from jsonb_populate_record(null::private.online_combat_states,turn_result->'state');
   monster_action:=turn_result->'action';ret:=coalesce((turn_result->>'damage')::bigint,0);
   player_absorb:=player_absorb+coalesce((turn_result->>'absorbed')::numeric,0);
   monster_delta:=private.effect_periodic_delta(p_combat.monster_effects,p_combat.monster_max_hp,p_combat.monster_turn);
   if monster_delta<0 and p_combat.monster_shield_hits>0 then
     p_combat.monster_shield_hits:=p_combat.monster_shield_hits-1;monster_absorb:=monster_absorb-monster_delta;monster_delta:=0;
   elsif monster_delta<0 and p_combat.monster_shield>0 then
     step_absorb:=least(p_combat.monster_shield,-monster_delta);monster_absorb:=monster_absorb+step_absorb;
     p_combat.monster_shield:=p_combat.monster_shield-step_absorb;monster_delta:=monster_delta+step_absorb;
   end if;
   p_combat.monster_hp:=greatest(0,least(p_combat.monster_max_hp,p_combat.monster_hp+monster_delta));
   p_combat.monster_effects:=private.effect_tick(p_combat.monster_effects,p_combat.monster_turn);
 end if;

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
   p_combat.player_turn:=p_combat.player_turn+1;next_phase:='PLAYER_TURN';
 end if;

 update private.online_combat_states set
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

 return jsonb_build_object(
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
end $$;
revoke all on function private.finish_server_player_action(uuid,private.online_expeditions,private.online_combat_states,bigint,bigint)
 from public,anon,authenticated;

