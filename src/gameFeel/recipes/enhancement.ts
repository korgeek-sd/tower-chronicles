import type{EnhancementFeelOutcome,GameFeelEvent,GameFeelPayloadMap,GameFeelRecipe}from'../types';
export function enhancementRecipe(event:GameFeelEvent,payload?:GameFeelPayloadMap[GameFeelEvent]):GameFeelRecipe{
 if(event==='enhancement.attempt')return{key:'enhancement.attempt',event,intensity:'normal',duration:260,commands:[{kind:'press'},{kind:'pulse',tone:'neutral'}]};
 const raw=(payload as {outcome?:EnhancementFeelOutcome}|undefined)?.outcome;
 const outcome:EnhancementFeelOutcome=['SUCCESS','FAIL_KEEP','FAIL_DOWNGRADE','FAIL_DESTROY'].includes(raw??'')?raw!:'FAIL_KEEP';
 const intensity=outcome==='FAIL_DESTROY'?'exceptional':outcome==='SUCCESS'||outcome==='FAIL_DOWNGRADE'?'strong':'subtle';
 const tone=outcome==='SUCCESS'?'gold':outcome==='FAIL_KEEP'?'neutral':'negative';
 const commands:GameFeelRecipe['commands']=[{kind:'flash',tone},{kind:'value-pop'},{kind:'haptic',intensity}];
 if(outcome==='FAIL_DOWNGRADE'||outcome==='FAIL_DESTROY')commands.push({kind:'shake',strength:outcome==='FAIL_DESTROY'?'heavy':'medium'});
 if(outcome==='FAIL_DESTROY')commands.push({kind:'particles',tone:'negative'});
 return{key:'enhancement.'+outcome.toLowerCase(),event,intensity,duration:outcome==='FAIL_DESTROY'?650:420,commands};
}
