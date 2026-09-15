export type GoldSide='BUY_GOLD'|'SELL_GOLD';export type GoldStatus='OPEN'|'PARTIAL'|'FILLED'|'CANCELLED';
export interface GoldExchangeOrder {orderId:string;side:GoldSide;priceSilverPerGold:number;originalGoldQuantity:number;remainingGoldQuantity:number;ownerId:string;createdAt:number;sequence:number;status:GoldStatus}
export interface GoldExchangeTrade {tradeId:string;priceSilverPerGold:number;goldQuantity:number;grossSilver:number;sellerFeeSilver:number;sellerNetSilver:number;buyOrderId:string;sellOrderId:string;buyerId:string;sellerId:string;executedAt:number;sequence:number}
export interface GoldExchangeState {gold:number;orders:GoldExchangeOrder[];trades:GoldExchangeTrade[];nextOrderId:number;nextTradeId:number;nextSequence:number}
export const initialGoldExchange=():GoldExchangeState=>({gold:0,orders:[],trades:[],nextOrderId:1,nextTradeId:1,nextSequence:1});
export const goldRegistrationFee=(price:number,quantity:number)=>Math.floor(price*quantity*.005);
export const goldSellerFee=(gross:number,golden:boolean)=>Math.floor(gross*(golden?.01:.02));
const active=(o:GoldExchangeOrder)=>o.status==='OPEN'||o.status==='PARTIAL';const state=(o:GoldExchangeOrder)=>o.remainingGoldQuantity===0?'FILLED':o.remainingGoldQuantity===o.originalGoldQuantity?'OPEN':'PARTIAL' as GoldStatus;
export function goldOrderBook(s:GoldExchangeState){const sortSell=(a:GoldExchangeOrder,b:GoldExchangeOrder)=>a.priceSilverPerGold-b.priceSilverPerGold||a.createdAt-b.createdAt||a.sequence-b.sequence,sortBuy=(a:GoldExchangeOrder,b:GoldExchangeOrder)=>b.priceSilverPerGold-a.priceSilverPerGold||a.createdAt-b.createdAt||a.sequence-b.sequence;return {sells:s.orders.filter(o=>active(o)&&o.side==='SELL_GOLD').sort(sortSell),buys:s.orders.filter(o=>active(o)&&o.side==='BUY_GOLD').sort(sortBuy)};}
