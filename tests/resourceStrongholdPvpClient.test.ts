import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const api=readFileSync(new URL('../src/online/resourceStronghold.ts',import.meta.url),'utf8');
const panel=readFileSync(new URL('../src/components/events/ResourceStrongholdPanel.tsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');

test('STRONGHOLD PVP CLIENT 01: client exposes state request response combat abandon and realtime APIs',()=>{
 for(const name of ['getResourceStrongholdState','requestResourceStronghold','respondResourceStrongholdContest','applyResourceStrongholdContestAction','abandonResourceStronghold','subscribeResourceStrongholdRealtime'])
  assert.match(api,new RegExp('export (?:const|function) '+name));
 assert.match(api,/crypto\.randomUUID\(\)/);
 assert.match(api,/private:true/);
});

test('STRONGHOLD PVP CLIENT 02: minimal panel exposes claim contest defend abandon and intervention actions',()=>{
 for(const label of ['점령','쟁탈','방어','포기','공격','방어 태세'])assert.match(panel,new RegExp(label));
 assert.match(panel,/decisionEndsAt/);
 assert.match(panel,/actionNonce/);
});

test('STRONGHOLD PVP CLIENT 03: app subscribes and mounts the panel for authoritative online expeditions',()=>{
 assert.match(app,/subscribeResourceStrongholdRealtime/);
 assert.match(app,/ResourceStrongholdPanel/);
});
