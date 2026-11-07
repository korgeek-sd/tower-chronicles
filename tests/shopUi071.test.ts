import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const screen=readFileSync(new URL('../src/components/mobile/NovarShopScreen.tsx',import.meta.url),'utf8');
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
 const end=screen.length;
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

test('NOVAR SHOP 04: all four tabs and the three cash package plans are reachable',()=>{
 const start=screen.indexOf('export function ShopScreen');
 const end=screen.length;
 const shop=screen.slice(start,end);
 for(const key of ["'recommend'","'gold'","'package'","'attendance'"])assert.ok(screen.includes(key),key);
 for(const name of ['신규 모험가 패키지','주간 원정 지원','복귀 모험가 패키지','30일 출석 보상'])assert.ok(screen.includes(name),name);
 assert.match(shop,/setTab\('attendance'\)/);
 assert.match(shop,/setTab\('gold'\)/);
 assert.match(shop,/setSelectedSku\(item.sku\)/);
 assert.match(shop,/previewPackage\(p.id\)/);
 assert.match(shop,/type="button"[^>]*disabled>결제 준비중/);
});

test('NOVAR SHOP 05: attendance previews 30 dates without client-side reward credits',()=>{
 const start=screen.indexOf('export function ShopScreen');
 const end=screen.length;
 const shop=screen.slice(start,end);
 assert.match(shop,/Array.from\(\{length:30\}/);
 assert.match(shop,/외형 소환권 30장/);
 assert.match(shop,/외형 소환권 60장/);
 assert.match(shop,/90,000 S/);
 assert.match(shop,/600 G/);
 assert.match(shop,/4,900원/);
 assert.doesNotMatch(shop,/setGame\(/);
 assert.match(shop,/보상 지급 기능 준비 중/);
 const style=readFileSync(new URL('../src/components/mobile/novar-shop.css',import.meta.url),'utf8');
 assert.match(style,/\.tc-novar-shop\{/);
 assert.match(style,/\.tc-novar-shop-view\{/);
 assert.match(style,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
 assert.match(style,/@media\(max-height:700px\)/);
});
