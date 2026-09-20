import type {
  JobCombatDefinition,
  PassiveDefinition,
  JobSkillDefinition,
} from './framework';
import { registerJobCombatDefinition } from './framework';

// 1. contract_mercenary (계약용병)
const mercenaryDef: JobCombatDefinition = {
  jobId: 'contract_mercenary',
  passives: [
    {
      id: 'mercenary_passive_1',
      name: '전투 숙련',
      description: '기본 공격 피해 +10%',
      hooks: ['BEFORE_DIRECT_HIT'],
      conditions: [{ kind: 'ACTION_IS_BASIC_ATTACK' }],
      effectActions: [{ kind: 'DAMAGE_MULTIPLIER', multiplier: 1.1 }],
    },
    {
      id: 'mercenary_passive_2',
      name: '노련한 방어',
      description: 'Direct Hit으로 받는 실제 피해 -8%',
      hooks: ['DAMAGE_TAKEN'],
      conditions: [{ kind: 'IS_DIRECT_HIT' }],
      effectActions: [{ kind: 'DAMAGE_MULTIPLIER', multiplier: 0.92 }],
    },
  ],
  skills: [
    {
      id: 'mercenary_skill_1',
      name: '강타',
      description: '180% Direct Damage',
      cooldown: 3,
      effectActions: [
        { kind: 'DIRECT_ATTACK', hits: 1, baseMultiplier: 1.8 }
      ],
    },
    {
      id: 'mercenary_skill_2',
      name: '방패 올리기',
      description: '2턴 동안 받는 피해 25% 감소',
      cooldown: 5,
      effectActions: [{ kind: 'APPLY_EFFECT', target: 'SELF', effectId: 'mercenary_guard', duration: 2 }],
    },
    {
      id: 'mercenary_skill_3',
      name: '빈틈 찌르기',
      description: '기본 130%, 적 HP ≤40%라면 200%',
      cooldown: 4,
      effectActions: [
        {
          kind: 'DIRECT_ATTACK',
          hits: 1,
          baseMultiplier: 1.3,
          conditionalLastHitMultiplier: {
            condition: { kind: 'TARGET_HP_RATIO_LE', ratio: 0.4 },
            multiplier: 2.0,
          },
        },
      ],
    },
  ],
};

// 2. hunter (사냥꾼)
const hunterDef: JobCombatDefinition = {
  jobId: 'hunter',
  passives: [
    {
      id: 'hunter_passive_1',
      name: '추적자의 눈',
      description: 'hunter_mark가 적용된 적에게 주는 피해 +15%',
      hooks: ['BEFORE_DIRECT_HIT'],
      conditions: [{ kind: 'TARGET_HAS_EFFECT', effectId: 'hunter_mark' }],
      effectActions: [{ kind: 'DAMAGE_MULTIPLIER', multiplier: 1.15 }],
    },
    {
      id: 'hunter_passive_2',
      name: '사냥 본능',
      description: '적 HP가 35% 이하일 때 기본 공격 피해 +20%',
      hooks: ['BEFORE_DIRECT_HIT'],
      conditions: [{ kind: 'ACTION_IS_BASIC_ATTACK' }, { kind: 'TARGET_HP_RATIO_LE', ratio: 0.35 }],
      effectActions: [{ kind: 'DAMAGE_MULTIPLIER', multiplier: 1.2 }],
    },
  ],
  skills: [
    {
      id: 'hunter_skill_1',
      name: '사냥감 표식',
      description: '적에게 hunter_mark 3턴',
      cooldown: 5,
      effectActions: [{ kind: 'APPLY_EFFECT', target: 'TARGET', effectId: 'hunter_mark', duration: 3 }],
    },
    {
      id: 'hunter_skill_2',
      name: '연속 사격',
      description: '기본 70% x 2타, 표식 대상 시 70% x 3타',
      cooldown: 0,
      effectActions: [
        {
          kind: 'DIRECT_ATTACK',
          hits: 2,
          baseMultiplier: 0.7,
          conditionalHits: {
            condition: { kind: 'TARGET_HAS_EFFECT', effectId: 'hunter_mark' },
            hits: 3,
          },
        },
      ],
    },
    {
      id: 'hunter_skill_3',
      name: '마무리 사격',
      description: '기본 170%, 표식 대상이며 적 HP ≤35%라면 280%',
      cooldown: 5,
      effectActions: [
        {
          kind: 'DIRECT_ATTACK',
          hits: 1,
          baseMultiplier: 1.7,
          conditionalLastHitMultiplier: {
            condition: {
              kind: 'ALL',
              conditions: [
                { kind: 'TARGET_HAS_EFFECT', effectId: 'hunter_mark' },
                { kind: 'TARGET_HP_RATIO_LE', ratio: 0.35 },
              ],
            },
            multiplier: 2.8,
          },
        },
      ],
    },
  ],
};

// 3. field_medic (야전구호원)
const fieldMedicDef: JobCombatDefinition = {
  jobId: 'field_medic',
  passives: [
    {
      id: 'field_medic_passive_1',
      name: '응급처치',
      description: '전투당 1회, 플레이어 HP가 처음 30% 이하로 내릴 때 Max HP 15% 회복',
      hooks: ['HP_THRESHOLD'],
      conditions: [{ kind: 'FLAG_IS', flag: 'first_aid_used', value: false }, { kind: 'SELF_HP_RATIO_LE', ratio: 0.3 }],
      effectActions: [
        { kind: 'HEAL_PERCENT', percent: 0.15 },
        { kind: 'SET_FLAG', flag: 'first_aid_used', value: true },
      ],
    },
    {
      id: 'field_medic_passive_2',
      name: '약물 지식',
      description: '회복 포션 회복량 +20%',
      hooks: ['BEFORE_HEAL'],
      conditions: [{ kind: 'ACTION_IS_POTION' }],
      effectActions: [{ kind: 'MODIFY_HEAL_MULTIPLIER', multiplier: 1.2 }],
    },
  ],
  skills: [
    {
      id: 'field_medic_skill_1',
      name: '응급 치료',
      description: 'Max HP 20% 회복',
      cooldown: 5,
      effectActions: [{ kind: 'HEAL_PERCENT', percent: 0.2 }],
    },
    {
      id: 'field_medic_skill_2',
      name: '지혈',
      description: 'BLEED 상태효과 제거 후 3턴간 턴당 Max HP 5% 회복',
      cooldown: 0,
      effectActions: [
        { kind: 'REMOVE_EFFECT_TAG', target: 'SELF', tag: 'BLEED' },
        { kind: 'APPLY_EFFECT', target: 'SELF', effectId: 'field_medic_regen', duration: 3 },
      ],
    },
    {
      id: 'field_medic_skill_3',
      name: '진통제',
      description: '2턴 동안 받는 피해 -30%',
      cooldown: 6,
      effectActions: [{ kind: 'APPLY_EFFECT', target: 'SELF', effectId: 'field_medic_analgesic', duration: 2 }],
    },
  ],
};

// 4. duelist (결투가)
const duelistDef: JobCombatDefinition = {
  jobId: 'duelist',
  passives: [
    {
      id: 'duelist_passive_1',
      name: '일대일',
      description: '1:1 전투 시 공격력/최종 피해 +10%',
      hooks: ['BEFORE_DIRECT_HIT'],
      effectActions: [{ kind: 'DAMAGE_MULTIPLIER', multiplier: 1.1 }],
    },
    {
      id: 'duelist_passive_2',
      name: '반격 태세',
      description: 'Direct Hit을 받을 때 20% 확률로 공격력 60% 반격',
      hooks: ['DAMAGE_TAKEN'],
      conditions: [{ kind: 'IS_DIRECT_HIT' }],
      effectActions: [{ kind: 'CHANCE_REACTION', chance: 0.2, multiplier: 0.6 }],
    },
    {
      id: 'duelist_passive_counter_stance_hook',
      name: '받아치기 반격',
      description: 'duelist_counter_stance 효과를 소모하여 180% 즉시 반격',
      hooks: ['DAMAGE_TAKEN'],
      conditions: [{ kind: 'IS_DIRECT_HIT' }, { kind: 'SELF_HAS_EFFECT', effectId: 'duelist_counter_stance' }],
      effectActions: [{ kind: 'APPLY_COUNTER_STANCE' }],
    },
  ],
  skills: [
    {
      id: 'duelist_skill_1',
      name: '찌르기',
      description: '160% Direct Damage',
      cooldown: 2,
      effectActions: [{ kind: 'DIRECT_ATTACK', hits: 1, baseMultiplier: 1.6 }],
    },
    {
      id: 'duelist_skill_2',
      name: '받아치기',
      description: 'Prepared Reaction 등록 (피해 40% 감소 + 공격력 180% 즉시 반격)',
      cooldown: 5,
      effectActions: [{ kind: 'APPLY_EFFECT', target: 'SELF', effectId: 'duelist_counter_stance', duration: 2 }],
    },
    {
      id: 'duelist_skill_3',
      name: '결착',
      description: '기본 220%, 적 HP ≤30%라면 320%',
      cooldown: 6,
      effectActions: [
        {
          kind: 'DIRECT_ATTACK',
          hits: 1,
          baseMultiplier: 2.2,
          conditionalLastHitMultiplier: {
            condition: { kind: 'TARGET_HP_RATIO_LE', ratio: 0.3 },
            multiplier: 3.2,
          },
        },
      ],
    },
  ],
};

// 5. berserker (광전사)
const berserkerDef: JobCombatDefinition = {
  jobId: 'berserker',
  resource: { id: 'rage', initialValue: 0, maxValue: 100 },
  passives: [
    {
      id: 'berserker_passive_1_tier3',
      name: '피의 열기 (20%)',
      description: 'HP ≤20%일 때 피해 +35%',
      hooks: ['BEFORE_DIRECT_HIT'],
      conditions: [{ kind: 'SELF_HP_RATIO_LE', ratio: 0.2 }],
      effectActions: [{ kind: 'DAMAGE_MULTIPLIER', multiplier: 1.35 }],
    },
    {
      id: 'berserker_passive_1_tier2',
      name: '피의 열기 (40%)',
      description: 'HP 20%~40%일 때 피해 +20%',
      hooks: ['BEFORE_DIRECT_HIT'],
      conditions: [{ kind: 'SELF_HP_RATIO_LE', ratio: 0.4 }, { kind: 'SELF_HP_RATIO_GT', ratio: 0.2 }],
      effectActions: [{ kind: 'DAMAGE_MULTIPLIER', multiplier: 1.2 }],
    },
    {
      id: 'berserker_passive_1_tier1',
      name: '피의 열기 (70%)',
      description: 'HP 40%~70%일 때 피해 +10%',
      hooks: ['BEFORE_DIRECT_HIT'],
      conditions: [{ kind: 'SELF_HP_RATIO_LE', ratio: 0.7 }, { kind: 'SELF_HP_RATIO_GT', ratio: 0.4 }],
      effectActions: [{ kind: 'DAMAGE_MULTIPLIER', multiplier: 1.1 }],
    },
    {
      id: 'berserker_passive_2',
      name: '죽음 거부',
      description: 'HP ≤30%일 때 받는 피해 -15%',
      hooks: ['DAMAGE_TAKEN'],
      conditions: [{ kind: 'SELF_HP_RATIO_LE', ratio: 0.3 }],
      effectActions: [{ kind: 'DAMAGE_MULTIPLIER', multiplier: 0.85 }],
    },
    {
      id: 'berserker_passive_rage_gain',
      name: '분노 수급',
      description: '피격 시 실제 HP 피해량만큼 Rage 획득',
      hooks: ['DAMAGE_TAKEN'],
      conditions: [{ kind: 'IS_DIRECT_HIT' }],
      effectActions: [{ kind: 'GAIN_RESOURCE_FROM_HP_DAMAGE' }],
    },
  ],
  skills: [
    {
      id: 'berserker_skill_1',
      name: '난도질',
      description: '75% x 2 Direct Hit, Rage +10',
      cooldown: 0,
      effectActions: [
        { kind: 'CHANGE_RESOURCE', delta: 10 },
        { kind: 'DIRECT_ATTACK', hits: 2, baseMultiplier: 0.75 },
      ],
    },
    {
      id: 'berserker_skill_2',
      name: '피의 대가',
      description: 'Max HP 10% 소비(최소 HP 1 보장), Rage +25, 3턴간 공격 피해 +25%',
      cooldown: 0,
      effectActions: [
        { kind: 'SELF_HP_COST_PERCENT', percentOfMax: 0.1 },
        { kind: 'CHANGE_RESOURCE', delta: 25 },
        { kind: 'APPLY_EFFECT', target: 'SELF', effectId: 'berserker_blood_boost', duration: 3 },
      ],
    },
    {
      id: 'berserker_skill_3',
      name: '폭주',
      description: 'Rage >= 60 필요, Rage -60 소비, 100% x 3 타격 (적 HP ≤30%면 막타 150%)',
      cooldown: 0,
      conditions: [{ kind: 'RESOURCE_GE', amount: 60 }],
      effectActions: [
        { kind: 'CHANGE_RESOURCE', delta: -60 },
        {
          kind: 'DIRECT_ATTACK',
          hits: 3,
          baseMultiplier: 1.0,
          conditionalLastHitMultiplier: {
            condition: { kind: 'TARGET_HP_RATIO_LE', ratio: 0.3 },
            multiplier: 1.5,
          },
        },
      ],
    },
  ],
};

export function initFiveJobCombatDefinitions() {
  registerJobCombatDefinition(mercenaryDef);
  registerJobCombatDefinition(hunterDef);
  registerJobCombatDefinition(fieldMedicDef);
  registerJobCombatDefinition(duelistDef);
  registerJobCombatDefinition(berserkerDef);
}
