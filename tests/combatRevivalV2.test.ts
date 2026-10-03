import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {basicAttack,resolveMonsterTurn,resolveRevivalDecision} from '../src/game/engine/combat.ts';
import {applyEffect,activeShield} from '../src/game/engine/effects.ts';
import {combatRuntime} from '../src/game/engine/battleLifecycle.ts';
import {setSkillCooldown} from '../src/game/engine/cooldowns.ts';
import {createMonsterRuntime,TEST_MONSTER_MULTI,TEST_MONSTER_REACTIVE} from '../src/game/engine/monsterAi.ts';
import {prepareReactive} from '../src/game/engine/reactions.ts';

test('revival clears harmful effects and shield, keeps buffs resource cooldown and enemy state',()=>{
 let s=enter(initialState(),'ore',1),e=s.expedition!;
 e.hp=1;e.bag.revival=1;e.monster.attack=10000;e.monster.definitionId=TEST_MONSTER_MULTI.id;e.monsterRuntime=createMonsterRuntime(e.monster);
 e.jobRuntime.resource!.value=3;setSkillCooldown(e,'player','heavy',3);
 for(const id of ['poison','silence','root','guard','test_shield'])applyEffect(e,'player',id,'monster',0);
 e.phase='MONSTER_TURN';s=resolveMonsterTurn(s);const enemy=s.expedition!.monster.currentHp;
 s=resolveRevivalDecision(s,true);e=s.expedition!;
 assert.equal(e.phase,'PLAYER_TURN');assert.equal(e.hp,54);assert.equal(e.monster.currentHp,enemy);
 assert.equal(e.jobRuntime.resource!.value,3);assert.ok(combatRuntime(e).skillReadyTurns.player.heavy);
 assert.deepEqual(e.playerEffects.map(x=>x.effectId),['guard']);assert.equal(activeShield(e,'player'),undefined);
 assert.equal(s.combatEvents!.filter(x=>x.attacker==='monster').length,1);
});
test('death from counter resumes at monster normal turn and never resumes original multi-hit',()=>{
 let s=initialState();s.items.push({id:'bow',kind:'bow',tier:1,enhancement:0});s.equipped.weapon='bow';s=enter(s,'ore',1);
 const e=s.expedition!;e.hp=1;e.bag.revival=1;e.monster={...e.monster,definitionId:TEST_MONSTER_REACTIVE.id,hp:10000,currentHp:10000,attack:10000};e.monsterRuntime=createMonsterRuntime(e.monster);
 prepareReactive(e,'monster',TEST_MONSTER_REACTIVE.id,TEST_MONSTER_REACTIVE.skills![0]);
 s=basicAttack(s,()=>.99);assert.ok(s.expedition!.pendingRevival);
 s=resolveRevivalDecision(s,true);
 assert.equal(s.expedition!.phase,'MONSTER_TURN');assert.equal(s.combatEvents!.filter(x=>x.attacker==='player').length,1);
});
