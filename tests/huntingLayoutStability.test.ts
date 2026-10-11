import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {HuntingScreen} from '../src/components/hunting/HuntingScreen';
import {initialState} from '../src/game/engine/state';
import {HUNT_MAPS,initialHuntingState,resolveHunt} from '../src/game/hunting/model';
import {HUNT_MONSTERS} from '../src/game/hunting/encounters';

const css=readFileSync(new URL('../src/components/hunting/hunting.css',import.meta.url),'utf8');
function style(selector:string) {
 const escaped=selector.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&');
 const match=css.match(new RegExp(escaped+'\\s*\\{([^}]*)\\}'));
 assert.ok(match,'Expected rule for '+selector);
 return match[1];
}

test('result player and monster use one fixed card height instead of flexing with fight content',()=>{
 assert.match(css,/\.tc-hunt-result-page\s*\{\s*--tc-hunt-combat-card-height:\s*clamp\(/);
 const both=style('.tc-hunt-result-page > .tc-hunt-fighter,\n.tc-hunt-result-page > .tc-hunt-fighter.enemy');
 assert.match(both,/flex:\s*0 0 var\(--tc-hunt-combat-card-height\)/);
 assert.match(both,/height:\s*var\(--tc-hunt-combat-card-height\)/);
 assert.match(both,/min-height:\s*var\(--tc-hunt-combat-card-height\)/);
 assert.match(both,/max-height:\s*var\(--tc-hunt-combat-card-height\)/);
 assert.match(both,/grid-template-columns:\s*32% minmax\(0,1fr\)/);
});

test('all combat sprites fill identical frames without cropping or intrinsic image reflow',()=>{
 const art=style('.tc-hunt-result-page > .tc-hunt-fighter > .tc-hunt-art');
 const sprite=style('.tc-hunt-result-page > .tc-hunt-fighter > .tc-hunt-art > img');
 assert.match(art,/height:\s*100%/);
 assert.match(art,/overflow:\s*hidden/);
 assert.match(sprite,/position:\s*absolute/);
 assert.match(sprite,/width:\s*100%/);
 assert.match(sprite,/height:\s*100%/);
 assert.match(sprite,/object-fit:\s*contain/);
 assert.match(sprite,/object-position:\s*center/);
 const info=style('.tc-hunt-result-page > .tc-hunt-fighter > .tc-hunt-fighter-info');
 assert.match(info,/overflow:\s*hidden/);
});

test('result panel keeps both fighter card slots present across all five hunting regions',()=>{
 const game=initialState();
 const initial=initialHuntingState(0);
 for(const map of HUNT_MAPS){
  for(const roll of [0,.4,.999]){
   const result=resolveHunt(initial,map.id,{hp:10000,attack:10000,defense:1000},['heavy'],0,()=>roll);
   const html=renderToStaticMarkup(React.createElement(HuntingScreen,{game,hunting:result.state,now:0,busy:false,onHunt:()=>{},onSettings:()=>{},previewAppearance:false}));
   const resultPage=html.match(/<section class="tc-hunt-result-page"[^>]*>[\s\S]*?<\/section>/)?.[0]??'';
   assert.match(resultPage,/class="tc-hunt-fighter tc-hunt-panel player"/);
   assert.match(resultPage,/class="tc-hunt-fighter tc-hunt-panel enemy/);
   assert.equal((resultPage.match(/class="tc-hunt-art"/g)??[]).length,2,map.id);
   assert.match(resultPage,/object-fit:contain|tc-hunt-art/);
   assert.ok(result.result.monster?.id&&HUNT_MONSTERS[map.id].some(m=>m.id===result.result.monster?.id));
  }
 }
});
