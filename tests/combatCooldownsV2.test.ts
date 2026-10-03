import {beginMonsterTurn,chooseMonsterAction,createMonsterRuntime,useMonsterAction,TEST_MONSTER_BASIC} from '../src/game/engine/monsterAi.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {combatRuntime,resetCombatRuntime} from '../src/game/engine/battleLifecycle.ts';
import {isSkillReady,setSkillCooldown,skillCooldownRemaining} from '../src/game/engine/cooldowns.ts';

test('COMBAT V2 cooldown: CD3 blocks exactly the next three player turns',()=>{
  const s=enter(initialState(),'ore',1);
  const e=combatRuntime(s.expedition!);
  e.playerTurn=5;
  e.phase='PLAYER_TURN';
  setSkillCooldown(e,'player','heavy',3);

  e.phase='MONSTER_TURN';
  assert.equal(skillCooldownRemaining(e,'player','heavy'),3);
  assert.equal(isSkillReady(e,'player','heavy'),false);

  e.phase='PLAYER_TURN';
  e.playerTurn=6;
  assert.equal(skillCooldownRemaining(e,'player','heavy'),3);
  assert.equal(isSkillReady(e,'player','heavy'),false);
  e.phase='MONSTER_TURN';
  assert.equal(skillCooldownRemaining(e,'player','heavy'),3,'monster turn does not advance player cooldown');

  e.phase='PLAYER_TURN';e.playerTurn=7;
  assert.equal(skillCooldownRemaining(e,'player','heavy'),2);
  e.playerTurn=8;
  assert.equal(skillCooldownRemaining(e,'player','heavy'),1);
  e.playerTurn=9;
  assert.equal(skillCooldownRemaining(e,'player','heavy'),0);
  assert.equal(isSkillReady(e,'player','heavy'),true);
});

test('COMBAT V2 cooldown: monster cooldown uses only monster turns and combat reset clears expiry',()=>{
  const s=enter(initialState(),'ore',1);
  const e=combatRuntime(s.expedition!);
  e.monsterTurn=2;
  e.phase='MONSTER_TURN';
  setSkillCooldown(e,'monster','crush',2);
  e.phase='PLAYER_TURN';
  assert.equal(skillCooldownRemaining(e,'monster','crush'),2);
  e.monsterTurn=3;e.phase='MONSTER_TURN';
  assert.equal(skillCooldownRemaining(e,'monster','crush'),2);
  e.monsterTurn=4;
  assert.equal(skillCooldownRemaining(e,'monster','crush'),1);
  e.monsterTurn=5;
  assert.equal(isSkillReady(e,'monster','crush'),true);

  resetCombatRuntime(e,999999);
  assert.equal(isSkillReady(e,'player','heavy'),true);
  assert.equal(isSkillReady(e,'monster','crush'),true);
});


test('COMBAT V2 cooldown: older expedition runtime is defaulted without losing HP or inventory',()=>{
  const s=enter(initialState(),'ore',1),e=s.expedition!;
  delete (e as any).skillReadyTurns;
  e.hp=17;e.cooldowns['turn:heavy']=2;
  assert.equal(skillCooldownRemaining(e,'player','heavy'),2);
  assert.equal(e.hp,17);
});

test('COMBAT V2 cooldown: monster action cannot repeat until N full future monster turns pass',()=>{
  const monster={definitionId:'test-basic-ai',name:'x',hp:100,currentHp:50,attack:0,defense:0,speed:1,skillPower:1};
  const runtime=createMonsterRuntime(monster);
  beginMonsterTurn(runtime);
  useMonsterAction(runtime,chooseMonsterAction(TEST_MONSTER_BASIC,runtime,monster,100,100));
  for(let turn=0;turn<2;turn++){
    beginMonsterTurn(runtime);
    assert.equal(chooseMonsterAction(TEST_MONSTER_BASIC,runtime,monster,100,100).kind,'BASIC_ATTACK');
  }
  beginMonsterTurn(runtime);
  assert.equal(chooseMonsterAction(TEST_MONSTER_BASIC,runtime,monster,100,100).skill?.id,'crush');
});
