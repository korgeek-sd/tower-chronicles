import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CraftScreen} from '../src/components/world/CraftScreen';
import {WORLD_TOWNS} from '../src/components/world/worldMap';
import type {VillageLifeState} from '../src/online/villageLife';
const state:VillageLifeState={location:'city',actionPoints:100,materials:{herb:100},products:{potion:7},craftMastery:1000,craftCarry:{},towns:WORLD_TOWNS,serverNow:0,nextResetAt:1000};
const render=(changes:Partial<VillageLifeState>={},busy=false)=>renderToStaticMarkup(React.createElement(CraftScreen,{state:{...state,...changes},busy,count:10,recipe:'potion',onRecipe:()=>{},onCount:()=>{},onCraft:()=>{}}));
test('craft skin distinguishes resources, location and pending states without enabling blocked production',()=>{
 assert.match(render(),/tc-iron-craft/);assert.match(render(),/data-craft-state="ready"/);assert.match(render(),/제작 가능/);
 for(const [changes,expected,label] of [
  [{materials:{herb:9}},'materials','재료 부족'],
  [{actionPoints:9},'action-points','행동력 부족'],
  [{location:'farm-1'},'location','약초 마을 또는 노바르에서 제작'],
 ] as const){
  const html=render(changes);assert.match(html,new RegExp('data-craft-state="'+expected+'"'));assert.ok(html.includes(label));
  assert.match(html,/<button[^>]*class="[^"]*tc-craft-main[^"]*"[^>]*disabled/);
 }
 assert.match(render({},true),/data-craft-state="working"/);
 assert.match(render(),/data-sufficient="true"/);assert.match(render({materials:{herb:9}}),/data-sufficient="false"/);
});
test('quantity and crafting controls remain together outside the scrolling workspace',()=>{
 const html=render(),footer=html.slice(html.indexOf('<footer class="tc-craft-footer"'));
 assert.match(footer,/aria-label="제작 횟수"/);assert.match(footer,/제작하기 10회/);
 assert.match(footer,/행동력 10 · 재료 100개 소비/);
 assert.doesNotMatch(html.slice(0,html.indexOf('<footer')),/aria-label="제작 횟수"/);
 assert.match(html,/data-craft-art="herb"/);assert.match(html,/보유 7개/);
});
