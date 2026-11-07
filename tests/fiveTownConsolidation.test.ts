import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WORLD_TOWNS,ACTIVE_TOWN_IDS,canTravel} from '../src/components/world/worldMap';
import {validWarDeclarationRequest} from '../src/online/villageWar';
test('only the five approved locations can be visited or declared for war',()=>{
 const kept=['city','herb-1','herb-2','farm-1','farm-2'];
 assert.deepEqual([...ACTIVE_TOWN_IDS].sort(),kept.sort());
 assert.deepEqual(WORLD_TOWNS.map(t=>t.id).sort(),kept.sort());
 const uuid='12345678-1234-1234-1234-123456789012';
 for(const id of ['herb-3','herb-4','herb-5','farm-3','farm-4','farm-5']){
  assert.equal(canTravel('city',id),false);
  assert.equal(validWarDeclarationRequest({id:uuid,townId:id}),false);
 }
 for(const id of kept)assert.equal(validWarDeclarationRequest({id:uuid,townId:id}),true);
});
test('server migration retires removed towns without deleting historical records',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261107013719_retire_six_towns_preserve_history.sql',import.meta.url),'utf8');
 assert.match(sql,/ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true/);
 assert.match(sql,/UPDATE private\.village_life_towns/);
 assert.match(sql,/WHERE is_active/);
 assert.match(sql,/and is_active/i);
 assert.match(sql,/t\.is_active/);
 assert.doesNotMatch(sql,/DELETE\s+FROM\s+private\.village_war_events|DELETE\s+FROM\s+private\.village_life_receipts/i);
});
