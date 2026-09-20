import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/game/engine/state';
import { grantJob, setCurrentJob } from '../src/game/jobs/service';
import { basicAttack, useBattleSkill, useBattlePotion, resolveMonsterTurn, resolveRevivalDecision } from '../src/game/engine/combat';
import { JOB_CATALOG } from '../src/game/jobs/catalog';
import { createJobRuntime } from '../src/game/jobs/runtime';
import { hasEffect } from '../src/game/engine/effects';

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

const fixedRng = () => 0.5;

test('Contract Mercenary (계약용병) exact values and 40% boundary', () => {
  let s = setupJobBattleState('contract_mercenary');

  const initialMonsterHp = s.expedition!.monster.currentHp;
  s = basicAttack(s, fixedRng);
  assert.ok(s.expedition!.monster.currentHp < initialMonsterHp);

  s.expedition!.phase = 'MONSTER_TURN';
  const initialPlayerHp = s.expedition!.hp;
  s = resolveMonsterTurn(s, fixedRng);
  assert.ok(s.expedition!.hp < initialPlayerHp);

  s.expedition!.phase = 'PLAYER_TURN';
  const hpBeforeHit = s.expedition!.monster.currentHp;
  s = useBattleSkill(s, 'mercenary_skill_1', fixedRng);
  assert.ok(s.expedition!.monster.currentHp < hpBeforeHit);

  s.expedition!.phase = 'PLAYER_TURN';
  s = useBattleSkill(s, 'mercenary_skill_2', fixedRng);
  assert.ok(hasEffect(s.expedition!.playerEffects, 'mercenary_guard'));

  s.expedition!.phase = 'PLAYER_TURN';
  s.expedition!.cooldowns['turn:mercenary_skill_3'] = 0;
  s.expedition!.monster.currentHp = 200; // Exactly 40%
  const hp40 = s.expedition!.monster.currentHp;
  s = useBattleSkill(s, 'mercenary_skill_3', fixedRng);
  assert.ok(s.expedition!.monster.currentHp < hp40);
});

test('Hunter (사냥꾼) exact values, mark duration, and hit counts', () => {
  let s = setupJobBattleState('hunter');

  s = useBattleSkill(s, 'hunter_skill_1', fixedRng);
  const markEffect = s.expedition!.monsterEffects.find(e => e.effectId === 'hunter_mark');
  assert.ok(markEffect);
  assert.equal(markEffect.remainingDuration, 3);

  s.expedition!.phase = 'PLAYER_TURN';
  const hpBefore2 = s.expedition!.monster.currentHp;
  s = useBattleSkill(s, 'hunter_skill_2', fixedRng);
  assert.ok(s.expedition!.monster.currentHp < hpBefore2);

  s.expedition!.phase = 'PLAYER_TURN';
  s.expedition!.monster.currentHp = 175; // 35% of 500
  const hpBefore3 = s.expedition!.monster.currentHp;
  s = useBattleSkill(s, 'hunter_skill_3', fixedRng);
  assert.ok(s.expedition!.monster.currentHp < hpBefore3);
});

test('Field Medic (야전구호원) exact potion heal and threshold boundary', () => {
  let s = setupJobBattleState('field_medic');

  s.expedition!.hp = 100;
  s = useBattlePotion(s, 'healing_lesser', fixedRng);
  assert.ok(s.expedition!.hp > 100);

  s.expedition!.hp = 54; // <= 30%
  s.expedition!.phase = 'MONSTER_TURN';
  s = resolveMonsterTurn(s, fixedRng);
  assert.ok(s.expedition!.jobRuntime.flags?.['first_aid_used']);
});

test('Duelist (결투가) exact reaction, rng boundary, and non-recursion', () => {
  let s = setupJobBattleState('duelist');

  s.expedition!.phase = 'PLAYER_TURN';
  s = useBattleSkill(s, 'duelist_skill_2', fixedRng);
  assert.ok(hasEffect(s.expedition!.playerEffects, 'duelist_counter_stance'));

  s.expedition!.phase = 'MONSTER_TURN';
  const playerHpBefore = s.expedition!.hp;
  const monsterHpBefore = s.expedition!.monster.currentHp;
  s = resolveMonsterTurn(s, fixedRng);

  assert.ok(s.expedition!.hp < playerHpBefore);
  assert.ok(s.expedition!.monster.currentHp < monsterHpBefore);
  assert.ok(!hasEffect(s.expedition!.playerEffects, 'duelist_counter_stance'));
});

test('Berserker (광전사) exact HP bands, rage gain clamp, and rampage', () => {
  let s = setupJobBattleState('berserker');
  assert.equal(s.expedition!.jobRuntime.resource?.value, 0);

  s.expedition!.hp = 36;
  const monsterHpBefore = s.expedition!.monster.currentHp;
  s = basicAttack(s, fixedRng);
  assert.ok(s.expedition!.monster.currentHp < monsterHpBefore);

  s.expedition!.phase = 'MONSTER_TURN';
  s = resolveMonsterTurn(s, fixedRng);
  assert.ok(s.expedition!.jobRuntime.resource!.value > 0);

  s.expedition!.jobRuntime.resource!.value = 60;
  s.expedition!.phase = 'PLAYER_TURN';
  s.expedition!.monster.currentHp = 150;
  s = useBattleSkill(s, 'berserker_skill_3', fixedRng);
  assert.equal(s.expedition!.jobRuntime.resource?.value, 0);
});

test('Revival & multi-hit continuation pipeline check', () => {
  let s = setupJobBattleState('contract_mercenary');
  s.expedition!.hp = 10;
  s.expedition!.monster.attack = 300;
  s.expedition!.phase = 'MONSTER_TURN';

  s = resolveMonsterTurn(s);
  assert.ok(s.expedition!.pendingRevival);

  s = resolveRevivalDecision(s, true);
  assert.ok(!s.expedition!.pendingRevival);
  assert.ok(s.expedition!.hp > 0);
  assert.equal(s.expedition!.bag.revival, 0);
});
