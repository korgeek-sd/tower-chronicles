import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,equip} from '../src/game/engine/state.ts';
import {
  EQUIPMENT_ENHANCEMENT_RULES,
  EQUIPMENT_ENHANCEMENT_STONE_COSTS,
  EQUIPMENT_ENHANCEMENT_GRADE_BASE_COSTS,
  EQUIPMENT_ENHANCEMENT_STAGE_FACTORS,
  equipmentEnhancementQuote,
  equipmentEnhancementSilverCost,
  resolveEquipmentEnhancementOutcome,
  enhanceEquipmentV2,
} from '../src/game/engine/equipmentEnhancementV2.ts';
import type {EquipmentItem,EquipmentKind} from '../src/game/types.ts';

const item=(id:string,kind:EquipmentKind,grade:EquipmentItem['grade']='common',enhancement:EquipmentItem['enhancement']=0):EquipmentItem=>({id,kind,grade,enhancement});

test('V2 ENHANCEMENT 01: all +0 through +9 outcome rows exactly match the finalized rates and sum to 100%',()=>{
 const expected=[
  [.50,.50,0,0],
  [.65,.32,.028,.002],
  [.60,.34,.057,.003],
  [.55,.34,.105,.005],
  [.48,.34,.173,.007],
  [.40,.33,.26,.01],
  [.32,.31,.36,.01],
  [.24,.27,.475,.015],
  [.19,.24,.55,.02],
  [.10,.23,.645,.025],
 ];
 assert.deepEqual(Object.values(EQUIPMENT_ENHANCEMENT_RULES).map(r=>[r.successRate,r.failKeepRate,r.failDowngradeRate,r.failDestroyRate]),expected);
 for(const rule of Object.values(EQUIPMENT_ENHANCEMENT_RULES)){
  assert.ok(Math.abs(rule.successRate+rule.failKeepRate+rule.failDowngradeRate+rule.failDestroyRate-1)<1e-12);
 }
});

test('V2 ENHANCEMENT 02: finalized Silver and universal stone costs are used for every target',()=>{
 assert.deepEqual(EQUIPMENT_ENHANCEMENT_GRADE_BASE_COSTS,{common:500,uncommon:750,rare:1100,heroic:1600,legendary:2500});
 assert.deepEqual(EQUIPMENT_ENHANCEMENT_STAGE_FACTORS,[1,1.5,2.2,3.2,4.5,6.5,9.5,14,21,32]);
 assert.deepEqual(EQUIPMENT_ENHANCEMENT_STONE_COSTS,{1:1,2:1,3:2,4:2,5:3,6:4,7:5,8:7,9:10,10:15});
 assert.equal(equipmentEnhancementSilverCost('legendary',1),2500);
 assert.equal(equipmentEnhancementSilverCost('legendary',10),80000);
 assert.equal(equipmentEnhancementSilverCost('rare',3),2420);
});

test('V2 ENHANCEMENT 03: quote uses equipmentItems and owned enhancement stones',()=>{
 const s=initialState();
 s.equipmentItems=[item('legendary-ring','expedition_merit_ring','legendary',9)];
 s.silver=100000;
 s.lootItems.enhancement_stone=20;
 const q=equipmentEnhancementQuote(s,'legendary-ring');
 assert.ok(q);
 assert.equal(q.current,9);
 assert.equal(q.target,10);
 assert.equal(q.silverCost,80000);
 assert.equal(q.stoneCost,15);
 assert.equal(q.stonesOwned,20);
 assert.equal(q.canAttempt,true);
});

test('V2 ENHANCEMENT 04: exact roll boundaries resolve success keep downgrade and destroy',()=>{
 assert.equal(resolveEquipmentEnhancementOutcome(9,.099999),'SUCCESS');
 assert.equal(resolveEquipmentEnhancementOutcome(9,.10),'FAIL_KEEP');
 assert.equal(resolveEquipmentEnhancementOutcome(9,.329999),'FAIL_KEEP');
 assert.equal(resolveEquipmentEnhancementOutcome(9,.33),'FAIL_DOWNGRADE');
 assert.equal(resolveEquipmentEnhancementOutcome(9,.974999),'FAIL_DOWNGRADE');
 assert.equal(resolveEquipmentEnhancementOutcome(9,.975),'FAIL_DESTROYED');
});

test('V2 ENHANCEMENT 05 retired enhancement leaves gear and currencies intact',()=>{const s=initialState();s.equipmentItems=[item('target','return_corps_plate_armor','rare',2)];s.silver=10000;s.lootItems.enhancement_stone=20;let calls=0;const next=enhanceEquipmentV2(s,'target',()=>{calls++;return .999;});assert.deepEqual(next.equipmentItems,s.equipmentItems);assert.deepEqual(next.equipped,s.equipped);assert.equal(next.silver,s.silver);assert.deepEqual(next.lootItems,s.lootItems);assert.equal(calls,0);assert.match(next.notice,/종료/);});

test('V2 ENHANCEMENT 06 retired enhancement leaves gear and currencies intact',()=>{const s=initialState();s.equipmentItems=[item('target','survey_corps_dust_boots','heroic',6)];s.silver=10000;s.lootItems.enhancement_stone=20;let calls=0;const next=enhanceEquipmentV2(s,'target',()=>{calls++;return .999;});assert.deepEqual(next.equipmentItems,s.equipmentItems);assert.deepEqual(next.equipped,s.equipped);assert.equal(next.silver,s.silver);assert.deepEqual(next.lootItems,s.lootItems);assert.equal(calls,0);assert.match(next.notice,/종료/);});

test('V2 ENHANCEMENT 07 retired enhancement leaves gear and currencies intact',()=>{const s=initialState();s.equipmentItems=[item('target','expedition_merit_ring','legendary',1)];s.equipped.ring='target';s.silver=10000;s.lootItems.enhancement_stone=20;let calls=0;const next=enhanceEquipmentV2(s,'target',()=>{calls++;return .999;});assert.deepEqual(next.equipmentItems,s.equipmentItems);assert.deepEqual(next.equipped,s.equipped);assert.equal(next.silver,s.silver);assert.deepEqual(next.lootItems,s.lootItems);assert.equal(calls,0);assert.match(next.notice,/종료/);});

test('V2 ENHANCEMENT 08: +10, expedition, starter and shortages are rejected without consuming resources',()=>{
 for(const setup of ['max','expedition','starter','silver','stones'] as const){
  const s=initialState();
  s.equipmentItems=[item(setup==='starter'?'starter-v2':'target','association_supply_iron_sword','common',setup==='max'?10:0)];
  s.silver=setup==='silver'?499:1000;
  s.lootItems.enhancement_stone=setup==='stones'?0:5;
  if(setup==='expedition')s.expedition={} as any;
  const before=structuredClone(s);
  const next=enhanceEquipmentV2(s,s.equipmentItems[0].id,()=>0);
  assert.equal(next.silver,before.silver,setup);
  assert.equal(next.lootItems.enhancement_stone,before.lootItems.enhancement_stone,setup);
  assert.deepEqual(next.equipmentItems,before.equipmentItems,setup);
 }
});
