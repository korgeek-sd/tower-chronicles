import test from 'node:test';
import assert from 'node:assert/strict';
import {jobsByRarity} from '../src/game/jobs/catalog';
import {jobDetailById} from '../src/game/jobs/details';
import {getJobCombatDefinition} from '../src/game/jobs/framework';
import {skillVisualAssetFor} from '../src/game/jobs/skillVisualAssets';
import {existsSync} from 'node:fs';

test('all 11 SR jobs are playable with three resource skills and committed images',()=>{
 const jobs=jobsByRarity('SR');assert.equal(jobs.length,11);
 for(const job of jobs){
  assert.equal(job.implementationStatus,'COMBAT_READY',job.id);
  const def=getJobCombatDefinition(job.id);assert.ok(def,job.id);
  assert.deepEqual(def.resource,{id:'combat',initialValue:0,maxValue:4});
  assert.equal(def.skills.length,3);assert.equal(def.skills[0].resource?.kind,'GENERATOR');assert.equal(def.skills[0].cooldown,0);
  assert.deepEqual(def.skills[2].resource,{kind:'SPENDER',cost:{mode:'FIXED',amount:3}});
  const detail=jobDetailById(job.id);assert.ok(detail,job.id);
  assert.deepEqual(detail.skills.map(s=>s.name),def.skills.map(s=>s.name));
  for(const skill of def.skills){const path=skillVisualAssetFor(skill.id);assert.ok(path,skill.id);assert.ok(existsSync(new URL('../public/'+path,import.meta.url)));}
 }
});
test('approved SR conditional finishers retain their stronger damage',()=>{
 const rows:[string,number,number][]=[['mutagen_doctor',4.5,5.5],['ascetic_fighter',4.8,6],['green_crown_martyr',4.6,5.8],['boss_tracker',4.7,5.6],['green_crown_inquisitor',4.6,5.5]];
 for(const [id,base,boost] of rows){const def=getJobCombatDefinition(id);assert.ok(def,id);const action=def.skills[2].effectActions.find(a=>a.kind==='DIRECT_ATTACK');assert.ok(action&&action.kind==='DIRECT_ATTACK');assert.equal(action.baseMultiplier,base);assert.equal(action.conditionalLastHitMultiplier?.multiplier,boost);}
});

import {initialState} from '../src/game/engine/state';
import {grantJob,setCurrentJob} from '../src/game/jobs/service';
import {useBattleSkill} from '../src/game/engine/combat';
import {JOB_CATALOG} from '../src/game/jobs/catalog';
import {createJobRuntime} from '../src/game/jobs/runtime';
function setupJobBattleState(jobId: string) {
  let s = initialState();
  s = grantJob(s, jobId).state;
  s = setCurrentJob(s, jobId);
  s.expedition = {
    events: { activeBossId: null, bossKillCountThisExpedition: 0, phase: 'BATTLE', currentStepIndex: 0, steps: [] },
    tower: 'ore',
    floor: 1,
    hp: 180, // Max HP 180
    monster: { name: '테스트 몬스터', hp: 500, currentHp: 500, attack: 20, defense: 8, speed: 1, skillPower: 1 },
    monsterRuntime: null,
    reactivePrepared: { player: null, monster: null },
    bag: { healing_lesser: 5, healing_standard: 5, healing_greater: 0, healing_supreme: 0, revival: 1 },
    time: 0,
    playerTimer: 0,
    enemyTimer: 0,
    spawnAt: 0,
    cooldowns: {},
    buffs: {},
    playerEffects: [],
    monsterEffects: [],
    preparedEffects: [],
    effectSequence: 0,
    jobSnapshotId: jobId,
    jobRuntime: createJobRuntime(JOB_CATALOG.find(j => j.id === jobId)!),
    kills: 0,
    loot: { silver: 0, materials: { ore: [0,0,0,0,0], leather: [0,0,0,0,0], gem: [0,0,0,0,0], kaleon: [0,0,0,0,0] }, tickets: { ore: Array(10).fill(0), leather: Array(10).fill(0), gem: Array(10).fill(0), kaleon: Array(10).fill(0) }, skillBooks: {}, items: {} },
    equipment: { weapon: null, armor: null, boots: null, accessory: null },
    returnRequested: false,
    bossTracking: { progress: 0, pendingBossId: null, encounterReason: null, bossDefeated: false },
    phase: 'PLAYER_TURN',
    playerTurn: 1,
    monsterTurn: 0,
    pendingFlee: false,
    pendingRevival: null,
  };
  return s;
}


test('SR local poison uses its authored three-turn duration',()=>{let s=setupJobBattleState('mutagen_doctor');s=useBattleSkill(s,'mutagen_doctor_skill_1',()=>.5);assert.equal(s.expedition!.monsterEffects[0].remainingDuration,3);});
