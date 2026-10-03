import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,stats} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {applyHealing,decayPlayerOverheal} from '../src/game/engine/healing.ts';
import {applyEffect,activeShield} from '../src/game/engine/effects.ts';
import {passPlayerTurn,useBattlePotion} from '../src/game/engine/combat.ts';
import {combatRuntime} from '../src/game/engine/battleLifecycle.ts';

test('skill healing can crit and overheal, potion cannot crit, excess decays by 25 percent',()=>{
 const s=enter(initialState(),'ore',1),e=s.expedition!;
 applyHealing(s,'player',20,{canCrit:true,rng:()=>0});assert.equal(e.hp,210);
 assert.equal(decayPlayerOverheal(e,180),7.5);assert.equal(e.hp,202.5);
 const r=applyHealing(s,'player',20,{canCrit:false,rng:()=>0});assert.equal(r.critical,false);assert.equal(e.hp,222.5);
});
test('DOT bypasses shield and lethal DOT suppresses HOT before revival decision',()=>{
 let s=enter(initialState(),'ore',1),e=s.expedition!;e.hp=3;e.bag.revival=1;
 applyEffect(e,'player','test_shield','player',0);applyEffect(e,'player','poison','monster',0);applyEffect(e,'player','regen','player',0);
 s=passPlayerTurn(s,()=>.99);e=s.expedition!;
 assert.equal(e.hp,0);assert.ok(e.pendingRevival);assert.equal(activeShield(e,'player')?.currentShield,30);
});
test('sixth expedition healing potion is rejected without consuming inventory or a turn',()=>{
 const s=enter(initialState(),'ore',1);s.expedition!.hp=50;combatRuntime(s.expedition!).healingPotionUses=5;
 assert.strictEqual(useBattlePotion(s,'healing_lesser'),s);
});
