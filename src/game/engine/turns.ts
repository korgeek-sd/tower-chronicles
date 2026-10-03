import type {Expedition} from '../types';
import {skillCooldownRemaining,syncActorCooldownsAtTurnStart} from './cooldowns';

export function skillTurnsLeft(e:Expedition,id:string,_speed?:number){return skillCooldownRemaining(e,'player',id);}
export function advanceSkillTurns(e:Expedition,ids:string[],_speed?:number){syncActorCooldownsAtTurnStart(e,'player',ids);}
