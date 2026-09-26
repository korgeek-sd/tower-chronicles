import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {validSave} from '../src/storage/repository.ts';
import {reconcileOnlineCombatState,reconcileOnlineExpeditionState,type OnlineCombatState,type RestoredOnlineExpedition} from '../src/online/economy.ts';

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


test('ONLINE COMBAT SAVE 05: zero turns and malformed cooldown counters are normalized before persistence',()=>{
 const state=activeRun();
 const next=reconcileOnlineCombatState(state,snapshot(state,{
  playerTurn:0,
  monsterTurn:0,
  playerCooldowns:{skill:-2.7,other:3.8},
  monsterCooldowns:{slam:-1.2,charge:4.9},
 }));
 assert.equal(next.expedition!.playerTurn,1);
 assert.equal(next.expedition!.monsterTurn,0);
 assert.deepEqual(next.expedition!.cooldowns,{skill:0,other:3});
 assert.deepEqual(next.expedition!.monsterRuntime?.skillCooldowns,{slam:0,charge:4});
 assert.equal(validSave(next),true);
});


test('ONLINE COMBAT SAVE 06: canonical server event after a kill clears defeated combat runtime and stays in expedition',()=>{
 const state=activeRun();
 state.expedition!.reactivePrepared.monster={definitionId:'test',prepareSkillId:'prepare',reactionSkillId:'react',trigger:'DIRECT_HIT_RECEIVED'};
 state.expedition!.monsterRuntime={definitionId:'goblin_miner',skillCooldowns:{slam:2},preparedActionId:'slam',turnNumber:3};
 const restored:RestoredOnlineExpedition={
  active:true,
  run:{
   runId:'11111111-1111-4111-8111-111111111111',
   tower:'ore',
   floor:1,
   confirmedKills:1,
   encounterIndex:1,
   bossProgress:0,
   bossDefeated:false,
   pendingEvent:{
    instanceId:'server-event-11111111-1111-4111-8111-111111111111-2',
    eventId:'common_cache',
    bossId:null,
    state:'CHOICE',
    choiceId:null,
    outcomeId:null,
    resultText:'',
    resultLines:[],
    next:'NORMAL',
    randomValue:.25,
    expiresAt:null,
   },
   temporaryLoot:{silver:12,material:1,tickets:0},
   stronghold:null,
   runVersion:2,
   potions:{lesser:state.expedition!.bag.healing_lesser,standard:state.expedition!.bag.healing_standard,greater:state.expedition!.bag.healing_greater,supreme:state.expedition!.bag.healing_supreme,revival:state.expedition!.bag.revival},
  },
  combat:{...snapshot(state,{monsterHp:0,phase:'DEFEATED'}),monsterCooldowns:{slam:2},monsterPreparedAction:'slam'},
 };
 const next=reconcileOnlineExpeditionState(state,restored);
 assert.ok(next.expedition);
 assert.equal(next.expedition!.events.phase,'EVENT');
 assert.equal(next.expedition!.phase,'BATTLE_END');
 assert.equal(next.expedition!.events.pendingEvent?.instanceId,'server-event-11111111-1111-4111-8111-111111111111-2');
 assert.equal(next.expedition!.monsterRuntime,null);
 assert.deepEqual(next.expedition!.reactivePrepared,{player:null,monster:null});
 assert.equal(next.expedition!.events.activeBossId,null);
 assert.equal(next.expedition!.bossTracking.pendingBossId,null);
 assert.equal(validSave(next),true);
});
