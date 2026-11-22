import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {HuntingScreen} from '../src/components/hunting/HuntingScreen';
import {initialState} from '../src/game/engine/state';
import {initialHuntingState,resolveHunt,HUNT_MAPS} from '../src/game/hunting/model';
import {HUNT_MONSTERS} from '../src/game/hunting/encounters';
import {HUNT_EQUIPMENT_RATES} from '../src/game/hunting/equipmentDrops';
import {readFileSync} from 'node:fs';

test('expanded hunting region uses actual monster pool, rates and persisted last hunting map',()=>{
 for(const map of HUNT_MAPS){
  const hunting=resolveHunt(initialHuntingState(0),map.id,{hp:600,attack:40,defense:25},[],0,()=>.5).state;
  const before=JSON.stringify(hunting);
  const html=renderToStaticMarkup(React.createElement(HuntingScreen,{game:initialState(),hunting,now:0,busy:false,onHunt:()=>{},onSettings:()=>{}}));
  assert.match(html,/몬스터·드롭 정보/);
  assert.match(html,/aria-label="사냥터 상세 정보"/);
  assert.match(html,new RegExp('aria-label="'+map.name+' 사냥터 접기"'));
  assert.equal((html.match(/class="tc-hunt-accordion-panel"/g)??[]).length,1);
  assert.match(html,new RegExp(map.exp.toLocaleString()));
  assert.match(html,new RegExp('승리 시 '+(HUNT_EQUIPMENT_RATES[map.id].reduce((sum,n)=>sum+n,0)/10000).toFixed(2).replace('.','\\.')+'%'));
  for(const monster of HUNT_MONSTERS[map.id])assert.ok(html.includes(monster.name),monster.name);
  for(const rate of HUNT_EQUIPMENT_RATES[map.id])assert.ok(html.includes(`${rate/10000}%`));
  assert.equal(JSON.stringify(hunting),before);
 }
});

test('instant hunt is disabled for empty vitality, server loading, busy request and expedition',()=>{
 for(const [hunting,busy,label] of [[initialHuntingState(0),false,'입장 가능'],[{...initialHuntingState(0),vitality:0},false,'활력 부족'],[null,false,'불러오는 중'],[initialHuntingState(0),true,'사냥 중…']] as const){
  const html=renderToStaticMarkup(React.createElement(HuntingScreen,{game:initialState(),hunting,now:0,busy,onHunt:()=>{},onSettings:()=>{}}));
  assert.ok(html.includes(label),label);
  assert.equal((html.match(/class="tc-hunt-accordion-card/g)??[]).length,5);
  const enter=html.match(/<button[^>]*class="tc-hunt-accordion-enter[^"]*"[^>]*>/)?.[0]??'';
  assert.ok(enter,'expanded region has a battle action');
  assert.equal(enter.includes('disabled=""'),busy||!hunting||hunting.vitality===0);
 }
 const blocked=renderToStaticMarkup(React.createElement(HuntingScreen,{game:{...initialState(),expedition:{} as any},hunting:initialHuntingState(0),now:0,busy:false,onHunt:()=>{},onSettings:()=>{}}));
 assert.match(blocked,/<button[^>]*class="tc-hunt-accordion-enter[^"]*"[^>]*disabled=""/);
});

test('accordion has a single open region, with the old result screen preserved',()=>{
 const css=readFileSync('src/components/hunting/hunting-accordion.css','utf8');
 const page=readFileSync('src/components/hunting/HuntingPage.tsx','utf8');
 const source=readFileSync('src/components/hunting/HuntingScreen.tsx','utf8');
 assert.match(page,/import '\.\/hunting-accordion\.css'/);
 assert.match(css,/\.tc-hunt-accordion-card\.is-open/);
 assert.match(css,/overflow-y:auto/);
 assert.match(css,/tc-hunt-accordion-enter/);
 assert.match(source,/setExpanded\(current=>current===m\.id\?null:m\.id\)/);
 assert.match(source,/setView\('result'\)/);
 assert.match(source,/startHunt\(m\.id\)/);
});

test('region art uses distinct world-map slices, a representative catalog monster, and a dialog for full loot data',()=>{
 const hunting=initialHuntingState(0);
 const html=renderToStaticMarkup(React.createElement(HuntingScreen,{game:initialState(),hunting,now:0,busy:false,onHunt:()=>{},onSettings:()=>{}}));
 assert.ok((html.match(/world-map\.webp/g)??[]).length>=5);
 assert.match(html,/grave_digger_hound\.svg/);
 assert.equal((html.match(/aria-expanded="/g)??[]).length,5);
 assert.equal((html.match(/aria-expanded="true"/g)??[]).length,1);
 assert.match(html,/10종/);
 assert.match(html,/권장 레벨/);
});
