import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialHuntingState,resolveHunt} from '../src/game/hunting/model';
import {appendHuntHistory,huntLogEntries} from '../src/components/hunting/huntingLog';
import {HuntingCombatLog} from '../src/components/hunting/HuntingCombatLog';

const sample=()=>resolveHunt(initialHuntingState(0),'plains',{hp:1000,attack:300,defense:80},['heavy'],0,()=>0).result;
test('history keeps consecutive hunts, ignores duplicate authoritative results and caps at ten fights without mutating input',()=>{
 const first=sample(),before=JSON.stringify(first),one=appendHuntHistory([],first);
 assert.equal(appendHuntHistory(one,{...first}),one);
 let history=one;
 for(let i=1;i<=12;i++)history=appendHuntHistory(history,{...first,requestId:'request-'+i,createdAt:i});
 assert.equal(history.length,10);assert.equal(history[0].requestId,'request-3');assert.equal(history[9].requestId,'request-12');
 assert.equal(one.length,1);assert.equal(JSON.stringify(first),before);
});
test('log preserves every actual turn line and reports recovery, gear, XP, silver and potion counts truthfully',()=>{
 const result={...sample(),playerHp:50,recoveredHp:100,potionsUsed:7,turns:[{turn:1,playerHp:50,monsterHp:0,lines:['탐사자의 강타! 30 피해','들개의 흡혈! 8 피해 · HP +4']}]};
 const entries=huntLogEntries(result,'검사');const text=entries.map(e=>e.text).join('\n');
 assert.match(text,/검사의 강타! 30 피해/);assert.match(text,/들개의 흡혈! 8 피해 · HP \+4/);
 assert.match(text,/HP 50 회복/);assert.match(text,/HP 물약 7개 사용/);assert.match(text,/경험치/);assert.match(text,/실버/);assert.match(text,/장비 획득/);
 const old=huntLogEntries({...result,potionsUsed:undefined,recoveredHp:undefined,equipment:null,outcome:'defeat'},'검사').map(e=>e.text).join('\n');
 assert.doesNotMatch(old,/HP 물약 0개|장비 획득|경험치 \+/);assert.match(old,/획득 보상 없음/);
});
test('stream renders readable chronological combat entries with a keyboard scroll region and latest-record control',()=>{
 const html=renderToStaticMarkup(React.createElement(HuntingCombatLog,{result:sample(),nickname:'검사',active:true,onRecords:()=>{}}));
 assert.match(html,/role="log"/);assert.match(html,/tabindex="0"/);assert.match(html,/최근 10회/);assert.match(html,/최신 기록/);assert.match(html,/전투 기록 보기/);
 assert.match(html,/사냥 성공/);assert.match(html,/HP 물약/);assert.doesNotMatch(html,/전송|<input/);
});
