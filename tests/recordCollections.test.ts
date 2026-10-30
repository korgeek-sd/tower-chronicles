import test from 'node:test';
import assert from 'node:assert/strict';
import {RECORD_COLLECTIONS,collectionRecordProgress,collectionRecordBonuses,equipmentRecordEntryId} from '../src/game/data/recordCollections';
import {APPEARANCES} from '../src/game/data/cosmetics';
import {EQUIPMENT_DEFINITIONS} from '../src/game/data/equipment';

test('ten appearance and ten equipment records, all with known identifiers',()=>{
 const appearances=RECORD_COLLECTIONS.filter(record=>record.kind==='appearance');
 const equipment=RECORD_COLLECTIONS.filter(record=>record.kind==='equipment');
 assert.equal(appearances.length,10);
 assert.equal(equipment.length,10);
 assert.equal(new Set(RECORD_COLLECTIONS.map(record=>record.id)).size,20);
 const appearanceIds=new Set(APPEARANCES.map(item=>item.id));
 for(const record of appearances){
  assert.ok(record.appearanceIds.length>=2);
  for(const id of record.appearanceIds)assert.ok(appearanceIds.has(id),id);
 }
 const ids=new Set<string>();
 for(const record of equipment)for(const [i,entry] of record.equipment.entries()){
  assert.ok(EQUIPMENT_DEFINITIONS[entry.kind]);
  const id=equipmentRecordEntryId(record,i);
  assert.ok(!ids.has(id),id);ids.add(id);
 }
 assert.equal(ids.size,20);
});
test('appearance collection auto-completes without consuming an appearance',()=>{
 const record=RECORD_COLLECTIONS.find(record=>record.kind==='appearance')!;
 const empty=collectionRecordProgress(record,[],new Set());
 assert.deepEqual(empty,{count:0,total:record.appearanceIds.length,complete:false});
 const done=collectionRecordProgress(record,[...record.appearanceIds],new Set());
 assert.equal(done.complete,true);
 assert.equal(done.count,done.total);
});
test('equipment collection requires every independently registered item',()=>{
 const record=RECORD_COLLECTIONS.find(record=>record.kind==='equipment')!;
 const first=equipmentRecordEntryId(record,0);
 assert.deepEqual(collectionRecordProgress(record,[],new Set([first])),{count:1,total:2,complete:false});
 assert.equal(collectionRecordProgress(record,[],new Set(record.equipment.map((_,i)=>equipmentRecordEntryId(record,i)))).complete,true);
});
test('collection bonuses count only completed sets and never uncompleted ones',()=>{
 const a=RECORD_COLLECTIONS.find(r=>r.kind==='appearance')!;
 const b=RECORD_COLLECTIONS.find(r=>r.kind==='equipment')!;
 const bonuses=collectionRecordBonuses(a.appearanceIds,new Set(b.equipment.map((_,i)=>equipmentRecordEntryId(b,i))));
 assert.equal(bonuses.completed,2);
 assert.equal(bonuses.total,20);
 assert.equal(bonuses[b.reward.stat],b.reward.value+(a.reward.stat===b.reward.stat?a.reward.value:0));
});
