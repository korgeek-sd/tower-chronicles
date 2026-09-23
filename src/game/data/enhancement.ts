import type {EnhancementLevel,Tower} from '../types';

export type EnhancementAttemptLevel = Exclude<EnhancementLevel,3>;
export type EquipmentTier = 1|2|3|4|5;
export type EnhancementEquipmentCategory = 'weapon'|'armor'|'boots'|'accessory';

export interface EnhancementRule {
  from:EnhancementAttemptLevel;
  to:EnhancementLevel;
  successRate:number;
  failKeepRate:number;
  failDowngradeRate:number;
  failDestroyRate:number;
  baseSilverCost:number;
  baseMaterialCost:number;
}

/**
 * v0.1.43 Equipment Enhancement v1
 *
 * Probability values are confirmed design values.
 * Silver/material costs are PROVISIONAL balance values and should be tuned
 * through this table instead of being duplicated in engine/UI code.
 *
 * Each row is an unconditional result distribution and must sum to 1.
 */
export const ENHANCEMENT_RULES={
  0:{
    from:0,
    to:1,
    successRate:.50,
    failKeepRate:.50,
    failDowngradeRate:0,
    failDestroyRate:0,
    baseSilverCost:100,
    baseMaterialCost:4,
  },
  1:{
    from:1,
    to:2,
    successRate:.35,
    failKeepRate:.40,
    failDowngradeRate:.20,
    failDestroyRate:.05,
    baseSilverCost:250,
    baseMaterialCost:8,
  },
  2:{
    from:2,
    to:3,
    successRate:.20,
    failKeepRate:.35,
    failDowngradeRate:.30,
    failDestroyRate:.15,
    baseSilverCost:600,
    baseMaterialCost:16,
  },
} as const satisfies Record<EnhancementAttemptLevel,EnhancementRule>;

/**
 * PROVISIONAL tier scaling.
 * Revisit T2-T5 when those equipment/content tiers are actually playable.
 */
export const ENHANCEMENT_TIER_COST_MULTIPLIER={
  1:1,
  2:2,
  3:3,
  4:4,
  5:5,
} as const satisfies Record<EquipmentTier,number>;

export const ENHANCEMENT_MATERIAL_BY_CATEGORY={
  weapon:'ore',
  armor:'leather',
  boots:'leather',
  accessory:'gem',
} as const satisfies Record<EnhancementEquipmentCategory,Tower>;

/**
 * Accessory trigger conditions stay fixed across enhancement levels.
 * Only the passive magnitude scales.
 */
export const ACCESSORY_ENHANCEMENT_VALUES={
  vampire:{
    0:.08,
    1:.09,
    2:.10,
    3:.11,
  },
  unyielding:{
    0:.30,
    1:.32,
    2:.34,
    3:.36,
  },
  berserker:{
    0:.40,
    1:.43,
    2:.46,
    3:.50,
  },
} as const satisfies Record<'vampire'|'unyielding'|'berserker',Record<EnhancementLevel,number>>;

export const ACCESSORY_TRIGGER_VALUES={
  vampire:{directHpDamageOnly:true},
  unyielding:{hpRatioAtOrBelow:.35},
  berserker:{hpRatioAtOrBelow:.40},
} as const;

export const ENHANCEMENT_POLICY={
  maxEnhancement:3 as EnhancementLevel,
  consumeCostOnSuccess:true,
  consumeCostOnFailure:true,
  downgradeAmount:1,
  destroyedItemRemovedPermanently:true,
  autoUnequipDestroyedItem:true,
  allowDuringExpedition:false,
  allowStarterEquipment:false,
  useProtectionItem:false,
  useFailureStack:false,
  usePity:false,
  useRecovery:false,
  useInheritance:false,
  randomStatRolls:false,
} as const;

export function enhancementRule(level:EnhancementLevel):EnhancementRule|null {
  return level===ENHANCEMENT_POLICY.maxEnhancement?null:ENHANCEMENT_RULES[level as EnhancementAttemptLevel];
}

export function isEquipmentTier(value:number):value is EquipmentTier {
  return Number.isInteger(value)&&value>=1&&value<=5;
}

export function enhancementSilverCost(level:EnhancementAttemptLevel,tier:EquipmentTier):number {
  return ENHANCEMENT_RULES[level].baseSilverCost*ENHANCEMENT_TIER_COST_MULTIPLIER[tier];
}

export function enhancementMaterialCost(level:EnhancementAttemptLevel,tier:EquipmentTier):number {
  return ENHANCEMENT_RULES[level].baseMaterialCost*ENHANCEMENT_TIER_COST_MULTIPLIER[tier];
}

export function accessoryEnhancementValue(kind:keyof typeof ACCESSORY_ENHANCEMENT_VALUES,level:EnhancementLevel):number {
  return ACCESSORY_ENHANCEMENT_VALUES[kind][level];
}
