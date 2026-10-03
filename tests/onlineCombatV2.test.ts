import test from 'node:test';
import assert from 'node:assert/strict';
import {enter} from '../src/game/engine/expedition.ts';
import {initialState} from '../src/game/engine/state.ts';
import {reconcileOnlineCombatState,type OnlineCombatState} from '../src/online/economy.ts';
import {combatRuntime} from '../src/game/engine/battleLifecycle.ts';
test('online V2 retains server outcomes healing ready turns potion count and full shield pools',()=>{
 const s=enter(initialState(),'ore',1);const server:OnlineCombatState={encounterIndex:1,monsterId:s.expedition!.monster.definitionId!,monsterHp:100,monsterMaxHp:100,playerHp:210,playerMaxHp:180,phase:'PLAYER_TURN',actionNonce:1,engineVersion:2,jobResource:3,healingPotionUses:4,playerTurn:2,playerReadyTurns:{guard:5},playerEffects:[{effectId:'test_shield',behavior:'SHIELD',duration:3,currentShield:90}],combatEvents:[{kind:'DIRECT_DAMAGE',attacker:'player',target:'monster',incomingDamage:0,absorbedByShield:0,hpDamage:0,critical:false,outcome:'MISS',origin:'ACTION',hitIndex:1,hitCount:1},{kind:'HEAL',attacker:'player',target:'player',healing:30,critical:true,incomingDamage:0,absorbedByShield:0,hpDamage:0,hitIndex:1,hitCount:1}]};
 const n=reconcileOnlineCombatState(s,server,{emitCombatEvents:true});assert.equal(n.combatEvents!.at(-2)!.outcome,'MISS');assert.equal(n.combatEvents!.at(-1)!.kind,'HEAL');assert.equal(n.combatEvents!.at(-1)!.critical,true);assert.equal(n.expedition!.playerEffects[0].currentShield,90);assert.equal(combatRuntime(n.expedition!).healingPotionUses,4);assert.equal(combatRuntime(n.expedition!).skillReadyTurns.player.guard,5);assert.equal(n.expedition!.hp,210);
 const same=reconcileOnlineCombatState(n,server,{emitCombatEvents:true});assert.equal(same.combatEvents!.length,n.combatEvents!.length);
});
