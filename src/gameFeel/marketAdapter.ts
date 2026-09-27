export interface MarketFeelOrder{
 orderId:string;
 status:'OPEN'|'PARTIAL'|'FILLED'|'CANCELLED';
 mine:boolean;
}
export interface MarketFeelTrade{
 tradeId:string;
 buyOrderId:string;
 sellOrderId:string;
 buyerMine:boolean;
 sellerMine:boolean;
}
export interface MarketFeelSnapshot{
 orders:readonly MarketFeelOrder[];
 trades:readonly MarketFeelTrade[];
}
export type MarketFillFeelEvent='market.trade-partial'|'market.trade-filled';

export function marketFeelForTransition(before:MarketFeelSnapshot,after:MarketFeelSnapshot):MarketFillFeelEvent[]{
 const seen=new Set(before.trades.map(trade=>trade.tradeId));
 const emissions:MarketFillFeelEvent[]=[];
 for(const trade of after.trades){
  if(seen.has(trade.tradeId)||(!trade.buyerMine&&!trade.sellerMine))continue;
  const mineOrderId=trade.buyerMine?trade.buyOrderId:trade.sellOrderId;
  const order=after.orders.find(candidate=>candidate.orderId===mineOrderId&&candidate.mine);
  const event:MarketFillFeelEvent=order&&(order.status==='OPEN'||order.status==='PARTIAL')?'market.trade-partial':'market.trade-filled';
  if(!emissions.includes(event))emissions.push(event);
 }
 return emissions;
}
