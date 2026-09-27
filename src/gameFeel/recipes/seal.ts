import type{GameFeelEvent,GameFeelPayloadMap,GameFeelRecipe}from'../types';
export function sealRecipe(event:GameFeelEvent,payload?:GameFeelPayloadMap[GameFeelEvent]):GameFeelRecipe{
 if(event==='seal.roll.result'){
  const step=(payload as {step?:number}|undefined)?.step;
  const intensity=step===3?'exceptional':step===2?'strong':'normal';
  const commands:GameFeelRecipe['commands']=[{kind:'pulse',tone:step===3?'gold':'positive'},{kind:'value-pop'},{kind:'haptic',intensity}];
  if(step===2||step===3)commands.push({kind:'burst',tone:step===3?'gold':'positive'});
  if(step===3)commands.push({kind:'particles',tone:'gold'});
  return{key:'seal.result.'+(step===1||step===2||step===3?step:'safe'),event,intensity,duration:step===3?720:step===2?460:280,commands};
 }
 if(event==='seal.reset')return{key:'seal.reset',event,intensity:'normal',duration:420,commands:[{kind:'pulse',tone:'neutral'},{kind:'haptic',intensity:'normal'}]};
 return{key:'seal.roll.start',event,intensity:'normal',duration:260,commands:[{kind:'press'},{kind:'pulse',tone:'neutral'}]};
}
