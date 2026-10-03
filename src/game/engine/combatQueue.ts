import type {CombatActor,Expedition,GameState} from '../types';
import {combatRuntime} from './battleLifecycle';
import {resolveActorDirectHits} from './monsterSkills';
import {applyEffect} from './effects';
export type CombatQueueItem=
 |{kind:'DIRECT_HIT'|'REACTION';actor:CombatActor;multiplier:number;canTriggerReaction?:boolean;hitIndex?:number;hitCount?:number}
 |{kind:'EFFECT';actor:CombatActor;target:CombatActor;effectId:string}
 |{kind:'ACTION_COMPLETE';actor:CombatActor};
export function runCombatQueue(e:Expedition,items:CombatQueueItem[],handle:(item:CombatQueueItem)=>void):void {
 const runtime=combatRuntime(e),previous=runtime.combatQueue,queue=[...items];runtime.combatQueue=queue;
 while(queue.length&&e.hp>0&&e.monster.currentHp>0&&!e.pendingRevival){
  handle(queue.shift()!);
 }
 if(e.hp<=0||e.monster.currentHp<=0||e.pendingRevival){queue.length=0;previous.length=0;}
 runtime.combatQueue=previous;
}
export function resolveCombatQueue(state:GameState,items:CombatQueueItem[],rng:()=>number=()=>.99):GameState {
 const e=state.expedition;if(!e)return state;
 runCombatQueue(e,items,item=>{
  if(item.kind==='DIRECT_HIT'||item.kind==='REACTION')resolveActorDirectHits(state,item.actor,1,item.multiplier,item.kind!=='REACTION'&&item.canTriggerReaction!==false,rng);
  if(item.kind==='EFFECT')applyEffect(e,item.target,item.effectId,item.actor,item.target==='player'?e.playerTurn:e.monsterTurn);
 });
 return state;
}
