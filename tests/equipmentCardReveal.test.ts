import test from 'node:test';
import assert from 'node:assert/strict';
import {cardRows,cardSize,remainingCards,cardNameLines} from '../src/components/inventory/equipmentCardLayout';
test('one through ten rewards fit centered rows with consistent card size',()=>{
 const expected=[[1],[2],[3],[2,2],[3,2],[3,3],[3,3,1],[3,3,2],[3,3,3],[3,4,3]];
 for(let n=1;n<=10;n++){
  assert.deepEqual(cardRows(n),expected[n-1]);
  for(const [w,h] of [[280,330],[350,460],[460,580]]){
   const size=cardSize(n,w,h),rows=cardRows(n);
   assert.ok(size*Math.max(...rows)+8*(Math.max(...rows)-1)<=w+.01);
   assert.ok(size/0.7*rows.length+8*(rows.length-1)<=h+.01);
   assert.ok(size>=44);
  }
 }
});
test('reveal all preserves order and excludes already opened cards',()=>{
 assert.deepEqual(remainingCards(5,new Set([1,3])),[0,2,4]);
 assert.deepEqual(remainingCards(1,new Set([0])),[]);
});
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {EquipmentCardReveal} from '../src/components/inventory/EquipmentCardReveal';
import type {EquipmentItem} from '../src/game/types';
test('real component renders one button per receipt and hides names until reveal',()=>{
 for(let n=1;n<=10;n++){
  const rewards:EquipmentItem[]=Array.from({length:n},(_,i)=>({id:String(i),kind:'association_supply_iron_sword',grade:'legendary',enhancement:0}));
  const html=renderToStaticMarkup(React.createElement(EquipmentCardReveal,{rewards,onClose:()=>{}}));
  assert.equal((html.match(/class="tc-card-tile"/g)||[]).length,n);
  assert.equal((html.match(/aria-label="장비 카드 \d+ 공개"/g)||[]).length,n);
  assert.ok(!html.includes('is-revealed'));
  assert.ok(html.includes('모두 공개'));
 }
});

test('card backs use the approved bronze seal artwork for every reward',()=>{
 const rewards:EquipmentItem[]=[{id:'back',kind:'association_supply_iron_sword',grade:'legendary',enhancement:0}];
 const html=renderToStaticMarkup(React.createElement(EquipmentCardReveal,{rewards,onClose:()=>{}}));
 assert.match(html,/card-back-bronze-seal-v1.webp/);
});

import {readFileSync} from 'node:fs';
test('reveal uses light layers and starts the legendary spotlight before the flip',()=>{
 const src=readFileSync('src/components/inventory/EquipmentCardReveal.tsx','utf8');
 const css=readFileSync('src/components/inventory/equipment-card-reveal.css','utf8');
 assert.ok(!src.includes('CardLightning'));
 assert.ok(!src.includes('card-electric-'));
 assert.match(src,/tc-card-reveal-light/);
 const charge=src.slice(src.indexOf("if(phase==='charge')"),src.indexOf("else if(phase==='flip')"));
 assert.match(charge,/setSpotlight\(index\)/);
 assert.match(css,/tc-light-sweep/);
 assert.match(css,/tc-card-halo/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});

test('repeat-result buttons consume one or ten boxes and display current stock',()=>{
 const rewards:EquipmentItem[]=[{id:'repeat',kind:'association_supply_iron_sword',grade:'legendary',enhancement:0}];
 const html=renderToStaticMarkup(React.createElement(EquipmentCardReveal,{rewards,onClose:()=>{},onRepeat:()=>{},quantity:128,skipReveal:true}));
 assert.match(html,/한 번 더 뽑기/);assert.match(html,/10회 연속 뽑기/);
 assert.match(html,/128개/);assert.match(html,/is-revealed/);assert.match(html,/다음 카드 연출 건너뛰기/);
 const low=renderToStaticMarkup(React.createElement(EquipmentCardReveal,{rewards,onClose:()=>{},onRepeat:()=>{},quantity:1,skipReveal:true}));
 assert.match(low,/class="tc-card-repeat-ten" disabled=""/);
 assert.doesNotMatch(low,/class="tc-card-repeat-one" disabled=""/);
 const unopened=renderToStaticMarkup(React.createElement(EquipmentCardReveal,{rewards,onClose:()=>{},onRepeat:()=>{},quantity:128}));
 assert.match(unopened,/모두 공개/);assert.doesNotMatch(unopened,/10회 연속 뽑기/);
});

import {EQUIPMENT_DEFINITIONS} from '../src/game/data/equipment';
test('compact card labels preserve every Korean equipment name across two balanced lines',()=>{
 for(const entry of Object.values(EQUIPMENT_DEFINITIONS)){
  const lines=cardNameLines(entry.name);
  assert.equal(lines.join(' '),entry.name);
  assert.ok(lines.length<=2);
  assert.ok(lines.every(line=>Array.from(line).length<=7),entry.name);
 }
 assert.deepEqual(cardNameLines('외곽 경비대 장궁'),['외곽','경비대 장궁']);
 assert.deepEqual(cardNameLines('귀환자의 부적 목걸이'),['귀환자의','부적 목걸이']);
 assert.deepEqual(cardNameLines('검'),['검']);
});
