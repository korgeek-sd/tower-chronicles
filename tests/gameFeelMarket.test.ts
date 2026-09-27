import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {marketFeelForTransition} from '../src/gameFeel/marketAdapter.ts';

const snapshot=(over:Partial<{orders:any[];trades:any[]}>)=>({
 orders:over.orders??[],
 trades:over.trades??[],
});

test('GAME FEEL MARKET 01: a new mine partial fill is classified from authoritative snapshot status',()=>{
 const before=snapshot({});
 const after=snapshot({
  orders:[{orderId:'o1',status:'PARTIAL',mine:true}],
  trades:[{tradeId:'t1',buyOrderId:'o1',sellOrderId:'other',buyerMine:true,sellerMine:false}],
 });
 assert.deepEqual(marketFeelForTransition(before,after),['market.trade-partial']);
});

test('GAME FEEL MARKET 02: a completed mine fill is classified as filled',()=>{
 const before=snapshot({orders:[{orderId:'o1',status:'OPEN',mine:true}]});
 const after=snapshot({
  orders:[{orderId:'o1',status:'FILLED',mine:true}],
  trades:[{tradeId:'t1',buyOrderId:'o1',sellOrderId:'other',buyerMine:true,sellerMine:false}],
 });
 assert.deepEqual(marketFeelForTransition(before,after),['market.trade-filled']);
});

test('GAME FEEL MARKET 03: unrelated market trades do not produce personal feedback',()=>{
 const before=snapshot({});
 const after=snapshot({
  trades:[{tradeId:'t1',buyOrderId:'a',sellOrderId:'b',buyerMine:false,sellerMine:false}],
 });
 assert.deepEqual(marketFeelForTransition(before,after),[]);
});

test('GAME FEEL MARKET 04: repeated snapshot refresh does not replay the same trade',()=>{
 const state=snapshot({
  trades:[{tradeId:'t1',buyOrderId:'o1',sellOrderId:'x',buyerMine:true,sellerMine:false}],
 });
 assert.deepEqual(marketFeelForTransition(state,state),[]);
});

test('GAME FEEL MARKET 05: server market emits order, cancel, fill and error semantics while DEMO tick stays visual-only',()=>{
 const source=readFileSync(new URL('../src/components/market/ServerMarketScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/useGameFeel/);
 assert.match(source,/marketFeelForTransition/);
 assert.match(source,/market\.order-placed/);
 assert.match(source,/market\.order-cancelled/);
 assert.match(source,/ui\.error/);
 const demoEffect=source.match(/useEffect\(\(\)=>\{\n  if\(!demoMode\)[\s\S]*?\},\[demoMode\]\);/)?.[0]??'';
 assert.doesNotMatch(demoEffect,/feel\.play/);
});

test('GAME FEEL MARKET 06: local market feedback comes from the actual returned order state',()=>{
 const source=readFileSync(new URL('../src/components/market/MarketScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/useGameFeel/);
 assert.match(source,/const next=placeOrder\(game,/);
 assert.match(source,/order\.status==='PARTIAL'/);
 assert.match(source,/order\.status==='FILLED'/);
 assert.match(source,/market\.order-cancelled/);
});

test('GAME FEEL MARKET 07: Gold Exchange uses the same transition adapter and reports request errors',()=>{
 const source=readFileSync(new URL('../src/components/market/GoldExchangeScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/useGameFeel/);
 assert.match(source,/marketFeelForTransition/);
 assert.match(source,/market\.order-placed/);
 assert.match(source,/market\.order-cancelled/);
 assert.match(source,/ui\.error/);
});

test('GAME FEEL MARKET 08: market recipes stay restrained',()=>{
 const recipe=readFileSync(new URL('../src/gameFeel/recipes/market.ts',import.meta.url),'utf8');
 assert.doesNotMatch(recipe,/intensity:'strong'/);
 assert.doesNotMatch(recipe,/intensity:'exceptional'/);
});
