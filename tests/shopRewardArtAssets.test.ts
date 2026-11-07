import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ShopRewardArt} from '../src/components/association/ShopRewardArt';

for(const [itemId,filename] of [
 ['silver_box_daily','silver_supply_chest.webp'],
 ['gold_box_weekly','gold_supply_chest.webp'],
] as const){
 test(itemId+' uses the uploaded transparent supply chest image',()=>{
  const bytes=readFileSync(new URL('../public/assets/ui/shop/'+filename,import.meta.url));
  assert.equal(bytes.subarray(0,4).toString('ascii'),'RIFF');
  assert.equal(bytes.subarray(8,12).toString('ascii'),'WEBP');
  for(const large of [false,true]){
   const html=renderToStaticMarkup(React.createElement(ShopRewardArt,{itemId,large}));
   assert.ok(html.includes('assets/ui/shop/'+filename));
   assert.ok(html.includes('tc-shop-art-chest-image'));
   assert.ok(!html.includes('<svg'));
  }
 });
}
test('rare equipment chest keeps its existing SVG artwork',()=>{
 const html=renderToStaticMarkup(React.createElement(ShopRewardArt,{itemId:'rare_equipment_weekly'}));
 assert.match(html,/<svg/);
});
