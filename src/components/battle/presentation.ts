import type {Expedition,Monster} from '../../game/types';
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
