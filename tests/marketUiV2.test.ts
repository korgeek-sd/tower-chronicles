import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('MARKET UI V2 01: online market uses item-first three-tab navigation',()=>{
 const source=readFileSync(new URL('../src/components/market/ServerMarketScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/\['market','시장'\]/);
 assert.match(source,/\['orders','내 주문'\]/);
 assert.match(source,/\['storage','보관함'\]/);
 assert.doesNotMatch(source,/\['buy','구매'\]/);
 assert.doesNotMatch(source,/\['sell','판매'\]/);
 assert.match(source,/판매 최저|최저 판매/);
 assert.match(source,/구매 최고|최고 구매/);
 assert.match(source,/최근 체결/);
 assert.match(source,/매수 주문 등록/);
 assert.match(source,/매도 주문 등록/);
});

test('MARKET UI V2 02: local fallback mirrors the online information architecture',()=>{
 const source=readFileSync(new URL('../src/components/market/MarketScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/type Tab='market'\|'orders'\|'storage'/);
 assert.match(source,/판매 최저|최저 판매/);
 assert.match(source,/구매 최고|최고 구매/);
 assert.match(source,/최근 체결/);
 assert.match(source,/tc-market-v2-detail/);
 assert.match(source,/Pager page=\{safeMarketPage\}/);
});

test('MARKET UI V2 03: order and storage views expose progress and settlement summaries',()=>{
 const online=readFileSync(new URL('../src/components/market/ServerMarketScreen.tsx',import.meta.url),'utf8');
 assert.match(online,/originalQuantity-order\.remainingQuantity/);
 assert.match(online,/tc-market-v2-progress/);
 assert.match(online,/판매대금/);
 assert.match(online,/구매물품|수령 물품/);
 assert.match(online,/모두 수령/);
});

test('MARKET UI V2 04: mobile CSS keeps market and detail screens viewport-contained',()=>{
 const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');
 assert.match(css,/\.tc-market-v2,\s*\.tc-market-v2-detail\{\s*height:100%;\s*min-height:0;\s*overflow:hidden;/);
 assert.match(css,/\.tc-market-v2\.tab-market\{grid-template-rows:/);
 assert.match(css,/\.tc-market-v2-detail\{\s*display:grid;\s*grid-template-rows:/);
 assert.match(css,/@media\(max-height:700px\)[\s\S]*\.tc-market-v2-detail/);
 assert.match(css,/@media\(max-height:620px\)[\s\S]*\.tc-market-v2-detail/);
 assert.match(css,/@media\(max-width:360px\)[\s\S]*\.tc-market-v2-row/);
});

test('MARKET UI V2 05: market rebuild ships no external UI image assets',()=>{
 const online=readFileSync(new URL('../src/components/market/ServerMarketScreen.tsx',import.meta.url),'utf8');
 const local=readFileSync(new URL('../src/components/market/MarketScreen.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(online,/assets\/ui|<img|url\(/);
 assert.doesNotMatch(local,/assets\/ui|<img|url\(/);
});
