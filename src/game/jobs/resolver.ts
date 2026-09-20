import type { Expedition, GameState } from '../types';
import { getJobCombatDefinition, modifyJobResource, setJobFlag, getJobFlag } from './framework';
import { applyEffect, hasEffect, removeEffectsByTag } from '../engine/effects';
import { log, stats } from '../engine/state';
import { directHitLog, resolveActorDirectHits } from '../engine/monsterSkills';

export function evaluateJobCondition(
  s: GameState,
  cond: any,
  context: { actionType?: 'BASIC' | 'SKILL'; isDirectHit?: boolean }
): boolean {
  const e = s.expedition;
  if (!e) return false;
  const maxHp = stats(s, e.equipment).hp;
  const hpRatio = e.hp / maxHp;
  const monsterHpRatio = e.monster.currentHp / e.monster.hp;

  switch (cond.kind) {
    case 'SELF_HP_RATIO_LE':
      return hpRatio <= cond.ratio;
    case 'SELF_HP_RATIO_GT':
      return hpRatio > cond.ratio;
    case 'TARGET_HP_RATIO_LE':
      return monsterHpRatio <= cond.ratio;
    case 'TARGET_HAS_EFFECT':
      return hasEffect(e.monsterEffects, cond.effectId);
    case 'SELF_HAS_EFFECT':
      return hasEffect(e.playerEffects, cond.effectId);
    case 'RESOURCE_GE':
      return (e.jobRuntime.resource?.value ?? 0) >= cond.amount;
    case 'FLAG_IS':
      return getJobFlag(e.jobRuntime, cond.flag) === cond.value;
    case 'ACTION_IS_BASIC_ATTACK':
      return context.actionType === 'BASIC';
    case 'ACTION_IS_SKILL':
      return context.actionType === 'SKILL';
    case 'IS_DIRECT_HIT':
      return !!context.isDirectHit;
    default:
      return true;
  }
}

export function applyJobDamageTakenHooks(s: GameState, rawDamage: number, isDirectHit: boolean): number {
  const e = s.expedition;
  if (!e || !e.jobRuntime.jobId) return rawDamage;
  const def = getJobCombatDefinition(e.jobRuntime.jobId);
  if (!def) return rawDamage;

  let damageMultiplier = 1.0;

  for (const passive of def.passives) {
    if (!passive.hooks.includes('DAMAGE_TAKEN')) continue;
    if (passive.conditions) {
      const match = passive.conditions.every((c) => evaluateJobCondition(s, c, { isDirectHit }));
      if (!match) continue;
    }
    if (passive.effectActions) {
      for (const act of passive.effectActions) {
        if (act.kind === 'DAMAGE_MULTIPLIER') damageMultiplier *= act.multiplier;
      }
    }
  }

  return rawDamage * damageMultiplier;
}

export function applyJobHpTakenRageGain(s: GameState, actualHpDamage: number) {
  const e = s.expedition;
  if (!e || e.jobRuntime.jobId !== 'berserker' || actualHpDamage <= 0) return;
  const maxHp = stats(s, e.equipment).hp;
  const rageGain = Math.floor((actualHpDamage / maxHp) * 100);
  if (rageGain > 0) {
    modifyJobResource(e.jobRuntime, rageGain);
    log(s, `피격 분노 수급 +${rageGain} (현재 분노: ${e.jobRuntime.resource?.value})`);
  }
}

export function checkJobHpThresholdHooks(s: GameState) {
  const e = s.expedition;
  if (!e || !e.jobRuntime.jobId || e.hp <= 0 || e.pendingRevival) return;
  const def = getJobCombatDefinition(e.jobRuntime.jobId);
  if (!def) return;

  for (const passive of def.passives) {
    if (!passive.hooks.includes('HP_THRESHOLD')) continue;
    if (passive.conditions) {
      const match = passive.conditions.every((c) => evaluateJobCondition(s, c, {}));
      if (!match) continue;
    }
    if (passive.effectActions) {
      for (const act of passive.effectActions) {
        if (act.kind === 'HEAL_PERCENT') {
          const maxHp = stats(s, e.equipment).hp;
          const healAmount = Math.round(maxHp * act.percent);
          e.hp = Math.min(maxHp, e.hp + healAmount);
          log(s, `[응급처치] 발동 · HP ${healAmount} 회복`);
        } else if (act.kind === 'SET_FLAG') {
          setJobFlag(e.jobRuntime, act.flag, act.value);
        }
      }
    }
  }
}

export function resolveJobDirectHitMultiplier(
  s: GameState,
  actionType: 'BASIC' | 'SKILL',
  skillId?: string
): number {
  const e = s.expedition;
  if (!e || !e.jobRuntime.jobId) return 1.0;
  const def = getJobCombatDefinition(e.jobRuntime.jobId);
  if (!def) return 1.0;

  let multiplier = 1.0;

  // Passive multipliers
  for (const passive of def.passives) {
    if (!passive.hooks.includes('BEFORE_DIRECT_HIT')) continue;

    // Berserker passive 1: 피의 열기
    if (passive.id === 'berserker_passive_1') {
      const hpRatio = e.hp / stats(s, e.equipment).hp;
      if (hpRatio <= 0.2) multiplier *= 1.35;
      else if (hpRatio <= 0.4) multiplier *= 1.2;
      else if (hpRatio <= 0.7) multiplier *= 1.1;
      continue;
    }

    if (passive.conditions) {
      const match = passive.conditions.every((c) => evaluateJobCondition(s, c, { actionType, isDirectHit: true }));
      if (!match) continue;
    }
    if (passive.effectActions) {
      for (const act of passive.effectActions) {
        if (act.kind === 'DAMAGE_MULTIPLIER') multiplier *= act.multiplier;
      }
    }
  }

  return multiplier;
}

export function executeJobSkill(s: GameState, skillId: string, rng: () => number = Math.random): boolean {
  const e = s.expedition;
  if (!e || !e.jobRuntime.jobId) return false;
  const def = getJobCombatDefinition(e.jobRuntime.jobId);
  if (!def) return false;

  const skill = def.skills.find((sk) => sk.id === skillId);
  if (!skill) return false;

  // Check conditions
  if (skill.conditions) {
    const match = skill.conditions.every((c) => evaluateJobCondition(s, c, { actionType: 'SKILL' }));
    if (!match) {
      log(s, `[${skill.name}] 사용 조건을 만족하지 못했습니다.`);
      return false;
    }
  }

  e.cooldowns['turn:' + skillId] = skill.cooldown;

  // Handle specific skill logic
  const targetHpRatio = e.monster.currentHp / e.monster.hp;

  const jobMult = resolveJobDirectHitMultiplier(s, 'SKILL', skillId);

  if (skillId === 'mercenary_skill_1') {
    // 강타 (180%)
    const hit = resolveActorDirectHits(s, 'player', 1, 1.8 * stats(s, e.equipment).skillPower * jobMult, true, rng);
    log(s, `[강타] · ${hit.total} 피해${hit.resolutions[0]?.critical ? ' · 치명타!' : ''}`);
  } else if (skillId === 'mercenary_skill_2') {
    // 방패 올리기 (2턴간 피해 -25%)
    applyEffect(e, 'player', 'mercenary_guard', 'player', e.playerTurn);
    log(s, `[방패 올리기] 사용 · 2턴 동안 받는 피해 25% 감소`);
  } else if (skillId === 'mercenary_skill_3') {
    // 빈틈 찌르기 (기본 130%, 적 HP <= 40% 면 200%)
    const mult = targetHpRatio <= 0.4 ? 2.0 : 1.3;
    const hit = resolveActorDirectHits(s, 'player', 1, mult * stats(s, e.equipment).skillPower * jobMult, true, rng);
    log(s, `[빈틈 찌르기] · ${hit.total} 피해${mult === 2.0 ? ' (약점 포착!)' : ''}`);
  } else if (skillId === 'hunter_skill_1') {
    // 사냥감 표식 (hunter_mark 3턴)
    applyEffect(e, 'monster', 'hunter_mark', 'player', e.playerTurn);
    log(s, `[사냥감 표식] 사용 · 적에게 표식 적용`);
  } else if (skillId === 'hunter_skill_2') {
    // 연속 사격 (기본 2타, 표식 시 3타)
    const hasMark = hasEffect(e.monsterEffects, 'hunter_mark');
    const hits = hasMark ? 3 : 2;
    const res = resolveActorDirectHits(s, 'player', hits, 0.7 * stats(s, e.equipment).skillPower * jobMult, true, rng);
    log(s, `[연속 사격] ${hits}연타 · 총 ${res.total} 피해`);
  } else if (skillId === 'hunter_skill_3') {
    // 마무리 사격 (기본 170%, 표식 + 적 HP <= 35% 면 280%)
    const hasMark = hasEffect(e.monsterEffects, 'hunter_mark');
    const mult = hasMark && targetHpRatio <= 0.35 ? 2.8 : 1.7;
    const res = resolveActorDirectHits(s, 'player', 1, mult * stats(s, e.equipment).skillPower * jobMult, true, rng);
    log(s, `[마무리 사격] · ${res.total} 피해${mult === 2.8 ? ' (치명적 마무리!)' : ''}`);
  } else if (skillId === 'field_medic_skill_1') {
    // 응급 치료 (Max HP 20% 회복)
    const maxHp = stats(s, e.equipment).hp;
    const amount = Math.round(maxHp * 0.2);
    e.hp = Math.min(maxHp, e.hp + amount);
    log(s, `[응급 치료] 사용 · HP ${amount} 회복`);
  } else if (skillId === 'field_medic_skill_2') {
    // 지혈 (BLEED 제거 후 3턴간 HOT 5%)
    removeEffectsByTag(e, 'player', 'BLEED');
    applyEffect(e, 'player', 'field_medic_regen', 'player', e.playerTurn);
    log(s, `[지혈] 사용 · 출혈 제거 및 지혈 재생 효과 적용`);
  } else if (skillId === 'field_medic_skill_3') {
    // 진통제 (2턴간 피해 -30%)
    applyEffect(e, 'player', 'field_medic_analgesic', 'player', e.playerTurn);
    log(s, `[진통제] 사용 · 2턴 동안 받는 피해 30% 감소`);
  } else if (skillId === 'duelist_skill_1') {
    // 찌르기 (160%)
    const res = resolveActorDirectHits(s, 'player', 1, 1.6 * stats(s, e.equipment).skillPower * jobMult, true, rng);
    log(s, `[찌르기] · ${res.total} 피해`);
  } else if (skillId === 'duelist_skill_2') {
    // 받아치기 (Reaction)
    applyEffect(e, 'player', 'duelist_counter_stance', 'player', e.playerTurn);
    log(s, `[받아치기] 준비 · 적의 다음 공격 시 40% 피해 감소 및 180% 반격`);
  } else if (skillId === 'duelist_skill_3') {
    // 결착 (기본 220%, 적 HP <= 30% 면 320%)
    const mult = targetHpRatio <= 0.3 ? 3.2 : 2.2;
    const res = resolveActorDirectHits(s, 'player', 1, mult * stats(s, e.equipment).skillPower * jobMult, true, rng);
    log(s, `[결착] · ${res.total} 피해${mult === 3.2 ? ' (결착 일격!)' : ''}`);
  } else if (skillId === 'berserker_skill_1') {
    // 난도질 (75% x 2, Rage +10)
    modifyJobResource(e.jobRuntime, 10);
    const res = resolveActorDirectHits(s, 'player', 2, 0.75 * stats(s, e.equipment).skillPower * jobMult, true, rng);
    log(s, `[난도질] 2연타 · 총 ${res.total} 피해 (분노 +10)`);
  } else if (skillId === 'berserker_skill_2') {
    // 피의 대가 (Max HP 10% 소비, 최소 1 보장, Rage +25, 3턴간 피해 +25%)
    const maxHp = stats(s, e.equipment).hp;
    const cost = Math.round(maxHp * 0.1);
    e.hp = Math.max(1, e.hp - cost);
    modifyJobResource(e.jobRuntime, 25);
    applyEffect(e, 'player', 'berserker_blood_boost', 'player', e.playerTurn);
    log(s, `[피의 대가] 사용 · HP ${cost} 소비 (분노 +25, 공격 피해 +25%)`);
  } else if (skillId === 'berserker_skill_3') {
    // 폭주 (Rage >= 60 -> -60, 100% x 3, 적 HP <= 30% 면 막타 150%)
    modifyJobResource(e.jobRuntime, -60);
    const isLow = targetHpRatio <= 0.3;
    let totalDamage = 0;
    for (let hitIdx = 0; hitIdx < 3; hitIdx++) {
      if (e.hp <= 0 || e.monster.currentHp <= 0 || e.pendingRevival) break;
      const lastMult = (hitIdx === 2 && isLow) ? 1.5 : 1.0;
      const res = resolveActorDirectHits(s, 'player', 1, lastMult * stats(s, e.equipment).skillPower * jobMult, true, rng);
      totalDamage += res.total;
    }
    log(s, `[폭주] 3연타 · 총 ${totalDamage} 피해 (분노 -60 사용${isLow ? ' · 막타 강화!' : ''})`);
  }

  return true;
}
