import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const screen=readFileSync(new URL('../src/components/mobile/CoreScreens.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');

test('GOLD SHOP UI 01: shop renders six-package catalog and purchase confirmation',()=>{
 assert.match(screen,/GOLD_SHOP_PACKAGES/);
 assert.match(screen,/getGoldPackageBySku/);
 assert.match(screen,/tc-shop-grid/);
 assert.match(screen,/tc-shop-confirm/);
 assert.match(screen,/결제 준비중/);
});

test('GOLD SHOP UI 02: paid shop never exposes gameplay item categories',()=>{
 const start=screen.indexOf('export function ShopScreen');
 const end=screen.indexOf('export function ExpeditionCompleteScreen');
 const shop=screen.slice(start,end);
 for(const forbidden of ['소모품','장비 상자','회복물약','외형 상품','Silver 상품'])assert.equal(shop.includes(forbidden),false,forbidden);
});

test('GOLD SHOP UI 03: mobile shop uses a viewport-contained two-column grid and press feedback',()=>{
 assert.match(css,/\.tc-shop-grid\{[^}]*grid-template-columns:repeat\(2,1fr\)/s);
 assert.match(css,/\.tc-shop-card[^}]*touch-action:manipulation/s);
 assert.match(css,/\.tc-shop-card:not\(:disabled\):active\{[^}]*transform:/s);
});

test('BOTTOM NAV SHOP: shop replaces the battle tab while the hunt route and purchase safeguards remain intact',()=>{
 const entry=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 const atlas=readFileSync(new URL('../src/components/mobile/HubIcon.tsx',import.meta.url),'utf8');
 const navSection=entry.slice(entry.indexOf('const nav:'),entry.indexOf('function App(){'));
 assert.ok(navSection.includes("['shop','상점']"));
 assert.ok(!navSection.includes("['hunt','전투']"));
 assert.match(entry,/<HubIcon name=\{p\}/);
 assert.match(entry,/\{page==='shop'&&<ShopScreen game=\{game\}\/>\}/);
 assert.match(entry,/\{page==='hunt'&&<HuntingPage/);
 assert.match(atlas,/shop:5/);
 assert.match(screen,/결제 준비중/);
});
