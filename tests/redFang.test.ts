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
 base.tickets.leather[floor-1]=1;
 const entered=enter(base,'leather',floor),bossId=bossIdFor('leather',floor);
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
test('RED 01: 6~10F production boss definitions are mapped and validate cleanly',()=>{
 const expected=[[6,'bloodmane_tracker'],[7,'redjaw_hide_eater'],[8,'fang_pack_matriarch'],[9,'sanctuary_talon_bishop'],[10,'lord_of_red_fang']] as const;
 for(const [floor,id] of expected){
  assert.equal(bossIdFor('leather',floor),id);
  const definition=monsterDefinitionById(id);
  assert.ok(definition);
  assert.deepEqual(validateMonsterDefinition(definition!),[]);
 }
});
test('RED 02: 6F 핏갈기 추적자 Charge prepares, survives reload, then discharges once',()=>{
 let s=bossState(6);s.expedition!.phase='MONSTER_TURN';
 const hp=s.expedition!.hp;
 s=resolveMonsterTurn(s);
 assert.equal(s.expedition!.monsterRuntime!.preparedActionId,'blood_charge');
 s=basicAttack(s,noEvent);
 assert.equal(s.expedition!.monsterRuntime!.preparedActionId,'blood_charge');
 s=roundTrip(s);
 const before=s.expedition!.hp;
 s=resolveMonsterTurn(s);
 assert.ok(s.expedition!.hp<before);
 assert.equal(s.expedition!.monsterRuntime!.preparedActionId,null);
 assert.equal(s.expedition!.monsterRuntime!.skillCooldowns.blood_charge,2);
});
test('RED 03: 7F 붉은턱 가죽포식자 applies stacking bleed via skills',()=>{
 let s=bossState(7);s.expedition!.phase='MONSTER_TURN';
 s=resolveMonsterTurn(s);
 assert.equal(effectStacks(s.expedition!.playerEffects,'fang_wound'),1);
 s=passPlayerTurn(s,noEvent);
 s=resolveMonsterTurn(s);
 assert.ok(effectStacks(s.expedition!.playerEffects,'fang_wound')>=2);
 const reloaded=roundTrip(s);
 assert.ok(effectStacks(reloaded.expedition!.playerEffects,'fang_wound')>=2);
});
test('RED 04: 7F bleed ticks damage without creating new stacks by itself',()=>{
 let s=bossState(7),e=s.expedition!;
 applyEffect(e,'player','fang_wound','monster',e.playerTurn);
 const before=e.hp;
 e.phase='MONSTER_TURN';
 s=resolveMonsterTurn(s);
 assert.ok(s.expedition!.hp<=before);
 assert.ok(effectStacks(s.expedition!.playerEffects,'fang_wound')>=1);
});
test('RED 05: 8F 송곳니 무리어미 prepares one direct-hit counter and then can prepare Charge independently',()=>{
 let s=bossState(8);s.expedition!.phase='MONSTER_TURN';
 s=resolveMonsterTurn(s);
 assert.equal(s.expedition!.reactivePrepared.monster?.prepareSkillId,'matriarch_counter_prepare');
 s=roundTrip(s);
 const hp=s.expedition!.hp;
 s=basicAttack(s,noEvent);
 assert.equal(s.expedition!.reactivePrepared.monster,null);
 assert.ok(s.expedition!.hp<hp);
 s=resolveMonsterTurn(s);
 assert.equal(s.expedition!.monsterRuntime!.preparedActionId,'pack_charge');
});
test('RED 06: 8F prepared counter ignores DOT and remains armed until a direct hit',()=>{
 let s=bossState(8);s.expedition!.phase='MONSTER_TURN';
 s=resolveMonsterTurn(s);
 const prepared=structuredClone(s.expedition!.reactivePrepared.monster);
 applyEffect(s.expedition!,'monster','poison','player',s.expedition!.playerTurn);
 s=passPlayerTurn(s,noEvent);
 s=resolveMonsterTurn(s);
 assert.deepEqual(s.expedition!.reactivePrepared.monster,prepared);
});
test('RED 07: 9F 성소 발톱주교 starts shielded and applies debuff',()=>{
 let s=bossState(9);
 assert.equal(hasEffect(s.expedition!.monsterEffects,'blood_rite_ward'),true);
 s=roundTrip(s);
 assert.equal(hasEffect(s.expedition!.monsterEffects,'blood_rite_ward'),true);
 s.expedition!.phase='MONSTER_TURN';
 s=resolveMonsterTurn(s);
 s=passPlayerTurn(s,noEvent);
 s=resolveMonsterTurn(s);
 assert.equal(hasEffect(s.expedition!.playerEffects,'crushing_pressure'),true);
});
test('RED 08: 10F 적아의 주인 Shield absorbs, debuff follows, low HP prioritizes terminal hunt',()=>{
 let s=bossState(10);s.expedition!.phase='MONSTER_TURN';
 s=resolveMonsterTurn(s);
 let shield=activeShield(s.expedition!,'monster');
 assert.ok(shield);
 assert.equal(shield!.effectId,'red_mantle_shield');
 assert.equal(shield!.currentShield,75);
 s=roundTrip(s);
 shield=activeShield(s.expedition!,'monster');
 assert.equal(shield?.currentShield,75);
 s=passPlayerTurn(s,noEvent);
 s=resolveMonsterTurn(s);
 assert.equal(hasEffect(s.expedition!.playerEffects,'crushing_pressure'),true);
 s.expedition!.monster.currentHp=Math.floor(s.expedition!.monster.hp*.4);
 s=passPlayerTurn(s,noEvent);
 s=resolveMonsterTurn(s);
 assert.equal(s.expedition!.monsterRuntime!.preparedActionId,'terminal_hunt');
});
test('RED 09: lethal boss Charge enters the shared revival decision pipeline and resumes combat',()=>{
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
