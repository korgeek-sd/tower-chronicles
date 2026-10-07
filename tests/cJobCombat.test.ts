import test from 'node:test';
import assert from 'node:assert/strict';
import {jobsByRarity} from '../src/game/jobs/catalog';
import {jobDetailById} from '../src/game/jobs/details';
import {getJobCombatDefinition} from '../src/game/jobs/framework';
import {skillVisualAssetFor} from '../src/game/jobs/skillVisualAssets';
import {existsSync} from 'node:fs';

import {initialState,stats} from '../src/game/engine/state';
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


test('remaining C kits execute fifteen skills with their existing artwork',()=>{
 for(const id of ['excavator','reclaimer','green_crown_pilgrim','porter','guide']){
  assert.equal(JOB_CATALOG.find(j=>j.id===id)!.implementationStatus,'COMBAT_READY');
  const def=getJobCombatDefinition(id)!;assert.equal(def.skills.length,3);
  assert.deepEqual(jobDetailById(id)!.skills.map(s=>s.name),def.skills.map(s=>s.name));
  assert.equal(def.skills[0].cooldown,0);
  for(const skill of def.skills){const asset=skillVisualAssetFor(skill.id);assert.ok(asset);assert.ok(existsSync('public/'+asset));let s=setupJobBattleState(id);s.expedition!.hp=90;s.expedition!.jobRuntime!.resource!.value=4;const next=useBattleSkill(s,skill.id,()=>.5);assert.equal(next.expedition!.phase,'MONSTER_TURN',skill.id);}
 }
});
test('C recovery scales with attack and porter shields scale with maximum HP',()=>{
 let s=setupJobBattleState('reclaimer');s.expedition!.hp=90;
 s=useBattleSkill(s,'reclaimer_skill_2',()=>.5);assert.equal(s.expedition!.hp,96);
 s=setupJobBattleState('green_crown_pilgrim');s.expedition!.hp=90;s.expedition!.jobRuntime!.resource!.value=2;
 s=useBattleSkill(s,'green_crown_pilgrim_skill_3',()=>.5);assert.equal(s.expedition!.hp,113);
 s=setupJobBattleState('porter');s=useBattleSkill(s,'porter_skill_2',()=>.5);assert.equal(s.expedition!.playerEffects[0].currentShield,Math.round(stats(s,s.expedition!.equipment).hp*.18));
 s=setupJobBattleState('porter');s.expedition!.jobRuntime!.resource!.value=2;s=useBattleSkill(s,'porter_skill_3',()=>.5);assert.equal(s.expedition!.playerEffects[0].currentShield,Math.round(stats(s,s.expedition!.equipment).hp*.3));
});
test('C finishers apply one-turn stun and silence',()=>{
 for(const [id,effect] of [['excavator','stun'],['guide','silence']]){
 let s=setupJobBattleState(id);s.expedition!.jobRuntime!.resource!.value=4;s=useBattleSkill(s,id+'_skill_3',()=>.5);
 assert.equal(s.expedition!.monsterEffects.find(e=>e.effectId===effect)!.remainingDuration,1);
 }
});

test('C prayer attack bonus increases subsequent attack-based recovery',()=>{
 let s=setupJobBattleState('green_crown_pilgrim');s.expedition!.hp=90;
 s=useBattleSkill(s,'green_crown_pilgrim_skill_2',()=>.5);
 assert.deepEqual(s.expedition!.playerEffects.map(e=>[e.effectId,e.remainingDuration]),[['c_attack_15',3],['c_defense_25',3]]);
 s.expedition!.phase='PLAYER_TURN';s.expedition!.jobRuntime!.resource!.value=2;
 s=useBattleSkill(s,'green_crown_pilgrim_skill_3',()=>.5);assert.equal(s.expedition!.hp,116);
});
