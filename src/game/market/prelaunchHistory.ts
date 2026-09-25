import type {GameState,MarketTrade,Tower} from '../types';
import {CONFIG,towerIds} from '../data/config';

/**
 * TEMPORARY PRE-LAUNCH MARKET SEED
 *
 * Adds deterministic historical trades to saves so the marketplace has a believable
 * price history during UI/balance testing before live players exist.
 *
 * Remove this module and the repository hook before launch/reset.
 */
const MARKER='prelaunch-';
const hoursAgo=[23.5,21,18,15,12,9,6,4,2,1,.5,.15];
const towerFactor:Record<Tower,number>={ore:1,leather:1.08,gem:1.22,kaleon:1.15};

function hash(text:string){
 let value=2166136261;
 for(let i=0;i<text.length;i++){value^=text.charCodeAt(i);value=Math.imul(value,16777619);}
 return value>>>0;
}

function tradeRows(itemId:string,basePrice:number,kind:'material'|'ticket',startSequence:number,now:number):MarketTrade[]{
 const seed=hash(itemId),drift=((seed%9)-4)/100;
 return hoursAgo.map((ago,index)=>{
  const wave=[-3,-1,1,0,2,4,3,5,4,6,5,7][index];
  const price=Math.max(1,Math.round(basePrice*(1+drift+wave/100)));
  const quantity=kind==='material'?2+((seed+index*11)%13):1+((seed+index*5)%4);
  return {
   tradeId:MARKER+itemId.replace(/:/g,'-')+'-'+String(index+1).padStart(2,'0'),
   itemId,
   price,
   quantity,
   buyOrderId:'prelaunch-buy-'+((seed+index)%37+1),
   sellOrderId:'prelaunch-sell-'+((seed+index*3)%41+1),
   buyerId:'market-sim-'+String((seed+index)%17+1).padStart(2,'0'),
   sellerId:'market-sim-'+String((seed+index*2+7)%19+20).padStart(2,'0'),
   executedAt:now-Math.round(ago*3_600_000),
   sequence:startSequence+index,
  };
 });
}

export function seedPrelaunchMarketHistory(state:GameState,now=Date.now()):GameState{
 if(state.market.trades.some(trade=>trade.tradeId.startsWith(MARKER)))return state;
 const next=structuredClone(state);
 let sequence=Math.max(next.market.nextSequence,...next.market.trades.map(trade=>trade.sequence+1),1);
 const seeded:MarketTrade[]=[];
 for(const tower of towerIds){
  for(let tier=1;tier<=5;tier++){
   const itemId='material:'+tower+':'+tier;
   const base=Math.round(70*Math.pow(2,tier-1)*towerFactor[tower]);
   const rows=tradeRows(itemId,base,'material',sequence,now);seeded.push(...rows);sequence+=rows.length;
  }
  for(let floor=1;floor<=CONFIG.maxFloor;floor++){
   const itemId='ticket:'+tower+':'+floor;
   const base=Math.round((95+floor*32)*towerFactor[tower]);
   const rows=tradeRows(itemId,base,'ticket',sequence,now);seeded.push(...rows);sequence+=rows.length;
  }
 }
 next.market.trades=[...next.market.trades,...seeded].sort((a,b)=>a.executedAt-b.executedAt||a.sequence-b.sequence);
 next.market.nextSequence=Math.max(next.market.nextSequence,sequence);
 return next;
}

export const isPrelaunchMarketTrade=(trade:MarketTrade)=>trade.tradeId.startsWith(MARKER);
