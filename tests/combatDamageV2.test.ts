import {applyHealing} from '../src/game/engine/healing.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {damage} from '../src/game/engine/damage.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {initialState} from '../src/game/engine/state.ts';
import {applyEffect,activeShield,expireTurnEffects} from '../src/game/engine/effects.ts';
import {resolveActorSkill,resolveActorDirectHits} from '../src/game/engine/monsterSkills.ts';

test('percentage defense with penetration is applied before critical multiplier',()=>{
 for(const [def,expected] of [[0,100],[50,66],[100,50],[200,33],[300,25]])assert.equal(damage(100,def),expected);
 assert.equal(damage(100,100,1,1,1),100);
 assert.equal(damage(100,100,1,1.5),75);
});
test('shield amounts add, cap at 300 percent max HP and never expire by turns',()=>{
 const e=enter(initialState(),'ore',1).expedition!;
 applyEffect(e,'player','test_shield','player',1);applyEffect(e,'player','test_shield','player',1);
 assert.equal(activeShield(e,'player')?.currentShield,60);
 for(let i=0;i<30;i++)applyEffect(e,'player','test_shield','player',1);
 assert.equal(activeShield(e,'player')?.currentShield,540);
 for(let i=2;i<20;i++)expireTurnEffects(e,'player',i);
 assert.equal(activeShield(e,'player')?.currentShield,540);
});
test('fully shielded direct hit suppresses attached debuff but non-damaging debuff passes',()=>{
 const s=enter(initialState(),'ore',1),e=s.expedition!;e.monster.attack=1;
 applyEffect(e,'player','test_shield','player',e.playerTurn);
 resolveActorSkill(s,'monster',{id:'x',name:'x',description:'',cooldown:0,kind:'damage',effects:[{target:'TARGET',effectId:'poison'}]});
 assert.equal(e.playerEffects.some(x=>x.effectId==='poison'),false);
 resolveActorSkill(s,'monster',{id:'x',name:'x',description:'',cooldown:0,kind:'effect',effects:[{target:'TARGET',effectId:'poison'}]});
 assert.equal(e.playerEffects.some(x=>x.effectId==='poison'),true);
});

test('all MISS or IMMUNE hits resolve without damage shield consumption counters or generation',()=>{
 const s=enter(initialState(),'ore',1),e=s.expedition!;applyEffect(e,'monster','test_shield','monster',0);const hp=e.monster.currentHp;
 for(const outcome of ['MISS','IMMUNE'] as const){const result=resolveActorDirectHits(s,'player',2,1,true,()=>.99,1,{outcome});assert.equal(result.triggerPoints,0);assert.equal(result.total,0);assert.equal(result.resolutions[0].outcome,outcome);}
 assert.equal(e.monster.currentHp,hp);assert.equal(activeShield(e,'monster')?.currentShield,30);
});

test('combat events retain MISS IMMUNE reaction origin and critical healing',()=>{
 const s=enter(initialState(),'ore',1);resolveActorDirectHits(s,'player',1,1,false,()=>.99,1,{outcome:'MISS'});
 assert.equal(s.combatEvents!.at(-1)!.outcome,'MISS');assert.equal(s.combatEvents!.at(-1)!.origin,'REACTION');
 resolveActorDirectHits(s,'player',1,1,true,()=>.99,1,{outcome:'IMMUNE'});assert.equal(s.combatEvents!.at(-1)!.outcome,'IMMUNE');
 applyHealing(s,'player',20,{canCrit:true,rng:()=>0});assert.equal(s.combatEvents!.at(-1)!.kind,'HEAL');assert.equal(s.combatEvents!.at(-1)!.critical,true);
});
