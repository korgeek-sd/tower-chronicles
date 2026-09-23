import type {BestiaryState,GameState,Monster} from '../types';
import {bestiaryEntryById} from '../data/bestiary';

export const emptyBestiary=():BestiaryState=>({entries:{}});

function progressFor(state:BestiaryState,id:string){
  return state.entries[id]??{encounters:0,defeats:0};
}
function safeIncrement(value:number){return Math.min(Number.MAX_SAFE_INTEGER,value+1);}

export function recordBestiaryEncounter(state:GameState,monster:Monster){
  const id=monster.definitionId;
  if(!id||!bestiaryEntryById(id))return;
  const current=progressFor(state.bestiary,id);
  state.bestiary.entries[id]={encounters:safeIncrement(current.encounters),defeats:current.defeats};
}

export function recordBestiaryDefeat(state:GameState,monster:Monster){
  const id=monster.definitionId;
  if(!id||!bestiaryEntryById(id))return;
  const current=progressFor(state.bestiary,id);
  state.bestiary.entries[id]={
    encounters:Math.max(current.encounters,1),
    defeats:safeIncrement(current.defeats),
  };
}

export type BestiaryKnowledge='UNKNOWN'|'ENCOUNTERED'|'DEFEATED'|'MASTERED';
export function bestiaryKnowledge(state:BestiaryState,id:string,boss=false):BestiaryKnowledge {
  const current=progressFor(state,id);
  if(current.encounters<1)return 'UNKNOWN';
  if(current.defeats<1)return 'ENCOUNTERED';
  if(boss||current.defeats>=3)return 'MASTERED';
  return 'DEFEATED';
}

export const bestiaryProgressFor=(state:BestiaryState,id:string)=>progressFor(state,id);
