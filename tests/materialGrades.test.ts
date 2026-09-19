import test from 'node:test';
import assert from 'node:assert/strict';
import {getMaterialGrade,getTowerMaterial} from '../src/game/data/config.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {initialState} from '../src/game/engine/state.ts';
import {reward} from '../src/game/engine/drops.ts';

test('v0.1.35 material grades map every floor to one of five grades',()=>{
  assert.deepEqual(Array.from({length:10},(_,i)=>getMaterialGrade(i+1)),[1,1,2,2,3,3,4,4,5,5]);
});

test('v0.1.35 canonical material mapping is one material per tower',()=>{
  assert.deepEqual(['ore','leather','gem','kaleon'].map(getTowerMaterial),['iron_ore','leather','crystal','verdant_anointing_oil']);
});

test('v0.1.35 normal drops use the current floor grade and roll one bonus once',()=>{
  const failedState=initialState(); failedState.tickets.ore[6]=1;
  const failed=enter(failedState,'ore',7); reward(failed,()=>.99);
  assert.deepEqual(failed.expedition!.loot.materials.ore,[0,0,0,1,0]);
  const successState=initialState(); successState.tickets.ore[6]=1;
  const success=enter(successState,'ore',7); reward(success,()=>0);
  assert.deepEqual(success.expedition!.loot.materials.ore,[0,0,0,2,0]);
  reward(success,()=>0);
  assert.deepEqual(success.expedition!.loot.materials.ore,[0,0,0,2,0]);
});
