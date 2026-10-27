import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {LifeScreen} from '../src/components/world/LifeScreen';
import {WORLD_TOWNS} from '../src/components/world/worldMap';
import type {VillageLifeState} from '../src/online/villageLife';

const state:VillageLifeState={location:'herb-1',vitality:24,materials:{herb:42,pepper:10,potato:20,wheat:30},lifeMasteries:{herb:100,farm:700,ticket:0},towns:WORLD_TOWNS.map(t=>({...t,owner:'잿빛',tax:10,herbCapacity:30000,farmCapacity:30000,herbRemaining:180,farmRemaining:90})),serverNow:0,nextResetAt:100000};
const props={state,busy:false,count:1,now:0,onCount:()=>{},onGather:()=>{},onBack:()=>{},onRefresh:()=>{}};
const render=(overrides:Partial<React.ComponentProps<typeof LifeScreen>>={})=>renderToStaticMarkup(React.createElement(LifeScreen,{...props,...overrides}));

test('gathering leads with the current town scenery and authoritative ownership, AP and stock',()=>{
 const html=render();
 assert.match(html,/data-gather-scene="herb"/);
 assert.match(html,/달그늘 약초밭/);
 assert.match(html,/잿빛 길드/);
 assert.match(html,/세율 10%/);
 assert.match(html,/aria-label="생활 활력"[^>]*aria-valuenow="24"/);
 assert.match(html,/aria-label="약초 잔여량"[^>]*aria-valuenow="180"[^>]*aria-valuemax="30000"/);
 assert.match(html,/data-craft-art="herb"/);
 assert.match(html,/보유 약초/);
 assert.match(html,/매일 24:00 초기화/);
});

test('farm location shows crop scenery and random crop rewards without inventing selectable crops',()=>{
 const html=render({state:{...state,location:'farm-1'}});
 assert.match(html,/data-gather-scene="farm"/);
 assert.match(html,/황금들 농장/);
 assert.match(html,/고추·감자·밀 중 매회 랜덤 한 종류/);
 for(const id of ['pepper','potato','wheat'])assert.match(html,new RegExp(`data-craft-art="${id}"`));
 assert.doesNotMatch(html,/약초 채집|철광석|구리광석/);
 assert.equal((html.match(/class="tc-life-gather"/g)??[]).length,1);
});

test('gathering explains insufficient action points and exhausted stock while disabling the main action',()=>{
 const emptyAP=render({state:{...state,vitality:0}});
 assert.match(emptyAP,/생활 활력이 부족합니다/);
 assert.match(emptyAP,/<button[^>]*class="[^"]*tc-gather-main[^"]*"[^>]*disabled/);
 const emptyStock=render({state:{...state,towns:state.towns.map(t=>({...t,herbRemaining:9}))}});
 assert.match(emptyStock,/마을의 남은 생산량이 부족합니다/);
 assert.match(emptyStock,/<button[^>]*class="[^"]*tc-gather-main[^"]*"[^>]*disabled/);
 const overLimit=render({count:20});
 assert.match(overLimit,/현재 최대 18회/);
 assert.match(overLimit,/<button[^>]*class="[^"]*tc-gather-main[^"]*"[^>]*disabled/);
});

test('pending keeps gathering and resource selection disabled and only displays confirmed messages',()=>{
 const html=render({state:{...state,location:'city'},busy:true});
 assert.match(html,/aria-busy="true"/);
 assert.match(html,/<button[^>]*aria-pressed="true"[^>]*disabled[^>]*>[^]*?약초 채집/);
 assert.match(html,/채집 요청 확인 중/);
 assert.doesNotMatch(html,/약초 \+10/);
 const confirmed=render({message:'약초 +10 · 활력 −1'});
 assert.match(confirmed,/약초 \+10 · 활력 −1/);
});

test('gathering leaves utility actions out and puts specialty selection after the scene',()=>{
 const html=render({state:{...state,location:'city'},onWell:()=>{}});
 assert.doesNotMatch(html,/우물|잔여량 새로고침|<footer/);
 assert.ok(html.indexOf('tc-life-resource')>html.indexOf('data-gather-scene'));
});

test('gathering displays mastery XP while preserving fixed yield',()=>{
 assert.match(render(),/약초 Lv.2/);
 assert.match(render({state:{...state,location:'farm-1'}}),/농업 Lv.5/);
 for(const html of [render(),render({state:{...state,location:'farm-1'}})]){
  assert.match(html,/생산 10개/);assert.match(html,/활력 1/);
 }
});


test('scenic production hides single-specialty tabs and unrelated inventory, with real max selection',()=>{
 const html=render();
 assert.doesNotMatch(html,/aria-label="채집 종류"|data-craft-art="pepper"|data-craft-art="potato"|data-craft-art="wheat"/);
 assert.match(html,/>최대<\/button>/);
 assert.doesNotMatch(html,/>100회<\/button>/);
 assert.match(html,/aria-label="약초 숙련도 경험치"[^>]*aria-valuenow="0"[^>]*aria-valuemin="0"[^>]*aria-valuemax="150"/);
 const farm=render({state:{...state,location:'farm-1'}});
 assert.doesNotMatch(farm,/data-craft-art="herb"/);
 for(const id of ['pepper','potato','wheat'])assert.match(farm,new RegExp(`data-craft-art="${id}"`));
});

test('mastery progress handles level cap and preview distinguishes pre-tax production',()=>{
 const html=render({state:{...state,lifeMasteries:{herb:3200}}});
 assert.match(html,/약초 Lv.10/);assert.match(html,/MAX/);assert.doesNotMatch(html,/NaN|Infinity/);
 assert.match(html,/세전/);
});
