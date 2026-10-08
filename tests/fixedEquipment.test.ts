import test from 'node:test';import assert from 'node:assert/strict';
import {EQUIPMENT_DEFINITIONS,EQUIPMENT_GRADES,equipmentItemStats,equipmentItemName} from '../src/game/data/equipment';
import {initialState,stats} from '../src/game/engine/state';import {marketItems,marketItemIdForEquipment} from '../src/game/market/marketService';
test('45 fixed equipment products have no enhancement suffix or stat variance',()=>{
 const game=initialState();const products=marketItems(game).filter(i=>i.modernEquipment);
 assert.equal(products.length,45);assert.equal(new Set(products.map(i=>i.id)).size,45);
 for(const kind of Object.keys(EQUIPMENT_DEFINITIONS))for(const grade of EQUIPMENT_GRADES){
  const a={id:'a',kind,grade,enhancement:0} as any,b={...a,id:'b',enhancement:10};
  assert.deepEqual(equipmentItemStats(a),equipmentItemStats(b));assert.equal(marketItemIdForEquipment(a),marketItemIdForEquipment(b));assert.ok(!equipmentItemName(a).includes('+'));
 }
});
test('exact fixed grade effects and six stat equipment contributions',()=>{
 const item={id:'bow',kind:'outer_guard_longbow',grade:'rare',enhancement:0} as const;
 assert.deepEqual(equipmentItemStats(item),{attack:17,critChance:.04});
 const s=initialState();s.equipmentItems=[];s.equipped.weapon=null;
 assert.equal(stats(s).attack,8);assert.equal(stats(s).defense,3);
 s.equipmentItems=[item,{id:'ring',kind:'expedition_merit_ring',grade:'legendary',enhancement:0},{id:'neck',kind:'association_registration_tag',grade:'legendary',enhancement:0}];
 s.equipped.weapon='bow';s.equipped.ring='ring';s.equipped.necklace='neck';
 assert.equal(stats(s).attack,35);assert.equal(stats(s).hp,245);
 assert.equal(stats(s).critChance,.09);assert.equal(stats(s).critDamage,1.7);assert.equal((stats(s) as any).armorPenetration,.08);
});
test('old save equipment is reset once while currencies and non-equipment progress survive',async()=>{
 const {normalizeCombatSave}=await import('../src/storage/repository');
 const s=initialState();delete s.equipmentRulesVersion;s.silver=10;s.lootItems.enhancement_stone=50;s.lootItems.job_draw_ticket=7;
 s.equipmentItems=[{id:'old',kind:'expedition_merit_ring',grade:'rare',enhancement:10}];s.equipped.ring='old';
 const next=normalizeCombatSave(s);assert.deepEqual(next.equipmentItems,initialState().equipmentItems);assert.equal(next.equipped.ring,null);assert.equal(next.silver,10);assert.equal(next.lootItems.job_draw_ticket,7);assert.equal(next.lootItems.enhancement_stone,undefined);
 next.equipmentItems.push({id:'new',kind:'expedition_merit_ring',grade:'rare',enhancement:0});assert.equal(normalizeCombatSave(next).equipmentItems.length,2);
});
