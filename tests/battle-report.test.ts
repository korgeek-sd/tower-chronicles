import test from 'node:test';
import assert from 'node:assert/strict';
import type {ActiveEffect,CombatEvent} from '../src/game/types.ts';
import {analyzeDeath,logKind,summarizeEvents} from '../src/components/battle/report.ts';
import {DEFAULT_PREFS,loadPrefs,savePrefs} from '../src/components/battle/prefs.ts';
import type {BattlePrefs} from '../src/components/battle/prefs.ts';

const hit=(over:Partial<CombatEvent>):CombatEvent=>({id:1,kind:'DIRECT_DAMAGE',attacker:'player',target:'monster',hitIndex:1,hitCount:1,incomingDamage:10,absorbedByShield:0,hpDamage:10,critical:false,...over});

test('REPORT 01: log lines are classified without touching save strings',()=>{
 assert.equal(logKind('당신의 공격 · 12 피해'),'player');
 assert.equal(logKind('고블린 광부의 기본 공격 · 5 피해'),'monster');
 assert.equal(logKind('당신의 공격 · 20 피해 · 치명타!'),'crit');
 assert.equal(logKind('당신의 활 공격 1타 · 5 피해 · 보호막 3 흡수'),'shield');
 assert.equal(logKind('[하급 회복 포션] 사용 · 남은 수량 9'),'heal');
 assert.equal(logKind('고블린 광부 처치! 1T 철광석 ×2 · Silver +13 (원정 임시 보관)'),'reward');
 assert.equal(logKind('[혈로 돌진] 준비 시작 · 다음 적 행동에 발동'),'buff');
 assert.equal(logKind('치명상을 입었습니다'),'death');
 assert.equal(logKind('탑에서 얻은 것은 아직 네 것이 아니다.'),null);
});

test('REPORT 02: dealt/taken/crit/max/shield are split by attacker',()=>{
 const events=[hit({id:1,hpDamage:10,incomingDamage:10}),hit({id:2,hpDamage:20,incomingDamage:20,critical:true}),hit({id:3,attacker:'monster',target:'player',hpDamage:7,incomingDamage:12,absorbedByShield:5}),hit({id:4,attacker:'monster',target:'player',hpDamage:0,incomingDamage:4,absorbedByShield:4,critical:true})];
 const s=summarizeEvents(events);
 assert.equal(s.hits,4);
 assert.equal(s.dealt,30);
 assert.equal(s.taken,7);
 assert.equal(s.critCount,2);
 assert.equal(s.maxHit,20);
 assert.equal(s.maxCrit,20);
 assert.equal(s.shieldAbsorbed,9);
 assert.equal(s.playerHits,2);
 assert.equal(s.monsterHits,2);
});

test('REPORT 03: empty telemetry summarizes to zeros',()=>{
 const s=summarizeEvents([]);
 assert.deepEqual(s,{hits:0,dealt:0,taken:0,critCount:0,maxHit:0,maxCrit:0,shieldAbsorbed:0,playerHits:0,monsterHits:0});
});

const fx=(effectId:string):ActiveEffect=>({instanceId:'effect-1',effectId,sourceActorId:'monster',targetActorId:'player',remainingDuration:3,stackCount:1,applicationSequence:1,createdTurn:1,scope:'BATTLE'});

test('REPORT 04: death analysis names burst, dot, defense-down and empty potions',()=>{
 const hints=analyzeDeath({lastEvent:hit({target:'player',hpDamage:80,incomingDamage:80,critical:true}),snap:{monsterName:'적아의 주인',maxHp:180,defense:10,effects:[fx('fang_wound'),fx('crushing_pressure')],potionsLeft:0,loadoutRevival:1}});
 const ids=hints.map(h=>h.id);
 assert.ok(ids.includes('burst'));
 assert.ok(ids.includes('dot'));
 assert.ok(ids.includes('defense-down'));
 assert.ok(ids.includes('potion'));
 assert.ok(hints.length<=4);
});

test('REPORT 05: calm death falls back to a general hint',()=>{
 const hints=analyzeDeath({lastEvent:hit({target:'player',hpDamage:5,incomingDamage:5}),snap:{monsterName:'동굴 쥐',maxHp:180,defense:30,effects:[],potionsLeft:5,loadoutRevival:1}});
 assert.equal(hints.length,1);
 assert.equal(hints[0].id,'general');
});

test('REPORT 06: prefs survive a storage roundtrip and reject bad values',()=>{
 const mem=new Map<string,string>();
 const store={getItem:(k:string)=>mem.get(k)??null,setItem:(k:string,v:string)=>{mem.set(k,v);}};
 assert.deepEqual(loadPrefs(null),DEFAULT_PREFS);
 assert.deepEqual(loadPrefs(store),DEFAULT_PREFS);
 const prefs:BattlePrefs={speed:2,damageNumbers:false,autoscroll:false};
 savePrefs(prefs,store);
 assert.deepEqual(loadPrefs(store),prefs);
 mem.set('tower-chronicles-ui-prefs','{bad json');
 assert.deepEqual(loadPrefs(store),DEFAULT_PREFS);
 mem.set('tower-chronicles-ui-prefs','{"speed":99}');
 assert.equal(loadPrefs(store).speed,1);
});
