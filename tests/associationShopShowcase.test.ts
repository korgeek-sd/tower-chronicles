import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AssociationShopShowcase} from '../src/components/association/AssociationShopShowcase';
import type {OnlineAssociationShopItem,OnlineAssociationShopState} from '../src/online/associationShop';

const offer=(itemId:string,reset:'DAILY'|'WEEKLY'):OnlineAssociationShopItem=>({
 itemId,name:itemId,description:'server-side product description',reset,
 contributionCost:500,purchaseLimit:3,purchased:1,requiredLevel:1
});
const shop:OnlineAssociationShopState={
 contribution:1800,level:5,
 dailyResetAt:'2026-11-08T00:00:00+09:00',weeklyResetAt:'2026-11-09T00:00:00+09:00',
 daily:['silver_box_daily','job_draw_ticket_daily','vitality_potion_daily'].map(id=>offer(id,'DAILY')),
 weekly:['gold_box_weekly','job_draw_ticket_weekly','rare_equipment_weekly'].map(id=>offer(id,'WEEKLY'))
};
const render=(filter:'ALL'|'DAILY'|'WEEKLY'|'CURRENCY'='ALL')=>
 renderToStaticMarkup(React.createElement(AssociationShopShowcase,{
  shop,filter,onFilter:()=>{},busy:false,expedition:false,onBuy:()=>{},onRefresh:()=>{}
 }));

test('mobile shop renders all six live offers as selectable cards with a single purchase CTA',()=>{
 const html=render();
 assert.equal((html.match(/data-shop-item-id=/g)||[]).length,6);
 assert.equal((html.match(/상품 선택/g)||[]).length,6);
 assert.equal((html.match(/구매하기/g)||[]).length,1);
 assert.match(html,/원정단 추천 보급/);
 assert.match(html,/구매 가격/);
 assert.doesNotMatch(html,/40%|30% 할인|10,000 Silver 지급|희귀 \+0/);
});

test('daily, weekly and currency tabs honor the existing live catalogue',()=>{
 assert.equal((render('DAILY').match(/data-shop-item-id=/g)||[]).length,3);
 assert.equal((render('WEEKLY').match(/data-shop-item-id=/g)||[]).length,3);
 assert.equal((render('CURRENCY').match(/data-shop-item-id=/g)||[]).length,2);
});

test('the shop CSS uses a three-column no-scroll catalogue and a fixed purchase area',()=>{
 const css=readFileSync(new URL('../src/components/association/supply-showcase.css',import.meta.url),'utf8');
 assert.match(css,/\.tc-supply-v5-tiles\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/s);
 assert.match(css,/\.tc-supply-v5-catalog\s*\{[^}]*overflow:hidden/s);
 assert.match(css,/\.tc-supply-v5-detail\s*\{[^}]*flex:0 0 146px/s);
 assert.match(css,/\.tc-supply-v5-purchase\s*\{[^}]*min-height:44px/s);
});


test('all shop reward images fit inside their own card, banner and detail areas',()=>{
 const css=readFileSync(new URL('../src/components/association/supply-showcase.css',import.meta.url),'utf8');
 const scoped=css.slice(css.indexOf('/* Card, feature banner and detail artwork bounds'));
 const rule=(selector:string)=>{
  const start=scoped.indexOf(selector+' {');
  assert.ok(start>=0,'missing clipping fix for '+selector);
  return scoped.slice(start,scoped.indexOf('}',start)+1);
 };
 assert.match(rule('.tc-supply-v5 .tc-supply-v5-art'),/position:relative/);
 assert.match(rule('.tc-supply-v5 .tc-supply-v5-art > .tc-shop-art'),/position:absolute/);
 assert.match(rule('.tc-supply-v5 .tc-supply-v5-art > .tc-shop-art'),/inset:/);
 assert.match(rule('.tc-supply-v5 .tc-supply-v5-art > .tc-shop-art img'),/object-fit:contain/);
 assert.match(rule('.tc-supply-v5 .tc-supply-v5-feature-art > .tc-shop-art img'),/object-fit:contain/);
 assert.match(rule('.tc-supply-v5 .tc-supply-v5-detail-art > .tc-shop-art img'),/object-fit:contain/);
 assert.match(css,/\.tc-supply-v5-catalog\s*\{[^}]*overflow:hidden/s);
 assert.match(css,/\.tc-supply-v5-tiles\s*\{[^}]*grid-template-rows:repeat\(2,minmax\(0,1fr\)\)/s);
});

test('shop screen hides duplicate guild navigation and uses a real back/dock route',()=>{
 const css=readFileSync(new URL('../src/components/association/supply-showcase.css',import.meta.url),'utf8');
 assert.match(css,/\.tc-assoc-shop-immersive>\.tc-gate-identity/);
 assert.match(css,/\.tc-app:has\(\.tc-assoc-shop-immersive\)>\.tc-nav/);
 const html=renderToStaticMarkup(React.createElement(AssociationShopShowcase,{
  shop,filter:'ALL' as const,onFilter:()=>{},busy:false,expedition:false,onBuy:()=>{},onRefresh:()=>{},
  onNavigate:()=>{}
 }));
 assert.match(html,/원정단 본부로 돌아가기/);
 assert.match(html,/원정단 시설 바로가기/);
});
