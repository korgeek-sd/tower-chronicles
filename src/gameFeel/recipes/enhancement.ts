import type{EnhancementFeelOutcome,GameFeelEvent,GameFeelPayloadMap,GameFeelRecipe}from'../types';
export function enhancementRecipe(event:GameFeelEvent,payload?:GameFeelPayloadMap[GameFeelEvent]):GameFeelRecipe{
 if(event==='enhancement.attempt')return{key:'enhancement.attempt',event,intensity:'normal',duration:180,commands:[{kind:'press'},{kind:'haptic',intensity:'subtle'}]};
 const raw=(payload as {outcome?:EnhancementFeelOutcome}|undefined)?.outcome;
 const outcome:EnhancementFeelOutcome=['SUCCESS','FAIL_KEEP','FAIL_DOWNGRADE','FAIL_DESTROY'].includes(raw??'')?raw!:'FAIL_KEEP';
 const intensity=outcome==='FAIL_DESTROY'?'exceptional':outcome==='SUCCESS'||outcome==='FAIL_DOWNGRADE'?'strong':'subtle';
 return{key:'enhancement.'+outcome.toLowerCase(),event,intensity,duration:180,commands:[{kind:'haptic',intensity}]};
}
