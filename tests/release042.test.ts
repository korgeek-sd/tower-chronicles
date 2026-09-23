import test from 'node:test';
import assert from 'node:assert/strict';
import {APP_VERSION} from '../src/storage/repository.ts';
import {initialState} from '../src/game/engine/state.ts';
import {PLAYABLE_TOWERS} from '../src/game/data/config.ts';
import {BESTIARY_ENTRIES,bestiaryCountForTower} from '../src/game/data/bestiary.ts';

test('RELEASE 0.1.42: app metadata, save schema and playable towers are aligned',()=>{
 assert.equal(APP_VERSION,'0.1.42');
 assert.equal(initialState().version,22);
 assert.deepEqual(PLAYABLE_TOWERS,['ore','gem']);
});

test('RELEASE 0.1.42: bestiary active catalog is 45 canonical entries',()=>{
 assert.equal(BESTIARY_ENTRIES.length,45);
 assert.equal(new Set(BESTIARY_ENTRIES.map(entry=>entry.id)).size,45);
 assert.equal(bestiaryCountForTower('ore'),10);
 assert.equal(bestiaryCountForTower('leather'),10);
 assert.equal(bestiaryCountForTower('gem'),25);
 assert.equal(bestiaryCountForTower('kaleon'),0);
});
