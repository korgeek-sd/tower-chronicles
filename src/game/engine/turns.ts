import type {Expedition} from '../types';

export function skillTurnsLeft(e:Expedition,id:string,_speed?:number){return Math.max(0,Math.ceil(e.cooldowns['turn:'+id]??0));}
export function advanceSkillTurns(e:Expedition,ids:string[],_speed?:number){for(const id of ids){const key='turn:'+id;e.cooldowns[key]=Math.max(0,skillTurnsLeft(e,id)-1);}}
