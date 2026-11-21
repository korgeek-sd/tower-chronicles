import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {QuestScreen} from '../src/components/quests/QuestScreen';import type {QuestBoard} from '../src/online/quests';
const board:QuestBoard={daily:['hunt','craft','gather'].map((id,i)=>({id,target:[30,10,30][i],progress:0,completed:false,claimed:false,reward:null})),weekly:[],dailyKey:'2026-10-11',weeklyKey:'2026-10-05',serverNow:0,dailyResetAt:1,weeklyResetAt:1};
test('quest screen shows authoritative progress and exactly one action per request',()=>{const html=renderToStaticMarkup(React.createElement(QuestScreen,{onMove:()=>{},board}));for(const label of ['의뢰','일일','주간','사냥 승리 30회','제작 10회','채집 30회','바로가기','랜덤 보상','0 / 30'])assert.ok(html.includes(label),label);assert.doesNotMatch(html,/보상 안내|배정 예시|서버 연결 준비 중/);assert.equal((html.match(/>바로가기<\/span><\/button>/g)??[]).length,3);assert.equal((html.match(/role="progressbar"/g)??[]).length,3);});
test('completed request replaces shortcut with a single claim button; claimed is disabled',()=>{const next={...board,daily:board.daily.map((q,i)=>({...q,completed:i<2,claimed:i===1,progress:i<2?q.target:0}))};const html=renderToStaticMarkup(React.createElement(QuestScreen,{onMove:()=>{},onClaim:()=>{},board:next}));assert.equal((html.match(/>보상받기<\/span><\/button>/g)??[]).length,1);assert.equal((html.match(/>바로가기<\/span><\/button>/g)??[]).length,1);assert.match(html,/disabled=""><span>수령 완료<\/span><\/button>/);});
test('unloaded quests show no fabricated assignment or claim action',()=>{const html=renderToStaticMarkup(React.createElement(QuestScreen,{onMove:()=>{}}));assert.doesNotMatch(html,/tc-quest-paper|>보상받기<|>바로가기</);assert.match(html,/불러오는 중/);});
test('quest presentation exposes progress, completed and claimed states without relying on color',()=>{
 const next={...board,daily:board.daily.map((q,i)=>({...q,completed:i>0,claimed:i===2,progress:i>0?q.target:18}))};
 const html=renderToStaticMarkup(React.createElement(QuestScreen,{onMove:()=>{},onClaim:()=>{},board:next}));
 assert.match(html,/>의뢰 게시판<\/h1>/);
 assert.match(html,/>일일<\/button>/);assert.match(html,/>주간<\/button>/);
 for(const label of ['바로가기','보상받기','수령 완료'])assert.ok(html.includes('>'+label+'</span></button>'),label);
 assert.equal((html.match(/tc-quest-seal/g)??[]).length,3);
});
test('weekly places all five assignments on the same notice board',()=>{
 const weekly=['hunt','craft','gather','daily','all'].map(id=>({...board.daily[0],id}));
 const html=renderToStaticMarkup(React.createElement(QuestScreen,{onMove:()=>{},board:{...board,weekly},initialTab:'weekly'}));
 assert.match(html,/의뢰 게시판/);
 assert.equal((html.match(/class="tc-quest-paper /g)??[]).length,5);
});
test('quest board retains live emblems on each server-backed request',()=>{
 const html=renderToStaticMarkup(React.createElement(QuestScreen,{onMove:()=>{},board}));
 assert.match(html,/tc-quest-wall is-daily/);
 assert.equal((html.match(/tc-quest-emblem/g)??[]).length,3);
});

test('quest board v3 shows a five-row dark fantasy list with real server progress and action states',()=>{
 const quests=['hunt','craft','gather','market','donate'].map((id,index)=>({id,target:index===3||index===4?3:30,progress:index===0?20:index===1?30:index===3?3:0,completed:index===1||index===3,claimed:false,reward:null}));
 const html=renderToStaticMarkup(React.createElement(QuestScreen,{onMove:()=>{},onClaim:()=>{},board:{...board,daily:quests}}));
 assert.match(html,/tc-quest-screen-v3/);
 assert.equal((html.match(/class="tc-quest-paper /g)??[]).length,5);
 assert.match(html,/완료 현황/);
 assert.match(html,/>2 \/ 5<\/b>/);
 assert.match(html,/수령 가능 2건/);
 assert.match(html,/20 \/ 30/);
 assert.match(html,/66%|67%/);
 assert.equal((html.match(/>보상받기<\/span><\/button>/g)??[]).length,2);
 assert.equal((html.match(/>바로가기<\/span><\/button>/g)??[]).length,3);
 assert.doesNotMatch(html,/임의의 보상 지급|확정 보상/);
});
test('quest board v3 keeps five weekly items on one fixed-height column and preserves claimed details',async()=>{
 const {readFileSync}=await import('node:fs');
 const css=readFileSync(new URL('../src/components/quests/quests.css',import.meta.url),'utf8');
 assert.match(css,/tc-quest-screen-v3/);
 assert.match(css,/grid-template-rows:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(css,/overflow:hidden/);
 assert.doesNotMatch(css,/notice-daily\.webp|notice-weekly\.webp/);
 const qs=['hunt','craft','gather','daily','all'].map((id,i)=>({...board.daily[0],id,completed:i===0,claimed:i===0,reward:i===0?[{item:'herb',name:'약초',quantity:3}]:null}));
 const html=renderToStaticMarkup(React.createElement(QuestScreen,{onMove:()=>{},board:{...board,weekly:qs},initialTab:'weekly'}));
 assert.equal((html.match(/class="tc-quest-paper /g)??[]).length,5);
 assert.match(html,/수령 완료/);
 assert.match(html,/약초 3개/);
 assert.match(html,/월요일 00시 초기화/);
});
