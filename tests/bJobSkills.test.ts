import test from 'node:test';
import assert from 'node:assert/strict';
import {JOB_CATALOG} from '../src/game/jobs/catalog';
import {jobDetailById} from '../src/game/jobs/details';
import {getJobCombatDefinition} from '../src/game/jobs/framework';
import {initFiveJobCombatDefinitions} from '../src/game/jobs/definitions';
import {skillVisualAssetFor} from '../src/game/jobs/skillVisualAssets';
initFiveJobCombatDefinitions();
test('all B jobs expose three executable skills with matching list descriptions and images',()=>{
 for(const job of JOB_CATALOG.filter(j=>j.rarity==='B')){
  const def=getJobCombatDefinition(job.id); assert.ok(def,job.id);
  const detail=jobDetailById(job.id); assert.ok(detail,job.id);
  assert.equal(job.implementationStatus,'COMBAT_READY');
  assert.deepEqual(job.combatKit?.activeSkillIds,def.skills.map(s=>s.id));
  def.skills.forEach((skill,i)=>{assert.equal(detail.skills[i].name,skill.name);assert.equal(detail.skills[i].description,skill.description);assert.ok(skillVisualAssetFor(skill.id),skill.id);});
 }
});
import {initialState} from '../src/game/engine/state';
import {enter} from '../src/game/engine/expedition';
import {grantJob,setCurrentJob} from '../src/game/jobs/service';
import {useBattleSkill} from '../src/game/engine/combat';
import {hasEffect} from '../src/game/engine/effects';
test('new B generators deal damage and grant one resource; spenders require and consume resource',()=>{
 for(const job of JOB_CATALOG.filter(j=>j.rarity==='B'&&j.id!=='duelist')){
  let s=enter(setCurrentJob(grantJob(initialState(),job.id).state,job.id),'ore',1);
  s.expedition!.monster.hp=10000;s.expedition!.monster.currentHp=10000;
  const def=getJobCombatDefinition(job.id)!;
  let blocked=useBattleSkill(s,def.skills[2].id,()=>.5);
  assert.equal(blocked.expedition!.monster.currentHp,10000,job.id);
  s=useBattleSkill(s,def.skills[0].id,()=>.5);
  assert.ok(s.expedition!.monster.currentHp<10000,job.id);assert.equal(s.expedition!.jobRuntime.resource!.value,1,job.id);
  s.expedition!.phase='PLAYER_TURN';s.expedition!.jobRuntime.resource!.value=4;s.expedition!.hp=30;
  s=useBattleSkill(s,def.skills[2].id,()=>.5);
  const resource=def.skills[2].resource!;assert.equal(s.expedition!.jobRuntime.resource!.value,4-(resource.kind==='SPENDER'&&resource.cost.mode==='FIXED'?resource.cost.amount:0),job.id);
 }
});
test('tracker bleeding arrow applies the authored two-turn bleed',()=>{
 let s=enter(setCurrentJob(grantJob(initialState(),'tracker').state,'tracker'),'ore',1);
 s.expedition!.monster.hp=10000;s.expedition!.monster.currentHp=10000;
 s=useBattleSkill(s,'tracker_skill_2',()=>.5);
 assert.ok(hasEffect(s.expedition!.monsterEffects,'bleed'));
 assert.equal(s.expedition!.monsterEffects.find(e=>e.effectId==='bleed')!.remainingDuration,2);
});
