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

test('selected region details use the actual encounter pool and absolute equipment rates',()=>{
 for(const map of HUNT_MAPS){
  const hunting=resolveHunt(initialHuntingState(0),map.id,{hp:600,attack:40,defense:25},[],0,()=>.5).state;
  const before=JSON.stringify(hunting);
  const html=renderToStaticMarkup(React.createElement(HuntingScreen,{game:initialState(),hunting,now:0,busy:false,onHunt:()=>{},onSettings:()=>{}}));
  assert.match(html,/몬스터·드롭 정보/);
  assert.match(html,/aria-label="사냥터 상세 정보"/);
  for(const monster of HUNT_MONSTERS[map.id])assert.ok(html.includes(monster.name),monster.name);
  for(const rate of HUNT_EQUIPMENT_RATES[map.id])assert.ok(html.includes(`${rate/10000}%`));
  assert.equal(JSON.stringify(hunting),before);
 }
});
test('region entry availability follows vitality and pending state, independently of recommended level',()=>{
 for(const [hunting,busy,label] of [[initialHuntingState(0),false,'입장 가능'],[{...initialHuntingState(0),vitality:0},false,'활력 부족'],[null,false,'불러오는 중'],[initialHuntingState(0),true,'사냥 중…']] as const){
  const html=renderToStaticMarkup(React.createElement(HuntingScreen,{game:initialState(),hunting,now:0,busy,onHunt:()=>{},onSettings:()=>{}}));
  assert.ok(html.includes(label),label);
  assert.equal((html.match(/class="tc-hunt-card /g)??[]).length,5);
  const enter=html.match(/<button class="tc-hunt-enter[^>]*>/)?.[0]??'';
  assert.equal(enter.includes('disabled=""'),busy||!hunting||hunting.vitality===0);
 }
});
test('region footer reserves the closed chat footprint below the entry action',()=>{
 const css=readFileSync('src/components/hunting/iron-regions.css','utf8');
 assert.match(css,/\.tc-hunt\[data-view="regions"\] \.tc-hunt-hint\{[^}]*min-height:44px;[^}]*padding-right:68px/);
});
test('scenic region cards keep their map backgrounds visible inside both frame states',()=>{
 const css=readFileSync('src/components/hunting/iron-regions.css','utf8');
 const card=css.match(/\.tc-hunt\[data-view="regions"\] \.tc-hunt-card\{([^}]*)\}/)?.[1]??'';
 assert.match(card,/border-image:var\(--region-button\) 24 stretch/);
 assert.doesNotMatch(card,/\bfill\b/,'frame centers must not paint over the scenic background');
 const html=renderToStaticMarkup(React.createElement(HuntingScreen,{game:initialState(),hunting:initialHuntingState(0),now:0,busy:false,onHunt:()=>{},onSettings:()=>{}}));
 assert.equal((html.match(/world-map\.webp/g)??[]).length,5);
 assert.match(css,/\.tc-hunt\[data-view="regions"\] \.tc-hunt-card\.selected\{border-image-source:var\(--region-active\)/);
});
