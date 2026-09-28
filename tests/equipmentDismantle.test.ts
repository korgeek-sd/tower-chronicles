import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,equip} from '../src/game/engine/state.ts';
import {
  EQUIPMENT_DISMANTLE_YIELDS,
  dismantleEquipment,
  equipmentDismantleYield,
} from '../src/game/engine/equipmentDismantle.ts';
import type {EquipmentItem,EquipmentKind} from '../src/game/types.ts';

const item=(id:string,kind:EquipmentKind,grade:EquipmentItem['grade'],enhancement:EquipmentItem['enhancement']=0):EquipmentItem=>({id,kind,grade,enhancement});

test('EQUIPMENT DISMANTLE 01: five grades yield exactly 1 2 4 8 15 universal enhancement stones',()=>{
 assert.deepEqual(EQUIPMENT_DISMANTLE_YIELDS,{common:1,uncommon:2,rare:4,heroic:8,legendary:15});
 assert.equal(equipmentDismantleYield(item('a','expedition_iron_helmet','common')),1);
 assert.equal(equipmentDismantleYield(item('b','return_corps_plate_armor','uncommon')),2);
 assert.equal(equipmentDismantleYield(item('c','mining_detail_reinforced_gloves','rare')),4);
 assert.equal(equipmentDismantleYield(item('d','association_registration_tag','heroic')),8);
 assert.equal(equipmentDismantleYield(item('e','expedition_merit_ring','legendary',10)),15);
});

test('EQUIPMENT DISMANTLE 02: successful dismantle deletes one item and adds enhancement stones',()=>{
 const s=initialState();
 s.equipmentItems.push(item('drop-rare','return_corps_plate_armor','rare',4));
 const next=dismantleEquipment(s,'drop-rare');
 assert.equal(next.equipmentItems?.some(x=>x.id==='drop-rare'),false);
 assert.equal(next.lootItems.enhancement_stone,4);
 assert.match(next.notice,/강화석 4/);
});

test('EQUIPMENT DISMANTLE 03: repeated local dismantle cannot mint stones twice',()=>{
 const s=initialState();
 s.equipmentItems.push(item('drop-one','survey_corps_dust_boots','uncommon'));
 const once=dismantleEquipment(s,'drop-one');
 const twice=dismantleEquipment(once,'drop-one');
 assert.equal(once.lootItems.enhancement_stone,2);
 assert.equal(twice.lootItems.enhancement_stone,2);
 assert.match(twice.notice,/찾을 수 없습니다/);
});

test('EQUIPMENT DISMANTLE 04: equipped equipment cannot be dismantled',()=>{
 let s=initialState();
 s.equipmentItems.push(item('equipped-ring','expedition_merit_ring','legendary'));
 s=equip(s,'equipped-ring');
 const next=dismantleEquipment(s,'equipped-ring');
 assert.ok(next.equipmentItems?.some(x=>x.id==='equipped-ring'));
 assert.equal(next.lootItems.enhancement_stone??0,0);
 assert.match(next.notice,/장착 해제/);
});

test('EQUIPMENT DISMANTLE 05: starter equipment can never be dismantled',()=>{
 const s=initialState();
 s.equipped.weapon=null;
 const next=dismantleEquipment(s,'starter-v2');
 assert.ok(next.equipmentItems?.some(x=>x.id==='starter-v2'));
 assert.equal(next.lootItems.enhancement_stone??0,0);
 assert.match(next.notice,/보급 장비/);
});

test('EQUIPMENT DISMANTLE 06: dismantling is blocked during an expedition',()=>{
 const s=initialState();
 s.equipmentItems.push(item('field-helmet','expedition_iron_helmet','common'));
 s.expedition={} as any;
 const next=dismantleEquipment(s,'field-helmet');
 assert.ok(next.equipmentItems?.some(x=>x.id==='field-helmet'));
 assert.equal(next.lootItems.enhancement_stone??0,0);
 assert.match(next.notice,/원정 중/);
});
