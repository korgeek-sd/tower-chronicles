import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {basicAttack} from '../src/game/engine/combat.ts';
import {beginEncounter} from '../src/game/events/service.ts';
import {bestiaryKnowledge,bestiaryProgressFor,recordBestiaryDefeat,recordBestiaryEncounter} from '../src/game/engine/bestiary.ts';
import {BESTIARY_BACKUP_KEY,SAVE_KEY,createRepository,migrateV21,validSave} from '../src/storage/repository.ts';

test('BESTIARY PROGRESS 01: new v22 saves start empty',()=>{
 const s=initialState();
 assert.equal(s.version,22);
 assert.deepEqual(s.bestiary,{entries:{}});
 assert.ok(validSave(s));
});

test('BESTIARY PROGRESS 02: entering an authored tower records the first encounter once',()=>{
 const s=enter(initialState(),'gem',1);
 assert.equal(s.expedition?.monster.definitionId,'quartz_carapace_beetle');
 assert.deepEqual(s.bestiary.entries.quartz_carapace_beetle,{encounters:1,defeats:0});
});

test('BESTIARY PROGRESS 03: each new encounter records its actual canonical monster id',()=>{
 let s=enter(initialState(),'gem',1);
 const before=bestiaryProgressFor(s.bestiary,'quartz_carapace_beetle').encounters;
 s=beginEncounter(s,()=>0);
 assert.equal(bestiaryProgressFor(s.bestiary,'quartz_carapace_beetle').encounters,before+1);
});

test('BESTIARY PROGRESS 04: any normal defeat path increments defeat before the next encounter',()=>{
 let s=enter(initialState(),'gem',1);
 const id=s.expedition!.monster.definitionId!;
 s.expedition!.monster.currentHp=1;
 s=basicAttack(s,()=>.99);
 assert.equal(bestiaryProgressFor(s.bestiary,id).defeats,1);
 assert.ok(bestiaryProgressFor(s.bestiary,id).encounters>=1);
});

test('BESTIARY PROGRESS 05: unknown/dev monsters never pollute permanent bestiary state',()=>{
 const s=initialState(),monster={name:'QA',definitionId:'test-basic-ai',hp:1,currentHp:1,attack:1,defense:0,speed:1,skillPower:1};
 recordBestiaryEncounter(s,monster);
 recordBestiaryDefeat(s,monster);
 assert.deepEqual(s.bestiary.entries,{});
});

test('BESTIARY PROGRESS 06: information unlock follows encounter, one defeat, three defeats, and boss mastery rules',()=>{
 const s=initialState();
 assert.equal(bestiaryKnowledge(s.bestiary,'quartz_carapace_beetle'),'UNKNOWN');
 s.bestiary.entries.quartz_carapace_beetle={encounters:1,defeats:0};
 assert.equal(bestiaryKnowledge(s.bestiary,'quartz_carapace_beetle'),'ENCOUNTERED');
 s.bestiary.entries.quartz_carapace_beetle={encounters:2,defeats:1};
 assert.equal(bestiaryKnowledge(s.bestiary,'quartz_carapace_beetle'),'DEFEATED');
 s.bestiary.entries.quartz_carapace_beetle={encounters:3,defeats:3};
 assert.equal(bestiaryKnowledge(s.bestiary,'quartz_carapace_beetle'),'MASTERED');
 s.bestiary.entries.celestial_core_matrix={encounters:1,defeats:1};
 assert.equal(bestiaryKnowledge(s.bestiary,'celestial_core_matrix',true),'MASTERED');
});

test('BESTIARY PROGRESS 07: v21 migration creates empty progress and preserves the active known encounter',()=>{
 const live:any=enter(initialState(),'gem',1);
 live.version=21;
 delete live.bestiary;
 const id=live.expedition.monster.definitionId;
 const migrated=migrateV21(live);
 assert.equal(migrated.version,22);
 assert.deepEqual(migrated.bestiary.entries[id],{encounters:1,defeats:0});
 assert.ok(validSave(migrated));
});

test('BESTIARY PROGRESS 08: repository backs up a v21 save once before migrating it to v22',()=>{
 const legacy:any=initialState();
 legacy.version=21;
 delete legacy.bestiary;
 const raw=JSON.stringify(legacy),map=new Map<string,string>([[SAVE_KEY,raw]]);
 const repo=createRepository({getItem:key=>map.get(key)??null,setItem:(key,value)=>void map.set(key,value)});
 const loaded=repo.load();
 assert.equal(loaded.version,22);
 assert.deepEqual(loaded.bestiary,{entries:{}});
 assert.equal(map.get(BESTIARY_BACKUP_KEY),raw);
 const backup=map.get(BESTIARY_BACKUP_KEY);
 repo.load();
 assert.equal(map.get(BESTIARY_BACKUP_KEY),backup);
});

test('BESTIARY PROGRESS 09: malformed or unknown bestiary records are rejected',()=>{
 const negative:any=initialState();negative.bestiary.entries.quartz_carapace_beetle={encounters:1,defeats:-1};assert.equal(validSave(negative),false);
 const impossible:any=initialState();impossible.bestiary.entries.quartz_carapace_beetle={encounters:1,defeats:2};assert.equal(validSave(impossible),false);
 const unknown:any=initialState();unknown.bestiary.entries.unknown_monster={encounters:1,defeats:0};assert.equal(validSave(unknown),false);
});
