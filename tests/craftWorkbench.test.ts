import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CraftScreen} from '../src/components/world/CraftScreen';
import {CRAFT_RECIPES,PRODUCT_NAMES} from '../src/game/life/crafting';
import {WORLD_TOWNS} from '../src/components/world/worldMap';
import type {VillageLifeState} from '../src/online/villageLife';

const state:VillageLifeState={location:'city',actionPoints:100,materials:{herb:100,pepper:100,potato:100,wheat:100,stone:100},products:{potion:7,attack_food:2,defense_food:0,experience_food:0,challenge_ticket:0},craftMastery:1000,craftCarry:{},towns:WORLD_TOWNS,serverNow:0,nextResetAt:1000};
const props={state,busy:false,count:10,recipe:'potion' as const,onRecipe:()=>{},onCount:()=>{},onCraft:()=>{}};

test('workbench recipe picker announces the selected product and shows distinct item art',()=>{
 const html=renderToStaticMarkup(React.createElement(CraftScreen,props));
 assert.match(html,/aria-label="제작 도안"/);
 assert.match(html,/<button[^>]*aria-pressed="true"[^>]*>[\s\S]*?회복 포션/);
 assert.match(html,/data-craft-art="potion"/);
 assert.match(html,/<img[^>]*src="\.\/assets\/ui\/crafting\/potion.png"/);
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

test('every town shows all five recipes and explains how to craft nonlocal products',()=>{
 const html=renderToStaticMarkup(React.createElement(CraftScreen,{...props,state:{...state,location:'farm-1'}}));
 for(const label of ['회복 포션','떡볶이','방어 음식','경험치 음식','점령전 도전권'])assert.ok(html.includes(label),label);
 assert.match(html,/노바르로 이동/);
 assert.match(html,/약초 마을 또는 노바르에서 제작/);
 assert.match(html,/<button[^>]*class="[^"]*tc-craft-main[^"]*"[^>]*disabled/);
});

test('Novar enables production of each of the five planned products',()=>{
 for(const recipe of CRAFT_RECIPES){
  const html=renderToStaticMarkup(React.createElement(CraftScreen,{...props,recipe:recipe.id,count:1}));
  assert.ok(html.includes(PRODUCT_NAMES[recipe.id]));
  assert.match(html,new RegExp(`data-craft-art="${recipe.material}"`));
  assert.match(html,/<button[^>]*class="[^"]*tc-craft-main[^"]*"[^>]*>[^]*?제작하기 1회/);
  assert.doesNotMatch(html,/<button[^>]*class="[^"]*tc-craft-main[^"]*"[^>]*disabled/);
 }
});

test('blueprint workshop separates the recipe rail from the selected product workspace',()=>{
 const html=renderToStaticMarkup(React.createElement(CraftScreen,props));
 assert.match(html,/<aside[^>]*aria-label="제작 도안 목록"/);
 assert.match(html,/<section[^>]*aria-label="제작 작업대"/);
 assert.match(html,/예상 완성품 미리보기/);
 assert.match(html,/필요 재료/);
});
