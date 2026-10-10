import {huntingRecipe} from './recipes/hunting';
import type{GameFeelEvent,GameFeelPayloadMap,GameFeelRecipe}from'./types';
import{sealRecipe}from'./recipes/seal';import{enhancementRecipe}from'./recipes/enhancement';import{combatRecipe}from'./recipes/combat';import{marketRecipe}from'./recipes/market';
export function resolveGameFeelRecipe<E extends GameFeelEvent>(event:E,payload?:GameFeelPayloadMap[E],options?:{reducedMotion?:boolean}):GameFeelRecipe{
 let recipe:GameFeelRecipe;
 if(event.startsWith('hunt.'))recipe=huntingRecipe(event,payload as GameFeelPayloadMap[GameFeelEvent]);
 else if(event.startsWith('seal.'))recipe=sealRecipe(event,payload as GameFeelPayloadMap[GameFeelEvent]);
 else if(event.startsWith('enhancement.'))recipe=enhancementRecipe(event,payload as GameFeelPayloadMap[GameFeelEvent]);
 else if(event.startsWith('combat.'))recipe=combatRecipe(event,payload as GameFeelPayloadMap[GameFeelEvent]);
 else if(event.startsWith('market.'))recipe=marketRecipe(event);
 else recipe={key:event,event,intensity:event==='ui.error'?'normal':'subtle',duration:180,commands:[event==='ui.press'?{kind:'press'}:{kind:'flash',tone:event==='ui.error'?'negative':'positive'},{kind:'haptic',intensity:event==='ui.error'?'normal':'subtle'}]};
 if(!options?.reducedMotion)return recipe;
 return{...recipe,duration:Math.min(recipe.duration,220),commands:recipe.commands.filter(c=>c.kind!=='shake'&&c.kind!=='particles'&&c.kind!=='burst')};
}
export type{GameFeelEvent,GameFeelPayloadMap,GameFeelRecipe}from'./types';
