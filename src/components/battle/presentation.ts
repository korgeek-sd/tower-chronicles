import type {ActiveEffect,Expedition,Monster} from '../../game/types';
import {EFFECTS} from '../../game/engine/effects';
export function effectText(effect:ActiveEffect){const definition=EFFECTS[effect.effectId],parts=[definition?.name||effect.effectId];if(definition?.payload?.multiplier)parts.push(`${definition.payload.multiplier>0?'+':''}${Math.round(definition.payload.multiplier*100*effect.stackCount)}%`);if(effect.currentShield!==undefined)parts.push(`흡수 ${effect.currentShield}`);if(effect.currentShieldHits!==undefined)parts.push(`${effect.currentShieldHits}회 방어`);if(effect.stackCount>1)parts.push(`${effect.stackCount}중첩`);parts.push(`${effect.remainingDuration}턴`);return parts.join(' · ');}
export const encounterKey=(e:Expedition)=>[e.tower,e.floor,e.monster.name,e.kills-(e.spawnAt?1:0)].join(':');
export const monsterHud=(m:Monster)=>({name:m.name,current:Math.max(0,m.currentHp),max:m.hp,percent:Math.max(0,Math.min(100,m.currentHp/m.hp*100))});
export function damageBetween(previous:Expedition,current:Expedition){
  if(encounterKey(previous)!==encounterKey(current)||current.time<=previous.time)return 0;
  return Math.max(0,previous.monster.currentHp-current.monster.currentHp);
}
export type PlayerVitalEvent={kind:'damage'|'heal';amount:number}|null;
export function playerVitalBetween(previous:Expedition,current:Expedition):PlayerVitalEvent {
  if(encounterKey(previous)!==encounterKey(current)||current.time<=previous.time)return null;
  const change=current.hp-previous.hp;
  return change<0?{kind:'damage',amount:Math.abs(change)}:change>0?{kind:'heal',amount:change}:null;
}
export function imageState(hit:boolean,idleReady:boolean,hitReady:boolean){
  return hit&&hitReady?'hit':idleReady?'idle':'placeholder';
}
