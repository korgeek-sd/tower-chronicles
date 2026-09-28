import test from 'node:test';
import assert from 'node:assert/strict';
import {EQUIPMENT_DEFINITIONS,V2_STARTER_EQUIPMENT_ID,createV2StarterEquipment} from '../src/game/data/equipment.ts';
import {initialState} from '../src/game/engine/state.ts';
import {migrateV22,validSave} from '../src/storage/repository.ts';
import {startCraft} from '../src/game/engine/crafting.ts';

test('V2 CUTOVER 01: all nine equipment identities have finalized base stats',()=>{
 assert.deepEqual(EQUIPMENT_DEFINITIONS.association_supply_iron_sword.baseStats,{attack:10,defense:4});
 assert.deepEqual(EQUIPMENT_DEFINITIONS.outer_guard_longbow.baseStats,{attack:12,defense:1,critChance:.05});
 assert.deepEqual(EQUIPMENT_DEFINITIONS.archive_standard_arcane_staff.baseStats,{attack:6});
 assert.deepEqual(EQUIPMENT_DEFINITIONS.expedition_iron_helmet.baseStats,{hp:20,defense:5});
 assert.deepEqual(EQUIPMENT_DEFINITIONS.return_corps_plate_armor.baseStats,{hp:55,defense:7});
 assert.deepEqual(EQUIPMENT_DEFINITIONS.mining_detail_reinforced_gloves.baseStats,{attack:3,defense:2});
 assert.deepEqual(EQUIPMENT_DEFINITIONS.survey_corps_dust_boots.baseStats,{hp:15,defense:3});
 assert.deepEqual(EQUIPMENT_DEFINITIONS.association_registration_tag.baseStats,{attack:2,hp:25});
 assert.deepEqual(EQUIPMENT_DEFINITIONS.expedition_merit_ring.baseStats,{attack:4,critChance:.03});
});

test('V2 CUTOVER 02: fresh state starts on schema 23 with only the V2 starter sword equipped',()=>{
 const s=initialState();
 assert.equal(s.version,23);
 assert.deepEqual(s.items,[]);
 assert.deepEqual(s.equipmentItems,[createV2StarterEquipment()]);
 assert.equal(s.equipped.weapon,V2_STARTER_EQUIPMENT_ID);
 for(const slot of ['helmet','armor','gloves','boots','necklace','ring'] as const)assert.equal(s.equipped[slot],null);
 assert.ok(validSave(s));
});

test('V2 CUTOVER 03: v22 migration wipes legacy equipment but preserves progression and currencies',()=>{
 const source:any=initialState();
 source.version=22;
 source.silver=123456;
 source.market.gold=987;
 source.progress.ore=7;
 source.items=[
  {id:'starter',kind:'sword',tier:1,enhancement:0},
  {id:'legacy-armor',kind:'armor',tier:3,enhancement:2},
 ];
 source.equipmentItems=[{id:'existing-v2',kind:'expedition_merit_ring',grade:'rare',enhancement:2}];
 source.equipped={weapon:'starter',helmet:null,armor:'legacy-armor',gloves:null,boots:null,necklace:null,ring:'existing-v2'};
 source.market.orders=[{orderId:'o1',itemId:'gear:legacy-armor',side:'SELL',limitPrice:10,originalQuantity:1,remainingQuantity:1,ownerId:'local-player',createdAt:1,sequence:1,status:'OPEN',gear:source.items[1]}];
 source.market.storage=[{storageId:'s1',tradeId:'t1',side:'BUY',itemId:'gear:legacy-armor',quantity:1,silver:0,createdAt:1,gear:source.items[1]}];
 source.crafting.jobs=[
  {jobId:'craft-1',recipeId:'sword-1',itemId:'sword',kind:'sword',tier:1,quantity:1,field:'weapon',status:'QUEUED',queuedAt:0,startedAt:null,completesAt:null,durationMs:1,consumedMaterials:1,consumedSilver:0},
  {jobId:'craft-2',recipeId:'healing_lesser-1',itemId:'healing_lesser',kind:'healing_lesser',tier:1,quantity:10,field:'alchemy',status:'QUEUED',queuedAt:0,startedAt:null,completesAt:null,durationMs:1,consumedMaterials:1,consumedSilver:0},
 ];
 const next=migrateV22(source);
 assert.equal(next.version,23);
 assert.equal(next.silver,123456);
 assert.equal(next.market.gold,987);
 assert.equal(next.progress.ore,7);
 assert.deepEqual(next.items,[]);
 assert.deepEqual(next.equipmentItems,[createV2StarterEquipment()]);
 assert.equal(next.equipped.weapon,V2_STARTER_EQUIPMENT_ID);
 assert.equal(next.market.orders.length,0);
 assert.equal(next.market.storage?.length,0);
 assert.deepEqual(next.crafting.jobs.map(job=>job.field),['alchemy']);
 assert.ok(validSave(next));
});

test('V2 CUTOVER 04: migration resets preset and active-expedition equipment references without touching loot',()=>{
 const source:any=initialState();
 source.version=22;
 source.expeditionPresets[0]={name:'legacy',equipment:{weapon:'starter',armor:null,boots:null,accessory:null},skills:[...source.skills],potions:{...source.loadout},threshold:70};
 source.expedition={equipment:{weapon:'starter',armor:null,boots:null,accessory:null},loot:{equipment:[{id:'drop-1',kind:'expedition_merit_ring',grade:'rare',enhancement:0}]}};
 const next=migrateV22(source);
 assert.equal(next.expeditionPresets[0]?.equipment.weapon,V2_STARTER_EQUIPMENT_ID);
 assert.equal(next.expedition?.equipment.weapon,V2_STARTER_EQUIPMENT_ID);
 assert.equal(next.expedition?.loot.equipment?.[0]?.id,'drop-1');
});

test('V2 CUTOVER 05: starter factory is deterministic and does not duplicate ids',()=>{
 assert.equal(V2_STARTER_EQUIPMENT_ID,'starter-v2');
 assert.deepEqual(createV2StarterEquipment(),{
  id:'starter-v2',kind:'association_supply_iron_sword',grade:'common',enhancement:0,
 });
});


test('V2 CUTOVER 06: legacy equipment crafting cannot create new legacy gear after cutover',()=>{
 const s=initialState();
 s.materials.ore[0]=999;
 const next=startCraft(s,'sword',1,1,0);
 assert.equal(next.crafting.jobs.length,0);
 assert.deepEqual(next.items,[]);
 assert.match(next.notice,/장비 제작.*종료|드랍/);
});
