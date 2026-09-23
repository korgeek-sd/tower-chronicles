import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,recordCombatEvent} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {basicAttack,resolveMonsterTurn} from '../src/game/engine/combat.ts';
import {inventoryView} from '../src/game/inventoryView.ts';
import {activeShield,applyEffect} from '../src/game/engine/effects.ts';
import {effectText} from '../src/components/battle/presentation.ts';
import {monsterCombatIntel} from '../src/components/battle/combatIntel.ts';
import {createRepository,validSave} from '../src/storage/repository.ts';

const noCrit=()=>.99;
function bowBattle(){const s=initialState();s.items.push({id:'bow-ui',kind:'bow',tier:1,enhancement:0});s.equipped.weapon='bow-ui';const battle=enter(s,'ore',1);battle.expedition!.monster.hp=1000;battle.expedition!.monster.currentHp=1000;return battle;}

test('VISIBILITY 01: weapon inventory facts expose attack, defense, crit, hit coefficients and skill power',()=>{const s=initialState();for(const kind of ['dagger','bow','staff'])s.items.push({id:kind,kind,tier:1,enhancement:0});const items=inventoryView(s);assert.ok(items.find(item=>item.sourceId==='starter')?.facts?.includes('치명타 5%'));assert.ok(items.find(item=>item.sourceId==='dagger')?.facts?.includes('치명타 20%'));assert.ok(items.find(item=>item.sourceId==='bow')?.facts?.includes('기본 공격 55% + 55%'));assert.ok(items.find(item=>item.sourceId==='staff')?.facts?.includes('공격 스킬 위력 130%'));});

test('VISIBILITY 02: bow emits two ordered hit-level combat events with independent critical labels',()=>{const s=bowBattle(),n=basicAttack(s,(()=>{const values=[0,.99,.99];return()=>values.shift()??.99;})());const events=n.combatEvents!;assert.equal(events.length,2);assert.deepEqual(events.map(event=>[event.hitIndex,event.hitCount,event.target,event.critical]),[[1,2,'monster',true],[2,2,'monster',false]]);assert.ok(events[0].id<events[1].id);});

test('VISIBILITY 03: shield absorption and actual HP damage are separate structured values',()=>{const s=bowBattle(),e=s.expedition!;applyEffect(e,'monster','test_shield','monster',0);activeShield(e,'monster')!.currentShield=5;const n=basicAttack(s,noCrit),events=n.combatEvents!;assert.equal(events.length,2);assert.equal(events[0].absorbedByShield,5);assert.equal(events[0].hpDamage,Math.max(0,events[0].incomingDamage-5));assert.equal(events[1].absorbedByShield,0);});

test('VISIBILITY 04: monster direct damage is identified as player-targeted',()=>{const s=enter(initialState(),'ore',1);s.expedition!.phase='MONSTER_TURN';const n=resolveMonsterTurn(s),event=n.combatEvents!.at(-1)!;assert.equal(event.attacker,'monster');assert.equal(event.target,'player');assert.equal(event.critical,false);});

test('VISIBILITY 05: effect labels include numeric modifier, stacks, shield mode and duration',()=>{const s=bowBattle(),e=s.expedition!;applyEffect(e,'player','attack_up','player',0);assert.equal(effectText(e.playerEffects[0]),'공격 증가 · +30% · 3턴');applyEffect(e,'monster','test_hit_shield','monster',0);assert.match(effectText(activeShield(e,'monster')!),/2회 방어 · 3턴/);});

test('VISIBILITY 06: combat event history is bounded and old v21 saves remain valid',()=>{const s=initialState();delete s.combatEvents;delete s.combatEventSequence;assert.equal(validSave(s),true);for(let i=0;i<45;i++)recordCombatEvent(s,{kind:'DIRECT_DAMAGE',attacker:'player',target:'monster',hitIndex:1,hitCount:1,incomingDamage:1,absorbedByShield:0,hpDamage:1,critical:false});assert.equal(s.combatEvents?.length,40);assert.equal(s.combatEvents?.[0].id,6);assert.equal(validSave(s),true);const map=new Map<string,string>(),repo=createRepository({getItem:key=>map.get(key)??null,setItem:(key,value)=>void map.set(key,value)});repo.save(s);assert.deepEqual(repo.load().combatEvents,s.combatEvents);});

test('VISIBILITY 07: malformed combat-event telemetry is rejected',()=>{const s:any=initialState();s.combatEvents=[{id:1,kind:'DIRECT_DAMAGE',attacker:'player',target:'player',hitIndex:2,hitCount:1,incomingDamage:-1,absorbedByShield:0,hpDamage:0,critical:'yes'}];s.combatEventSequence=1;assert.equal(validSave(s),false);});


test('VISIBILITY 08: combat intel only announces committed Charge or Reactive actions and never predicts AI',()=>{
 const s=enter(initialState(),'ore',1),e=s.expedition!;
 e.monster={...e.monster,definitionId:'test-prepared-combined',name:'복합 준비 훈련체'};
 e.monsterRuntime={definitionId:'test-prepared-combined',skillCooldowns:{},preparedActionId:null,turnNumber:0};
 assert.equal(monsterCombatIntel(e).intent.kind,'NONE');
 e.monsterRuntime.preparedActionId='qa_charge';
 let intel=monsterCombatIntel(e);
 assert.equal(intel.intent.kind,'CHARGE');
 assert.equal(intel.intent.skillName,'TEST_CHARGE_LONG_NAME');
 e.monsterRuntime.preparedActionId=null;
 e.reactivePrepared.monster={definitionId:'test-prepared-combined',prepareSkillId:'qa_counter_stance',reactionSkillId:'qa_counter',trigger:'DIRECT_HIT_RECEIVED'};
 intel=monsterCombatIntel(e);
 assert.equal(intel.intent.kind,'REACTIVE');
 assert.equal(intel.intent.skillName,'TEST_REACTIVE_COUNTER_LONG_NAME');
});

test('VISIBILITY 09: combat intel exposes exact effect stacks, turns, shield amount and skill cooldown state',()=>{
 const s=enter(initialState(),'ore',1),e=s.expedition!;
 e.monster={...e.monster,definitionId:'test-shield-monster',name:'보호막 훈련체'};
 e.monsterRuntime={definitionId:'test-shield-monster',skillCooldowns:{shield_stance:2,shield_multi:0},preparedActionId:null,turnNumber:0};
 applyEffect(e,'monster','test_shield','monster',0);
 activeShield(e,'monster')!.currentShield=17;
 const intel=monsterCombatIntel(e);
 assert.equal(intel.shield?.shieldCurrent,17);
 assert.equal(intel.shield?.shieldMax,30);
 assert.equal(intel.shield?.turns,3);
 assert.equal(intel.skills.find(skill=>skill.id==='shield_stance')?.cooldownRemaining,2);
 assert.equal(intel.skills.find(skill=>skill.id==='shield_stance')?.ready,false);
 assert.equal(intel.skills.find(skill=>skill.id==='shield_multi')?.ready,true);
});
