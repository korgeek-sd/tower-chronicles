import test from 'node:test';
import assert from 'node:assert/strict';
import {APP_VERSION} from '../src/storage/repository.ts';
import {initialState} from '../src/game/engine/state.ts';
import {
  ACCESSORY_ENHANCEMENT_VALUES,
  ENHANCEMENT_POLICY,
  ENHANCEMENT_RULES,
  enhancementMaterialCost,
  enhancementSilverCost,
} from '../src/game/data/enhancement.ts';
import {enhancementQuote} from '../src/game/engine/enhancement.ts';

test('RELEASE 0.1.43: app metadata and save schema stay aligned',()=>{
  assert.equal(APP_VERSION,'0.1.43');
  assert.equal(initialState().version,22);
});

test('RELEASE 0.1.43: enhancement probability contract is exact',()=>{
  assert.deepEqual(
    [0,1,2].map(level=>{
      const rule=ENHANCEMENT_RULES[level as 0|1|2];
      return [rule.successRate,rule.failKeepRate,rule.failDowngradeRate,rule.failDestroyRate];
    }),
    [[.5,.5,0,0],[.35,.4,.2,.05],[.2,.35,.3,.15]],
  );
  assert.equal(ENHANCEMENT_POLICY.maxEnhancement,3);
  assert.equal(ENHANCEMENT_POLICY.downgradeAmount,1);
  assert.equal(ENHANCEMENT_POLICY.destroyedItemRemovedPermanently,true);
  assert.equal(ENHANCEMENT_POLICY.autoUnequipDestroyedItem,true);
});

test('RELEASE 0.1.43: provisional T1 costs and accessory values are locked',()=>{
  assert.deepEqual([0,1,2].map(level=>enhancementSilverCost(level as 0|1|2,1)),[100,250,600]);
  assert.deepEqual([0,1,2].map(level=>enhancementMaterialCost(level as 0|1|2,1)),[4,8,16]);
  assert.deepEqual(ACCESSORY_ENHANCEMENT_VALUES.vampire,{0:.08,1:.09,2:.10,3:.11});
  assert.deepEqual(ACCESSORY_ENHANCEMENT_VALUES.unyielding,{0:.30,1:.32,2:.34,3:.36});
  assert.deepEqual(ACCESSORY_ENHANCEMENT_VALUES.berserker,{0:.40,1:.43,2:.46,3:.50});
});

test('RELEASE 0.1.43: quote maps weapon/armor/boots/accessory to canonical materials without new save fields',()=>{
  const cases=[
    ['sword','ore'],
    ['armor','leather'],
    ['boots','leather'],
    ['vampire','gem'],
  ] as const;
  for(const [kind,tower] of cases){
    const s=initialState();
    s.items.push({id:'release-target',kind,tier:1,enhancement:0});
    assert.equal(enhancementQuote(s,'release-target')?.materialTower,tower);
  }
});
