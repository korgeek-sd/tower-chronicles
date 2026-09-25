import test from 'node:test';
import assert from 'node:assert/strict';
import {APP_VERSION} from '../src/storage/repository.ts';
import {initialState} from '../src/game/engine/state.ts';
import {PLAYABLE_TOWERS} from '../src/game/data/config.ts';
import {KALEON_NORMAL_POOL,KALEON_BOSS_SLOTS,KALEON_T1_FLOORS} from '../src/game/data/kaleon.ts';
import {KALEON_NORMAL_DEFINITIONS,KALEON_BOSS_DEFINITIONS} from '../src/game/data/kaleonCombat.ts';
import {bestiaryEntriesForTower} from '../src/game/data/bestiary.ts';
import {bossIdFor,bossMonsterFor} from '../src/game/engine/bossTracking.ts';
import {monsterFor} from '../src/game/engine/drops.ts';
import {entryStatus} from '../src/game/engine/exploration.ts';
import {monsterDefinitionById,validateMonsterDefinition} from '../src/game/engine/monsterAi.ts';

test('RELEASE 0.1.45: metadata and four playable towers are aligned',()=>{
 assert.equal(APP_VERSION,'0.1.45');
 assert.equal(initialState().version,22);
 assert.deepEqual(PLAYABLE_TOWERS,['ore','leather','gem','kaleon']);
});

test('RELEASE 0.1.45: Caleon exposes five regulars and five bosses',()=>{
 assert.equal(KALEON_NORMAL_POOL.length,5);
 assert.equal(KALEON_NORMAL_DEFINITIONS.length,5);
 assert.equal(KALEON_BOSS_DEFINITIONS.length,5);
 assert.equal(Object.keys(KALEON_BOSS_SLOTS).length,5);
 assert.equal(bestiaryEntriesForTower('kaleon').length,10);
 for(const id of [...KALEON_NORMAL_POOL,...Object.values(KALEON_BOSS_SLOTS).map(x=>x.bossId)]){
  const definition=monsterDefinitionById(id);
  assert.ok(definition,id);
  assert.deepEqual(validateMonsterDefinition(definition!),[]);
 }
});

test('RELEASE 0.1.45: Caleon regular pool is available on every floor and scales at runtime',()=>{
 for(let floor=1;floor<=10;floor++)assert.deepEqual(KALEON_T1_FLOORS[floor].normalPool,KALEON_NORMAL_POOL);
 const one=monsterFor('kaleon',1,()=>0),ten=monsterFor('kaleon',10,()=>0);
 assert.equal(one.definitionId,'moss_spirit');
 assert.equal(ten.definitionId,'moss_spirit');
 assert.ok(ten.hp>one.hp);
 assert.ok(ten.attack>one.attack);
});

test('RELEASE 0.1.45: Caleon boss mapping is fixed to floors 6 through 10',()=>{
 assert.deepEqual(Object.entries(KALEON_BOSS_SLOTS).map(([floor,slot])=>[Number(floor),slot.bossId]),[
  [6,'greenwrought_gatekeeper'],
  [7,'overgrowth_regenerator'],
  [8,'transfer_subject_c17'],
  [9,'atonement_prototype'],
  [10,'false_saint_caleon'],
 ]);
 for(let floor=6;floor<=10;floor++){
  const id=bossIdFor('kaleon',floor);
  assert.equal(id,KALEON_BOSS_SLOTS[floor as keyof typeof KALEON_BOSS_SLOTS].bossId);
  assert.ok(id&&bossMonsterFor(id,floor));
 }
});

test('RELEASE 0.1.45: Caleon first floor can be entered with starter ticket',()=>{
 const s=initialState();
 assert.equal(entryStatus(s,'kaleon',1),'READY');
});
