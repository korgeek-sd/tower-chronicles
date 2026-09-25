import type {MarketTrade} from '../../game/types';

/**
 * Deterministic presentation-only sample trades used when an item has too little
 * real history to demonstrate the market chart. These rows never enter GameState,
 * never affect balances/orders, and are replaced automatically once real history exists.
 */
export function demoTradesFor(itemId:string,now=Date.now()):MarketTrade[]{
 let seed=0;
 for(let i=0;i<itemId.length;i++)seed=(seed*31+itemId.charCodeAt(i))>>>0;
 const base=45+(seed%12)*15;
 const pattern=[0,3,1,5,4,8,6,10,7,12,9,14,11,16,13,18,15,20,17,22];
 return pattern.map((step,index)=>{
   const wave=[0,2,-1,3,1,4,2,5,3,6,4,7,5,4,6,8,7,9,8,10][index];
   const price=Math.max(5,Math.round(base*(1+(wave-(index>12?2:0))/100)));
   const quantity=1+((seed>>((index%4)*4)+index*3)%9);
   return {
     tradeId:'demo-'+itemId+'-'+index,
     itemId,
     price,
     quantity,
     buyOrderId:'demo-buy-'+index,
     sellOrderId:'demo-sell-'+index,
     buyerId:'demo-buyer',
     sellerId:'demo-seller',
     executedAt:now-(24-step)*3600000+index*13000,
     sequence:index+1,
   };
 });
}

export function marketTradesForPreview(realTrades:MarketTrade[],itemId:string,now=Date.now()){
 const actual=realTrades.filter(t=>t.itemId===itemId);
 return actual.length>=3?{trades:realTrades,demo:false}:{trades:[...realTrades,...demoTradesFor(itemId,now)],demo:true};
}
