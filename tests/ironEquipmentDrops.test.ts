import test from 'node:test';
import assert from 'node:assert/strict';
import type {EquipmentGrade,EquipmentKind} from '../src/game/types.ts';
import {
  IRON_BOSS_EQUIPMENT_DROPS,
  IRON_EQUIPMENT_FLOOR_DROPS,
  IRON_MONSTER_EQUIPMENT_WEIGHTS,
  ironEquipmentFloorDrop,
  ironEquipmentWeightsForFloor,
} from '../src/game/data/equipmentDrops.ts';

const allKinds:EquipmentKind[]=[
  'association_supply_iron_sword',
  'outer_guard_longbow',
  'archive_standard_arcane_staff',
  'expedition_iron_helmet',
  'return_corps_plate_armor',
  'mining_detail_reinforced_gloves',
  'survey_corps_dust_boots',
  'association_registration_tag',
  'expedition_merit_ring',
];

const gradeVector=(weights:Record<EquipmentGrade,number>)=>
  ['common','uncommon','rare','heroic','legendary'].map(grade=>weights[grade as EquipmentGrade]);

test('IRON EQUIPMENT DROP 01: floors 1-10 expose exact equipment drop chances',()=>{
  assert.deepEqual(
    Array.from({length:10},(_,i)=>ironEquipmentFloorDrop(i+1)?.equipmentChance),
    [.08,.09,.10,.11,.12,.14,.16,.18,.20,.25],
  );
  assert.equal(ironEquipmentFloorDrop(0),null);
  assert.equal(ironEquipmentFloorDrop(11),null);
});

test('IRON EQUIPMENT DROP 02: floors 1-3 use three-item starter pools and floors 4-10 use all nine',()=>{
  assert.deepEqual(IRON_EQUIPMENT_FLOOR_DROPS[1].itemPool,[
    'association_supply_iron_sword',
    'expedition_iron_helmet',
    'survey_corps_dust_boots',
  ]);
  assert.deepEqual(IRON_EQUIPMENT_FLOOR_DROPS[2].itemPool,[
    'outer_guard_longbow',
    'return_corps_plate_armor',
    'mining_detail_reinforced_gloves',
  ]);
  assert.deepEqual(IRON_EQUIPMENT_FLOOR_DROPS[3].itemPool,[
    'archive_standard_arcane_staff',
    'association_registration_tag',
    'expedition_merit_ring',
  ]);
  for(let floor=4;floor<=10;floor++)assert.deepEqual(IRON_EQUIPMENT_FLOOR_DROPS[floor].itemPool,allKinds);
});

test('IRON EQUIPMENT DROP 03: normal-monster grade distributions exactly match the approved floor bands',()=>{
  assert.deepEqual(gradeVector(IRON_EQUIPMENT_FLOOR_DROPS[1].gradeWeights),[85,15,0,0,0]);
  assert.deepEqual(gradeVector(IRON_EQUIPMENT_FLOOR_DROPS[2].gradeWeights),[85,15,0,0,0]);
  for(const floor of [3,4,5])assert.deepEqual(gradeVector(IRON_EQUIPMENT_FLOOR_DROPS[floor].gradeWeights),[70,24,6,0,0]);
  for(const floor of [6,7])assert.deepEqual(gradeVector(IRON_EQUIPMENT_FLOOR_DROPS[floor].gradeWeights),[55,30,12,3,0]);
  assert.deepEqual(gradeVector(IRON_EQUIPMENT_FLOOR_DROPS[8].gradeWeights),[0,65,27,8,0]);
  assert.deepEqual(gradeVector(IRON_EQUIPMENT_FLOOR_DROPS[9].gradeWeights),[0,55,32,12,1]);
  assert.deepEqual(gradeVector(IRON_EQUIPMENT_FLOOR_DROPS[10].gradeWeights),[0,48,34,16,2]);
  for(let floor=1;floor<=10;floor++)assert.equal(gradeVector(IRON_EQUIPMENT_FLOOR_DROPS[floor].gradeWeights).reduce((a,b)=>a+b,0),100);
});

test('IRON EQUIPMENT DROP 04: five normal monster identity weight rows are exact and each totals 100',()=>{
  assert.deepEqual(IRON_MONSTER_EQUIPMENT_WEIGHTS.goblin_miner,[18,7,7,7,7,22,18,7,7]);
  assert.deepEqual(IRON_MONSTER_EQUIPMENT_WEIGHTS.goblin_carrier,[8,8,8,8,21,8,8,21,10]);
  assert.deepEqual(IRON_MONSTER_EQUIPMENT_WEIGHTS.goblin_overseer,[18,7,7,18,7,7,7,7,22]);
  assert.deepEqual(IRON_MONSTER_EQUIPMENT_WEIGHTS.cave_rat,[7,7,7,7,7,7,26,26,6]);
  assert.deepEqual(IRON_MONSTER_EQUIPMENT_WEIGHTS.mine_bat,[7,26,26,7,7,7,7,7,6]);
  for(const weights of Object.values(IRON_MONSTER_EQUIPMENT_WEIGHTS))assert.equal(weights.reduce((a,b)=>a+b,0),100);
});

test('IRON EQUIPMENT DROP 05: early floors filter monster weights to their floor pool and normalize to 100',()=>{
  const floor1=ironEquipmentWeightsForFloor(1,'goblin_miner');
  assert.deepEqual(Object.keys(floor1),IRON_EQUIPMENT_FLOOR_DROPS[1].itemPool);
  assert.ok(Math.abs(Object.values(floor1).reduce((a,b)=>a+b,0)-100)<1e-9);
  assert.ok(floor1.mining_detail_reinforced_gloves===undefined);

  const floor4=ironEquipmentWeightsForFloor(4,'mine_bat');
  assert.deepEqual(Object.keys(floor4),allKinds);
  assert.ok(Math.abs(Object.values(floor4).reduce((a,b)=>a+b,0)-100)<1e-9);
});

test('IRON EQUIPMENT DROP 06: bosses 6-10 expose exact equipment chances and approved grade distributions',()=>{
  assert.deepEqual(
    [6,7,8,9,10].map(floor=>IRON_BOSS_EQUIPMENT_DROPS[floor].equipmentChance),
    [.60,.70,.80,.90,1],
  );
  assert.deepEqual(gradeVector(IRON_BOSS_EQUIPMENT_DROPS[6].gradeWeights),[0,55,35,10,0]);
  assert.deepEqual(gradeVector(IRON_BOSS_EQUIPMENT_DROPS[7].gradeWeights),[0,45,40,15,0]);
  assert.deepEqual(gradeVector(IRON_BOSS_EQUIPMENT_DROPS[8].gradeWeights),[0,35,43,21,1]);
  assert.deepEqual(gradeVector(IRON_BOSS_EQUIPMENT_DROPS[9].gradeWeights),[0,25,45,27,3]);
  assert.deepEqual(gradeVector(IRON_BOSS_EQUIPMENT_DROPS[10].gradeWeights),[0,0,55,38,7]);
  for(const floor of [6,7,8,9,10])assert.equal(gradeVector(IRON_BOSS_EQUIPMENT_DROPS[floor].gradeWeights).reduce((a,b)=>a+b,0),100);
});

test('IRON EQUIPMENT DROP 07: boss item pool always contains all nine shared equipment identities',()=>{
  for(const floor of [6,7,8,9,10])assert.deepEqual(IRON_BOSS_EQUIPMENT_DROPS[floor].itemPool,allKinds);
});
