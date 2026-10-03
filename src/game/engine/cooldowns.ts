import type {CombatActor,Expedition} from '../types';
import {combatRuntime} from './battleLifecycle';

const actorTurn=(e:Expedition,actor:CombatActor)=>actor==='player'?e.playerTurn:e.monsterTurn;
const actorPhase=(actor:CombatActor)=>actor==='player'?'PLAYER_TURN' as const:'MONSTER_TURN' as const;
const legacyStore=(e:Expedition,actor:CombatActor):Record<string,number>=>{
  if(actor==='monster')return e.monsterRuntime?.skillCooldowns??{};
  const out:Record<string,number>={};
  for(const [key,value] of Object.entries(e.cooldowns))if(key.startsWith('turn:'))out[key.slice(5)]=value;
  return out;
};
const setLegacy=(e:Expedition,actor:CombatActor,id:string,value:number)=>{
  if(actor==='monster'){if(e.monsterRuntime)e.monsterRuntime.skillCooldowns[id]=value;return;}
  e.cooldowns['turn:'+id]=value;
};
const readyStore=(e:Expedition,actor:CombatActor)=>combatRuntime(e).skillReadyTurns[actor];

export function setSkillCooldown(e:Expedition,actor:CombatActor,skillId:string,cooldown:number):void {
  const turns=Math.max(0,Math.floor(cooldown));
  const store=readyStore(e,actor);
  if(turns===0){delete store[skillId];setLegacy(e,actor,skillId,0);return;}
  store[skillId]=actorTurn(e,actor)+turns+1;
  setLegacy(e,actor,skillId,turns);
}

export function skillCooldownRemaining(e:Expedition,actor:CombatActor,skillId:string):number {
  const readyAt=readyStore(e,actor)[skillId];
  if(readyAt===undefined)return Math.max(0,Math.ceil(legacyStore(e,actor)[skillId]??0));
  const current=actorTurn(e,actor);
  if(current>=readyAt)return 0;
  const betweenActorTurns=e.phase!==actorPhase(actor);
  return Math.max(0,readyAt-current-(betweenActorTurns?1:0));
}

export function isSkillReady(e:Expedition,actor:CombatActor,skillId:string):boolean {
  const readyAt=readyStore(e,actor)[skillId];
  if(readyAt!==undefined)return actorTurn(e,actor)>=readyAt;
  return (legacyStore(e,actor)[skillId]??0)<=0;
}

/** Called after the actor turn counter advances. It converts legacy numeric cooldowns lazily. */
export function syncActorCooldownsAtTurnStart(e:Expedition,actor:CombatActor,knownSkillIds:string[]=[]):void {
  const store=readyStore(e,actor),legacy=legacyStore(e,actor),ids=new Set([...knownSkillIds,...Object.keys(legacy),...Object.keys(store)]);
  for(const id of ids){
    const raw=Math.max(0,Math.ceil(legacy[id]??0));
    if(store[id]===undefined&&raw>0)store[id]=actorTurn(e,actor)+raw;
    const remaining=skillCooldownRemaining(e,actor,id);
    setLegacy(e,actor,id,remaining);
    if(remaining===0&&store[id]!==undefined&&actorTurn(e,actor)>=store[id])delete store[id];
  }
}
