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
