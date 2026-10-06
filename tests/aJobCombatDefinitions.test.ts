import test from 'node:test';
import assert from 'node:assert/strict';
import {JOB_CATALOG} from '../src/game/jobs/catalog';
import {jobDetailById} from '../src/game/jobs/details';
import {initFiveJobCombatDefinitions} from '../src/game/jobs/definitions';
import {getJobCombatDefinition,type JobCombatDefinition,type JobEffectAction} from '../src/game/jobs/framework';

initFiveJobCombatDefinitions();

const A_JOB_IDS=[
 'executor','inquisitor','deep_delver','bloodfighter','expedition_tactician','ascetic_priest',
 'life_stitcher','subjugation_officer','rescuer','quartermaster','coroner','stair_scout',
] as const;
const ACTIVE_ACTIONS=new Set(['DIRECT_ATTACK','APPLY_EFFECT','REMOVE_EFFECT_TAG','CLEANSE','DISPEL','HEAL_PERCENT','HEAL_FLAT','SELF_HP_COST_PERCENT','CHANGE_RESOURCE','SET_FLAG']);
const EFFECT_IDS=new Set(['bleed','weaken','attack_up','defense_up','regen','b_attack_25','b_guard_15','b_guard_30']);

function def(id:(typeof A_JOB_IDS)[number]):JobCombatDefinition{
 const value=getJobCombatDefinition(id);
 assert.ok(value,`${id} should have a registered combat definition`);
 return value;
}
function actions(id:(typeof A_JOB_IDS)[number],skillIndex:number):JobEffectAction[]{return def(id).skills[skillIndex].effectActions;}
function directAttack(id:(typeof A_JOB_IDS)[number],skillIndex:number){
 const action=actions(id,skillIndex).find((candidate):candidate is Extract<JobEffectAction,{kind:'DIRECT_ATTACK'}>=>candidate.kind==='DIRECT_ATTACK');
 assert.ok(action,`${id} skill ${skillIndex+1} should contain DIRECT_ATTACK`);
 return action;
}
function resourceLabel(skill:JobCombatDefinition['skills'][number]){
 const resource=skill.resource!;
 if(resource.kind==='GENERATOR')return `자원 +${resource.gain}`;
 if(resource.kind==='SPENDER')return `자원 -${resource.cost.mode==='FIXED'?resource.cost.amount:resource.cost.min}`;
 return '자원 변화 없음';
}

test('A-rank catalog exposes all 12 jobs as combat-ready three-skill kits with the approved resource loop',()=>{
 const jobs=JOB_CATALOG.filter(job=>job.rarity==='A');
 assert.equal(jobs.length,12);
 assert.deepEqual(jobs.map(job=>job.id),A_JOB_IDS);
 for(const job of jobs){
  assert.equal(job.implementationStatus,'COMBAT_READY',job.id);
  const combat=def(job.id as (typeof A_JOB_IDS)[number]);
  assert.deepEqual(combat.resource,{id:'combat',initialValue:0,maxValue:4},job.id);
  assert.equal(combat.passives.length,0,job.id);
  assert.equal(combat.skills.length,3,job.id);
  assert.deepEqual(job.combatKit?.activeSkillIds,combat.skills.map(skill=>skill.id),job.id);
  assert.deepEqual(combat.skills.map(skill=>skill.id),[`${job.id}_skill_1`,`${job.id}_skill_2`,`${job.id}_skill_3`],job.id);
  assert.deepEqual(combat.skills[0].resource,{kind:'GENERATOR',gain:1},job.id);
  assert.equal(combat.skills[0].cooldown,0,job.id);
  assert.deepEqual(combat.skills[1].resource,{kind:'NEUTRAL'},job.id);
  assert.deepEqual(combat.skills[2].resource,{kind:'SPENDER',cost:{mode:'FIXED',amount:3}},job.id);
 }
});

test('A-rank skills stay inside the existing combat engine and never depend on basic attacks',()=>{
 for(const id of A_JOB_IDS){
  const combat=def(id);
  assert.equal(JSON.stringify(combat).includes('ACTION_IS_BASIC_ATTACK'),false,id);
  for(const skill of combat.skills){
   for(const action of skill.effectActions){
    assert.equal(ACTIVE_ACTIONS.has(action.kind),true,`${skill.id}: ${action.kind}`);
    if(action.kind==='APPLY_EFFECT') assert.equal(EFFECT_IDS.has(action.effectId),true,`${skill.id}: ${action.effectId}`);
   }
  }
 }
});

test('A-rank representative authored numbers match the approved design',()=>{
 const executor=directAttack('executor',2);
 assert.equal(executor.baseMultiplier,3);
 assert.deepEqual(executor.conditionalLastHitMultiplier,{condition:{kind:'TARGET_HP_RATIO_LE',ratio:.3},multiplier:3.8});

 const inquisitor=directAttack('inquisitor',2);
 assert.equal(inquisitor.penetrationRate,.35);
 assert.equal(inquisitor.baseMultiplier,3.1);
 assert.deepEqual(inquisitor.conditionalLastHitMultiplier,{condition:{kind:'TARGET_HAS_EFFECT',effectId:'weaken'},multiplier:3.5});

 const bloodfighterTwo=actions('bloodfighter',1);
 assert.deepEqual(bloodfighterTwo[0],{kind:'SELF_HP_COST_PERCENT',percentOfMax:.08});
 const bloodfighterThree=actions('bloodfighter',2);
 assert.deepEqual(bloodfighterThree[0],{kind:'SELF_HP_COST_PERCENT',percentOfMax:.12});
 assert.deepEqual(directAttack('bloodfighter',2).conditionalLastHitMultiplier,{condition:{kind:'SELF_HP_RATIO_LE',ratio:.5},multiplier:4});

 assert.deepEqual(actions('life_stitcher',1),[
  {kind:'HEAL_PERCENT',percent:.2},
  {kind:'REMOVE_EFFECT_TAG',target:'SELF',tag:'BLEED'},
 ]);
 assert.deepEqual(actions('life_stitcher',2),[
  {kind:'HEAL_PERCENT',percent:.3},
  {kind:'APPLY_EFFECT',target:'SELF',effectId:'regen',duration:3},
  {kind:'REMOVE_EFFECT_TAG',target:'SELF',tag:'BLEED'},
  {kind:'REMOVE_EFFECT_TAG',target:'SELF',tag:'POISON'},
 ]);

 const stairScout=directAttack('stair_scout',2);
 assert.equal(stairScout.hits,4);
 assert.equal(stairScout.baseMultiplier,.9);
});

test('A-rank job detail sheet is derived from the live combat definitions',()=>{
 for(const id of A_JOB_IDS){
  const combat=def(id);
  const detail=jobDetailById(id);
  assert.ok(detail,id);
  assert.equal(detail.resourceSummary,'전투 자원 · 시작 0 · 최대 4칸',id);
  combat.skills.forEach((skill,index)=>{
   const preview=detail.skills[index];
   assert.equal(preview.name,skill.name,`${id} skill ${index+1} name`);
   assert.equal(preview.description,skill.description,`${id} skill ${index+1} description`);
   assert.equal(preview.cooldown,skill.cooldown,`${id} skill ${index+1} cooldown`);
   assert.equal(preview.kind,skill.resource!.kind,`${id} skill ${index+1} kind`);
   assert.equal(preview.resourceLabel,resourceLabel(skill),`${id} skill ${index+1} resource label`);
  });
 }
});
