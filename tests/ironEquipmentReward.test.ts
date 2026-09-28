import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {enter,leave} from '../src/game/engine/expedition.ts';
import {reward} from '../src/game/engine/drops.ts';
import {beginEncounter} from '../src/game/events/service.ts';
import {bossIdFor} from '../src/game/engine/bossTracking.ts';

function sequence(...values:number[]){
  let index=0;
  return ()=>values[index++]??.999999;
}

test('IRON EQUIPMENT REWARD 01: 1F miner can drop weighted starter-pool equipment into temporary loot',()=>{
  const s=enter(initialState(),'ore',1);
  s.expedition!.monster.definitionId='goblin_miner';
  reward(s,()=>.99,sequence(.01,.10,.10));
  const drops=s.expedition!.loot.equipment??[];
  assert.equal(drops.length,1);
  assert.equal(drops[0].kind,'association_supply_iron_sword');
  assert.equal(drops[0].grade,'common');
  assert.equal(drops[0].enhancement,0);
  assert.equal((s.equipmentItems??[]).length,0);
});

test('IRON EQUIPMENT REWARD 02: failed floor equipment roll creates no equipment',()=>{
  const s=enter(initialState(),'ore',1);
  s.expedition!.monster.definitionId='goblin_miner';
  reward(s,()=>.99,sequence(.50));
  assert.deepEqual(s.expedition!.loot.equipment,[]);
});

test('IRON EQUIPMENT REWARD 03: non-Iron towers do not use the Iron equipment table',()=>{
  const s=enter(initialState(),'leather',1);
  reward(s,()=>.99,sequence(0,0,0));
  assert.deepEqual(s.expedition!.loot.equipment,[]);
});

test('IRON EQUIPMENT REWARD 04: 4F bat weighting can select the longbow and rare grade',()=>{
  const base=initialState();base.tickets.ore[3]=1;
  const s=enter(base,'ore',4);
  s.expedition!.monster.definitionId='mine_bat';
  reward(s,()=>.99,sequence(.01,.08,.95));
  const [drop]=s.expedition!.loot.equipment??[];
  assert.equal(drop.kind,'outer_guard_longbow');
  assert.equal(drop.grade,'rare');
});

test('IRON EQUIPMENT REWARD 05: safe return commits equipment exactly once',()=>{
  const s=enter(initialState(),'ore',1);
  s.expedition!.monster.definitionId='goblin_miner';
  reward(s,sequence(.99,.01,.10,.10));
  const item=s.expedition!.loot.equipment![0];
  const returned=leave(s);
  assert.deepEqual(returned.equipmentItems,[item]);
  assert.equal(returned.expedition,null);
  assert.deepEqual(leave(returned).equipmentItems,[item]);
});

test('IRON EQUIPMENT REWARD 06: death preserves receipt but does not grant temporary equipment',()=>{
  const s=enter(initialState(),'ore',1);
  s.expedition!.monster.definitionId='goblin_miner';
  reward(s,sequence(.99,.01,.10,.10));
  const item=s.expedition!.loot.equipment![0];
  const dead=leave(s,true);
  assert.deepEqual(dead.equipmentItems,[]);
  assert.deepEqual(dead.lastExpedition!.loot.equipment,[item]);
});

test('IRON EQUIPMENT REWARD 07: Iron boss uses boss equipment chance and all-nine pool',()=>{
  const base=initialState();base.tickets.ore[5]=1;
  let s=enter(base,'ore',6);
  const boss=bossIdFor('ore',6)!;
  s=beginEncounter(s,()=>.5,boss);
  reward(s,()=>.99,sequence(.01,.99,.99));
  const [drop]=s.expedition!.loot.equipment??[];
  assert.ok(drop);
  assert.equal(drop.grade,'heroic');
  assert.equal(drop.enhancement,0);
});
