import type {GameFeelIntensity,GameFeelPayloadMap,GameFeelRecipe} from '../types';

const safeIntensity=(value:unknown,fallback:GameFeelIntensity):GameFeelIntensity=>
 value==='subtle'||value==='normal'||value==='strong'||value==='exceptional'?value:fallback;

export function combatRecipe(
 event:'combat.basic-hit'|'combat.critical-hit'|'combat.player-damaged'|'combat.guard'|'combat.heal'|'combat.death',
 payload?:GameFeelPayloadMap[typeof event],
):GameFeelRecipe{
 if(event==='combat.critical-hit')return {
  event,intensity:'strong',duration:300,
  commands:[
   {type:'flash',duration:150,tone:'brass',target:'target'},
   {type:'shake',duration:120,strength:'light',target:'target'},
   {type:'value-pop',duration:280,tone:'brass',target:'value'},
   {type:'haptic',intensity:'strong'},
  ],
 };
 if(event==='combat.player-damaged'){
  const intensity=safeIntensity((payload as {intensity?:unknown}|undefined)?.intensity,'normal');
  return {
   event,intensity,duration:intensity==='strong'?280:210,
   commands:[
    {type:'flash',duration:150,tone:'negative',target:'source'},
    ...(intensity==='strong'?[{type:'shake' as const,duration:120,strength:'light' as const,target:'source' as const}]:[]),
    {type:'haptic',intensity},
   ],
  };
 }
 if(event==='combat.guard')return {
  event,intensity:'normal',duration:200,
  commands:[
   {type:'flash',duration:160,tone:'defense',target:'source'},
   {type:'pulse',duration:190,tone:'defense',target:'source'},
   {type:'haptic',intensity:'subtle'},
  ],
 };
 if(event==='combat.heal')return {
  event,intensity:'normal',duration:240,
  commands:[
   {type:'pulse',duration:230,tone:'heal',target:'source'},
   {type:'value-pop',duration:220,tone:'heal',target:'value'},
  ],
 };
 if(event==='combat.death')return {
  event,intensity:'strong',duration:420,
  commands:[
   {type:'flash',duration:220,tone:'negative',target:'screen'},
   {type:'pulse',duration:380,tone:'negative',target:'target'},
   {type:'haptic',intensity:'strong'},
  ],
 };
 const intensity=safeIntensity((payload as {intensity?:unknown}|undefined)?.intensity,'normal');
 return {
  event,intensity,duration:190,
  commands:[
   {type:'pulse',duration:170,tone:'neutral',target:'target'},
   {type:'value-pop',duration:180,tone:'neutral',target:'value'},
  ],
 };
}
