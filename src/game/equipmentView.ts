import type {GameState,Item,Stats} from './types';
import {equippedItem,itemSlot,masteryKeyOf,stats} from './engine/state';
import {GEAR_MASTERY_NAMES,SKILLS,WEAPONS} from './data/config';
import {jobById} from './jobs/catalog';

export const equipmentIcon=(item:Item)=>item.kind in WEAPONS||item.kind==='armor'||item.kind==='boots'?item.kind:'accessory';
export const statLabels:[keyof Stats,string][]=[['hp','최대 HP'],['attack','공격력'],['defense','방어력'],['skillPower','스킬 배율']];
export const formatStat=(n:number)=>Number(n.toFixed(2)).toLocaleString('ko-KR');
export const tierRoman=(n:number)=>['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ'][n-1]??String(n);
export const shortItemName=(name:string)=>name.replace(/^\d+T\s+/,'').replace(/\s+\+0$/,'');

/** Read-only projection of the same base stats used by the combat engine. */
export function previewEquipment(s:GameState,id:string){
  const item=s.items.find(candidate=>candidate.id===id);if(!item)return null;
  const equipment=s.expedition?.equipment??s.equipped,slot=itemSlot(item.kind),key=masteryKeyOf(item);
  const blockedReason=s.expedition?'원정 중에는 장비를 변경할 수 없습니다.':equipment[slot]===id?'현재 장착 중인 장비입니다.':item.tier>s.gearMastery[key].unlockedTier?`${GEAR_MASTERY_NAMES[key]} 숙련 ${tierRoman(item.tier)}단계가 필요합니다.`:null;
  return {item,slot,current:equippedItem(s,slot,equipment),before:stats(s,equipment),after:stats(s,{...equipment,[slot]:id}),blockedReason};
}
export function configureSkillSlot(s:GameState,index:number,id:string|null):GameState {
  if(s.expedition||jobById(s.currentJobId)?.combatKit||!Number.isInteger(index)||index<0||index>2)return s;
  if(id!==null&&(!s.learned.includes(id)||!SKILLS.some(skill=>skill.id===id)||s.skills.some((other,i)=>i!==index&&other===id)))return s;
  const skills=[...s.skills] as GameState['skills'];skills[index]=id;return {...s,skills,notice:'전투 스킬 구성을 저장했습니다.'};
}
