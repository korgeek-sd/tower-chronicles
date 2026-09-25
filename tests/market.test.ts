import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {cancelOrder,claimAllMarketStorage,claimMarketStorage,getMarketStorage,placeOrder} from '../src/game/market/marketService.ts';
import type {MarketOrder} from '../src/game/types.ts';
import {createRepository,MARKET_BACKUP_KEY,SAVE_KEY} from '../src/storage/repository.ts';
import {withHistoricalTickets} from './legacyFixture.ts';

const item='material:ore:1';
function state(){const s=initialState();s.market.traderCertified=true;s.silver=10_000;s.materials.ore[0]=100;return s;}
function resting(s:ReturnType<typeof state>,side:'BUY'|'SELL',ownerId:string,price:number,quantity:number,sequence:number):MarketOrder {const o:MarketOrder={orderId:'seed-'+sequence,itemId:item,side,limitPrice:price,originalQuantity:quantity,remainingQuantity:quantity,ownerId,createdAt:1_000,sequence,status:'OPEN'};s.market.orders.push(o);return o;}
function buy(s:ReturnType<typeof state>,price:number,quantity:number){return placeOrder(s,{itemId:item,side:'BUY',limitPrice:price,quantity,createdAt:2_000});}
function sell(s:ReturnType<typeof state>,price:number,quantity:number){return placeOrder(s,{itemId:item,side:'SELL',limitPrice:price,quantity,createdAt:2_000});}

test('TC-01/06/12 BUY 가격 우선과 다중 체결은 낮은 resting 매도부터 처리한다',()=>{const s=state();resting(s,'SELL','A',100,10,1);resting(s,'SELL','B',80,2,2);resting(s,'SELL','C',90,3,3);const n=buy(s,100,10);assert.deepEqual(n.market.trades.map(t=>[t.price,t.quantity]),[[80,2],[90,3],[100,5]]);});
test('TC-02 SELL 가격 우선은 높은 resting 매수부터 처리한다',()=>{const s=state();resting(s,'BUY','A',90,5,1);resting(s,'BUY','B',110,4,2);resting(s,'BUY','C',100,5,3);const n=sell(s,90,6);assert.deepEqual(n.market.trades.map(t=>[t.price,t.quantity]),[[110,4],[100,2]]);});
test('TC-03/14 동일 가격은 sequence가 시간 우선 순서를 결정한다',()=>{const s=state();resting(s,'SELL','A',100,3,9);resting(s,'SELL','B',100,4,10);const n=buy(s,100,5);assert.deepEqual(n.market.trades.map(t=>[t.sellerId,t.quantity]),[['A',3],['B',2]]);});
test('TC-04/05 부분 체결은 양쪽 상태와 잔량을 정확히 남긴다',()=>{let s=state();resting(s,'SELL','A',100,3,1);let n=buy(s,100,10);let mine=n.market.orders.at(-1)!;assert.equal(mine.remainingQuantity,7);assert.equal(mine.status,'PARTIAL');s=state();resting(s,'BUY','A',100,10,1);n=sell(s,100,4);assert.equal(n.market.orders[0].remainingQuantity,6);assert.equal(n.market.orders[0].status,'PARTIAL');assert.equal(n.market.orders.at(-1)!.status,'FILLED');});
test('TC-07/08 지정가 보호는 교차하지 않는 주문을 체결하지 않는다',()=>{let s=state();resting(s,'SELL','A',101,10,1);assert.equal(buy(s,100,5).market.trades.length,0);s=state();resting(s,'BUY','A',99,10,1);assert.equal(sell(s,100,5).market.trades.length,0);});
test('TC-09/10/11 자기 주문은 건너뛰고 뒤의 유효 주문을 체결한다',()=>{const s=state();resting(s,'SELL','local-player',90,5,1);resting(s,'SELL','A',95,3,2);resting(s,'SELL','B',100,10,3);const n=buy(s,100,5);assert.deepEqual(n.market.trades.map(t=>[t.sellerId,t.quantity]),[['A',3],['B',2]]);assert.equal(n.market.orders[0].remainingQuantity,5);});
test('TC-13 가격 개선과 부분 체결 취소는 예약 Silver를 정확히 반환한다',()=>{const s=state();resting(s,'SELL','A',90,4,1);let n=buy(s,100,10);assert.equal(n.silver,9_040);const order=n.market.orders.find(o=>o.ownerId==='local-player')!;n=cancelOrder(n,order.orderId);assert.equal(n.silver,9_640);assert.equal(order.status,'PARTIAL');assert.equal(n.market.orders.find(o=>o.orderId===order.orderId)!.status,'CANCELLED');});
test('v8 저장은 기존 재산을 보존하고 빈 거래소 데이터로 현재 v21까지 이전한다',()=>{const old:any=withHistoricalTickets(initialState());old.version=8;delete old.market;old.silver=321;const raw=JSON.stringify(old),mem=new Map<string,string>([[SAVE_KEY,raw]]),repo=createRepository({getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v)});const n=repo.load();assert.equal(n.version,22);assert.equal(n.silver,321);assert.deepEqual(n.market.orders,[]);assert.equal(mem.get(MARKET_BACKUP_KEY),raw);});


test('TRADE STORAGE 01 구매 체결품은 거래 보관함에 대기하고 수령할 때 영구 보관함으로 이동한다',()=>{
 const s=state();resting(s,'SELL','remote',90,4,1);
 const before=s.materials.ore[0],n=buy(s,100,4);
 assert.equal(n.materials.ore[0],before);
 const entry=getMarketStorage(n)[0];
 assert.equal(entry.side,'BUY');assert.equal(entry.quantity,4);assert.equal(entry.itemId,item);
 const claimed=claimMarketStorage(n,entry.storageId);
 assert.equal(claimed.materials.ore[0],before+4);assert.equal(getMarketStorage(claimed).length,0);
});

test('TRADE STORAGE 02 판매대금은 거래 보관함에 대기하고 수령할 때 Silver에 반영한다',()=>{
 const s=state();resting(s,'BUY','remote',110,3,1);
 const before=s.silver,n=sell(s,100,3);
 assert.equal(n.silver,before);
 const entry=getMarketStorage(n)[0];
 assert.equal(entry.side,'SELL');assert.equal(entry.silver,330);assert.equal(entry.quantity,3);
 const claimed=claimMarketStorage(n,entry.storageId);
 assert.equal(claimed.silver,before+330);assert.equal(getMarketStorage(claimed).length,0);
});

test('TRADE STORAGE 03 모두 수령은 아이템과 판매대금을 한 번에 정산한다',()=>{
 let s=state();resting(s,'SELL','remote-seller',90,2,1);s=buy(s,100,2);
 resting(s,'BUY','remote-buyer',120,3,2);s=sell(s,100,3);
 assert.equal(getMarketStorage(s).length,2);
 const beforeMaterial=s.materials.ore[0],beforeSilver=s.silver,n=claimAllMarketStorage(s);
 assert.equal(n.materials.ore[0],beforeMaterial+2);assert.equal(n.silver,beforeSilver+360);assert.equal(getMarketStorage(n).length,0);
});

test('TRADE STORAGE 04 기존 v22 거래소 저장은 storage 필드가 없어도 유효하다',()=>{
 const s:any=state();delete s.market.storage;delete s.market.nextStorageId;
 let raw=JSON.stringify(s);const repo=createRepository({getItem:k=>k===SAVE_KEY?raw:null,setItem:(_,v)=>{raw=v;}});
 const loaded=repo.load();assert.equal(loaded.version,22);assert.deepEqual(getMarketStorage(loaded),[]);
});
