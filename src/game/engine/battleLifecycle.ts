import type {CombatActor,Expedition} from '../types';

export interface CombatQueueActionComplete {kind:'ACTION_COMPLETE';actor:CombatActor}
export type CombatQueueItem=CombatQueueActionComplete;
export type SkillReadyTurns=Record<CombatActor,Record<string,number>>;
export type CombatRuntimeV2={
  healingPotionUses:number;
  skillReadyTurns:SkillReadyTurns;
  combatQueue:CombatQueueItem[];
};
export type CombatExpedition=Expedition&CombatRuntimeV2;

const emptyReadyTurns=():SkillReadyTurns=>({player:{},monster:{}});
const emptyResource=()=>({id:'combat',value:0,maxValue:4});

export function combatRuntime(e:Expedition):CombatExpedition{return e as CombatExpedition;}

export function initializeCombatRuntimeV2(e:Expedition):CombatExpedition {
  const runtime=combatRuntime(e);
  runtime.healingPotionUses=0;
  runtime.skillReadyTurns=emptyReadyTurns();
  runtime.combatQueue=[];
  e.jobRuntime.resource=emptyResource();
  return runtime;
}

/** Reset state owned by a single monster combat without touching expedition-long resources. */
export function resetCombatRuntime(e:Expedition,playerMaxHp:number):void {
  const runtime=combatRuntime(e);
  e.hp=Math.min(e.hp,playerMaxHp);
  e.cooldowns={};
  e.buffs={};
  e.playerEffects=[];
  e.monsterEffects=[];
  e.preparedEffects=[];
  e.effectSequence=0;
  e.reactivePrepared={player:null,monster:null};
  e.jobRuntime.resource=emptyResource();
  e.jobRuntime.flags={};
  e.jobRuntime.counters={};
  runtime.skillReadyTurns=emptyReadyTurns();
  runtime.combatQueue=[];
  if(e.monsterRuntime){
    e.monsterRuntime.skillCooldowns={};
    e.monsterRuntime.preparedActionId=null;
    e.monsterRuntime.turnNumber=0;
  }
  e.phase='PLAYER_TURN';
  e.playerTurn=1;
  e.monsterTurn=0;
  e.pendingFlee=false;
  e.pendingRevival=null;
}
