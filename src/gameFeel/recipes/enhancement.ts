import type {EnhancementFeelOutcome,GameFeelPayloadMap,GameFeelRecipe} from '../types';

const outcomeOf=(payload:GameFeelPayloadMap['enhancement.result']|undefined):EnhancementFeelOutcome|null=>{
 const outcome=(payload as {outcome?:unknown}|undefined)?.outcome;
 return outcome==='SUCCESS'||outcome==='FAIL_KEEP'||outcome==='FAIL_DOWNGRADE'||outcome==='FAIL_DESTROYED'?outcome:null;
};

export function enhancementRecipe(
 event:'enhancement.attempt'|'enhancement.result',
 payload?:GameFeelPayloadMap[typeof event],
):GameFeelRecipe{
 if(event==='enhancement.attempt')return {
  event,intensity:'normal',duration:300,
  commands:[
   {type:'press',duration:80,target:'control'},
   {type:'pulse',duration:300,tone:'brass',target:'source'},
   {type:'haptic',intensity:'subtle'},
  ],
 };
 const outcome=outcomeOf(payload as GameFeelPayloadMap['enhancement.result']);
 if(outcome==='SUCCESS')return {
  event,intensity:'strong',duration:500,
  commands:[
   {type:'flash',duration:260,tone:'brass',target:'source'},
   {type:'burst',duration:460,tone:'positive',target:'source'},
   {type:'value-pop',duration:420,tone:'positive',target:'value'},
   {type:'haptic',intensity:'strong'},
  ],
 };
 if(outcome==='FAIL_DOWNGRADE')return {
  event,intensity:'strong',duration:420,
  commands:[
   {type:'flash',duration:220,tone:'negative',target:'source'},
   {type:'shake',duration:180,strength:'medium',target:'source'},
   {type:'value-pop',duration:320,tone:'negative',target:'value'},
   {type:'haptic',intensity:'strong'},
  ],
 };
 if(outcome==='FAIL_DESTROYED')return {
  event,intensity:'exceptional',duration:720,
  commands:[
   {type:'flash',duration:280,tone:'negative',target:'screen'},
   {type:'burst',duration:520,tone:'negative',target:'source'},
   {type:'particles',duration:680,tone:'negative',count:8,target:'source'},
   {type:'shake',duration:240,strength:'heavy',target:'source'},
   {type:'haptic',intensity:'exceptional'},
  ],
 };
 return {
  event,intensity:'subtle',duration:220,
  commands:[
   {type:'pulse',duration:200,tone:'neutral',target:'source'},
   {type:'haptic',intensity:'subtle'},
  ],
 };
}
