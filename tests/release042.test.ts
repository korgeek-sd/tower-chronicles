import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {PLAYABLE_TOWERS} from '../src/game/data/config.ts';
import {BESTIARY_ENTRIES,bestiaryCountForTower} from '../src/game/data/bestiary.ts';

test('RELEASE 0.1.42: save schema and original playable towers remain compatible',()=>{
 assert.equal(initialState().version,22);
 assert.equal(PLAYABLE_TOWERS.includes('ore'),true);
 assert.equal(PLAYABLE_TOWERS.includes('gem'),true);
});

test('RELEASE 0.1.42: the original 45-entry authored subset remains intact',()=>{
 assert.ok(BESTIARY_ENTRIES.length>=45);
 assert.equal(new Set(BESTIARY_ENTRIES.map(entry=>entry.id)).size,BESTIARY_ENTRIES.length);
 assert.equal(bestiaryCountForTower('ore'),10);
 assert.equal(bestiaryCountForTower('leather'),10);
 assert.equal(bestiaryCountForTower('gem'),25);
 assert.equal(bestiaryCountForTower('ore')+bestiaryCountForTower('leather')+bestiaryCountForTower('gem'),45);
});
