import type{GameFeelEvent,GameFeelPayloadMap,GameFeelRecipe,GameFeelIntensity}from'../types';
export function combatRecipe(event:GameFeelEvent,payload?:GameFeelPayloadMap[GameFeelEvent]):GameFeelRecipe{
 const supplied=(payload as {intensity?:GameFeelIntensity}|undefined)?.intensity;
 const intensity:GameFeelIntensity=event==='combat.critical-hit'||event==='combat.death'?'strong':event==='combat.player-damaged'&&supplied?supplied:'normal';
 const tone=event==='combat.player-damaged'||event==='combat.death'?'negative':event==='combat.heal'?'positive':'neutral';
 const commands:GameFeelRecipe['commands']=[{kind:'pulse',tone},{kind:'haptic',intensity}];
 if(event==='combat.critical-hit')commands.push({kind:'shake',strength:'light'},{kind:'value-pop'});
 return{key:event,event,intensity,duration:intensity==='strong'?300:180,commands};
}
