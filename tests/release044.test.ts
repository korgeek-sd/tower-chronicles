import test from 'node:test';
import assert from 'node:assert/strict';
import {APP_VERSION} from '../src/storage/repository.ts';
import {initialState} from '../src/game/engine/state.ts';
import {PLAYABLE_TOWERS} from '../src/game/data/config.ts';
import {RED_NORMAL_POOL,RED_BOSS_SLOTS} from '../src/game/data/redFang.ts';
import {RED_NORMAL_DEFINITIONS} from '../src/game/data/redCombat.ts';
import {bestiaryEntriesForTower,bestiaryEntryById} from '../src/game/data/bestiary.ts';
import {monsterDefinitionById,validateMonsterDefinition} from '../src/game/engine/monsterAi.ts';

test('RELEASE 0.1.44: app metadata, save schema and playable towers are aligned',()=>{
 assert.equal(APP_VERSION,'0.1.44');
 assert.equal(initialState().version,22);
 assert.deepEqual(PLAYABLE_TOWERS,['ore','leather','gem']);
});

test('RELEASE 0.1.44: Red Fang exposes five regulars and five authored bosses',()=>{
 assert.equal(RED_NORMAL_POOL.length,5);
 assert.equal(RED_NORMAL_DEFINITIONS.length,5);
 assert.equal(Object.keys(RED_BOSS_SLOTS).length,5);
 assert.equal(bestiaryEntriesForTower('leather').length,10);
 for(const id of RED_NORMAL_POOL){
  const definition=monsterDefinitionById(id);
  assert.ok(definition,id);
  assert.deepEqual(validateMonsterDefinition(definition!),[]);
 }
});

test('RELEASE 0.1.44: Red Fang boss floor mapping remains 6 through 10',()=>{
 assert.deepEqual(Object.entries(RED_BOSS_SLOTS).map(([floor,slot])=>[Number(floor),slot.bossId]),[
  [6,'bloodmane_tracker'],
  [7,'redjaw_hide_eater'],
  [8,'fang_pack_matriarch'],
  [9,'sanctuary_talon_bishop'],
  [10,'lord_of_red_fang'],
 ]);
});

test('RELEASE 0.1.44: Crystal 6F uses the canonical boss display name',()=>{
 assert.equal(bestiaryEntryById('white_crystal_armor_behemoth')?.name,'백정갑주 균열거수');
 assert.equal(monsterDefinitionById('white_crystal_armor_behemoth')?.name,'백정갑주 균열거수');
});
