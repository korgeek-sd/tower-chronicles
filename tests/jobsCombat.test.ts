import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/game/engine/state';
import { grantJob, setCurrentJob } from '../src/game/jobs/service';
import { basicAttack, useBattleSkill, useBattlePotion, resolveMonsterTurn, resolveRevivalDecision } from '../src/game/engine/combat';
import { JOB_CATALOG } from '../src/game/jobs/catalog';
import { createJobRuntime } from '../src/game/jobs/runtime';
import { hasEffect, applyEffect } from '../src/game/engine/effects';

function setupJobBattleState(jobId: string) {
  let s = initialState();
  s = grantJob(s, jobId).state;
  s = setCurrentJob(s, jobId);
  s.expedition = {
    events: { activeBossId: null, bossKillCountThisExpedition: 0, phase: 'BATTLE', currentStepIndex: 0, steps: [] },
    tower: 'ore',
    floor: 1,
    hp: 200,
    monster: { name: '테스트 몬스터', hp: 500, currentHp: 500, attack: 20, defense: 5, speed: 1, skillPower: 1 },
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

test('JOB 01: Catalog has exactly 5 COMBAT_READY jobs and 20 CATALOG_ONLY jobs', () => {
  const ready = JOB_CATALOG.filter(j => j.implementationStatus === 'COMBAT_READY');
  const catalogOnly = JOB_CATALOG.filter(j => j.implementationStatus === 'CATALOG_ONLY');
  assert.equal(JOB_CATALOG.length, 25);
  assert.equal(ready.length, 5);
  assert.equal(catalogOnly.length, 20);

  const readyIds = ready.map(j => j.id).sort();
  assert.deepEqual(readyIds, ['berserker', 'contract_mercenary', 'duelist', 'field_medic', 'hunter']);
});

test('JOB 02: contract_mercenary (계약용병) skills and damage reduction', () => {
  let s = setupJobBattleState('contract_mercenary');

  // Basic attack
  const initialMonsterHp = s.expedition!.monster.currentHp;
  s = basicAttack(s, () => 0.5); // non-critical
  assert.ok(s.expedition!.monster.currentHp < initialMonsterHp);

  // Skill 1: 강타
  s.expedition!.phase = 'PLAYER_TURN';
  const hpBeforeHit = s.expedition!.monster.currentHp;
  s = useBattleSkill(s, 'mercenary_skill_1', () => 0.5);
  assert.ok(s.expedition!.monster.currentHp < hpBeforeHit);

  // Skill 2: 방패 올리기
  s.expedition!.phase = 'PLAYER_TURN';
  s = useBattleSkill(s, 'mercenary_skill_2', () => 0.5);
  assert.ok(hasEffect(s.expedition!.playerEffects, 'mercenary_guard'));
});

test('JOB 03: hunter (사냥꾼) mark and multi-hit', () => {
  let s = setupJobBattleState('hunter');

  // Skill 1: 사냥감 표식
  s = useBattleSkill(s, 'hunter_skill_1', () => 0.5);
  assert.ok(hasEffect(s.expedition!.monsterEffects, 'hunter_mark'));

  // Skill 2: 연속 사격 (표식 시 3타)
  s.expedition!.phase = 'PLAYER_TURN';
  const hpBefore = s.expedition!.monster.currentHp;
  s = useBattleSkill(s, 'hunter_skill_2', () => 0.5);
  assert.ok(s.expedition!.monster.currentHp < hpBefore);
});

test('JOB 04: field_medic (야전구호원) emergency first aid & potion boost', () => {
  let s = setupJobBattleState('field_medic');

  // Potion boost (+20% of ratio: 20% -> 24%)
  s.expedition!.hp = 100;
  const maxHp = 180; // baseStats.hp is 180
  s = useBattlePotion(s, 'healing_lesser', () => 0.5);
  // 24% of 180 = 43.2 -> 100 + 43.2 = 143.2
  assert.equal(s.expedition!.hp, 143.2);

  // First Aid 30% threshold check
  s.expedition!.hp = 60; // <= 30% of 180 (54)
  s.expedition!.phase = 'MONSTER_TURN';
  s = resolveMonsterTurn(s);
  assert.ok(s.expedition!.jobRuntime.flags?.['first_aid_used']);
});

test('JOB 05: duelist (결투가) counter stance & 20% counter chance', () => {
  let s = setupJobBattleState('duelist');

  // Skill 2: 받아치기
  s = useBattleSkill(s, 'duelist_skill_2', () => 0.5);
  assert.ok(hasEffect(s.expedition!.playerEffects, 'duelist_counter_stance'));

  // Monster attacks -> trigger counter
  const monsterHpBefore = s.expedition!.monster.currentHp;
  s = resolveMonsterTurn(s);
  assert.ok(s.expedition!.monster.currentHp < monsterHpBefore);
  assert.ok(!hasEffect(s.expedition!.playerEffects, 'duelist_counter_stance'));
});

test('JOB 06: berserker (광전사) rage gain & blood cost & rampage', () => {
  let s = setupJobBattleState('berserker');
  assert.equal(s.expedition!.jobRuntime.resource?.value, 0);

  // Skill 2: 피의 대가 -> consumes 10% max HP, grants +25 rage
  const initialHp = s.expedition!.hp;
  s = useBattleSkill(s, 'berserker_skill_2', () => 0.5);
  assert.ok(s.expedition!.hp < initialHp);
  assert.equal(s.expedition!.jobRuntime.resource?.value, 25);
  assert.ok(hasEffect(s.expedition!.playerEffects, 'berserker_blood_boost'));

  // Add rage to reach 60+
  s.expedition!.jobRuntime.resource!.value = 70;

  // Skill 3: 폭주 (requires 60 rage, consumes 60)
  s.expedition!.phase = 'PLAYER_TURN';
  s = useBattleSkill(s, 'berserker_skill_3', () => 0.5);
  assert.equal(s.expedition!.jobRuntime.resource?.value, 10);
});

test('JOB 07: revival decision pipeline remains intact with job hooks', () => {
  let s = setupJobBattleState('contract_mercenary');
  s.expedition!.hp = 10;
  s.expedition!.monster.attack = 300; // high lethal damage
  s.expedition!.phase = 'MONSTER_TURN';

  s = resolveMonsterTurn(s);
  assert.ok(s.expedition!.pendingRevival);

  // Revive
  s = resolveRevivalDecision(s, true);
  assert.ok(!s.expedition!.pendingRevival);
  assert.ok(s.expedition!.hp > 0);
  assert.equal(s.expedition!.bag.revival, 0);
});
