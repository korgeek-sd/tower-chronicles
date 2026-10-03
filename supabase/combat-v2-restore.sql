CREATE OR REPLACE FUNCTION public.restore_online_expedition(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u uuid;
  r private.online_expeditions%rowtype;
  c private.online_combat_states%rowtype;
  temporary_loot jsonb;
  stones bigint:=0;
begin
  u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
  select * into r from private.online_expeditions where user_id=u;
  if not found or r.status<>'ACTIVE' then return jsonb_build_object('active',false);end if;

  r:=private.ensure_run_consumables(u,r);
  select * into c from private.online_combat_states where user_id=u and run_id=r.run_id;

  stones:=private.server_run_enhancement_stones(r);
  temporary_loot:=jsonb_set(
    coalesce(r.temporary_loot,'{}'::jsonb),
    '{enhancementStones}',
    to_jsonb(stones),
    true
  );

  return jsonb_build_object(
    'active',true,
    'run',jsonb_build_object(
      'runId',r.run_id,
      'tower',r.tower,
      'floor',r.floor,
      'confirmedKills',r.confirmed_kills,
      'encounterIndex',r.encounter_index,
      'bossProgress',r.boss_progress,
      'bossDefeated',r.boss_defeated,
      'pendingEvent',r.pending_event,
      'temporaryLoot',temporary_loot,
      'stronghold',r.stronghold,
      'runVersion',r.run_version,'healingPotionUses',r.healing_potion_uses,
      'potions',jsonb_build_object(
        'lesser',r.potion_lesser,
        'standard',r.potion_standard,
        'greater',r.potion_greater,
        'supreme',r.potion_supreme,
        'revival',r.revival_count
      )
    ),
    'combat',case when c.user_id is null then null else private.combat_v2_payload(c,r)||jsonb_build_object(
      'encounterIndex',c.encounter_index,
      'monsterId',c.monster_id,
      'monsterHp',c.monster_hp,
      'monsterMaxHp',c.monster_max_hp,
      'monsterAttack',c.monster_attack,
      'monsterDefense',c.monster_defense,
      'playerHp',c.player_hp,
      'playerMaxHp',c.player_max_hp,
      'playerShield',c.player_shield,
      'monsterShield',c.monster_shield,
      'playerShieldHits',c.player_shield_hits,
      'monsterShieldHits',c.monster_shield_hits,
      'playerEffects',c.player_effects,
      'monsterEffects',c.monster_effects,
      'monsterCooldowns',c.monster_cooldowns,
      'monsterPreparedAction',c.monster_prepared_action,
      'monsterReactiveAction',c.monster_reactive_action,
      'jobId',c.job_id,
      'jobResource',c.job_resource,
      'jobFlags',c.job_flags,
      'playerCooldowns',c.cooldowns,
      'stateVersion',c.state_version,
      'playerTurn',c.player_turn,
      'monsterTurn',c.monster_turn,
      'turnNo',c.turn_no,
      'phase',c.phase,
      'pendingRevival',c.pending_revival,
      'actionNonce',c.action_nonce,
      'returnAuthorized',c.return_authorized
    ) end
  );
end;$function$
;

