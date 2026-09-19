import type {GameState,Item,MarketOrder,MarketSide,MarketTrade,Tower} from '../types';
import type {InventoryCategory} from '../inventoryView';
import {TOWERS,towerIds,MATERIAL_BASE_PRICE} from '../data/config';
import {itemName} from '../engine/state';
import {bookName} from '../engine/loot';

export interface MarketItem {id:string;name:string;available:number;gear?:Item;category:Exclude<InventoryCategory,'all'|'potions'|'cosmetics'>;description:string}
export interface OrderInput {itemId:string;side:MarketSide;limitPrice:number;quantity:number;ownerId?:string;createdAt?:number}
const active=(o:MarketOrder)=>o.status==='OPEN'||o.status==='PARTIAL';
const validPositive=(n:number)=>Number.isSafeInteger(n)&&n>0;
const status=(remaining:number,original:number):MarketOrder['status']=>remaining===0?'FILLED':remaining===original?'OPEN':'PARTIAL';
const local=(s:GameState,id:string)=>s.market.ownerId===id;

function parseStack(itemId:string):{kind:string;tower?:Tower;index?:number;id?:string}|null {
 const [kind,a,b]=itemId.split(':');
 if(kind==='material'||kind==='ticket'){const index=Number(b)-1;return towerIds.includes(a as Tower)&&Number.isInteger(index)&&index>=0?{kind,tower:a as Tower,index}:null;}
 if((kind==='skillbook'||kind==='other')&&a)return {kind,id:a};
 return null;
}
export function marketItems(s:GameState):MarketItem[]{
 const result:MarketItem[]=[];
 s.items.forEach(gear=>result.push({id:'gear:'+gear.id,name:itemName(gear),available:Object.values(s.equipped).includes(gear.id)||s.expedition?0:1,gear,category:'equipment',description:'노바르 제작 장비입니다.'}));
 towerIds.forEach(t=>s.materials[t].forEach((q,i)=>result.push({id:`material:${t}:${i+1}`,name:`T${i+1} ${TOWERS[t].material}`,available:q,category:'materials',description:`안전 귀환으로 확보한 제작 재료입니다. 기준가 ${MATERIAL_BASE_PRICE[t][i]??0} Silver`})));
 towerIds.forEach(t=>s.tickets[t].forEach((q,i)=>result.push({id:`ticket:${t}:${i+1}`,name:`${TOWERS[t].name} ${i+1}층 입장권`,available:q,category:'tickets',description:'해당 층 입장에 사용하는 입장권입니다.'})));
 Object.entries(s.skillBooks).forEach(([id,q])=>result.push({id:'skillbook:'+id,name:bookName(id),available:q,category:'skillbooks',description:'아직 사용하지 않은 스킬북입니다.'}));
 Object.entries(s.lootItems).forEach(([id,q])=>result.push({id:'other:'+id,name:id,available:q,category:'other',description:'원정에서 보관한 거래 가능 아이템입니다.'}));
 return result;
}
export function marketItemName(s:GameState,itemId:string){return marketItems(s).find(i=>i.id===itemId)?.name||itemId;}
export function marketCatalog(s:GameState){const own=marketItems(s),known=new Map(own.map(item=>[item.id,item]));s.market.orders.forEach(order=>{if(!known.has(order.itemId))known.set(order.itemId,{id:order.itemId,name:marketItemName(s,order.itemId),available:0,category:order.itemId.startsWith('ticket:')?'tickets':order.itemId.startsWith('skillbook:')?'skillbooks':order.itemId.startsWith('gear:')?'equipment':order.itemId.startsWith('material:')?'materials':'other',description:'거래소에 등록된 아이템입니다.'});});return [...known.values()];}
function available(s:GameState,itemId:string){return marketItems(s).find(i=>i.id===itemId)?.available||0;}
function removeItem(s:GameState,itemId:string,quantity:number):Item|undefined {
 if(itemId.startsWith('gear:')){const id=itemId.slice(5),index=s.items.findIndex(i=>i.id===id);if(quantity!==1||index<0||Object.values(s.equipped).includes(id)||s.expedition)throw Error('판매할 수 없는 장비입니다.');return s.items.splice(index,1)[0];}
 const p=parseStack(itemId);if(!p||available(s,itemId)<quantity)throw Error('판매할 아이템 수량이 부족합니다.');
 if(p.kind==='material')s.materials[p.tower!][p.index!] -= quantity;
 if(p.kind==='ticket')s.tickets[p.tower!][p.index!] -= quantity;
 if(p.kind==='skillbook')s.skillBooks[p.id!] -= quantity;
 if(p.kind==='other')s.lootItems[p.id!] -= quantity;
 return undefined;
}
function addItem(s:GameState,itemId:string,quantity:number,gear?:Item){
 if(itemId.startsWith('gear:')){if(gear)s.items.push(structuredClone(gear));return;}
 const p=parseStack(itemId);if(!p)throw Error('알 수 없는 거래 아이템입니다.');
 if(p.kind==='material')s.materials[p.tower!][p.index!] += quantity;
 if(p.kind==='ticket')s.tickets[p.tower!][p.index!] += quantity;
 if(p.kind==='skillbook')s.skillBooks[p.id!]=(s.skillBooks[p.id!]||0)+quantity;
 if(p.kind==='other')s.lootItems[p.id!]=(s.lootItems[p.id!]||0)+quantity;
}
const sellSort=(a:MarketOrder,b:MarketOrder)=>a.limitPrice-b.limitPrice||a.createdAt-b.createdAt||a.sequence-b.sequence;
const buySort=(a:MarketOrder,b:MarketOrder)=>b.limitPrice-a.limitPrice||a.createdAt-b.createdAt||a.sequence-b.sequence;
export function orderBook(s:GameState,itemId:string){const orders=s.market.orders.filter(o=>o.itemId===itemId&&active(o));return {sells:orders.filter(o=>o.side==='SELL').sort(sellSort),buys:orders.filter(o=>o.side==='BUY').sort(buySort)};}
export const getBestBid=(s:GameState,itemId:string)=>orderBook(s,itemId).buys[0]?.limitPrice??null;
export const getBestAsk=(s:GameState,itemId:string)=>orderBook(s,itemId).sells[0]?.limitPrice??null;
export const getLastTrade=(s:GameState,itemId:string)=>s.market.trades.filter(t=>t.itemId===itemId).at(-1)??null;
export const getRecentTrades=(s:GameState,itemId:string,limit=8)=>s.market.trades.filter(t=>t.itemId===itemId).slice(-limit).reverse();
export const getMyOpenOrders=(s:GameState)=>s.market.orders.filter(o=>o.ownerId===s.market.ownerId&&active(o));
export function aggregateOrderBookByPrice(orders:MarketOrder[]){const totals=new Map<number,number>();orders.forEach(o=>totals.set(o.limitPrice,(totals.get(o.limitPrice)||0)+o.remainingQuantity));return [...totals].map(([price,quantity])=>({price,quantity}));}
function settle(s:GameState,buy:MarketOrder,sell:MarketOrder,quantity:number,price:number,now:number){
 const m=s.market,trade:MarketTrade={tradeId:'trade-'+m.nextTradeId++,itemId:buy.itemId,price,quantity,buyOrderId:buy.orderId,sellOrderId:sell.orderId,buyerId:buy.ownerId,sellerId:sell.ownerId,executedAt:now,sequence:m.nextSequence++};
 // The buy deposit was withdrawn at registration. A buyer gets only the difference between its limit and the resting price.
 if(local(s,buy.ownerId)){addItem(s,buy.itemId,quantity,sell.gear);s.silver+=(buy.limitPrice-price)*quantity;}
 if(local(s,sell.ownerId))s.silver+=price*quantity;
 buy.remainingQuantity-=quantity;sell.remainingQuantity-=quantity;buy.status=status(buy.remainingQuantity,buy.originalQuantity);sell.status=status(sell.remainingQuantity,sell.originalQuantity);m.trades.push(trade);
}
function matchIncoming(s:GameState,incoming:MarketOrder,now:number){
 const opposite=s.market.orders.filter(o=>active(o)&&o.itemId===incoming.itemId&&o.side!==incoming.side&&o.orderId!==incoming.orderId).sort(incoming.side==='BUY'?sellSort:buySort);
 for(const resting of opposite){
  if(!active(incoming))break;
  if(resting.ownerId===incoming.ownerId)continue;
  const buy=incoming.side==='BUY'?incoming:resting,sell=incoming.side==='SELL'?incoming:resting;
  if(sell.limitPrice>buy.limitPrice)break;
  settle(s,buy,sell,Math.min(buy.remainingQuantity,sell.remainingQuantity),resting.limitPrice,now);
 }
}
export function placeOrder(state:GameState,input:OrderInput):GameState {
 const s=structuredClone(state),ownerId=input.ownerId||s.market.ownerId,now=input.createdAt??Date.now();
 if(s.expedition)return {...s,notice:'원정 중에는 거래소 주문을 등록할 수 없습니다.'};
 if(!validPositive(input.limitPrice)||!validPositive(input.quantity))return {...s,notice:'가격과 수량은 1 이상의 정수여야 합니다.'};
 try{
  let gear:Item|undefined;
  if(input.side==='BUY'){const reserve=input.limitPrice*input.quantity;if(!Number.isSafeInteger(reserve)||s.silver<reserve)throw Error('예약할 Silver가 부족합니다.');s.silver-=reserve;}
  else gear=removeItem(s,input.itemId,input.quantity);
  const m=s.market,order:MarketOrder={orderId:'order-'+m.nextOrderId++,itemId:input.itemId,side:input.side,limitPrice:input.limitPrice,originalQuantity:input.quantity,remainingQuantity:input.quantity,ownerId,createdAt:now,sequence:m.nextSequence++,status:'OPEN',gear};
  m.orders.push(order);matchIncoming(s,order,now);s.notice=`${input.side==='BUY'?'매수':'매도'} 지정가 주문을 등록했습니다.`;return s;
 }catch(error){return {...s,notice:error instanceof Error?error.message:'주문을 등록할 수 없습니다.'};}
}
export function cancelOrder(state:GameState,orderId:string):GameState {
 const s=structuredClone(state),order=s.market.orders.find(o=>o.orderId===orderId);
 if(!order||order.ownerId!==s.market.ownerId||!active(order))return {...s,notice:'취소할 수 없는 주문입니다.'};
 if(order.side==='BUY')s.silver+=order.limitPrice*order.remainingQuantity;else addItem(s,order.itemId,order.remainingQuantity,order.gear);
 order.status='CANCELLED';s.notice='주문을 취소하고 남은 예치 자산을 반환했습니다.';return s;
}
