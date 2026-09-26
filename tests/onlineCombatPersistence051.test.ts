import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {validSave} from '../src/storage/repository.ts';
import {reconcileOnlineCombatState,type OnlineCombatState} from '../src/online/economy.ts';

function activeRun(){
 const state=enter(initialState(),'ore',1);
 assert.ok(state.expedition);
 return state;
}

function snapshot(state:ReturnType<typeof activeRun>,overrides:Partial<OnlineCombatState>={}):OnlineCombatState{
 const expedition=state.expedition!;
 return {
  encounterIndex:1,
  monsterId:expedition.monster.definitionId??'goblin_miner',
  playerHp:expedition.hp,
  monsterHp:expedition.monster.currentHp,
  monsterMaxHp:expedition.monster.hp,
  phase:'PLAYER_TURN',
  actionNonce:1,
  ...overrides,
 };
}

test('ONLINE COMBAT SAVE 01: server revival snapshot remains persistable',()=>{
 const state=activeRun();
 state.expedition!.bag.revival=1;
 const next=reconcileOnlineCombatState(state,snapshot(state,{playerHp:0,phase:'PLAYER_DEAD',pendingRevival:true}));
 assert.deepEqual(next.expedition!.pendingRevival,{source:'DIRECT_HIT',steps:[{kind:'AFTER_MONSTER_ACTION'}]});
 assert.equal(next.expedition!.phase,'MONSTER_TURN');
 assert.equal(validSave(next),true);
});

test('ONLINE COMBAT SAVE 02: exhausted server shields are removed before persistence',()=>{
 const state=activeRun();
 const next=reconcileOnlineCombatState(state,snapshot(state,{
  playerEffects:[{effectId:'test_shield',remainingDuration:2,stackCount:1,applicationSequence:1,createdTurn:1,currentShield:0}],
  monsterEffects:[{effectId:'test_hit_shield',remainingDuration:2,stackCount:1,applicationSequence:2,createdTurn:1,currentShieldHits:0}],
 }));
 assert.deepEqual(next.expedition!.playerEffects,[]);
 assert.deepEqual(next.expedition!.monsterEffects,[]);
 assert.equal(validSave(next),true);
});

test('ONLINE COMBAT SAVE 03: active server shields are clamped to catalog limits and persist',()=>{
 const state=activeRun();
 const next=reconcileOnlineCombatState(state,snapshot(state,{
  playerEffects:[{effectId:'test_shield',remainingDuration:2.9,stackCount:1,applicationSequence:1,createdTurn:1,currentShield:999}],
  monsterEffects:[{effectId:'test_hit_shield',remainingDuration:2,stackCount:1,applicationSequence:2,createdTurn:1,currentShieldHits:99}],
 }));
 assert.equal(next.expedition!.playerEffects[0]?.currentShield,30);
 assert.equal(next.expedition!.monsterEffects[0]?.currentShieldHits,2);
 assert.equal(validSave(next),true);
});


test('ONLINE COMBAT SAVE 04: terminal kill snapshots never create an invalid BATTLE/BATTLE_END save',()=>{
 const state=activeRun();
 const next=reconcileOnlineCombatState(state,snapshot(state,{monsterHp:0,phase:'DEFEATED'}));
 assert.equal(next.expedition!.events.phase,'BATTLE');
 assert.ok(['PLAYER_TURN','MONSTER_TURN'].includes(next.expedition!.phase));
 assert.equal(next.expedition!.monster.currentHp,0);
 assert.equal(validSave(next),true);
});
