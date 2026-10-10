import type {GameFeelEvent,GameFeelPayloadMap,GameFeelRecipe} from '../types';
export function huntingRecipe(event:GameFeelEvent,payload?:GameFeelPayloadMap[GameFeelEvent]):GameFeelRecipe {
 const result=payload as {outcome?:string;grade?:string}|undefined;
 const intensity=event==='hunt.start'?'subtle':result?.grade==='legendary'?'exceptional':result?.grade==='heroic'?'strong':'normal';
 return {key:event,event,intensity,duration:360,commands:[{kind:'haptic',intensity}]};
}
