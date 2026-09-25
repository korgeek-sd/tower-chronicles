import type {MarketTrade} from '../../game/types';

/**
 * Presentation-only sample trades for marketplace UI preview.
 * They are never written into GameState and never affect balances, orders, matching, or saves.
 * Real trade history replaces this preview automatically once at least 3 real trades exist.
 */
export function demoTradesFor(itemId:string,now=Date.now()):MarketTrade[]{
 let seed=0;
 for(let i=0;i<itemId.length;i++)seed=(seed*31+itemId.charCodeAt(i))>>>0;
 const base=55+(seed%11)*20;
 const hours=[24,22,20,18,16,14,12,10,8,6,4,3,2,1,.5,.25];
 const wave=[0,2,-1,3,1,5,2,4,6,3,7,5,8,6,9,10];
 return hours.map((ago,index)=>{
   const price=Math.max(5,Math.round(base*(1+wave[index]/100)));
   const quantity=1+((seed+index*7)%8);
   return {
     tradeId:'demo-'+itemId+'-'+index,
     itemId,
     price,
     quantity,
     buyOrderId:'demo-buy-'+index,
     sellOrderId:'demo-sell-'+index,
     buyerId:'demo-buyer',
     sellerId:'demo-seller',
     executedAt:now-Math.round(ago*3600000),
     sequence:index+1,
   };
 });
}

export function marketTradesForPreview(realTrades:MarketTrade[],itemId:string,now=Date.now()){
 const actual=realTrades.filter(trade=>trade.itemId===itemId);
 return actual.length>=3
  ?{trades:realTrades,demo:false}
  :{trades:[...realTrades,...demoTradesFor(itemId,now)],demo:true};
}
