import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AssociationShopCatalog} from '../src/components/association/AssociationSupplyPanel';
import type {OnlineAssociationShopItem,OnlineAssociationShopState} from '../src/online/associationShop';

// Current server catalogue after retired products are disabled. No catalog is seeded by the client.
const make=(itemId:string,name:string,reset:'DAILY'|'WEEKLY',requiredLevel:number,contributionCost:number,purchaseLimit:number):OnlineAssociationShopItem=>({
 itemId,name,reset,description:'기존 서버 상품 설명',requiredLevel,contributionCost,purchaseLimit,purchased:0,
});
const shop:OnlineAssociationShopState={
 contribution:1500,level:2,dailyResetAt:'2026-11-08T00:00:00+09:00',weeklyResetAt:'2026-11-09T00:00:00+09:00',
 daily:[
  make('vitality_potion_daily','활력 회복 포션 ×1','DAILY',1,500,1),
  make('job_draw_ticket_daily','외형 소환권 ×5','DAILY',2,1000,1),
  make('silver_box_daily','실버 상자','DAILY',1,500,1),
 ],
 weekly:[
  make('gold_box_weekly','골드 보급 상자','WEEKLY',3,3000,1),
  make('job_draw_ticket_weekly','외형 소환권 ×30','WEEKLY',3,5000,1),
  make('rare_equipment_weekly','희귀 장비 상자','WEEKLY',5,5000,1),
 ],
};
const render=(filter:'ALL'|'DAILY'|'WEEKLY'|'CURRENCY',state=shop)=>renderToStaticMarkup(
 React.createElement(AssociationShopCatalog,{shop:state,filter,busy:false,expedition:false,onBuy:()=>{}}),
);
test('guild shop overview displays all six current server products in daily and weekly sections',()=>{
 const html=render('ALL');
 assert.equal((html.match(/data-shop-item-id=/g)||[]).length,6);
 for(const item of [...shop.daily,...shop.weekly])assert.ok(html.includes(item.name),item.name);
 assert.match(html,/일일 보급/);assert.match(html,/주간 보급/);
 assert.match(html,/매일 00:00/);assert.match(html,/월요일 00:00/);
 assert.doesNotMatch(html,/인장 조각|스킬 강화석|특성 초기화권|상급 포션|직능 뽑기권|강화석 ×/);
});
test('shop category filters only rearrange existing server offerings',()=>{
 for(const [filter,count] of [['DAILY',3],['WEEKLY',3],['CURRENCY',2]] as const){
  const html=render(filter);assert.equal((html.match(/data-shop-item-id=/g)||[]).length,count,filter);
 }
 assert.match(render('CURRENCY'),/실버 상자/);assert.match(render('CURRENCY'),/골드 보급 상자/);
 assert.doesNotMatch(render('CURRENCY'),/희귀 장비 상자/);
});
test('shop cards respect real unlocked levels, available contribution and purchase limits',()=>{
 const html=render('ALL');
 assert.match(html,/Lv\.3 해금/);assert.match(html,/Lv\.5 해금/);
 assert.match(html,/500/);assert.match(html,/1,000/);
 assert.equal((html.match(/aria-label="[^"]+ 구매"/g)||[]).length,6);
 const exhausted:OnlineAssociationShopState={...shop,daily:shop.daily.map(item=>item.itemId==='vitality_potion_daily'?{...item,purchased:item.purchaseLimit}:item)};
 assert.match(render('DAILY',exhausted),/구매 완료/);
});
test('compact two-column shop does not hide merchandise inside one-at-a-time record picker',()=>{
 const source=readFileSync(new URL('../src/components/association/AssociationSupplyPanel.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/components/association/supply.css',import.meta.url),'utf8');
 assert.match(css,/\.tc-supply-v3-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/s);
 assert.match(css,/\.tc-supply-v3-catalog\s*\{[^}]*overflow-y:\s*auto/s);
 assert.doesNotMatch(source,/<GuildRecord items=\{items\}/);
 assert.match(source,/buyOnlineAssociationShopItem\(lease,itemId,id\)/);
 assert.match(source,/onRecord\(next.record/);
});
