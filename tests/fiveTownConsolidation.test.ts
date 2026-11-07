import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WORLD_TOWNS,ACTIVE_TOWN_IDS,isActiveTownId,canTravel} from '../src/components/world/worldMap';
import {validGatherRequest} from '../src/online/villageLife';
import {validLifeAction} from '../src/game/life/crafting';
import {validVillageWarPending} from '../src/components/occupation/villageWarPending';
import {validWarDeclarationRequest} from '../src/online/villageWar';
test('only the five approved locations can be visited or declared for war',()=>{
 const kept=['city','herb-1','herb-2','farm-1','farm-2'];
 assert.deepEqual([...ACTIVE_TOWN_IDS].sort(),kept.sort());
 assert.deepEqual(WORLD_TOWNS.map(t=>t.id).sort(),kept.sort());
 for(const id of kept)assert.ok(isActiveTownId(id));
 const uuid='12345678-1234-1234-1234-123456789012';
 for(const id of ['herb-3','herb-4','herb-5','farm-3','farm-4','farm-5']){
  assert.equal(isActiveTownId(id),false);
  assert.equal(canTravel('city',id),false);
  assert.equal(validWarDeclarationRequest({id:uuid,townId:id}),false);
  assert.equal(validGatherRequest({id:uuid,town:id,resource:'farm',count:1}),false);
  assert.equal(validLifeAction({id:uuid,town:id,action:'craft',item:'potion',count:1}),false);
  assert.equal(validVillageWarPending({id:uuid,eventId:uuid,userId:uuid,townId:id,frontId:1,expectedEpoch:0,action:'PLACE'},uuid),false);
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


test('guild territory and occupation screens display exactly five active settlements',()=>{
 const guild=readFileSync(new URL('../src/components/association/GuildTerritoryPanel.tsx',import.meta.url),'utf8');
 const overview=readFileSync(new URL('../src/components/association/AssociationScreen.tsx',import.meta.url),'utf8');
 const occupation=readFileSync(new URL('../src/components/occupation/VillageWarBattleScreen.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(guild,/11개 마을|전체 11/);
 assert.match(guild,/전체 \{activeTowns.length\}/);
 assert.match(guild,/ACTIVE_TOWN_ID_SET\.has\(t\.townId\)/);
 assert.match(guild,/ACTIVE_TOWN_IDS\.length/);
 assert.match(overview,/ACTIVE_TOWN_ID_SET\.has\(t\.townId\)/);
 assert.match(occupation,/WORLD_TOWNS\.map\(t=><option/g);
 assert.equal(WORLD_TOWNS.length,5);
});
