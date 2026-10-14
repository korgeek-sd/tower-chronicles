import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {VillageWarDeploymentPanel} from '../src/components/occupation/VillageWarDeploymentPanel';
import {validVillageWarPending} from '../src/components/occupation/villageWarPending';
import {retainVillageWarPending} from '../src/components/occupation/villageWarPending';
const uid='11111111-1111-4111-8111-000000000001';
test('stage two shows scores, enemy attack, MP and settled winner without preview values',()=>{
 const state:any={enabled:true,stageTwo:true,phase:'BATTLE',serverNow:0,canAttack:true,tickets:2,myAssociationId:'ours',fronts:[{frontId:1,defenderUserId:'enemy',associationId:'theirs',associationName:'공격길드',hp:100,maxHp:180,mp:42,maxMp:100}],scores:[{associationId:'theirs',associationName:'공격길드',points:15.5,fronts:1}],recentBattles:[]};
 const render=(s:any)=>renderToStaticMarkup(React.createElement(VillageWarDeploymentPanel,{state:s,userId:uid,busy:false,pending:null,error:'',onPlace:()=>{},onRemove:()=>{},onClaim:()=>{},onAttack:()=>{},onRetry:()=>{},onRefresh:()=>{}}));
 const html=render(state);assert.match(html,/즉시 전투/);assert.match(html,/15\.50/);assert.match(html,/MP 42/);assert.doesNotMatch(html,/자동 PvP 연결 전/);
 assert.match(render({...state,phase:'ENDED',winnerAssociationId:'theirs',settledAt:'2026-10-17T13:30:00Z'}),/공격길드 승리/);
});
test('attack recovery preserves request account, event and defender epoch',()=>{
 const r={id:'44444444-4444-4444-8444-000000000001',eventId:'55555555-5555-4555-8555-555555555555',userId:uid,townId:'city',frontId:2,expectedEpoch:3,action:'ATTACK'};
 assert.equal(validVillageWarPending(r,uid),true);assert.equal(validVillageWarPending(r,'other'),false);
});
test('committed receipt recovery survives transient event and actor locks',()=>{
 for(const code of ['WAR_REQUEST_BUSY','WAR_EVENT_BUSY','WAR_ACTOR_BUSY','WAR_FRONT_BUSY'])assert.equal(retainVillageWarPending(code),true,code);
 for(const code of ['WAR_ENDED','WAR_DEFENDER_CHANGED','WAR_SAME_GUILD'])assert.equal(retainVillageWarPending(code),false,code);
});

test('combat result displays authored skill names rather than internal IDs',async()=>{
 const {VillageWarCombatResult}=await import('../src/components/occupation/VillageWarCombatResult');
 const battle:any={outcome:'DEFENDED',attackerName:'공격자',defenderName:'수비자',attackerHp:0,attackerMaxHp:180,attackerMp:20,attackerMaxMp:100,defenderHp:80,defenderMaxHp:180,defenderMp:40,defenderMaxMp:100,defenderReward:1,turns:[{turn:1,lines:['공격자 · sword_strike_c 12 피해']}]};
 const html=renderToStaticMarkup(React.createElement(VillageWarCombatResult,{battle,onClose:()=>{}}));
 assert.doesNotMatch(html,/sword_strike_c/);assert.match(html,/보급검 베기/);assert.match(html,/수비자 도전권 \+1/);assert.match(html,/전선으로 돌아가기/);
});
