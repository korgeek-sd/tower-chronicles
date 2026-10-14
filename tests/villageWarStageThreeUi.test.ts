import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {VillageWarDeploymentPanel} from '../src/components/occupation/VillageWarDeploymentPanel';
import {VillageWarCombatResult} from '../src/components/occupation/VillageWarCombatResult';

const user='11111111-1111-4111-8111-000000000001';
const date=Date.parse('2026-10-17T13:20:00Z');
const base:any={
 enabled:true,stageTwo:true,serverNow:date,phase:'BATTLE',
 eventId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',myAssociationId:'ours',
 ownerAssociationId:'theirs',myRole:'MEMBER',canAttack:true,tickets:4,
 nextAttackAt:null,myDefendingFront:null,
 deploymentStartsAt:'2026-10-17T12:55:00Z',battleStartsAt:'2026-10-17T13:00:00Z',
 battleEndsAt:'2026-10-17T14:00:00Z',
 fronts:Array.from({length:5},(_,i)=>({
  frontId:i+1,defenderUserId:i===0?'other':null,defenderName:i===0?'방패기사':null,
  associationId:i===0?'theirs':null,associationName:i===0?'푸른별':null,
  defenderEpoch:0,revision:0,hp:i===0?90:null,maxHp:i===0?120:null,
  mp:i===0?42:null,maxMp:i===0?60:null,occupiedAt:null
 })),
 scores:[{associationId:'theirs',associationName:'푸른별',points:25.5,fronts:1}],
 recentBattles:[{battleId:'receipt',frontId:1,createdAt:'2026-10-17T13:18:00Z',attackerName:'검객',defenderName:'방패기사',outcome:'DEFENDED',defenderHp:90,defenderReward:1}]
};
const render=(state:any,callbacks:Record<string,unknown>={})=>renderToStaticMarkup(React.createElement(VillageWarDeploymentPanel,{
 state,userId:user,busy:false,pending:null,error:'',now:date,
 onPlace:()=>{},onRemove:()=>{},onClaim:()=>{},onAttack:()=>{},onRetry:()=>{},onRefresh:()=>{},...callbacks
} as any));

test('live battlefield renders exactly five selectable lanes, exact HP/MP, scoring and recent combat',()=>{
 const html=render(base);
 assert.equal((html.match(/class="tc-village-lane /g)??[]).length,5);
 assert.match(html,/제1전선 · 적군 수비/);
 assert.match(html,/수비자 HP 90 \/ 120/);
 assert.match(html,/수비자 MP 42 \/ 60/);
 assert.match(html,/25\.50/);
 assert.match(html,/150점 선착순/);
 assert.match(html,/즉시 전투/);
 assert.match(html,/전투 기록/);
 assert.match(html,/검객/);
 assert.doesNotMatch(html,/붉은달|철의맹세|UI 시연 데이터/);
});
test('front action obeys friendly-fire and authorization/cooldown constraints',()=>{
 const allied=render({...base,fronts:base.fronts.map((f:any,i:number)=>i===0?{...f,associationId:'ours'}:f)});
 assert.match(allied,/우리 길드 수비 중/);
 assert.match(allied,/class="tc-village-primary tc-feel-press" disabled=""/);
 for(const state of [{...base,tickets:0},{...base,nextAttackAt:'2026-10-17T13:20:30Z'},{...base,myDefendingFront:{eventId:base.eventId,frontId:4}}]){
  const html=render(state);
  assert.match(html,/class="tc-village-primary tc-feel-press" disabled=""/);
 }
 assert.match(render({...base,canAttack:false}),/class="tc-village-primary tc-feel-press" disabled=""/);
});
test('deployment remains leader-only for removing an existing defender',()=>{
 const state={...base,phase:'DEPLOYMENT',serverNow:Date.parse('2026-10-17T12:56:00Z'),ownerAssociationId:'ours',myRole:'LEADER'};
 const html=render(state);
 assert.match(html,/배치 해제/);
 assert.match(render({...state,myRole:'MEMBER'}),/disabled=""/);
 assert.doesNotMatch(render({...state,myRole:'MEMBER'}),/배치 해제/);
});
test('server PvP result shows actual names, art, vitals, reward, and authored turn log',()=>{
 const battle:any={outcome:'DEFENDED',attackerName:'공격자',defenderName:'방패기사',
 attackerHp:0,attackerMaxHp:100,attackerMp:8,attackerMaxMp:50,
 defenderHp:36,defenderMaxHp:120,defenderMp:42,defenderMaxMp:60,defenderReward:1,
 turns:[{turn:1,lines:['공격자 · sword_strike_c 12 피해']}]};
 const html=renderToStaticMarkup(React.createElement(VillageWarCombatResult,{battle,onClose:()=>{},attackerArt:'/assets/characters/hero.png'}));
 assert.match(html,/전선으로 돌아가기/);
 assert.match(html,/수비자 도전권 \+1/);
 assert.match(html,/보급검 베기/);
 assert.match(html,/\/assets\/characters\/hero.png/);
 assert.match(html,/공격자 HP/);
 assert.match(html,/수비자 MP/);
 assert.doesNotMatch(html,/sword_strike_c/);
});
