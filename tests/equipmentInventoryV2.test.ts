import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,equip,unequip,stats} from '../src/game/engine/state.ts';
import {inventoryView} from '../src/game/inventoryView.ts';
import type {EquipmentItem,EquipmentKind} from '../src/game/types.ts';

const item=(id:string,kind:EquipmentKind,grade:EquipmentItem['grade']='common',enhancement:EquipmentItem['enhancement']=0):EquipmentItem=>({id,kind,grade,enhancement});

test('V2 INVENTORY 01: modern equipment appears with Korean name, grade, slot, enhancement and facts',()=>{
 const s=initialState();
 s.equipmentItems=[
  item('drop-sword','association_supply_iron_sword','rare',3),
  item('drop-helmet','expedition_iron_helmet','common',0),
 ];
 const view=inventoryView(s);
 const sword=view.find(x=>x.sourceId==='drop-sword');
 assert.ok(sword);
 assert.equal(sword.name,'희귀 협회 보급 철검 +3');
 assert.equal(sword.grade,'rare');
 assert.equal(sword.slot,'weapon');
 assert.equal(sword.enhancement,3);
 assert.equal(sword.modern,true);
 assert.ok(sword.facts?.some(x=>x.startsWith('공격 +')));
 const helmet=view.find(x=>x.sourceId==='drop-helmet');
 assert.equal(helmet?.name,'일반 원정대 철제 투구 +0');
 assert.equal(helmet?.slot,'helmet');
});

test('V2 INVENTORY 02: modern equipment equips to its canonical seven-slot position',()=>{
 let s=initialState();
 s.equipmentItems=[
  item('helmet','expedition_iron_helmet'),
  item('gloves','mining_detail_reinforced_gloves'),
  item('necklace','association_registration_tag'),
  item('ring','expedition_merit_ring'),
 ];
 s=equip(s,'helmet');s=equip(s,'gloves');s=equip(s,'necklace');s=equip(s,'ring');
 assert.equal(s.equipped.helmet,'helmet');
 assert.equal(s.equipped.gloves,'gloves');
 assert.equal(s.equipped.necklace,'necklace');
 assert.equal(s.equipped.ring,'ring');
 assert.equal(inventoryView(s).filter(x=>x.modern&&x.equipped).length,4);
});

test('V2 INVENTORY 03: equipping another weapon replaces only the weapon slot',()=>{
 let s=initialState();
 s.equipmentItems=[
  item('sword-v2','association_supply_iron_sword'),
  item('bow-v2','outer_guard_longbow'),
  item('armor-v2','return_corps_plate_armor'),
 ];
 s=equip(s,'sword-v2');
 s=equip(s,'armor-v2');
 s=equip(s,'bow-v2');
 assert.equal(s.equipped.weapon,'bow-v2');
 assert.equal(s.equipped.armor,'armor-v2');
 assert.equal(inventoryView(s).find(x=>x.sourceId==='sword-v2')?.equipped,false);
 assert.equal(inventoryView(s).find(x=>x.sourceId==='bow-v2')?.equipped,true);
});

test('V2 INVENTORY 04: equipped modern item can be removed and weapon may be empty',()=>{
 let s=initialState();
 s.equipmentItems=[item('sword-v2','association_supply_iron_sword')];
 s=equip(s,'sword-v2');
 s=unequip(s,'sword-v2');
 assert.equal(s.equipped.weapon,null);
 assert.equal(inventoryView(s).find(x=>x.sourceId==='sword-v2')?.equipped,false);
 assert.match(s.notice,/해제 완료/);
});

test('V2 INVENTORY 05: equipment changes are blocked during an expedition',()=>{
 let s=initialState();
 s.equipmentItems=[item('armor-v2','return_corps_plate_armor')];
 s.expedition={} as any;
 const equipped=equip(s,'armor-v2');
 assert.notEqual(equipped.equipped.armor,'armor-v2');
 assert.match(equipped.notice,/원정 중/);
});

test('V2 INVENTORY 06: grade and enhancement deterministically affect equipped combat stats without Speed',()=>{
 let common=initialState();
 common.equipped={weapon:null,helmet:null,armor:null,gloves:null,boots:null,necklace:null,ring:null};
 common.equipmentItems=[item('armor','return_corps_plate_armor','common',0),item('boots','survey_corps_dust_boots','common',0)];
 common=equip(common,'armor');common=equip(common,'boots');
 let legendary=initialState();
 legendary.equipped={weapon:null,helmet:null,armor:null,gloves:null,boots:null,necklace:null,ring:null};
 legendary.equipmentItems=[item('armor','return_corps_plate_armor','legendary',10),item('boots','survey_corps_dust_boots','legendary',10)];
 legendary=equip(legendary,'armor');legendary=equip(legendary,'boots');
 const a=stats(common),b=stats(legendary);
 assert.ok(b.hp>a.hp);
 assert.ok(b.defense>a.defense);
 assert.equal(a.speed,b.speed);
});
