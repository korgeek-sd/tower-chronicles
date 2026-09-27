import {combatRecipe} from './recipes/combat';
import {enhancementRecipe} from './recipes/enhancement';
import {marketRecipe} from './recipes/market';
import {sealRecipe} from './recipes/seal';
import type {GameFeelCommand,GameFeelEvent,GameFeelPayloadMap,GameFeelRecipe} from './types';

const uiRecipe=(event:'ui.press'|'ui.confirm'|'ui.error'):GameFeelRecipe=>{
 if(event==='ui.error')return {
  event,intensity:'normal',duration:240,
  commands:[
   {type:'flash',duration:180,tone:'negative',target:'control'},
   {type:'shake',duration:140,strength:'light',target:'control'},
   {type:'haptic',intensity:'normal'},
  ],
 };
 if(event==='ui.confirm')return {
  event,intensity:'normal',duration:180,
  commands:[
   {type:'flash',duration:150,tone:'positive',target:'control'},
   {type:'haptic',intensity:'normal'},
  ],
 };
 return {
  event,intensity:'subtle',duration:140,
  commands:[
   {type:'press',duration:80,target:'control'},
   {type:'haptic',intensity:'subtle'},
  ],
 };
};

const reducedCommand=(command:GameFeelCommand):GameFeelCommand|null=>{
 if(command.type==='shake')return null;
 if(command.type==='particles')return {
  type:'flash',
  duration:Math.min(command.duration,220),
  tone:command.tone,
  target:command.target,
 };
 if(command.type==='burst')return {
  ...command,
  duration:Math.min(command.duration,240),
 };
 if(command.type==='press')return {
  ...command,
  duration:Math.min(command.duration,60),
 };
 return command;
};

const withReducedMotion=(recipe:GameFeelRecipe):GameFeelRecipe=>({
 ...recipe,
 duration:Math.min(recipe.duration,300),
 commands:recipe.commands.map(reducedCommand).filter((command):command is GameFeelCommand=>!!command),
});

export function resolveGameFeelRecipe<E extends GameFeelEvent>(
 event:E,
 payload?:GameFeelPayloadMap[E],
 options?:{reducedMotion?:boolean},
):GameFeelRecipe{
 let recipe:GameFeelRecipe;
 if(event.startsWith('seal.'))recipe=sealRecipe(event as 'seal.roll.start'|'seal.roll.result'|'seal.reset',payload as never);
 else if(event.startsWith('enhancement.'))recipe=enhancementRecipe(event as 'enhancement.attempt'|'enhancement.result',payload as never);
 else if(event.startsWith('combat.'))recipe=combatRecipe(event as 'combat.basic-hit'|'combat.critical-hit'|'combat.player-damaged'|'combat.guard'|'combat.heal'|'combat.death',payload as never);
 else if(event.startsWith('market.'))recipe=marketRecipe(event as 'market.order-placed'|'market.order-cancelled'|'market.trade-partial'|'market.trade-filled');
 else recipe=uiRecipe(event as 'ui.press'|'ui.confirm'|'ui.error');
 return options?.reducedMotion?withReducedMotion(recipe):recipe;
}
