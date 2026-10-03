import type {CombatActor,Expedition,GameState} from '../types';
import {modifier,EFFECTS} from './effects';
import {stats,recordCombatEvent} from './state';
export interface HealingOptions {canCrit?:boolean;source?:CombatActor;rng?:()=>number}
export interface HealingResult {amount:number;critical:boolean}
export function applyHealing(s:GameState,actor:CombatActor,amount:number,options:HealingOptions={}):HealingResult {
 const e=s.expedition;if(!e)return {amount:0,critical:false};
 if((actor==='player'?e.hp:e.monster.currentHp)<=0)return {amount:0,critical:false};
 const source=options.source??actor,base=stats(s,e.equipment);
 const chance=source==='player'?base.critChance??.05:0;
 const critical=!!options.canCrit&&(options.rng??Math.random)()<Math.max(0,Math.min(1,chance+modifier(e,source,'healCritChance')));
 const crit=source==='player'?base.critDamage??1.5:1.5;
 const healed=Math.max(0,amount)*Math.max(0,1+modifier(e,source,'healingDone'))*Math.max(0,1+modifier(e,actor,'healingReceived'))*(critical?Math.max(1,crit+modifier(e,source,'healCritDamage')):1);
 if(actor==='player')e.hp+=healed;else e.monster.currentHp+=healed;
 if(healed>0)recordCombatEvent(s,{kind:'HEAL',attacker:source,target:actor,hitIndex:1,hitCount:1,incomingDamage:0,absorbedByShield:0,hpDamage:0,healing:healed,critical});
 return {amount:healed,critical};
}
export function decayPlayerOverheal(e:Expedition,maxHp:number):number {
 const loss=Math.max(0,e.hp-maxHp)*.25;e.hp-=loss;return loss;
}
export function periodicTicks(e:Expedition,actor:CombatActor,turn:number){
 const effects=actor==='player'?e.playerEffects:e.monsterEffects;
 return effects.filter(x=>x.createdTurn!==turn).map(effect=>({effect,definition:EFFECTS[effect.effectId]})).filter(x=>x.definition?.behavior==='PERIODIC_DAMAGE'||x.definition?.behavior==='PERIODIC_HEAL');
}
