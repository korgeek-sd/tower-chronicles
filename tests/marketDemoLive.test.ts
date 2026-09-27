import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {demoMarketView} from '../src/components/market/demoLiveMarket';

test('MARKET DEMO 01: deterministic ticks generate moving four-level books',()=>{
 const a=demoMarketView('iron_ore',200,10);
 const same=demoMarketView('iron_ore',200,10);
 const next=demoMarketView('iron_ore',200,11);
 assert.deepEqual(a,same);
 assert.equal(a.asks.length,4);
 assert.equal(a.bids.length,4);
 assert.equal(a.series.length,24);
 assert.ok(a.asks.every((row,index)=>index===0||row.price>a.asks[index-1].price));
 assert.ok(a.bids.every((row,index)=>index===0||row.price<a.bids[index-1].price));
 assert.notDeepEqual(a,next);
});

test('MARKET DEMO 02: demo generator uses no random source or persistence',()=>{
 const source=readFileSync(new URL('../src/components/market/demoLiveMarket.ts',import.meta.url),'utf8');
 assert.doesNotMatch(source,/Math\.random|localStorage|supabase|insert|update|rpc/i);
 assert.match(source,/Math\.sin/);
 assert.match(source,/Math\.cos/);
});

test('MARKET DEMO 03: online market defaults to demo and ticks every 900ms',()=>{
 const source=readFileSync(new URL('../src/components/market/ServerMarketScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/useState\(true\)/);
 assert.match(source,/setInterval\(\(\)=>setDemoTick\(tick=>tick\+1\),900\)/);
 assert.match(source,/DEMO ON/);
 assert.match(source,/DEMO · 실제 주문 미반영/);
 assert.match(source,/DEMO 시연 중 · 실제 주문 비활성/);
});

test('MARKET DEMO 04: real order submission is gated off while demo is enabled',()=>{
 const source=readFileSync(new URL('../src/components/market/ServerMarketScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/const valid=.*?!demoMode/);
 assert.match(source,/placeOnlineMarketOrder\(lease/);
 assert.match(source,/onClick=\{\(\)=>setDemoMode\(value=>!value\)\}/);
});

test('MARKET DEMO 05: demo state is presentation-only and server economy code is unchanged',()=>{
 const source=readFileSync(new URL('../src/components/market/ServerMarketScreen.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/setGame\([^)]*demo/i);
 assert.doesNotMatch(source,/applySnapshot\([^)]*demo/i);
 assert.match(source,/selectedDemo\?\.asks/);
 assert.match(source,/selectedDemo\?\.bids/);
});
