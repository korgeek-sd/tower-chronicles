import test from 'node:test';
import assert from 'node:assert/strict';
import type {EquipmentGrade,EquipmentKind,EquipmentItem,Slot} from '../src/game/types.ts';
import {
  EQUIPMENT_DEFINITIONS,
  EQUIPMENT_GRADES,
  EQUIPMENT_FIXED_STATS,
  EQUIPMENT_SLOTS,
  equipmentDefinition,
} from '../src/game/data/equipment.ts';
import {initialState} from '../src/game/engine/state.ts';
import {snapshotPreset} from '../src/game/engine/presets.ts';

const expectedKinds:EquipmentKind[]=[
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

const expectedSlots:Slot[]=['weapon','helmet','armor','gloves','boots','necklace','ring'];
const expectedGrades:EquipmentGrade[]=['common','uncommon','rare','heroic','legendary'];

test('EQUIPMENT FOUNDATION 01: canonical equipment domain exposes nine kinds, five grades and seven slots',()=>{
  assert.deepEqual(EQUIPMENT_GRADES,expectedGrades);
  assert.deepEqual(EQUIPMENT_SLOTS,expectedSlots);
  assert.deepEqual(Object.keys(EQUIPMENT_DEFINITIONS),expectedKinds);
});

test('EQUIPMENT FOUNDATION 02: nine equipment identities have exact Korean names and slot mapping',()=>{
  const expected=[
    ['association_supply_iron_sword','협회 보급 철검','weapon'],
    ['outer_guard_longbow','외곽 경비대 장궁','weapon'],
    ['archive_standard_arcane_staff','기록원 제식 마도봉','weapon'],
    ['expedition_iron_helmet','원정대 철제 투구','helmet'],
    ['return_corps_plate_armor','귀환대 판금갑','armor'],
    ['mining_detail_reinforced_gloves','채굴반 강화 장갑','gloves'],
    ['survey_corps_dust_boots','탐사대 방진 장화','boots'],
    ['association_registration_tag','귀환자의 부적 목걸이','necklace'],
    ['expedition_merit_ring','추적자의 인장 반지','ring'],
  ] as const;
  assert.deepEqual(expected.map(([kind])=>equipmentDefinition(kind).name),expected.map(([,name])=>name));
  assert.deepEqual(expected.map(([kind])=>equipmentDefinition(kind).slot),expected.map(([, ,slot])=>slot));
  assert.equal(new Set(expected.map(([kind])=>kind)).size,9);
});

test('EQUIPMENT FOUNDATION 03: grade multipliers are deterministic and equipment base stats never expose speed',()=>{
  assert.equal(Object.keys(EQUIPMENT_FIXED_STATS).length,9);
  for(const definition of Object.values(EQUIPMENT_DEFINITIONS)){
    assert.equal('speed' in definition.baseStats,false);
  }
});

test('EQUIPMENT FOUNDATION 04: weapon slot has exactly three weapon identities and six non-weapon slots are unique',()=>{
  const definitions=Object.values(EQUIPMENT_DEFINITIONS);
  assert.deepEqual(definitions.filter(item=>item.slot==='weapon').map(item=>item.kind),expectedKinds.slice(0,3));
  const nonWeapons=definitions.filter(item=>item.slot!=='weapon');
  assert.deepEqual(nonWeapons.map(item=>item.slot),['helmet','armor','gloves','boots','necklace','ring']);
  assert.equal(new Set(nonWeapons.map(item=>item.slot)).size,6);
});

test('EQUIPMENT FOUNDATION 05: initial equipment references use exactly seven slots',()=>{
  const s=initialState();
  assert.deepEqual(Object.keys(s.equipped),expectedSlots);
  assert.equal(s.equipped.weapon,'starter-v2');
  for(const slot of expectedSlots.filter(slot=>slot!=='weapon'))assert.equal(s.equipped[slot],null);
});

test('EQUIPMENT FOUNDATION 06: preset snapshots preserve the full seven-slot equipment record',()=>{
  const s=initialState();
  const preset=snapshotPreset(s,'7-slot');
  assert.ok(preset);
  assert.deepEqual(Object.keys(preset!.equipment),expectedSlots);
  assert.deepEqual(preset!.equipment,s.equipped);
});

test('EQUIPMENT FOUNDATION 07: EquipmentItem contract accepts canonical kind, grade and enhancement',()=>{
  const item:EquipmentItem={
    id:'equipment-test-1',
    kind:'association_supply_iron_sword',
    grade:'common',
    enhancement:0,
  };
  assert.equal(item.kind,expectedKinds[0]);
  assert.equal(item.grade,expectedGrades[0]);
});
