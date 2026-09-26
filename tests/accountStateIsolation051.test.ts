import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');

test('ACCOUNT STATE 01: inactive server run hydrates the current account instead of leaving stale battle state',()=>{
 assert.match(main,/if\(!restored\.active\|\|!restored\.run\)\{await hydrateAccountWithoutServerRun\(lease\);return;\}/);
 assert.match(main,/reconcileCloudState\(initialState\(\),lease\)/);
});

test('ACCOUNT STATE 02: account activation resets combat action locks and nonces',()=>{
 assert.match(main,/recordingAction\.current=false;onlineCombatNonce\.current=0;onlineRunVersion\.current=0;confirmedKillCount\.current=0/);
});

test('ACCOUNT STATE 03: stale cloud expedition is cleared when the server has no active run',()=>{
 assert.match(main,/remote\.payload\.expedition\?\{\.\.\.remote\.payload,expedition:null\}:remote\.payload/);
});

test('ACCOUNT STATE 04: battle server errors are visible in immersive mode',()=>{
 assert.match(main,/immersive&&cloudSyncStatus==='error'/);
});
