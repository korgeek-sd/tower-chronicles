import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ShopRewardArt} from '../src/components/association/ShopRewardArt';

for(const [itemId,filename] of [
 ['silver_box_daily','silver_pixel_supply_chest.webp'],
 ['gold_box_weekly','gold_pixel_supply_chest.webp'],
 ['rare_equipment_weekly','rare_pixel_supply_chest.webp'],
] as const){
 test(itemId+' uses the selected transparent pixel chest image',()=>{
  const bytes=readFileSync(new URL('../public/assets/ui/shop/'+filename,import.meta.url));
  assert.equal(bytes.subarray(0,4).toString('ascii'),'RIFF');
  assert.equal(bytes.subarray(8,12).toString('ascii'),'WEBP');
  for(const large of [false,true]){
   const html=renderToStaticMarkup(React.createElement(ShopRewardArt,{itemId,large}));
   assert.ok(html.includes('assets/ui/shop/'+filename));
   assert.ok(html.includes('tc-shop-art-chest-image'));
   assert.ok(html.includes('tc-shop-art-pixel'));
   assert.ok(!html.includes('<svg'));
  }
 });
}
test('all three pixel chests retain their crisp rendering style',()=>{
 const css=readFileSync(new URL('../src/components/association/supply-showcase.css',import.meta.url),'utf8');
 assert.match(css,/\.tc-supply-v5 \.tc-shop-art-pixel img\s*\{image-rendering:pixelated!important;\}/);
});

for(const [itemId,filename,klass] of [
 ['job_draw_ticket_daily','appearance_summon_ticket_pixel.webp','tc-shop-art-ticket'],
 ['job_draw_ticket_weekly','appearance_summon_ticket_pixel.webp','tc-shop-art-ticket'],
 ['vitality_potion_daily','vitality_potion_pixel.webp','tc-shop-art-potion'],
] as const){
 test(itemId+' displays the selected dark pixel icon in the expedition shop',()=>{
  const asset=readFileSync(new URL('../public/assets/ui/shop/'+filename,import.meta.url));
  assert.equal(asset.subarray(0,4).toString('ascii'),'RIFF');
  assert.equal(asset.subarray(8,12).toString('ascii'),'WEBP');
  for(const large of [false,true]){
   const html=renderToStaticMarkup(React.createElement(ShopRewardArt,{itemId,large}));
   assert.ok(html.includes('assets/ui/shop/'+filename));
   assert.ok(html.includes(klass));
   assert.ok(html.includes('tc-shop-art-pixel'));
   assert.ok(!html.includes('<svg'));
  }
 });
}
