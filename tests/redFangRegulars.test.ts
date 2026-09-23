import test from 'node:test';
import assert from 'node:assert/strict';
import type {GameState} from '../src/game/types.ts';
import {RED_NORMAL_POOL,RED_T1_FLOORS} from '../src/game/data/redFang.ts';
import {RED_NORMAL_DEFINITIONS} from '../src/game/data/redCombat.ts';
import {initialState} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {beginEncounter} from '../src/game/events/service.ts';
import {basicAttack,resolveMonsterTurn} from '../src/game/engine/combat.ts';
import {effectStacks,hasEffect} from '../src/game/engine/effects.ts';
import {monsterDefinitionById,validateMonsterDefinition} from '../src/game/engine/monsterAi.ts';

const noEvent=()=>.99;
function regularState(id:string,floor=1):GameState {
 const base=initialState();
 base.tickets.leather[floor-1]=1;
 const entered=enter(base,'leather',floor);
 assert.ok(entered.expedition);
 return beginEncounter(entered,noEvent,id);
}

test('RED REGULAR 01: five authored regulars share the 1~10F pool and all have valid combat definitions',()=>{
 assert.deepEqual(RED_NORMAL_POOL,['wasteland_boar','thorn_jackal','carrion_vulture','hide_gnawer','pack_vanguard']);
 assert.equal(RED_NORMAL_DEFINITIONS.length,5);
 for(let floor=1;floor<=10;floor++)assert.deepEqual(RED_T1_FLOORS[floor].normalPool,RED_NORMAL_POOL);
 for(const id of RED_NORMAL_POOL){
  const definition=monsterDefinitionById(id);
  assert.ok(definition,id);
  assert.deepEqual(validateMonsterDefinition(definition!),[]);
 }
});

test('RED REGULAR 02: each regular encounter creates the canonical combat runtime',()=>{
 for(const id of RED_NORMAL_POOL){
  const s=regularState(id);
  assert.equal(s.expedition!.monster.definitionId,id);
  assert.equal(s.expedition!.monsterRuntime?.definitionId,id);
 }
});

test('RED REGULAR 03: 황야 멧돼지 opens with defensive hide stance',()=>{
 let s=regularState('wasteland_boar');s.expedition!.phase='MONSTER_TURN';
 s=resolveMonsterTurn(s);
 assert.equal(hasEffect(s.expedition!.monsterEffects,'defense_up'),true);
 assert.equal(s.expedition!.monsterRuntime!.skillCooldowns.boar_hide_brace,4);
});

test('RED REGULAR 04: 가시 자칼 opens a fang wound and then prioritizes the wounded target bite',()=>{
 let s=regularState('thorn_jackal');s.expedition!.phase='MONSTER_TURN';
 s=resolveMonsterTurn(s);
 assert.equal(effectStacks(s.expedition!.playerEffects,'fang_wound'),1);
 s=basicAttack(s,noEvent);
 s=resolveMonsterTurn(s);
 assert.equal(s.expedition!.monsterRuntime!.skillCooldowns.blood_scent_bite,2);
});

test('RED REGULAR 05: 썩은날 독수리 first weakens defense and exposes a two-hit attack definition',()=>{
 let s=regularState('carrion_vulture');s.expedition!.phase='MONSTER_TURN';
 s=resolveMonsterTurn(s);
 assert.equal(hasEffect(s.expedition!.playerEffects,'weaken'),true);
 const dive=monsterDefinitionById('carrion_vulture')!.skills!.find(skill=>skill.id==='carrion_dive')!;
 assert.equal(dive.hits,2);
 assert.equal(dive.multiplier,.72);
});

test('RED REGULAR 06: 가죽 갉는 하이에나는 출혈 중첩을 기반으로 강한 교상을 선택한다',()=>{
 let s=regularState('hide_gnawer');s.expedition!.phase='MONSTER_TURN';
 s=resolveMonsterTurn(s);
 assert.equal(effectStacks(s.expedition!.playerEffects,'fang_wound'),1);
 s=basicAttack(s,noEvent);s=resolveMonsterTurn(s);
 assert.equal(effectStacks(s.expedition!.playerEffects,'fang_wound'),2);
 s=basicAttack(s,noEvent);s=resolveMonsterTurn(s);
 assert.equal(s.expedition!.monsterRuntime!.skillCooldowns.rending_bite,2);
});

test('RED REGULAR 07: 무리 선봉은 직접 공격에 반응하는 준비 반격을 먼저 사용한다',()=>{
 let s=regularState('pack_vanguard');s.expedition!.phase='MONSTER_TURN';
 s=resolveMonsterTurn(s);
 assert.equal(s.expedition!.reactivePrepared.monster?.prepareSkillId,'vanguard_counter_prepare');
 const hp=s.expedition!.hp;
 s=basicAttack(s,noEvent);
 assert.equal(s.expedition!.reactivePrepared.monster,null);
 assert.ok(s.expedition!.hp<hp);
});
