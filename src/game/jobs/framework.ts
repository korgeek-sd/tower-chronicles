import type {BattleJobRuntime,CombatActor,Expedition,GameState} from '../types';

export type CombatHook =
  | 'BATTLE_START'
  | 'TURN_START'
  | 'BEFORE_ACTION'
  | 'BEFORE_DIRECT_HIT'
  | 'AFTER_DIRECT_HIT'
  | 'DAMAGE_TAKEN'
  | 'AFTER_HEAL'
  | 'HP_THRESHOLD'
  | 'MONSTER_DEFEATED'
  | 'BATTLE_END';

export type JobCondition =
  | { kind: 'SELF_HP_RATIO_LE'; ratio: number }
  | { kind: 'SELF_HP_RATIO_GT'; ratio: number }
  | { kind: 'TARGET_HP_RATIO_LE'; ratio: number }
  | { kind: 'TARGET_HAS_EFFECT'; effectId: string }
  | { kind: 'SELF_HAS_EFFECT'; effectId: string }
  | { kind: 'RESOURCE_GE'; amount: number }
  | { kind: 'FLAG_IS'; flag: string; value: boolean }
  | { kind: 'ACTION_IS_BASIC_ATTACK' }
  | { kind: 'ACTION_IS_SKILL' }
  | { kind: 'IS_DIRECT_HIT' };

export type JobEffectAction =
  | { kind: 'DAMAGE_MULTIPLIER'; multiplier: number }
  | { kind: 'FLAT_DAMAGE'; amount: number }
  | { kind: 'HEAL_PERCENT'; percent: number }
  | { kind: 'HEAL_FLAT'; amount: number }
  | { kind: 'SELF_HP_COST_PERCENT'; percentOfMax: number }
  | { kind: 'APPLY_EFFECT'; target: 'SELF' | 'TARGET'; effectId: string; duration?: number }
  | { kind: 'REMOVE_EFFECT_TAG'; target: 'SELF' | 'TARGET'; tag: string }
  | { kind: 'CHANGE_RESOURCE'; delta: number }
  | { kind: 'SET_FLAG'; flag: string; value: boolean }
  | { kind: 'PREPARE_REACTION'; reactionId: string };

export interface PassiveDefinition {
  id: string;
  name: string;
  description: string;
  hooks: CombatHook[];
  conditions?: JobCondition[];
  effectActions?: JobEffectAction[];
}

export interface JobSkillDefinition {
  id: string;
  name: string;
  description: string;
  cooldown: number;
  conditions?: JobCondition[];
  effectActions: JobEffectAction[];
}

export interface JobCombatDefinition {
  jobId: string;
  passives: [PassiveDefinition, PassiveDefinition];
  skills: [JobSkillDefinition, JobSkillDefinition, JobSkillDefinition];
  resource?: { id: string; initialValue: number; maxValue?: number };
}

const JOB_REGISTRY: Record<string, JobCombatDefinition> = {};

export function registerJobCombatDefinition(def: JobCombatDefinition) {
  JOB_REGISTRY[def.jobId] = def;
}

export function getJobCombatDefinition(jobId: string | null): JobCombatDefinition | null {
  return jobId ? JOB_REGISTRY[jobId] ?? null : null;
}

export function modifyJobResource(runtime: BattleJobRuntime, delta: number): number {
  if (!runtime.resource) return 0;
  const max = runtime.resource.maxValue ?? 100;
  const oldVal = runtime.resource.value;
  const newVal = Math.max(0, Math.min(max, oldVal + delta));
  runtime.resource.value = newVal;
  return newVal - oldVal;
}

export function setJobFlag(runtime: BattleJobRuntime, flag: string, value: boolean) {
  runtime.flags ??= {};
  runtime.flags[flag] = value;
}

export function getJobFlag(runtime: BattleJobRuntime, flag: string): boolean {
  return !!runtime.flags?.[flag];
}
