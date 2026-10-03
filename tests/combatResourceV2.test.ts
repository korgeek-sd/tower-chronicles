import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {basicAttack} from '../src/game/engine/combat.ts';
import {gainCombatResource,spendCombatResource,grantBasicAttackResource} from '../src/game/engine/combatResource.ts';

test('resource caps at four and fixed/variable spend returns actual cost',()=>{
 const e=enter(initialState(),'ore',1).expedition!;
 assert.equal(gainCombatResource(e,8),4);
 assert.equal(spendCombatResource(e,{kind:'SPENDER',cost:{mode:'FIXED',amount:3}}),3);
 assert.equal(spendCombatResource(e,{kind:'SPENDER',cost:{mode:'VARIABLE',min:2,max:4}}),null);
 gainCombatResource(e,2);
 assert.equal(spendCombatResource(e,{kind:'SPENDER',cost:{mode:'VARIABLE',min:2,max:4}}),3);
 assert.equal(e.jobRuntime.resource!.value,0);
});
test('basic attack generation is once per successful action, including multi-hit',()=>{
 const e=enter(initialState(),'ore',1).expedition!;
 assert.equal(grantBasicAttackResource(e,0),0);
 assert.equal(grantBasicAttackResource(e,3),1);
 let s=enter(initialState(),'ore',1);s.expedition!.monster.currentHp=10000;s.expedition!.monster.hp=10000;
 s=basicAttack(s,()=>.99);
 assert.equal(s.expedition!.jobRuntime.resource!.value,1);
});

import {registerJobCombatDefinition} from '../src/game/jobs/framework.ts';
import {executeJobSkill} from '../src/game/jobs/resolver.ts';
import {applyEffect,EFFECTS} from '../src/game/engine/effects.ts';
test('offensive generator grants after successful shield hit, but never for all immune hits',()=>{
 const s=enter(initialState(),'ore',1),e=s.expedition!;e.jobRuntime.jobId='generator_fixture';e.monster.hp=10000;e.monster.currentHp=10000;
 registerJobCombatDefinition({jobId:'generator_fixture',passives:[],skills:[
 {id:'gen',name:'gen',description:'',cooldown:0,resource:{kind:'GENERATOR',gain:2},effectActions:[{kind:'DIRECT_ATTACK',hits:3,baseMultiplier:.1}]},
 {id:'neutral',name:'neutral',description:'',cooldown:0,effectActions:[]},
 {id:'spend',name:'spend',description:'',cooldown:1,resource:{kind:'SPENDER',cost:{mode:'VARIABLE',min:2,max:4}},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:1,conditionalLastHitMultiplier:{condition:{kind:'RESOURCE_SPENT_GE',amount:3},multiplier:3}}]}
 ]});
 applyEffect(e,'monster','test_shield','monster',0);executeJobSkill(s,'gen',()=>.99);assert.equal(e.jobRuntime.resource!.value,2);
 EFFECTS.test_immune={id:'test_immune',name:'immune',description:'',category:'BUFF',behavior:'STAT_MODIFIER',tags:['STAT_UP'],defaultDuration:2,stackingPolicy:'REFRESH_DURATION',payload:{stat:'hitImmunity',multiplier:1}};
 applyEffect(e,'monster','test_immune','monster',0);executeJobSkill(s,'gen',()=>.99);assert.equal(e.jobRuntime.resource!.value,2);
});
test('variable spender passes actual spent amount into effect branches',()=>{
 const s=enter(initialState(),'ore',1),e=s.expedition!;e.jobRuntime.jobId='generator_fixture';e.monster.hp=10000;e.monster.currentHp=10000;e.monster.defense=0;
 gainCombatResource(e,3);executeJobSkill(s,'spend',()=>.99);
 assert.equal(e.jobRuntime.resource!.value,0);assert.equal(s.combatEvents!.at(-1)!.incomingDamage,54);
 const t=enter(initialState(),'ore',1);t.expedition!.jobRuntime.jobId='generator_fixture';t.expedition!.monster.hp=10000;t.expedition!.monster.currentHp=10000;t.expedition!.monster.defense=0;gainCombatResource(t.expedition!,2);executeJobSkill(t,'spend',()=>.99);assert.equal(t.combatEvents!.at(-1)!.incomingDamage,18);
});

test('flat recovery generator actually heals before granting resource',()=>{
 registerJobCombatDefinition({jobId:'healer_fixture',passives:[],skills:[{id:'heal',name:'heal',description:'',cooldown:3,resource:{kind:'GENERATOR',gain:2},effectActions:[{kind:'HEAL_FLAT',amount:20}]}]});
 const s=enter(initialState(),'ore',1);s.expedition!.jobRuntime.jobId='healer_fixture';s.expedition!.hp=50;
 executeJobSkill(s,'heal',()=>.99);assert.equal(s.expedition!.hp,70);assert.equal(s.expedition!.jobRuntime.resource!.value,2);
});

test('job attached effects are gated per hit while cleanse and independent effects resolve',()=>{
 registerJobCombatDefinition({jobId:'actions_fixture',passives:[],skills:[{id:'hit',name:'hit',description:'',cooldown:0,effectActions:[{kind:'DIRECT_ATTACK',hits:2,baseMultiplier:.01,onHitEffects:[{effectId:'poison'}]}]},{id:'clean',name:'clean',description:'',cooldown:0,effectActions:[{kind:'CLEANSE',target:'SELF',count:1},{kind:'DISPEL',target:'TARGET',count:1}]}]});
 const s=enter(initialState(),'ore',1),e=s.expedition!;e.jobRuntime.jobId='actions_fixture';applyEffect(e,'monster','test_shield','monster',0);executeJobSkill(s,'hit',()=>.99);assert.equal(e.monsterEffects.some(x=>x.effectId==='poison'),false);
 applyEffect(e,'player','stun','monster',0);applyEffect(e,'player','poison','monster',0);applyEffect(e,'monster','attack_up','monster',0);executeJobSkill(s,'clean',()=>.99);assert.equal(e.playerEffects.some(x=>x.effectId==='stun'),false);assert.equal(e.playerEffects.some(x=>x.effectId==='poison'),true);assert.equal(e.monsterEffects.some(x=>x.effectId==='attack_up'),false);assert.equal(e.monsterEffects.some(x=>x.effectId==='test_shield'),true);
});
