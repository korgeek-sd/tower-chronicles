import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {PLAYABLE_TOWERS} from '../src/game/data/config.ts';
import {KALEON_NORMAL_POOL,KALEON_T1_FLOORS,KALEON_BOSS_SLOTS} from '../src/game/data/kaleonSpire.ts';
import {KALEON_MONSTER_DEFINITIONS} from '../src/game/engine/kaleonMonsters.ts';
import {monsterDefinitionById,validateMonsterDefinition} from '../src/game/engine/monsterAi.ts';
import {monsterFor} from '../src/game/engine/drops.ts';
import {bossIdFor,bossMonsterFor} from '../src/game/engine/bossTracking.ts';
import {bestiaryEntriesForTower,bestiaryEntryById} from '../src/game/data/bestiary.ts';
import {backgroundFor,MONSTER_GRAPHICS} from '../src/game/data/graphics.ts';
import {initialState} from '../src/game/engine/state.ts';
import {entryStatus,contentReady} from '../src/game/engine/exploration.ts';

test('CALEON 01: Green Spire is playable on all ten floors',()=>{
 assert.equal(PLAYABLE_TOWERS.includes('kaleon'),true);
 for(let floor=1;floor<=10;floor++){
  assert.equal(contentReady('kaleon',floor),true);
  assert.deepEqual(KALEON_T1_FLOORS[floor].normalPool,KALEON_NORMAL_POOL);
 }
 const state=initialState();
 assert.equal(entryStatus(state,'kaleon',1),'READY');
});

test('CALEON 02: five regular monsters share one pool and floor scaling',()=>{
 assert.equal(KALEON_NORMAL_POOL.length,5);
 assert.equal(KALEON_MONSTER_DEFINITIONS.length,10);
 const one=monsterFor('kaleon',1,()=>0);
 const ten=monsterFor('kaleon',10,()=>0);
 assert.equal(one.definitionId,'verdant_penitent');
 assert.equal(ten.definitionId,'verdant_penitent');
 assert.ok(ten.hp>one.hp);
 assert.ok(ten.attack>one.attack);
 assert.equal(monsterFor('kaleon',10,()=>.999).definitionId,'stigmata_reaper');
 for(const id of KALEON_NORMAL_POOL){
  const definition=monsterDefinitionById(id);
  assert.ok(definition,id);
  assert.deepEqual(validateMonsterDefinition(definition!),[]);
 }
});

test('CALEON 03: bosses occupy 6F through 10F and end with False Saint Caleon',()=>{
 assert.deepEqual(Object.entries(KALEON_BOSS_SLOTS).map(([floor,slot])=>[Number(floor),slot.bossId]),[
  [6,'stigmata_healer'],
  [7,'atonement_cross_bearer'],
  [8,'sacrament_executioner'],
  [9,'false_salvation_apostle'],
  [10,'false_saint_caleon'],
 ]);
 assert.equal(bestiaryEntryById('false_saint_caleon')?.name,'거짓 성자 칼레온');
 assert.equal(monsterDefinitionById('false_saint_caleon')?.name,'거짓 성자 칼레온');
 for(const [floorText,slot] of Object.entries(KALEON_BOSS_SLOTS)){
  const floor=Number(floorText);
  assert.equal(bossIdFor('kaleon',floor),slot.bossId);
  const boss=bossMonsterFor(slot.bossId,floor);
  assert.ok(boss);
  assert.equal(boss!.name,slot.name);
  assert.deepEqual(validateMonsterDefinition(monsterDefinitionById(slot.bossId)!),[]);
 }
});

test('CALEON 04: bestiary and art expose ten Caleon encounters',()=>{
 assert.equal(bestiaryEntriesForTower('kaleon').length,10);
 const graphics=MONSTER_GRAPHICS.filter(graphic=>graphic.tower==='kaleon');
 assert.equal(graphics.length,10);
 for(const graphic of graphics){
  assert.ok(graphic.image.idle);
  assert.ok(existsSync('public/'+graphic.image.idle),graphic.id+': '+graphic.image.idle);
 }
 assert.equal(backgroundFor('kaleon',1),'assets/backgrounds/kaleon/t1.webp');
 assert.ok(existsSync('public/'+backgroundFor('kaleon',1)));
});
