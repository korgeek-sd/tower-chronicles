import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('MARKET UI V4 01: market entry is search-first with four compact filters',()=>{
 const online=readFileSync(new URL('../src/components/market/ServerMarketScreen.tsx',import.meta.url),'utf8');
 const local=readFileSync(new URL('../src/components/market/MarketScreen.tsx',import.meta.url),'utf8');
 for(const source of [online,local]){
  assert.match(source,/거래 품목 검색/);
  assert.match(source,/type Category='all'\|'equipment'\|'materials'\|'other'/);
  assert.match(source,/\['all','전체'\]/);
  assert.match(source,/\['equipment','장비'\]/);
  assert.match(source,/\['materials','재료'\]/);
  assert.match(source,/\['other','기타'\]/);
  assert.match(source,/tc-market-v4-card/);
 }
});

test('MARKET UI V4 02: item detail is separated from the real buy and sell ticket',()=>{
 const online=readFileSync(new URL('../src/components/market/ServerMarketScreen.tsx',import.meta.url),'utf8');
 const local=readFileSync(new URL('../src/components/market/MarketScreen.tsx',import.meta.url),'utf8');
 for(const source of [online,local]){
  assert.match(source,/tradeSide/);
  assert.match(source,/BUY · 매수/);
  assert.match(source,/SELL · 매도/);
  assert.match(source,/if\(item[^\n]*tradeSide/);
  assert.match(source,/tc-market-v4-trade/);
  assert.match(source,/tc-market-v2-book tc-market-v4-book/);
 }
 assert.match(online,/placeOnlineMarketOrder\(lease/);
 assert.match(local,/placeOrder\(state/);
});

test('MARKET UI V4 03: detail chart uses real trade time ranges and holding summary',()=>{
 const online=readFileSync(new URL('../src/components/market/ServerMarketScreen.tsx',import.meta.url),'utf8');
 const local=readFileSync(new URL('../src/components/market/MarketScreen.tsx',import.meta.url),'utf8');
 for(const source of [online,local]){
  assert.match(source,/\['1H','1H'\]/);
  assert.match(source,/\['24H','24H'\]/);
  assert.match(source,/\['1W','1W'\]/);
  assert.match(source,/\['1M','1M'\]/);
  assert.match(source,/\['ALL','ALL'\]/);
  assert.match(source,/rangeMs\(range\)/);
  assert.match(source,/tc-market-v4-holding/);
  assert.match(source,/평가액/);
  assert.match(source,/최저 판매/);
  assert.match(source,/최고 구매/);
 }
});

test('MARKET UI V4 04: storage uses portfolio-style settlement summary',()=>{
 const online=readFileSync(new URL('../src/components/market/ServerMarketScreen.tsx',import.meta.url),'utf8');
 const local=readFileSync(new URL('../src/components/market/MarketScreen.tsx',import.meta.url),'utf8');
 for(const source of [online,local]){
  assert.match(source,/tc-market-v4-portfolio/);
  assert.match(source,/거래 정산/);
  assert.match(source,/수령 대금/);
  assert.match(source,/수령 물품/);
  assert.match(source,/모두 수령/);
 }
});

test('MARKET UI V4 05: one-screen mobile constraints and rollback-safe no-image invariant remain',()=>{
 const online=readFileSync(new URL('../src/components/market/ServerMarketScreen.tsx',import.meta.url),'utf8');
 const local=readFileSync(new URL('../src/components/market/MarketScreen.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');
 assert.match(css,/MARKET V4 \/ direct mobile trading-reference adaptation/);
 assert.match(css,/\.tc-market-v4-detail\{[\s\S]*height:100%;[\s\S]*overflow:hidden/);
 assert.match(css,/@media\(max-height:700px\)[\s\S]*\.tc-market-v4-detail/);
 assert.match(css,/@media\(max-height:620px\)[\s\S]*\.tc-market-v4-detail/);
 assert.match(css,/@media\(max-width:360px\)[\s\S]*\.tc-market-v4-card/);
 assert.doesNotMatch(online,/assets\/ui|<img|url\(/);
 assert.doesNotMatch(local,/assets\/ui|<img|url\(/);
});
