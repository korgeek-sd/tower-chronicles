import {applyHealing} from '../engine/healing';
import {gainCombatResource,spendCombatResource} from '../engine/combatResource';
import {setSkillCooldown} from '../engine/cooldowns';
import type { Expedition, GameState } from '../types';
import type { CombatHook, JobCondition, JobEffectAction, JobHookContext } from './framework';
import { getJobCombatDefinition, modifyJobResource, setJobFlag, getJobFlag } from './framework';
import { applyEffect, cleanseEffects,dispelEffects,hasEffect, removeEffectsByTag } from '../engine/effects';
import { log, stats } from '../engine/state';
import { resolveActorDirectHits } from '../engine/monsterSkills';
import { random } from '../events/rng';

export function evaluateJobCondition(
  s: GameState,
  cond: JobCondition,
  context: JobHookContext = {}
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
    case 'RESOURCE_SPENT_GE':return (context.resourceSpent??0)>=cond.amount;
    case 'RESOURCE_GE':
      return (e.jobRuntime.resource?.value ?? 0) >= cond.amount;
    case 'FLAG_IS':
      return getJobFlag(e.jobRuntime, cond.flag) === cond.value;
    case 'ACTION_IS_BASIC_ATTACK':
      return context.actionType === 'BASIC';
    case 'ACTION_IS_SKILL':
      return context.actionType === 'SKILL';
    case 'ACTION_IS_POTION':
      return context.actionType === 'POTION';
    case 'IS_DIRECT_HIT':
      return !!context.isDirectHit;
    case 'ALL':
      return cond.conditions.every((c) => evaluateJobCondition(s, c, context));
    default:
      return true;
  }
}

export function runJobHook(
  s: GameState,
  hook: CombatHook,
  context: JobHookContext = {},
  rng: () => number = random
): { damageMultiplier: number; healMultiplier: number } {
  const e = s.expedition;
  if (!e || !e.jobRuntime.jobId) return { damageMultiplier: 1.0, healMultiplier: 1.0 };
  const def = getJobCombatDefinition(e.jobRuntime.jobId);
  if (!def) return { damageMultiplier: 1.0, healMultiplier: 1.0 };

  let damageMultiplier = 1.0;
  let healMultiplier = 1.0;

  for (const passive of def.passives) {
    if (!passive.hooks.includes(hook)) continue;

    if (passive.conditions) {
      const match = passive.conditions.every((c) => evaluateJobCondition(s, c, context));
      if (!match) continue;
    }

    if (passive.effectActions) {
      for (const act of passive.effectActions) {
        if (act.kind === 'DAMAGE_MULTIPLIER') {
          damageMultiplier *= act.multiplier;
        } else if (act.kind === 'MODIFY_HEAL_MULTIPLIER') {
          healMultiplier *= act.multiplier;
        } else if (act.kind === 'GAIN_RESOURCE_FROM_HP_DAMAGE' && context.actualHpDamage && context.actualHpDamage > 0) {
          const maxHp = stats(s, e.equipment).hp;
          const rageGain = Math.max(1,Math.floor((context.actualHpDamage / maxHp) * 4));
          if (rageGain > 0) {
            gainCombatResource(e, rageGain);
            log(s, `피격 분노 수급 +${rageGain} (현재 분노: ${e.jobRuntime.resource?.value})`);
          }
        } else if (act.kind === 'HEAL_PERCENT') {
          const maxHp = stats(s, e.equipment).hp;
          const healAmount = Math.round(maxHp * act.percent);
          applyHealing(s,'player',healAmount,{canCrit:true,rng});
          log(s, `[응급처치] 발동 · HP ${healAmount} 회복`);
        } else if (act.kind === 'SET_FLAG') {
          setJobFlag(e.jobRuntime, act.flag, act.value);
        } else if (act.kind === 'CHANCE_REACTION' && context.isDirectHit) {
          if (context.actor === 'player' && rng() < act.chance) {
            log(s, `[${passive.name}] 반격 발동!`);
            resolveActorDirectHits(s, 'player', 1, act.multiplier * stats(s, e.equipment).skillPower, false, rng);
          }
        }
      }
    }
  }

  return { damageMultiplier, healMultiplier };
}

export function applyJobDamageTakenHooks(s: GameState, rawDamage: number, isDirectHit: boolean, rng: () => number = random): number {
  const { damageMultiplier } = runJobHook(s, 'BEFORE_DAMAGE_TAKEN', { isDirectHit, damage: rawDamage, actor: 'player' }, rng);
  return rawDamage * damageMultiplier;
}

export function notifyJobHpDamageTaken(s: GameState, actualHpDamage: number, rng: () => number = random,allowReactive=true) {
  runJobHook(s, 'AFTER_DAMAGE_TAKEN', { isDirectHit: allowReactive, actualHpDamage, actor: 'player' }, rng);
}

export function checkJobHpThresholdHooks(s: GameState, rng: () => number = random) {
  const e = s.expedition;
  if (!e || !e.jobRuntime.jobId || e.hp <= 0 || e.pendingRevival) return;
  runJobHook(s, 'HP_THRESHOLD', { actor: 'player' }, rng);
}

export function resolveJobDirectHitMultiplier(
  s: GameState,
  actionType: 'BASIC' | 'SKILL',
  skillId?: string,
  rng: () => number = Math.random
): number {
  const { damageMultiplier } = runJobHook(s, 'BEFORE_DIRECT_HIT', { actionType, skillId, isDirectHit: true, actor: 'player' }, rng);
  return damageMultiplier;
}

export function executeJobSkill(s: GameState, skillId: string, rng: () => number = random): boolean {
  const e = s.expedition;
  if (!e || !e.jobRuntime.jobId) return false;
  const def = getJobCombatDefinition(e.jobRuntime.jobId);
  if (!def) return false;

  const skill = def.skills.find((sk) => sk.id === skillId);
  if (!skill) return false;

  if (skill.conditions) {
    const match = skill.conditions.every((c) => evaluateJobCondition(s, c, { actionType: 'SKILL', skillId }));
    if (!match) {
      log(s, `[${skill.name}] 사용 조건을 만족하지 못했습니다.`);
      return false;
    }
  }

  const spent=spendCombatResource(e,skill.resource??{kind:'NEUTRAL'});
  if(spent===null)return false;
  setSkillCooldown(e,'player',skillId,skill.cooldown);
  let successfulHits=0;
  const offensive=skill.effectActions.some(a=>a.kind==='DIRECT_ATTACK');
  const jobMult = resolveJobDirectHitMultiplier(s, 'SKILL', skillId,rng);

  for (const act of skill.effectActions) {
    if (e.hp <= 0 || e.monster.currentHp<=0 || e.pendingRevival) break;

    switch (act.kind) {
      case 'SET_FLAG':setJobFlag(e.jobRuntime,act.flag,act.value);break;
      case 'CLEANSE':case 'DISPEL': {
        (act.kind==='CLEANSE'?cleanseEffects:dispelEffects)(e,act.target==='SELF'?'player':'monster',{count:act.count,tags:act.tags});break;
      }
      case 'APPLY_EFFECT': {
        const target = act.target === 'SELF' ? 'player' : 'monster';
        applyEffect(e, target, act.effectId, 'player', target === 'player' ? e.playerTurn : e.monsterTurn);
        log(s, `[${skill.name}] 사용 · ${act.target === 'SELF' ? '자신에게' : '적에게'} 효과 적용`);
        break;
      }
      case 'REMOVE_EFFECT_TAG': {
        const target = act.target === 'SELF' ? 'player' : 'monster';
        removeEffectsByTag(e, target, act.tag as any);
        log(s, `[${skill.name}] 사용 · ${act.tag} 효과 제거`);
        break;
      }
      case 'HEAL_FLAT': {
        applyHealing(s,'player',act.amount,{canCrit:true,rng});
        break;
      }
      case 'HEAL_PERCENT': {
        const maxHp = stats(s, e.equipment).hp;
        const amount = Math.round(maxHp * act.percent);
        applyHealing(s,'player',amount,{canCrit:true,rng});
        log(s, `[${skill.name}] 사용 · HP ${amount} 회복`);
        break;
      }
      case 'SELF_HP_COST_PERCENT': {
        const maxHp = stats(s, e.equipment).hp;
        const cost = Math.round(maxHp * act.percentOfMax);
        e.hp = Math.max(1, e.hp - cost);
        log(s, `[${skill.name}] 사용 · HP ${cost} 소비`);
        break;
      }
      case 'CHANGE_RESOURCE': {
        modifyJobResource(e.jobRuntime, act.delta);
        break;
      }
      case 'DIRECT_ATTACK': {
        let totalHits = act.hits;
        if (act.conditionalHits && evaluateJobCondition(s, act.conditionalHits.condition, { actionType: 'SKILL', skillId,resourceSpent:spent })) {
          totalHits = act.conditionalHits.hits;
        }

        let totalDamage = 0;
        for (let i = 0; i < totalHits; i++) {
          if (e.hp <= 0 || e.monster.currentHp <= 0 || e.pendingRevival) break;
          let mult = act.baseMultiplier;
          if (i === totalHits - 1 && act.conditionalLastHitMultiplier) {
            if (evaluateJobCondition(s, act.conditionalLastHitMultiplier.condition, { actionType: 'SKILL', skillId,resourceSpent:spent })) {
              mult = act.conditionalLastHitMultiplier.multiplier;
            }
          }
          const res = resolveActorDirectHits(s, 'player', 1, mult * stats(s, e.equipment).skillPower * jobMult, true, rng,1,{penetrationRate:act.penetrationRate,critical:act.critical,onHit:hit=>{if(hit.hpDamage>0&&hit.hpAfter>0)for(const effect of act.onHitEffects??[])applyEffect(e,'monster',effect.effectId,'player',e.monsterTurn);}});
          totalDamage += res.total;
          successfulHits+=res.triggerPoints;
        }
        log(s, `[${skill.name}] ${totalHits > 1 ? `${totalHits}연타 · ` : ''}총 ${totalDamage} 피해`);
        break;
      }
      default:throw new Error(`Unsupported active action: ${act.kind}`);
    }
  }

  if(skill.resource?.kind==='GENERATOR'&&(!offensive||successfulHits>0)&&e.hp>0&&!e.pendingRevival)gainCombatResource(e,skill.resource.gain);
  return true;
}
