import type {GameFeelPayloadMap,GameFeelRecipe} from '../types';

export function sealRecipe(
 event:'seal.roll.start'|'seal.roll.result'|'seal.reset',
 payload?:GameFeelPayloadMap[typeof event],
):GameFeelRecipe{
 if(event==='seal.roll.start')return {
  event,intensity:'normal',duration:300,
  commands:[
   {type:'press',duration:80,target:'control'},
   {type:'pulse',duration:300,tone:'brass',target:'source'},
   {type:'haptic',intensity:'subtle'},
  ],
 };
 if(event==='seal.reset')return {
  event,intensity:'normal',duration:420,
  commands:[
   {type:'pulse',duration:420,tone:'neutral',target:'source'},
   {type:'value-pop',duration:260,tone:'neutral',target:'value'},
   {type:'haptic',intensity:'normal'},
  ],
 };
 const step=Number((payload as {step?:unknown}|undefined)?.step);
 if(step===3)return {
  event,intensity:'exceptional',duration:720,
  commands:[
   {type:'flash',duration:260,tone:'rare',target:'screen'},
   {type:'burst',duration:620,tone:'rare',target:'source'},
   {type:'particles',duration:700,tone:'rare',count:10,target:'source'},
   {type:'value-pop',duration:520,tone:'rare',target:'value'},
   {type:'shake',duration:180,strength:'medium',target:'source'},
   {type:'haptic',intensity:'exceptional'},
  ],
 };
 if(step===2)return {
  event,intensity:'strong',duration:460,
  commands:[
   {type:'burst',duration:420,tone:'brass',target:'source'},
   {type:'flash',duration:240,tone:'brass',target:'source'},
   {type:'value-pop',duration:360,tone:'brass',target:'value'},
   {type:'haptic',intensity:'strong'},
  ],
 };
 return {
  event,intensity:'normal',duration:300,
  commands:[
   {type:'pulse',duration:280,tone:'positive',target:'source'},
   {type:'value-pop',duration:240,tone:'positive',target:'value'},
   {type:'haptic',intensity:'normal'},
  ],
 };
}
