import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {applyOnlineEconomyToGame,applyOnlineMarketSnapshotToGame,type OnlineMarketState} from '../src/online/market.ts';

const snapshot:OnlineMarketState={
 wallet:{silver:321,gold:77,revision:15},
 assets:[
  {itemId:'material:ore:1',quantity:9,gear:null},
  {itemId:'ticket:leather:3',quantity:4,gear:null},
  {itemId:'skillbook:heavy',quantity:2,gear:null},
 ],
 orders:[{
  orderId:'11111111-1111-1111-1111-111111111111',itemId:'material:ore:1',side:'SELL',limitPrice:40,
  originalQuantity:3,remainingQuantity:3,status:'OPEN',gear:null,createdAt:1000,mine:false,
 }],
 trades:[{
  tradeId:'22222222-2222-2222-2222-222222222222',itemId:'material:ore:1',price:35,quantity:1,
  buyOrderId:'33333333-3333-3333-3333-333333333333',sellOrderId:'44444444-4444-4444-4444-444444444444',
  executedAt:2000,buyerMine:false,sellerMine:false,
 }],
 storage:[],
};

test('ONLINE MARKET 01: server wallet and tradeable assets project onto the local economy shadow',()=>{
 const next=applyOnlineEconomyToGame(initialState(),snapshot);
 assert.equal(next.silver,321);
 assert.equal(next.market.gold,77);
 assert.equal(next.materials.ore[0],9);
 assert.equal(next.tickets.leather[2],4);
 assert.equal(next.skillBooks.heavy,2);
});

test('ONLINE MARKET 02: public order book is display-only and does not enter the player save shadow',()=>{
 const base=initialState();
 const next=applyOnlineEconomyToGame(base,snapshot);
 assert.deepEqual(next.market.orders,base.market.orders);
 assert.deepEqual(next.market.trades,base.market.trades);
});

test('ONLINE MARKET 03: display projection maps remote orders and trades without exposing another user id',()=>{
 const base=initialState();
 const view=applyOnlineMarketSnapshotToGame(base,snapshot);
 assert.equal(view.market.orders.length,1);
 assert.match(view.market.orders[0].ownerId,/^online:/);
 assert.equal(view.market.trades.length,1);
 assert.equal(view.market.trades[0].buyerId,'online-buyer');
 assert.equal(view.market.trades[0].sellerId,'online-seller');
});
