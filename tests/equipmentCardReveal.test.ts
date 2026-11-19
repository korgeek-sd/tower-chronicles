import test from 'node:test';
import assert from 'node:assert/strict';
import {cardRows,cardSize,remainingCards} from '../src/components/inventory/equipmentCardLayout';
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
