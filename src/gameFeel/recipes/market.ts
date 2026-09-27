import type{GameFeelEvent,GameFeelRecipe}from'../types';
export function marketRecipe(event:GameFeelEvent):GameFeelRecipe{
 const intensity=event==='market.trade-filled'?'normal':'subtle';
 return{key:event,event,intensity,duration:intensity==='normal'?260:180,commands:[{kind:'pulse',tone:event==='market.order-cancelled'?'neutral':'positive'},{kind:'haptic',intensity}]};
}
