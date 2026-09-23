import test from 'node:test';
import assert from 'node:assert/strict';
import type {Item,MarketOrder} from '../src/game/types.ts';
import {initialState} from '../src/game/engine/state.ts';
import {inventoryView} from '../src/game/inventoryView.ts';
import {cancelOrder,marketCatalog,marketItemName,placeOrder} from '../src/game/market/marketService.ts';
import {createRepository,validSave} from '../src/storage/repository.ts';

const enhanced=(id:string,kind:string,tier:number,enhancement:0|1|2|3):Item=>({id,kind,tier,enhancement});

test('ENHANCE COMPAT 01: inventory details show enhanced armor and accessory values',()=>{
  const s=initialState();
  s.items.push(enhanced('armor2','armor',1,2),enhanced('vamp3','vampire',1,3));
  const items=inventoryView(s);
  const armor=items.find(i=>i.sourceId==='armor2')!,vamp=items.find(i=>i.sourceId==='vamp3')!;
  assert.deepEqual(armor.facts,['최대HP +66','방어 +8.4']);
  assert.match(vamp.description,/11%/);
  assert.deepEqual(vamp.facts,['흡혈 11%','조건 직접 피해']);
});

test('ENHANCE COMPAT 02: selling enhanced gear keeps exact identity in escrow and catalog',()=>{
  const s=initialState(),gear=enhanced('market-gear','sword',2,2);
  s.items.push(gear);
  const n=placeOrder(s,{itemId:'gear:market-gear',side:'SELL',limitPrice:500,quantity:1,createdAt:1000});
  assert.equal(n.items.some(i=>i.id===gear.id),false);
  const order=n.market.orders.at(-1)!;
  assert.deepEqual(order.gear,gear);
  assert.equal(marketItemName(n,order.itemId),'2T 검 +2');
  const catalog=marketCatalog(n).find(i=>i.id===order.itemId)!;
  assert.equal(catalog.name,'2T 검 +2');
  assert.deepEqual(catalog.gear,gear);
});

test('ENHANCE COMPAT 03: cancelling enhanced gear sell order restores the exact item',()=>{
  const s=initialState(),gear=enhanced('cancel-gear','armor',3,1);
  s.items.push(gear);
  const listed=placeOrder(s,{itemId:'gear:cancel-gear',side:'SELL',limitPrice:700,quantity:1,createdAt:1000});
  const n=cancelOrder(listed,listed.market.orders.at(-1)!.orderId);
  assert.deepEqual(n.items.find(i=>i.id===gear.id),gear);
});

test('ENHANCE COMPAT 04: buying escrowed +3 gear transfers the exact enhancement state',()=>{
  const s=initialState();s.silver=1000;
  const gear=enhanced('remote-gear','dagger',1,3);
  const sell:MarketOrder={orderId:'remote-sell',itemId:'gear:remote-gear',side:'SELL',limitPrice:100,originalQuantity:1,remainingQuantity:1,ownerId:'remote',createdAt:500,sequence:1,status:'OPEN',gear};
  s.market.orders.push(sell);
  const n=placeOrder(s,{itemId:'gear:remote-gear',side:'BUY',limitPrice:100,quantity:1,createdAt:1000});
  assert.deepEqual(n.items.find(i=>i.id==='remote-gear'),gear);
  assert.equal(n.silver,900);
  assert.equal(n.market.trades.length,1);
});

test('ENHANCE COMPAT 05: enhanced gear escrow survives save/load with schema v22 unchanged',()=>{
  const s=initialState();s.items.push(enhanced('saved-gear','boots',1,2));
  const listed=placeOrder(s,{itemId:'gear:saved-gear',side:'SELL',limitPrice:300,quantity:1,createdAt:1000});
  assert.equal(listed.version,22);
  assert.equal(validSave(listed),true);
  let raw='';
  const repo=createRepository({getItem:()=>raw||null,setItem:(_,value)=>{raw=value;}});
  repo.save(listed);
  const loaded=repo.load();
  assert.equal(loaded.version,22);
  assert.deepEqual(loaded.market.orders.at(-1)!.gear,enhanced('saved-gear','boots',1,2));
});

test('ENHANCE COMPAT 06: corrupted enhancement in market escrow is rejected by current save validation',()=>{
  const s=initialState();s.items.push(enhanced('bad-gear','sword',1,2));
  const listed:any=placeOrder(s,{itemId:'gear:bad-gear',side:'SELL',limitPrice:300,quantity:1,createdAt:1000});
  listed.market.orders.at(-1).gear.enhancement=4;
  assert.equal(validSave(listed),false);
});

test('ENHANCE COMPAT 07: unique gear orders reject quantities above one atomically',()=>{
  const s=initialState();s.items.push(enhanced('single-gear','sword',1,1));s.silver=1000;
  const sell=placeOrder(s,{itemId:'gear:single-gear',side:'SELL',limitPrice:100,quantity:2,createdAt:1000});
  assert.equal(sell.market.orders.length,0);
  assert.equal(sell.items.some(i=>i.id==='single-gear'),true);
  const buy=placeOrder(s,{itemId:'gear:single-gear',side:'BUY',limitPrice:100,quantity:2,createdAt:1000});
  assert.equal(buy.market.orders.length,0);
  assert.equal(buy.silver,s.silver);
});
