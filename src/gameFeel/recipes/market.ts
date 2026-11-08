import type{GameFeelEvent,GameFeelRecipe}from'../types';

// Trading feedback is tactile-only: the global circle/pulse animation distracts
// from the order book and was removed for order placement, cancellations and fills.
export function marketRecipe(event:GameFeelEvent):GameFeelRecipe{
 const intensity=event==='market.trade-filled'?'normal':'subtle';
 return{key:event,event,intensity,duration:intensity==='normal'?260:180,commands:[{kind:'haptic',intensity}]};
}
