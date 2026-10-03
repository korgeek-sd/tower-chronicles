import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {applyEffect,isStunned,isSilenced,isRooted,cleanseEffects,dispelEffects,activeShield} from '../src/game/engine/effects.ts';
import {basicAttack,canUseSkill,flee,useBattlePotion,resolveMonsterTurn} from '../src/game/engine/combat.ts';
const state=()=>enter(initialState(),'ore',1);
test('same production effect extends duration without increasing magnitude',()=>{
 const e=state().expedition!;
 applyEffect(e,'player','fang_wound','monster',0);applyEffect(e,'player','fang_wound','monster',0);
 assert.equal(e.playerEffects[0].stackCount,1);assert.equal(e.playerEffects[0].remainingDuration,6);
});
test('cleanse prioritizes controls and DOT; dispel excludes shield',()=>{
 const e=state().expedition!;
 for(const id of ['poison','root','silence','stun','guard','test_shield'])applyEffect(e,'player',id,'monster',0);
 assert.equal(isStunned(e,'player'),true);assert.equal(isSilenced(e,'player'),true);assert.equal(isRooted(e,'player'),true);
 assert.deepEqual(cleanseEffects(e,'player',{count:2}),['stun','silence']);
 assert.deepEqual(dispelEffects(e,'player',{count:8}),['guard']);assert.ok(activeShield(e,'player'));
});
test('silence permits basic and potion but locks skills; root locks flee',()=>{
 let s=state();const e=s.expedition!;e.hp=50;
 applyEffect(e,'player','silence','monster',0);applyEffect(e,'player','root','monster',0);
 assert.equal(canUseSkill(s,'guard'),false);assert.strictEqual(flee(s),s);
 assert.equal(basicAttack(s,()=>.99).expedition!.phase,'MONSTER_TURN');
 assert.equal(useBattlePotion(s,'healing_lesser').expedition!.phase,'MONSTER_TURN');
});
test('stun loses a normal turn while cooldowns still advance',()=>{
 let s=state();applyEffect(s.expedition!,'monster','stun','player',0);
 s.expedition!.phase='MONSTER_TURN';const hp=s.expedition!.hp;s=resolveMonsterTurn(s);
 assert.equal(s.expedition!.hp,hp);assert.equal(s.expedition!.playerTurn,2);
});

test('stun immediately removes preparation even if the stun is cleansed before the next monster turn',()=>{
 const e=state().expedition!;e.monsterRuntime!.preparedActionId='charge';
 applyEffect(e,'monster','stun','player',0);cleanseEffects(e,'monster');
 assert.equal(e.monsterRuntime!.preparedActionId,null);
});
