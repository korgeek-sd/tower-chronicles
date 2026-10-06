import test from 'node:test';
import assert from 'node:assert/strict';
import {JOB_CATALOG} from '../src/game/jobs/catalog';
import {initFiveJobCombatDefinitions} from '../src/game/jobs/definitions';
import {getJobCombatDefinition,type JobCombatDefinition} from '../src/game/jobs/framework';

const A_IDS=[
 'executor','inquisitor','deep_delver','bloodfighter','expedition_tactician','ascetic_priest',
 'life_stitcher','subjugation_officer','rescuer','quartermaster','coroner','stair_scout',
] as const;

initFiveJobCombatDefinitions();

function aDefs():JobCombatDefinition[]{
 return A_IDS.map(id=>{
  const def=getJobCombatDefinition(id);
  assert.ok(def,`${id} must be registered for combat`);
  return def;
 });
}

function skill(def:JobCombatDefinition,index:number){return def.skills[index]!;}

test('A JOB 01: all 12 A-rank jobs are combat-ready with exactly three active skills',()=>{
 const catalogA=JOB_CATALOG.filter(job=>job.rarity==='A');
 assert.equal(catalogA.length,12);
 assert.equal(catalogA.filter(job=>job.implementationStatus==='COMBAT_READY').length,12);
 for(const def of aDefs()){
  assert.equal(def.passives.length,0);
  assert.equal(def.skills.length,3);
  assert.deepEqual(def.resource,{id:'combat',initialValue:0,maxValue:4});
 }
});

test('A JOB 02: skill 1 is always cooldown-0 generator +1 and skill 3 always spends fixed resource 3',()=>{
 for(const def of aDefs()){
  const generator=skill(def,0),finisher=skill(def,2);
  assert.equal(generator.cooldown,0,`${def.jobId} skill 1 cooldown`);
  assert.deepEqual(generator.resource,{kind:'GENERATOR',gain:1},`${def.jobId} skill 1 resource`);
  assert.deepEqual(finisher.resource,{kind:'SPENDER',cost:{mode:'FIXED',amount:3}},`${def.jobId} skill 3 resource`);
 }
});

test('A JOB 03: A-rank combat definitions never depend on basic attacks',()=>{
 for(const def of aDefs())assert.equal(JSON.stringify(def).includes('ACTION_IS_BASIC_ATTACK'),false,def.jobId);
});

test('A JOB 04: executor and inquisitor finishers keep approved conditional damage and penetration',()=>{
 const executor=getJobCombatDefinition('executor')!;
 const execute=skill(executor,2).effectActions.find(action=>action.kind==='DIRECT_ATTACK');
 assert.ok(execute&&execute.kind==='DIRECT_ATTACK');
 assert.equal(execute.baseMultiplier,3);
 assert.deepEqual(execute.conditionalLastHitMultiplier,{condition:{kind:'TARGET_HP_RATIO_LE',ratio:.3},multiplier:3.8});

 const inquisitor=getJobCombatDefinition('inquisitor')!;
 const condemn=skill(inquisitor,2).effectActions.find(action=>action.kind==='DIRECT_ATTACK');
 assert.ok(condemn&&condemn.kind==='DIRECT_ATTACK');
 assert.equal(condemn.baseMultiplier,3.1);
 assert.equal(condemn.penetrationRate,.35);
 assert.deepEqual(condemn.conditionalLastHitMultiplier,{condition:{kind:'TARGET_HAS_EFFECT',effectId:'weaken'},multiplier:3.5});
});

test('A JOB 05: bloodfighter HP costs and low-HP finisher match the approved risk profile',()=>{
 const def=getJobCombatDefinition('bloodfighter')!;
 assert.deepEqual(skill(def,1).effectActions[0],{kind:'SELF_HP_COST_PERCENT',percentOfMax:.08});
 assert.deepEqual(skill(def,2).effectActions[0],{kind:'SELF_HP_COST_PERCENT',percentOfMax:.12});
 const attack=skill(def,2).effectActions.find(action=>action.kind==='DIRECT_ATTACK');
 assert.ok(attack&&attack.kind==='DIRECT_ATTACK');
 assert.equal(attack.baseMultiplier,3.4);
 assert.deepEqual(attack.conditionalLastHitMultiplier,{condition:{kind:'SELF_HP_RATIO_LE',ratio:.5},multiplier:4});
});

test('A JOB 06: life stitcher reconstructs life with heal, regen, bleed cleanse and poison cleanse',()=>{
 const def=getJobCombatDefinition('life_stitcher')!;
 assert.deepEqual(skill(def,2).effectActions,[
  {kind:'HEAL_PERCENT',percent:.3},
  {kind:'APPLY_EFFECT',target:'SELF',effectId:'regen',duration:3},
  {kind:'REMOVE_EFFECT_TAG',target:'SELF',tag:'BLEED'},
  {kind:'REMOVE_EFFECT_TAG',target:'SELF',tag:'POISON'},
 ]);
});

test('A JOB 07: stair scout finisher is four 90-percent hits',()=>{
 const def=getJobCombatDefinition('stair_scout')!;
 const attack=skill(def,2).effectActions.find(action=>action.kind==='DIRECT_ATTACK');
 assert.ok(attack&&attack.kind==='DIRECT_ATTACK');
 assert.equal(attack.hits,4);
 assert.equal(attack.baseMultiplier,.9);
});
