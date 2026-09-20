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

export interface PreparedReactionState {
  effectId?: string;
  incomingDamageMultiplier?: number;
  counterMultiplier?: number;
  counterHits?: number;
  logMessage?: string;
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
