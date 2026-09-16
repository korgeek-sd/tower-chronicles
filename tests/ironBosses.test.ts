import test from 'node:test';
import assert from 'node:assert/strict';
import type {GameState} from '../src/game/types.ts';
import {initialState} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {beginEncounter} from '../src/game/events/service.ts';
import {bossIdFor} from '../src/game/engine/bossTracking.ts';
import {basicAttack,passPlayerTurn,resolveMonsterTurn,resolveRevivalDecision} from '../src/game/engine/combat.ts';
import {activeShield,applyEffect,effectStacks,hasEffect} from '../src/game/engine/effects.ts';
import {monsterDefinitionById,validateMonsterDefinition} from '../src/game/engine/monsterAi.ts';
import {createRepository,SAVE_KEY} from '../src/storage/repository.ts';

const noEvent=()=>.99;
function bossState(floor:number):GameState {
 const base=initialState();
 base.tickets.ore[floor-1]=1;
 const entered=enter(base,'ore',floor),bossId=bossIdFor('ore',floor);
 assert.ok(entered.expedition);
 assert.ok(bossId);
 return beginEncounter(entered,noEvent,bossId);
}
function roundTrip(state:GameState):GameState {
 const map=new Map<string,string>();
 const repo=createRepository({getItem:key=>map.get(key)??null,setItem:(key,value)=>void map.set(key,value)});
 repo.save(state);
 assert.ok(map.has(SAVE_KEY));
 return repo.load();
}

test('IRON BOSS 01: 6~10F production boss definitions are mapped and validate cleanly',()=>{
 const expected=[
  [6,'iron_maw_burrower'],
  [7,'black_vein_armor_breaker'],
  [8,'echo_devourer'],
  [9,'deep_hoist_overseer'],
  [10,'iron_core_pulsator']
 ] as const;
 for(const [floor,id] of expected){
  assert.equal(bossIdFor('ore',floor),id);
  const definition=monsterDefinitionById(id);
  assert.ok(definition);
  assert.deepEqual(validateMonsterDefinition(definition!),[]);
 }
});

test('IRON BOSS 02: 6F 쇄철턱 굴혈수 Charge prepares, survives reload, then discharges once',()=>{
 let s=bossState(6);s.expedition!.phase='MONSTER_TURN';
 const hp=s.expedition!.hp;
 s=resolveMonsterTurn(s);
 assert.equal(s.expedition!.hp,hp);
 assert.equal(s.expedition!.monsterRuntime!.preparedActionId,'burrow_charge');
 s=basicAttack(s,noEvent);
 assert.equal(s.expedition!.monsterRuntime!.preparedActionId,'burrow_charge');
 s=roundTrip(s);
 const before=s.expedition!.hp;
 s=resolveMonsterTurn(s);
 assert.ok(s.expedition!.hp<before);
 assert.equal(s.expedition!.monsterRuntime!.preparedActionId,null);
 assert.equal(s.expedition!.monsterRuntime!.skillCooldowns.burrow_charge,2);
});

test('IRON BOSS 03: 7F 흑맥갑주 파쇄충 starts armored and three direct hits break armor into exposed',()=>{
 let s=bossState(7);
 assert.equal(hasEffect(s.expedition!.monsterEffects,'iron_armor'),true);
 for(let hit=1;hit<=2;hit++){
  s=basicAttack(s,noEvent);
  assert.equal(effectStacks(s.expedition!.monsterEffects,'fracture'),hit);
  s=resolveMonsterTurn(s);
 }
 s=basicAttack(s,noEvent);
 assert.equal(hasEffect(s.expedition!.monsterEffects,'iron_armor'),false);
 assert.equal(effectStacks(s.expedition!.monsterEffects,'fracture'),0);
 assert.equal(hasEffect(s.expedition!.monsterEffects,'exposed_core'),true);
 const reloaded=roundTrip(s);
 assert.equal(hasEffect(reloaded.expedition!.monsterEffects,'exposed_core'),true);
});

test('IRON BOSS 04: 7F periodic damage never creates fracture stacks',()=>{
 let s=bossState(7),e=s.expedition!;
 applyEffect(e,'monster','poison','player',e.playerTurn);
 e.phase='MONSTER_TURN';
 s=resolveMonsterTurn(s);
 assert.equal(effectStacks(s.expedition!.monsterEffects,'fracture'),0);
});

test('IRON BOSS 05: 8F 울림포식자 waits for 3 resonance stacks before prioritizing Charge',()=>{
 let s=bossState(8),e=s.expedition!;
 applyEffect(e,'player','resonance','monster',e.playerTurn);
 applyEffect(e,'player','resonance','monster',e.playerTurn);
 e.phase='MONSTER_TURN';
 s=resolveMonsterTurn(s);
 assert.equal(effectStacks(s.expedition!.playerEffects,'resonance'),3);
 assert.equal(s.expedition!.monsterRuntime!.preparedActionId,null);
 s=passPlayerTurn(s,noEvent);
 s=resolveMonsterTurn(s);
 assert.equal(s.expedition!.monsterRuntime!.preparedActionId,'resonant_charge');
 const reloaded=roundTrip(s);
 assert.equal(effectStacks(reloaded.expedition!.playerEffects,'resonance'),3);
 assert.equal(reloaded.expedition!.monsterRuntime!.preparedActionId,'resonant_charge');
});

test('IRON BOSS 06: 9F 심층 권양감독체 prepares one direct-hit counter and then can prepare Charge independently',()=>{
 let s=bossState(9);s.expedition!.phase='MONSTER_TURN';
 s=resolveMonsterTurn(s);
 assert.equal(s.expedition!.reactivePrepared.monster?.prepareSkillId,'counter_prepare');
 s=roundTrip(s);
 const hp=s.expedition!.hp;
 s=basicAttack(s,noEvent);
 assert.equal(s.expedition!.reactivePrepared.monster,null);
 assert.ok(s.expedition!.hp<hp);
 assert.equal(s.logs.filter(line=>line.includes('즉시 발동')).length,1);
 s=resolveMonsterTurn(s);
 assert.equal(s.expedition!.monsterRuntime!.preparedActionId,'hoist_charge');
});

test('IRON BOSS 07: 9F prepared counter ignores DOT and remains armed until a direct hit',()=>{
 let s=bossState(9);s.expedition!.phase='MONSTER_TURN';
 s=resolveMonsterTurn(s);
 const prepared=structuredClone(s.expedition!.reactivePrepared.monster);
 applyEffect(s.expedition!,'monster','poison','player',s.expedition!.playerTurn);
 s=passPlayerTurn(s,noEvent);
 s=resolveMonsterTurn(s);
 assert.deepEqual(s.expedition!.reactivePrepared.monster,prepared);
});

test('IRON BOSS 08: 10F 철심 맥동체 Shield absorbs first, debuff follows, and low HP prioritizes terminal Charge',()=>{
 let s=bossState(10);s.expedition!.phase='MONSTER_TURN';
 s=resolveMonsterTurn(s);
 let shield=activeShield(s.expedition!,'monster');
 assert.ok(shield);
 assert.equal(shield!.effectId,'iron_core_shield');
 assert.equal(shield!.currentShield,70);
 s=roundTrip(s);
 shield=activeShield(s.expedition!,'monster');
 assert.equal(shield?.currentShield,70);
 const hp=s.expedition!.monster.currentHp,shieldBefore=shield!.currentShield!;
 s=basicAttack(s,noEvent);
 assert.equal(s.expedition!.monster.currentHp,hp);
 assert.ok((activeShield(s.expedition!,'monster')?.currentShield??0)<shieldBefore);
 s=resolveMonsterTurn(s);
 assert.equal(hasEffect(s.expedition!.playerEffects,'crushing_pressure'),true);
 s.expedition!.monster.currentHp=Math.floor(s.expedition!.monster.hp*.4);
 s=passPlayerTurn(s,noEvent);
 s=resolveMonsterTurn(s);
 assert.equal(s.expedition!.monsterRuntime!.preparedActionId,'terminal_charge');
});

test('IRON BOSS 09: lethal boss Charge enters the shared revival decision pipeline and resumes combat',()=>{
 let s=bossState(6);s.expedition!.bag.revival=1;s.expedition!.phase='MONSTER_TURN';
 s=resolveMonsterTurn(s);
 s=basicAttack(s,noEvent);
 s.expedition!.hp=1;
 s=resolveMonsterTurn(s);
 assert.equal(s.expedition!.pendingRevival?.source,'DIRECT_HIT');
 assert.equal(s.expedition!.bag.revival,1);
 s=roundTrip(s);
 s=resolveRevivalDecision(s,true);
 assert.ok(s.expedition);
 assert.equal(s.expedition!.bag.revival,0);
 assert.ok(s.expedition!.hp>0);
 assert.equal(s.expedition!.phase,'PLAYER_TURN');
});
