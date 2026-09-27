import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('MARKET UI V3 01: market list uses real trade sparklines and price-first cards',()=>{
 const online=readFileSync(new URL('../src/components/market/ServerMarketScreen.tsx',import.meta.url),'utf8');
 const local=readFileSync(new URL('../src/components/market/MarketScreen.tsx',import.meta.url),'utf8');
 for(const source of [online,local]){
  assert.match(source,/sparkPoints/);
  assert.match(source,/tc-market-v3-spark/);
  assert.match(source,/<polyline/);
  assert.match(source,/tc-market-v3-rowprice/);
  assert.match(source,/최근 체결가/);
 }
});

test('MARKET UI V3 02: detail order ticket exposes percentage presets without client-side trade resolution',()=>{
 const online=readFileSync(new URL('../src/components/market/ServerMarketScreen.tsx',import.meta.url),'utf8');
 const local=readFileSync(new URL('../src/components/market/MarketScreen.tsx',import.meta.url),'utf8');
 for(const source of [online,local]){
  assert.match(source,/\[10,25,50,75,100\]/);
  assert.match(source,/tc-market-v3-presets/);
  assert.match(source,/percent===100\?'MAX'/);
  assert.match(source,/tc-market-v3-ticket|tc-market-v4-orderform/);
 }
 assert.match(online,/placeOnlineMarketOrder\(lease/);
 assert.match(local,/placeOrder\(state/);
 assert.doesNotMatch(online,/Math\.random\(/);
});

test('MARKET UI V3 03: Figma-inspired hierarchy remains Tower Chronicles-native',()=>{
 const online=readFileSync(new URL('../src/components/market/ServerMarketScreen.tsx',import.meta.url),'utf8');
 const local=readFileSync(new URL('../src/components/market/MarketScreen.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');
 assert.doesNotMatch(online,/figma\.com|<img|assets\/ui|url\(/);
 assert.doesNotMatch(local,/figma\.com|<img|assets\/ui|url\(/);
 assert.match(css,/MARKET V3 \/ Figma trading-reference refinement/);
 assert.match(css,/\.tc-market-v3-card\{/);
 assert.match(css,/\.tc-market-v3-detailhead\{/);
 assert.match(css,/\.tc-market-v3-chart\{/);
});

test('MARKET UI V3 04: one-screen compact breakpoints cover short phones',()=>{
 const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');
 assert.match(css,/@media\(max-height:700px\)[\s\S]*\.tc-market-v3-detail/);
 assert.match(css,/@media\(max-height:620px\)[\s\S]*\.tc-market-v3-detail/);
 assert.match(css,/@media\(max-width:360px\)[\s\S]*\.tc-market-v3-card/);
 assert.match(css,/\.tc-market-v2,\s*\.tc-market-v2-detail\{\s*height:100%;\s*min-height:0;\s*overflow:hidden;/);
});
