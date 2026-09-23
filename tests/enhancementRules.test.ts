import test from 'node:test';
import assert from 'node:assert/strict';
import {PASSIVES} from '../src/game/data/config.ts';
import {
  ACCESSORY_ENHANCEMENT_VALUES,
  ACCESSORY_TRIGGER_VALUES,
  ENHANCEMENT_MATERIAL_BY_CATEGORY,
  ENHANCEMENT_POLICY,
  ENHANCEMENT_RULES,
  ENHANCEMENT_TIER_COST_MULTIPLIER,
  accessoryEnhancementValue,
  enhancementMaterialCost,
  enhancementRule,
  enhancementSilverCost,
  isEquipmentTier,
  type EnhancementAttemptLevel,
  type EquipmentTier,
} from '../src/game/data/enhancement.ts';

test('ENHANCE RULES 01: 각 강화 단계 결과 확률은 확정값이며 합계가 100%다',()=>{
  const expected={
    0:[.50,.50,0,0],
    1:[.35,.40,.20,.05],
    2:[.20,.35,.30,.15],
  } as const;
  for(const level of [0,1,2] as const){
    const rule=ENHANCEMENT_RULES[level];
    const actual=[rule.successRate,rule.failKeepRate,rule.failDowngradeRate,rule.failDestroyRate];
    assert.deepEqual(actual,expected[level]);
    assert.equal(actual.reduce((sum,value)=>sum+value,0),1);
    assert.equal(rule.from,level);
    assert.equal(rule.to,level+1);
  }
  assert.equal(ENHANCEMENT_RULES[0].failDowngradeRate,0);
  assert.equal(ENHANCEMENT_RULES[0].failDestroyRate,0);
  assert.equal(ENHANCEMENT_RULES[1].failDestroyRate,.05);
  assert.equal(ENHANCEMENT_RULES[2].failDestroyRate,.15);
});

test('ENHANCE RULES 02: 최대 +3이며 +3에서는 더 이상 강화 규칙을 반환하지 않는다',()=>{
  assert.equal(ENHANCEMENT_POLICY.maxEnhancement,3);
  assert.equal(enhancementRule(0)?.to,1);
  assert.equal(enhancementRule(1)?.to,2);
  assert.equal(enhancementRule(2)?.to,3);
  assert.equal(enhancementRule(3),null);
});

test('ENHANCE RULES 03: v1 실패 정책은 1단계 하락, 영구 파괴, 자동 해제이며 보호/보정은 없다',()=>{
  assert.equal(ENHANCEMENT_POLICY.consumeCostOnSuccess,true);
  assert.equal(ENHANCEMENT_POLICY.consumeCostOnFailure,true);
  assert.equal(ENHANCEMENT_POLICY.downgradeAmount,1);
  assert.equal(ENHANCEMENT_POLICY.destroyedItemRemovedPermanently,true);
  assert.equal(ENHANCEMENT_POLICY.autoUnequipDestroyedItem,true);
  assert.equal(ENHANCEMENT_POLICY.allowDuringExpedition,false);
  assert.equal(ENHANCEMENT_POLICY.allowStarterEquipment,false);
  assert.equal(ENHANCEMENT_POLICY.useProtectionItem,false);
  assert.equal(ENHANCEMENT_POLICY.useFailureStack,false);
  assert.equal(ENHANCEMENT_POLICY.usePity,false);
  assert.equal(ENHANCEMENT_POLICY.useRecovery,false);
  assert.equal(ENHANCEMENT_POLICY.useInheritance,false);
  assert.equal(ENHANCEMENT_POLICY.randomStatRolls,false);
});

test('ENHANCE RULES 04: provisional T1 비용은 100/250/600 Silver와 재료 4/8/16이다',()=>{
  assert.deepEqual(
    ([0,1,2] as EnhancementAttemptLevel[]).map(level=>[
      ENHANCEMENT_RULES[level].baseSilverCost,
      ENHANCEMENT_RULES[level].baseMaterialCost,
    ]),
    [[100,4],[250,8],[600,16]],
  );
});

test('ENHANCE RULES 05: provisional 비용은 장비 티어 1~5배로 선형 증가한다',()=>{
  assert.deepEqual(ENHANCEMENT_TIER_COST_MULTIPLIER,{1:1,2:2,3:3,4:4,5:5});
  const expectedSilver={
    1:[100,250,600],
    2:[200,500,1200],
    3:[300,750,1800],
    4:[400,1000,2400],
    5:[500,1250,3000],
  } as const;
  const expectedMaterial={
    1:[4,8,16],
    2:[8,16,32],
    3:[12,24,48],
    4:[16,32,64],
    5:[20,40,80],
  } as const;
  for(const tier of [1,2,3,4,5] as EquipmentTier[]){
    assert.deepEqual(([0,1,2] as EnhancementAttemptLevel[]).map(level=>enhancementSilverCost(level,tier)),expectedSilver[tier]);
    assert.deepEqual(([0,1,2] as EnhancementAttemptLevel[]).map(level=>enhancementMaterialCost(level,tier)),expectedMaterial[tier]);
  }
});

test('ENHANCE RULES 06: 무기/갑옷/신발/장신구 강화 재료 탑은 제작 계열과 일치한다',()=>{
  assert.deepEqual(ENHANCEMENT_MATERIAL_BY_CATEGORY,{
    weapon:'ore',
    armor:'leather',
    boots:'leather',
    accessory:'gem',
  });
});

test('ENHANCE RULES 07: 장신구 강화 수치는 확정값을 사용한다',()=>{
  assert.deepEqual(ACCESSORY_ENHANCEMENT_VALUES.vampire,{0:.08,1:.09,2:.10,3:.11});
  assert.deepEqual(ACCESSORY_ENHANCEMENT_VALUES.unyielding,{0:.30,1:.32,2:.34,3:.36});
  assert.deepEqual(ACCESSORY_ENHANCEMENT_VALUES.berserker,{0:.40,1:.43,2:.46,3:.50});
  assert.equal(accessoryEnhancementValue('vampire',3),.11);
  assert.equal(accessoryEnhancementValue('unyielding',3),.36);
  assert.equal(accessoryEnhancementValue('berserker',3),.50);
});

test('ENHANCE RULES 08: +0 장신구 효과와 HP 발동 조건은 기존 전투 설정을 유지한다',()=>{
  assert.equal(ACCESSORY_ENHANCEMENT_VALUES.vampire[0],PASSIVES.vampire.value);
  assert.equal(ACCESSORY_ENHANCEMENT_VALUES.unyielding[0],PASSIVES.unyielding.value);
  assert.equal(ACCESSORY_ENHANCEMENT_VALUES.berserker[0],PASSIVES.berserker.value);
  assert.equal(ACCESSORY_TRIGGER_VALUES.unyielding.hpRatioAtOrBelow,PASSIVES.unyielding.threshold);
  assert.equal(ACCESSORY_TRIGGER_VALUES.berserker.hpRatioAtOrBelow,PASSIVES.berserker.threshold);
  assert.equal(ACCESSORY_TRIGGER_VALUES.vampire.directHpDamageOnly,true);
});

test('ENHANCE RULES 09: 장비 티어 판정은 1~5 정수만 허용한다',()=>{
  for(const tier of [1,2,3,4,5])assert.equal(isEquipmentTier(tier),true);
  for(const tier of [0,6,1.5,NaN,Infinity])assert.equal(isEquipmentTier(tier),false);
});
