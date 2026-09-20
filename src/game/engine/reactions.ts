import type { CombatActor, Expedition, GameState } from '../types';
import type { MonsterSkillDefinition } from './monsterAi';
import { monsterDefinitionById } from './monsterAi';

export interface ReactionHandlerResult {
  consumed: boolean;
  incomingDamageMultiplier?: number;
  counterMultiplier?: number;
  counterHits?: number;
  logMessage?: string;
}

export interface JobReactionPrepared {
  trigger: 'DIRECT_HIT_RECEIVED';
  incomingDamageMultiplier?: number;
  counterMultiplier?: number;
  counterHits?: number;
  consumeOnTrigger?: boolean;
}

export const emptyReactivePrepared = () => ({ player: null, monster: null } satisfies Expedition['reactivePrepared']);

export function prepareReactive(e: Expedition, actor: CombatActor, definitionId: string, prepareSkill: MonsterSkillDefinition) {
  if (prepareSkill.kind !== 'reactive_prepare' || !prepareSkill.reactionSkillId || prepareSkill.reactiveTrigger !== 'DIRECT_HIT_RECEIVED') return false;
  e.reactivePrepared[actor] = { definitionId, prepareSkillId: prepareSkill.id, reactionSkillId: prepareSkill.reactionSkillId, trigger: prepareSkill.reactiveTrigger };
  return true;
}

export function clearReactivePrepared(e: Expedition) {
  e.reactivePrepared = emptyReactivePrepared();
}

export function reactivePreparedSkill(e: Expedition, actor: CombatActor) {
  const pending = e.reactivePrepared[actor];
  if (!pending) return;
  const definition = monsterDefinitionById(pending.definitionId),
    prepare = definition?.skills?.find(skill => skill.id === pending.prepareSkillId),
    reaction = definition?.skills?.find(skill => skill.id === pending.reactionSkillId);
  return prepare?.kind === 'reactive_prepare' && reaction && reaction.kind !== 'reactive_prepare' && reaction.kind !== 'charge'
    ? { pending, prepare, reaction }
    : undefined;
}

export function consumeDirectHitReaction(e: Expedition, target: CombatActor): { pending: any; prepare: MonsterSkillDefinition; reaction: MonsterSkillDefinition } | undefined {
  const found = reactivePreparedSkill(e, target);
  if (!found) return;
  e.reactivePrepared[target] = null;
  return found;
}

export function checkJobPreparedReaction(e: Expedition, target: CombatActor): JobReactionPrepared | undefined {
  const prepared = e.preparedEffects.find(ef => ef.targetActorId === target && ef.remainingDuration > 0);
  if (prepared && prepared.currentShieldHits) {
    return {
      trigger: 'DIRECT_HIT_RECEIVED',
      incomingDamageMultiplier: 0.6,
      counterMultiplier: 1.8,
      counterHits: 1,
      consumeOnTrigger: true,
    };
  }
  // Check active PREPARED effects for general reaction data if stored on effect or active effect graph
  const stance = (target === 'player' ? e.playerEffects : e.monsterEffects).find(ef => ef.scope === 'BATTLE' && ef.effectId.endsWith('_counter_stance'));
  if (stance) {
    return {
      trigger: 'DIRECT_HIT_RECEIVED',
      incomingDamageMultiplier: 0.6,
      counterMultiplier: 1.8,
      counterHits: 1,
      consumeOnTrigger: true,
    };
  }
  return undefined;
}

export function consumeJobPreparedReaction(e: Expedition, target: CombatActor) {
  const list = target === 'player' ? e.playerEffects : e.monsterEffects;
  const idx = list.findIndex(ef => ef.scope === 'BATTLE' && ef.effectId.endsWith('_counter_stance'));
  if (idx !== -1) {
    list.splice(idx, 1);
  }
}
