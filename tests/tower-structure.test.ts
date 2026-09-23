import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG,floorSafety,PLAYABLE_TOWERS} from '../src/game/data/config.ts';
import {BOSS_FLOORS} from '../src/game/data/graphics.ts';
import {IRON_T1_FLOORS,IRON_NORMAL_POOL} from '../src/game/data/ironSpire.ts';
import {entryStatus} from '../src/game/engine/exploration.ts';
import {monsterFor} from '../src/game/engine/drops.ts';
import {initialState} from '../src/game/engine/state.ts';
import {createRepository,migrateV20,SAVE_KEY,validSave} from '../src/storage/repository.ts';

test('v0.1.30: each tower exposes exactly 1 through 10 floors and marks safe/PK metadata',()=>{
 const state=initialState();assert.equal(CONFIG.maxFloor,10);assert.equal(entryStatus(state,'ore',1),'READY');assert.equal(entryStatus(state,'ore',10),'NO_PASS');assert.equal(entryStatus(state,'ore',11),'INVALID');
 assert.equal(floorSafety(1),'SAFE');assert.equal(floorSafety(2),'SAFE');assert.equal(floorSafety(3),'PK_ELIGIBLE');assert.equal(floorSafety(10),'PK_ELIGIBLE');
});
test('v0.1.30: all iron floors use the same normal pool and only runtime stats scale',()=>{
 for(const floor of [1,5,9,10])assert.deepEqual(IRON_T1_FLOORS[floor].normalPool,IRON_NORMAL_POOL);
 const one=monsterFor('ore',1,()=>0),ten=monsterFor('ore',10,()=>0);assert.equal(one.definitionId,ten.definitionId);assert.equal(one.name,ten.name);assert.ok(ten.hp>one.hp);assert.ok(ten.attack>one.attack);
});
test('v0.1.30: boss slots are 6 through 10 and legacy v20 floors safely normalize',()=>{
 assert.deepEqual(BOSS_FLOORS,[6,7,8,9,10]);const legacy:any=initialState();legacy.version=20;for(const tower of ['ore','leather','gem','kaleon']){legacy.tickets[tower]=Array(50).fill(0);legacy.tickets[tower][49]=2;legacy.progress[tower]=50;legacy.exploration.highestReturned[tower]=50;}legacy.expedition=null;
 const migrated=migrateV20(legacy);assert.equal(migrated.version,21);assert.ok(validSave(migrated));for(const tower of ['ore','leather','gem','kaleon']){assert.equal(migrated.tickets[tower].length,10);assert.equal(migrated.tickets[tower][9],2);assert.equal(migrated.progress[tower],10);assert.equal(migrated.exploration.highestReturned[tower],10);}const memory=new Map([[SAVE_KEY,JSON.stringify(legacy)]]) as Map<string,string>;const repo=createRepository({getItem:key=>memory.get(key)??null,setItem:(key,value)=>void memory.set(key,value)});assert.equal(repo.load().version,21);
});
test('v0.1.31: a live v21 expedition and receipt validate without changing their 10-slot loot',()=>{
 const state:any=initialState();state.progress.ore=6;state.lastExpedition={outcome:'returned',tower:'ore',floor:6,time:1,kills:1,loot:structuredClone(state.expedition?.loot??{silver:0,materials:{ore:[0,0,0,0,0],leather:[0,0,0,0,0],gem:[0,0,0,0,0],kaleon:[0,0,0,0,0]},tickets:{ore:Array(10).fill(0),leather:Array(10).fill(0),gem:Array(10).fill(0),kaleon:Array(10).fill(0)},skillBooks:{},items:{}}),remainingPotions:structuredClone(state.potions)};
 assert.ok(validSave(state));
});

test('v0.1.41: playable tower registry exposes Iron and Crystal only',()=>{
 assert.deepEqual(PLAYABLE_TOWERS,['ore','gem']);
 assert.equal(PLAYABLE_TOWERS.includes('leather'),false);
 assert.equal(PLAYABLE_TOWERS.includes('kaleon'),false);
});
