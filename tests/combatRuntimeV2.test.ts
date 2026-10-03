import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,stats} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {combatRuntime,resetCombatRuntime} from '../src/game/engine/battleLifecycle.ts';
import {applyEffect} from '../src/game/engine/effects.ts';

test('COMBAT V2 runtime: new expedition starts with four-slot resource and empty combat runtime',()=>{
  const s=enter(initialState(),'ore',1);
  const e=combatRuntime(s.expedition!);
  assert.deepEqual(e.jobRuntime.resource,{id:'combat',value:0,maxValue:4});
  assert.equal(e.healingPotionUses,0);
  assert.deepEqual(e.skillReadyTurns,{player:{},monster:{}});
  assert.deepEqual(e.combatQueue,[]);
});

test('COMBAT V2 lifecycle: reset clears combat-only state but preserves expedition HP potion inventory and potion-use count',()=>{
  const s=enter(initialState(),'ore',1);
  const e=combatRuntime(s.expedition!);
  const maxHp=stats(s,e.equipment).hp;
  e.hp=maxHp-10;
  e.bag.healing_lesser=3;
  e.healingPotionUses=4;
  e.jobRuntime.resource!.value=4;
  e.cooldowns['turn:heavy']=3;
  e.skillReadyTurns.player.heavy=9;
  e.combatQueue.push({kind:'ACTION_COMPLETE',actor:'player'});
  applyEffect(e,'player','attack_up','player',e.playerTurn);
  applyEffect(e,'monster','weaken','player',e.monsterTurn);
  e.reactivePrepared.player={definitionId:'test',prepareSkillId:'test',reactionSkillId:'test',trigger:'DIRECT_HIT_RECEIVED'};
  if(e.monsterRuntime){e.monsterRuntime.skillCooldowns.test=2;e.monsterRuntime.preparedActionId='test';}

  resetCombatRuntime(e,maxHp);

  assert.equal(e.hp,maxHp-10);
  assert.equal(e.bag.healing_lesser,3);
  assert.equal(e.healingPotionUses,4);
  assert.deepEqual(e.jobRuntime.resource,{id:'combat',value:0,maxValue:4});
  assert.deepEqual(e.cooldowns,{});
  assert.deepEqual(e.skillReadyTurns,{player:{},monster:{}});
  assert.deepEqual(e.combatQueue,[]);
  assert.deepEqual(e.playerEffects,[]);
  assert.deepEqual(e.monsterEffects,[]);
  assert.deepEqual(e.reactivePrepared,{player:null,monster:null});
  assert.equal(e.monsterRuntime?.preparedActionId,null);
  assert.deepEqual(e.monsterRuntime?.skillCooldowns,{});
  assert.equal(e.playerTurn,1);
  assert.equal(e.monsterTurn,0);

  e.hp=maxHp+50;
  resetCombatRuntime(e,maxHp);
  assert.equal(e.hp,maxHp);
});
