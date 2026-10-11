import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {HuntingScreen} from '../src/components/hunting/HuntingScreen';
import {initialState} from '../src/game/engine/state';
import {initialHuntingState,resolveHunt} from '../src/game/hunting/model';
import {HUNT_MONSTERS} from '../src/game/hunting/encounters';

function screen(hunting=resolveHunt(initialHuntingState(0),'plains',{hp:500,attack:300,defense:30},['heavy'],0,()=>0).state) {
 return renderToStaticMarkup(React.createElement(HuntingScreen,{game:initialState(),hunting,now:0,busy:false,onHunt:()=>{},onSettings:()=>{},previewAppearance:false}));
}
const css=readFileSync(new URL('../src/components/hunting/hunting.css',import.meta.url),'utf8');

test('player and enemy MP gauges appear directly under their respective HP bars',()=>{
 const html=screen();
 const combat=html.split('<section class="tc-hunt-result-page"')[1]??'';
 const player= combat.match(/<article class="tc-hunt-fighter tc-hunt-panel player"[\s\S]*?<\/article>/)?.[0]??'';
 const enemy= combat.match(/<article[^>]*data-monster-id="[^"]+"[\s\S]*?<\/article>/)?.[0]??'';
 for(const [section,label] of [[player,'탐사자'],[enemy,HUNT_MONSTERS.plains[0].name]]){
  assert.ok(section.includes('aria-label="'+label+' HP"'),label+' health');
  assert.ok(section.includes('aria-label="'+label+' MP"'),label+' mana');
  assert.ok(section.indexOf('aria-label="'+label+' MP"')>section.indexOf('aria-label="'+label+' HP"'),label+' MP after HP');
  if(label==='탐사자'){
   assert.match(section,/MP<\/span><b>100 \/ 100<\/b>/);
   assert.doesNotMatch(section,/aria-valuetext="마나 시스템 미적용"/);
  }else{
   assert.match(section,/MP<\/span><b>미사용<\/b>/);
   assert.match(section,/aria-valuetext="마나 시스템 미적용"/);
  }
 }
});
test('available mana values are shown truthfully, clamped and remain present after a fight',()=>{
 const base=resolveHunt(initialHuntingState(0),'plains',{hp:500,attack:300,defense:30},['heavy'],0,()=>0).state;
 const last=base.lastResult!;
 const hunting={...base,currentMp:23,maxMp:80,lastResult:{...last,monsterMp:7,monsterMaxMp:30}};
 const html=screen(hunting);
 assert.match(html,/aria-label="탐사자 MP"[^>]*aria-valuemax="80"[^>]*aria-valuenow="23"/);
 assert.match(html,/MP<\/span><b>23 \/ 80<\/b>/);
 assert.match(html,/aria-label="무덤파는 들개 MP"[^>]*aria-valuemax="30"[^>]*aria-valuenow="7"/);
 assert.match(html,/MP<\/span><b>7 \/ 30<\/b>/);
});
test('MP track has its own blue theme and keeps fixed-size combatant cards intact',()=>{
 assert.match(css,/\.tc-hunt-mp[^{}]*\{[^}]*\}/);
 assert.match(css,/\.tc-hunt-mp i\s*\{[^}]*background:[^}]*#/);
 assert.match(css,/\.tc-hunt-result-page > \.tc-hunt-fighter,[\s\S]*?height:var\(--tc-hunt-combat-card-height\)/);
});
