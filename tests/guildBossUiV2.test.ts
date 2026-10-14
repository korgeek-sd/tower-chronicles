import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {GuildBossDetail,GuildBossPanel} from '../src/components/association/GuildBossPanel';
import type {GuildBossInfo,GuildBossAttackResult} from '../src/online/guildBoss';

const day='2026-10-15T15:00:00.000Z';
const now=Date.parse('2026-10-14T15:00:00.000Z');
const base:GuildBossInfo={
 encounterId:'aaaa0000-0000-4000-8000-000000000001',kind:'DAILY',
 name:'황혼의 무리왕',maxHp:2400,remainingHp:1800,bossAttack:13,bossDefense:8,
 cycleStart:'2026-10-14T15:00:00.000Z',cycleEnd:day,defeatedAt:null,
 attacksUsed:2,attacksLeft:3,myDamage:600,participants:4,totalAttacks:8,
 leaderboard:[
  {userId:'u1',name:'검객',damage:970,attacks:3},
  {userId:'u2',name:'궁수',damage:660,attacks:2},
 ],nextAttackResetAt:day,
};
const show=(boss:GuildBossInfo,result:GuildBossAttackResult|null=null,expedition=false)=>
 renderToStaticMarkup(React.createElement(GuildBossDetail,{
  boss,now,result,busy:false,expedition,error:'',
  onFight:()=>{},onReload:()=>{},onDismiss:()=>{},onAuction:()=>{},
 }));

test('guild boss mobile UI foregrounds shared HP, attempts, attack and compact ranking',()=>{
 const html=show(base);
 assert.match(html,/황혼의 무리왕/);
 assert.match(html,/1,800/);
 assert.match(html,/2,400/);
 assert.match(html,/aria-valuenow="75"/);
 assert.match(html,/오늘 남은 공격/);
 assert.match(html,/3<small> \/ 5회<\/small>/);
 assert.match(html,/aria-label="공격 가능 3회"/);
 assert.match(html,/<button type="button" class="tc-boss-attack"/);
 assert.match(html,/>보스 공격<\/span>/);
 assert.match(html,/길드 피해량 순위/);
 assert.match(html,/<details class="tc-boss-leaderboard">/);
 assert.doesNotMatch(html,/<details class="tc-boss-leaderboard" open/);
 assert.match(html,/토벌 보상 · 길드 경매장/);
 assert.doesNotMatch(html,/<img/);
});
test('raid button respects existing cooldown-free 5-attack limit and defeated state',()=>{
 const exhausted=show({...base,attacksLeft:0,attacksUsed:5});
 assert.match(exhausted,/오늘의 공격 완료/);
 assert.match(exhausted,/<button type="button" class="tc-boss-attack" disabled=""/);
 const defeated=show({...base,remainingHp:0,defeatedAt:'2026-10-14T15:20:00Z',attacksLeft:3});
 assert.match(defeated,/토벌 성공/);
 assert.match(defeated,/토벌 완료/);
 assert.match(defeated,/aria-valuenow="0"/);
 const expedition=show(base,null,true);
 assert.match(expedition,/원정 중 공격 불가/);
 assert.match(expedition,/<button type="button" class="tc-boss-attack" disabled=""/);
});
test('weekly raid wording remains Saturday/KST without altering server balance',()=>{
 const html=show({...base,kind:'WEEKLY',name:'심연의 파수자',maxHp:24000,
 remainingHp:12000,cycleEnd:'2026-10-16T15:00:00Z'});
 assert.match(html,/심연의 파수자/);
 assert.match(html,/토요일 00:00/);
 assert.match(html,/aria-valuenow="50"/);
 const source=readFileSync(new URL('../src/components/association/GuildBossPanel.tsx',import.meta.url),'utf8');
 assert.match(source,/boss\.encounterId/);
 assert.match(source,/tc-guild-boss-request/);
 assert.match(source,/setTime\(Date\.now\(\)\)/);
 assert.doesNotMatch(source,/setInterval\([^)]*2000/);
});
test('a resolved attack shows a compact result, with long turn logs still folded',()=>{
 const result:GuildBossAttackResult={
 encounterId:base.encounterId,kind:'DAILY',name:base.name,damage:300,
 remainingHp:1500,maxHp:2400,defeated:false,attacksLeft:2,
 createdAt:'2026-10-14T15:20:00Z',
 combat:{damage:300,turns:[{turn:1,lines:['강타 · 300 피해'],playerHp:150,playerMp:100,damageTotal:300}],
 playerHp:150,maxPlayerHp:180,playerMp:100,maxPlayerMp:100,outcome:'survived',attackStat:45,defenseStat:10,weapon:'sword'},
 };
 const html=show(base,result);
 assert.match(html,/이번 공격 피해/);
 assert.match(html,/\+300/);
 assert.match(html,/1,500/);
 assert.match(html,/턴별 전투 기록/);
 assert.match(html,/<details class="tc-boss-turn-details">/);
 assert.match(html,/강타 · 300 피해/);
 assert.doesNotMatch(html,/<details class="tc-boss-turn-details" open/);
 const mismatched=show({...base,encounterId:'bbbb0000-0000-4000-8000-000000000002'},result);
 assert.doesNotMatch(mismatched,/이번 공격 피해/);
});
test('loading boss UI has both boss choices and a live refresh action',()=>{
 const html=renderToStaticMarkup(React.createElement(GuildBossPanel,{
  lease:{leaseId:'test',generation:1,expiresAt:'',clientInstanceId:'test'},associationId:'guild',expedition:false
 }));
 assert.match(html,/일일 보스/);
 assert.match(html,/주간 보스/);
 assert.match(html,/보스 정보 새로고침/);
 assert.match(html,/불러오는 중입니다/);
});
