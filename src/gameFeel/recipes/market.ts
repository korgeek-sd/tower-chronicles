import type {GameFeelRecipe} from '../types';

export function marketRecipe(
 event:'market.order-placed'|'market.order-cancelled'|'market.trade-partial'|'market.trade-filled',
):GameFeelRecipe{
 if(event==='market.trade-filled')return {
  event,intensity:'normal',duration:280,
  commands:[
   {type:'flash',duration:180,tone:'positive',target:'value'},
   {type:'value-pop',duration:260,tone:'positive',target:'value'},
   {type:'haptic',intensity:'normal'},
  ],
 };
 if(event==='market.trade-partial')return {
  event,intensity:'subtle',duration:180,
  commands:[{type:'pulse',duration:170,tone:'neutral',target:'value'}],
 };
 if(event==='market.order-cancelled')return {
  event,intensity:'subtle',duration:180,
  commands:[
   {type:'pulse',duration:170,tone:'neutral',target:'control'},
   {type:'haptic',intensity:'subtle'},
  ],
 };
 return {
  event,intensity:'subtle',duration:200,
  commands:[
   {type:'press',duration:70,target:'control'},
   {type:'flash',duration:170,tone:'brass',target:'control'},
   {type:'haptic',intensity:'subtle'},
  ],
 };
}
