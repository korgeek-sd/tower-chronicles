import type{GameFeelEvent,GameFeelPayloadMap,GameFeelRecipe,GameFeelIntensity}from'../types';
export function combatRecipe(event:GameFeelEvent,payload?:GameFeelPayloadMap[GameFeelEvent]):GameFeelRecipe{
 const supplied=(payload as {intensity?:GameFeelIntensity}|undefined)?.intensity;
 const intensity:GameFeelIntensity=event==='combat.critical-hit'||event==='combat.death'?'strong':event==='combat.player-damaged'&&supplied?supplied:event==='combat.guard'||event==='combat.heal'?'subtle':'normal';
 return{key:event,event,intensity,duration:intensity==='strong'?220:140,commands:[{kind:'haptic',intensity}]};
}
