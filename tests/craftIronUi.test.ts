import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CraftScreen} from '../src/components/world/CraftScreen';
import {WORLD_TOWNS} from '../src/components/world/worldMap';
import type {VillageLifeState} from '../src/online/villageLife';
const state:VillageLifeState={location:'city',vitality:100,materials:{herb:100},products:{potion:7},craftMastery:1000,lifeMasteries:{herb:1000,farm:1000,ticket:1000},craftCarry:{},towns:WORLD_TOWNS,serverNow:0,nextResetAt:1000};
const render=(changes:Partial<VillageLifeState>={},busy=false)=>renderToStaticMarkup(React.createElement(CraftScreen,{state:{...state,...changes},busy,count:10,recipe:'potion',onRecipe:()=>{},onCount:()=>{},onCraft:()=>{}}));
test('craft skin distinguishes resources, location and pending states without enabling blocked production',()=>{
 assert.match(render(),/tc-forge-craft/);assert.match(render(),/data-craft-state="ready"/);assert.match(render(),/제작 가능/);
 for(const [changes,expected,label] of [
  [{materials:{herb:9}},'materials','재료 부족'],
  [{vitality:9},'action-points','활력 부족'],
  [{location:'farm-1'},'location','약초 마을 또는 노바르에서 제작'],
 ] as const){
  const html=render(changes);assert.match(html,new RegExp('data-craft-state="'+expected+'"'));assert.ok(html.includes(label));
  assert.match(html,/<button[^>]*class="[^"]*tc-craft-main[^"]*"[^>]*disabled/);
 }
 assert.match(render({},true),/data-craft-state="working"/);
 assert.match(render(),/data-sufficient="true"/);assert.match(render({materials:{herb:9}}),/data-sufficient="false"/);
});
test('quantity and crafting controls stay together inside the new forge workspace',()=>{
 const html=render(),footer=html.slice(html.indexOf('<footer class="tc-craft-footer"'));
 assert.match(footer,/aria-label="제작 횟수"/);assert.match(footer,/제작하기 10회/);
 assert.match(footer,/활력 10 · 재료 100개 소비/);
 assert.ok(html.indexOf('tc-forge-workspace')<html.indexOf('<footer class="tc-craft-footer"'));
 assert.ok(html.indexOf('<footer class="tc-craft-footer"')<html.indexOf('tc-craft-queue'));
 assert.match(footer,/제작 시간/);
 assert.doesNotMatch(html.slice(0,html.indexOf('<footer')),/aria-label="제작 횟수"/);
 assert.match(html,/data-craft-art="herb"/);assert.match(html,/보유 7개/);
});

test('post-registration automatic mode clears the previous batch and shows a neutral one-craft supply target',()=>{
 const exhausted={...state,materials:{herb:0}};
 const html=renderToStaticMarkup(React.createElement(CraftScreen,{state:exhausted,busy:false,count:0,recipe:'potion',queue:[{id:'queued',item:'potion',count:10,quantity:10000,startsAt:0,endsAt:100000,durationSeconds:1800,status:'crafting'}],onRecipe:()=>{},onCount:()=>{},onCraft:()=>{},onFindMaterials:()=>{}}));
 assert.match(html,/data-craft-auto="true"/);
 assert.match(html,/>0회<\/output>/);
 assert.match(html,/필요 재료 \(1회 기준\)/);
 assert.match(html,/재료 수집하기/);
 assert.match(html,/제작 대기열 등록 완료/);
 assert.doesNotMatch(html,/재료 부족|부족 100|insufficient/);
 assert.match(html,/활력 0/);
 assert.match(html,/00:00/);
 assert.match(html,/tc-craft-material-amount"><span class="">0<\/span> <i>\/<\/i> 10/);
});
test('automatic quantity returns to one when enough resources are available; explicit requests remain editable',()=>{
 const html=renderToStaticMarkup(React.createElement(CraftScreen,{state,busy:false,count:0,recipe:'potion',onRecipe:()=>{},onCount:()=>{},onCraft:()=>{}}));
 assert.match(html,/>1회<\/output>/);
 assert.match(html,/제작하기 1회/);
 assert.match(render(),/>10회<\/output>/);
});
