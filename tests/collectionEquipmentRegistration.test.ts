import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,stats} from '../src/game/engine/state';
import {registerCollectionEquipment} from '../src/game/engine/collection';
import {APPEARANCE_SETS,collectionSetProgress,collectionEquipmentLabel} from '../src/game/data/appearanceSets';
import {createV2StarterEquipment} from '../src/game/data/equipment';
import type {EquipmentItem} from '../src/game/types';

test('equipment + appearance requirements form a single collection without consuming appearance unlocks',()=>{
 const s=APPEARANCE_SETS[0];
 assert.equal(s.appearanceIds.length,3);
 assert.deepEqual(s.equipment,{kind:'return_corps_plate_armor',grade:'rare'});
 assert.equal(collectionEquipmentLabel(s.equipment),'희귀 귀환대 판금갑');
 assert.deepEqual(collectionSetProgress(s,s.appearanceIds),{count:3,total:4,complete:false});
 assert.deepEqual(collectionSetProgress(s,s.appearanceIds,new Set([s.id])),{count:4,total:4,complete:true});
});
test('registering an unequipped matching item consumes exactly one item and persists the registration',()=>{
 const set=APPEARANCE_SETS[0],base=initialState(),gear:EquipmentItem={id:'good-1',kind:set.equipment.kind,grade:set.equipment.grade,enhancement:0};
 base.equipmentItems.push(gear,{...gear,id:'good-2'});
 const unlocked=[...base.cosmetics.unlockedAppearanceIds,...set.appearanceIds];base.cosmetics.unlockedAppearanceIds=unlocked;
 const before=stats(base);const done=registerCollectionEquipment(base,set.id,gear.id);
 assert.equal(done.collectionRegisteredItems?.[set.id],gear.id);
 assert.equal(done.equipmentItems.some(x=>x.id===gear.id),false);
 assert.equal(done.equipmentItems.some(x=>x.id==='good-2'),true);
 assert.deepEqual(done.cosmetics.unlockedAppearanceIds,unlocked);
 assert.deepEqual(stats(done),before,'proposed collection reward must not silently modify stats');
 const retry=registerCollectionEquipment(done,set.id,'good-2');
 assert.deepEqual(retry.equipmentItems,done.equipmentItems);
 assert.equal(retry.collectionRegisteredItems?.[set.id],gear.id);
});
test('a wrong grade, a protected starter and equipped or missing items cannot be registered',()=>{
 const set=APPEARANCE_SETS[0],base=initialState();
 const wrong:EquipmentItem={id:'wrong',kind:set.equipment.kind,grade:'common',enhancement:0};
 const right:EquipmentItem={...wrong,id:'right',grade:set.equipment.grade};
 base.equipmentItems.push(wrong,right);
 assert.equal(registerCollectionEquipment(base,set.id,'wrong').equipmentItems.length,3);
 assert.equal(registerCollectionEquipment(base,set.id,'starter-v2').equipmentItems.length,3);
 assert.equal(registerCollectionEquipment(base,set.id,'not-here').equipmentItems.length,3);
 base.equipped.armor='right';
 assert.equal(registerCollectionEquipment(base,set.id,'right').equipmentItems.length,3);
});
test('the hardest tier combines SSR appearances with legendary gear',()=>{
 const legendary=APPEARANCE_SETS.filter(s=>s.rarity==='SSR');
 assert.ok(legendary.length>0);
 assert.ok(legendary.every(s=>s.equipment.grade==='legendary'));
 assert.ok(legendary.every(s=>s.appearanceIds.some(id=>id!=='')));
});
