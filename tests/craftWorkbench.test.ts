import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CraftScreen} from '../src/components/world/CraftScreen';
import {WORLD_TOWNS} from '../src/components/world/worldMap';
import type {VillageLifeState} from '../src/online/villageLife';

const state:VillageLifeState={location:'city',actionPoints:100,materials:{herb:100,pepper:100,potato:100,wheat:100,stone:100},products:{potion:7,attack_food:2,defense_food:0,experience_food:0,challenge_ticket:0},craftMastery:1000,craftCarry:{},towns:WORLD_TOWNS,serverNow:0,nextResetAt:1000};
const props={state,busy:false,count:10,recipe:'potion' as const,onRecipe:()=>{},onCount:()=>{},onCraft:()=>{}};

test('workbench recipe picker announces the selected product and shows distinct item art',()=>{
 const html=renderToStaticMarkup(React.createElement(CraftScreen,props));
 assert.match(html,/aria-label="제작 도안"/);
 assert.match(html,/<button[^>]*aria-pressed="true"[^>]*>[\s\S]*?회복 포션/);
 assert.match(html,/data-craft-art="potion"/);
 assert.match(html,/data-craft-art="herb"/);
 assert.match(html,/보유 7개/);
});

test('workbench separates base yield, mastery bonus and authoritative resource costs',()=>{
 const html=renderToStaticMarkup(React.createElement(CraftScreen,props));
 for(const label of ['기본 생산','숙련 보너스','재료 확보','행동력 10','재료 100개','예상 완성품 미리보기'])assert.ok(html.includes(label),label);
 assert.match(html,/aria-label="생활 행동력"/);
 assert.match(html,/aria-valuenow="100"/);
 assert.match(html,/11,000/);
});

test('insufficient resources keep crafting disabled and pending cannot show a reward',()=>{
 const html=renderToStaticMarkup(React.createElement(CraftScreen,{...props,state:{...state,materials:{herb:9}}}));
 assert.match(html,/부족 91개/);
 assert.match(html,/<button[^>]*class="[^"]*tc-craft-main[^"]*"[^>]*disabled/);
 const pending=renderToStaticMarkup(React.createElement(CraftScreen,{...props,busy:true}));
 assert.match(pending,/aria-busy="true"/);
 assert.match(pending,/제작 요청 처리 중/);
 assert.doesNotMatch(pending,/제작 완료!/);
});

test('local workshop only offers recipes supported by the current town',()=>{
 const html=renderToStaticMarkup(React.createElement(CraftScreen,{...props,state:{...state,location:'farm-1'},recipe:'attack_food'}));
 assert.match(html,/data-craft-art="pepper"/);
 assert.match(html,/공격 음식/);
 assert.doesNotMatch(html,/회복 포션|점령전 도전권/);
});
