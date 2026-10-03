import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {combatRuntime} from '../src/game/engine/battleLifecycle.ts';
import {gainCombatResource,grantBasicAttackResource,spendCombatResource,type CombatSkillResource} from '../src/game/engine/combatResource.ts';

const expedition=()=>combatRuntime(enter(initialState(),'ore',1).expedition!);

test('COMBAT V2 resource: gain caps at four and basic generation is action based',()=>{
  const e=expedition();
  e.jobRuntime.resource!.value=3;
  assert.equal(gainCombatResource(e,2),1);
  assert.equal(e.jobRuntime.resource!.value,4);
  e.jobRuntime.resource!.value=0;
  assert.equal(grantBasicAttackResource(e,3),1);
  assert.equal(e.jobRuntime.resource!.value,1,'three successful hits still grant one resource');
  assert.equal(grantBasicAttackResource(e,0),0,'all MISS/IMMUNE grants nothing');
  assert.equal(e.jobRuntime.resource!.value,1);
});

test('COMBAT V2 resource: fixed spender pre-spends exact cost and refuses insufficient resource',()=>{
  const e=expedition();
  const spender:CombatSkillResource={kind:'SPENDER',cost:{mode:'FIXED',amount:2}};
  e.jobRuntime.resource!.value=4;
  assert.equal(spendCombatResource(e,spender),2);
  assert.equal(e.jobRuntime.resource!.value,2);
  e.jobRuntime.resource!.value=1;
  assert.equal(spendCombatResource(e,spender),null);
  assert.equal(e.jobRuntime.resource!.value,1);
});

test('COMBAT V2 resource: variable spender consumes available amount up to max and enforces min',()=>{
  const e=expedition();
  const spender:CombatSkillResource={kind:'SPENDER',cost:{mode:'VARIABLE',min:2,max:4}};
  e.jobRuntime.resource!.value=3;
  assert.equal(spendCombatResource(e,spender),3);
  assert.equal(e.jobRuntime.resource!.value,0);
  e.jobRuntime.resource!.value=1;
  assert.equal(spendCombatResource(e,spender),null);
  assert.equal(e.jobRuntime.resource!.value,1);
});
