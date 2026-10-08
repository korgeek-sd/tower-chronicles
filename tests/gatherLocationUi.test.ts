import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {LifeScreen} from '../src/components/world/LifeScreen';
import {WORLD_TOWNS} from '../src/components/world/worldMap';
import type {VillageLifeState} from '../src/online/villageLife';

const state:VillageLifeState={location:'herb-1',actionPoints:24,materials:{herb:42,pepper:10,potato:20,wheat:30},towns:WORLD_TOWNS.map(t=>({...t,owner:'잿빛',tax:10,herbCapacity:30000,farmCapacity:30000,herbRemaining:180,farmRemaining:90})),serverNow:0,nextResetAt:100000};
const props={state,busy:false,count:1,now:0,onCount:()=>{},onGather:()=>{},onBack:()=>{},onRefresh:()=>{}};
const render=(overrides:Partial<React.ComponentProps<typeof LifeScreen>>={})=>renderToStaticMarkup(React.createElement(LifeScreen,{...props,...overrides}));

test('gathering leads with the current town scenery and authoritative ownership, AP and stock',()=>{
 const html=render();
 assert.match(html,/data-gather-scene="herb"/);
 assert.match(html,/달그늘 약초밭/);
 assert.match(html,/잿빛 원정단/);
 assert.match(html,/생산물 세율 10%/);
 assert.match(html,/aria-label="생활 행동력"[^>]*aria-valuenow="24"/);
 assert.match(html,/aria-label="약초 잔여량"[^>]*aria-valuenow="180"[^>]*aria-valuemax="30000"/);
 assert.match(html,/data-craft-art="herb"/);
 assert.match(html,/보유 42개/);
 assert.match(html,/매일 00:00 초기화/);
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
 const emptyAP=render({state:{...state,actionPoints:0}});
 assert.match(emptyAP,/생활 행동력이 부족합니다/);
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
 const confirmed=render({message:'약초 +10 · 행동력 −1'});
 assert.match(confirmed,/약초 \+10 · 행동력 −1/);
});

test('gathering leaves utility actions out and puts specialty selection after the scene',()=>{
 const html=render({onWell:()=>{}});
 assert.doesNotMatch(html,/우물|잔여량 새로고침|<footer/);
 assert.match(html,/<\/div><div class="tc-life-resource"/);
});
