import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AssociationShopCatalog} from '../src/components/association/AssociationSupplyPanel';
import type {OnlineAssociationShopState, OnlineAssociationShopItem} from '../src/online/associationShop';

const source=readFileSync(new URL('../src/components/association/supply.css',import.meta.url),'utf8');
const block=(selector:string)=>{
 const start=source.indexOf(selector+' {');
 assert.ok(start>=0,'missing CSS rule: '+selector);
 const end=source.indexOf('}',start);
 assert.ok(end>start);
 return source.slice(start,end);
};
const product=(id:string,reset:'DAILY'|'WEEKLY'):OnlineAssociationShopItem=>({
 itemId:id,name:id,description:'기존 서버 상품',reset,contributionCost:500,
 purchaseLimit:1,purchased:0,requiredLevel:1,
});
const state:OnlineAssociationShopState={
 contribution:1400,level:2,
 dailyResetAt:'2026-11-08T00:00:00+09:00',weeklyResetAt:'2026-11-09T00:00:00+09:00',
 daily:['job_draw_ticket_daily','silver_box_daily','vitality_potion_daily'].map(id=>product(id,'DAILY')),
 weekly:['gold_box_weekly','job_draw_ticket_weekly','rare_equipment_weekly'].map(id=>product(id,'WEEKLY')),
};

test('all six existing daily and weekly products remain visible in the one-screen shop',()=>{
 const html=renderToStaticMarkup(React.createElement(AssociationShopCatalog,{
  shop:state,filter:'ALL',busy:false,expedition:false,onBuy:()=>{},
 }));
 assert.equal((html.match(/data-shop-item-id=/g)||[]).length,6);
 assert.match(html,/일일 보급/);assert.match(html,/주간 보급/);
 assert.equal((html.match(/aria-label="[^"]+ 구매"/g)||[]).length,6);
});

test('the normal-height guild shop allocates available height without nested vertical scrolling',()=>{
 const host=block('.tc-guild-workspace .tc-supply-shop.tc-supply-shop-v3');
 const catalog=block('.tc-supply-shop-v3 .tc-supply-v3-catalog');
 const section=block('.tc-supply-shop-v3 .tc-supply-v3-section');
 const grid=block('.tc-supply-shop-v3 .tc-supply-v3-grid');
 const card=block('.tc-supply-shop-v3 .tc-supply-v3-item');
 const button=block('.tc-supply-shop-v3 .tc-supply-v3-buy');
 assert.match(host,/overflow:\s*hidden/);
 assert.match(catalog,/overflow:\s*hidden/);
 assert.doesNotMatch(catalog,/overflow-y:\s*auto/);
 assert.match(section,/flex:\s*1\s+1\s+0/);
 assert.match(section,/min-height:\s*0/);
 assert.match(grid,/flex:\s*1/);
 assert.match(grid,/grid-auto-rows:\s*minmax\(0,\s*1fr\)/);
 assert.match(card,/min-height:\s*5[0-9]px/);
 assert.match(button,/min-height:\s*44px/);
});

test('tiny-height fallback remains usable rather than cutting off purchasing buttons',()=>{
 assert.match(source,/@media\s*\(max-height:\s*5[0-9]{2}px\)/);
 assert.match(source,/\.tc-supply-shop-v3 \.tc-supply-v3-catalog\s*\{overflow-y:\s*auto/);
});
