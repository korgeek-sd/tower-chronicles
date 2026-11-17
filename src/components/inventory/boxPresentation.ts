import {EQUIPMENT_GRADES,equipmentItemStats} from '../../game/data/equipment';
import type {EquipmentItem} from '../../game/types';
export function boxReveal(rewards:readonly EquipmentItem[],reducedMotion=false){
 if(!rewards.length)return null;
 const rank=rewards.reduce((highest,item)=>Math.max(highest,EQUIPMENT_GRADES.indexOf(item.grade)),0);
 const duration=reducedMotion?0:[2500,2600,2900,3200,3500][rank];
 return {grade:EQUIPMENT_GRADES[rank],duration,chargeAt:750,holdAt:duration-1000,burstAt:duration-550};
}
export function boxStatRows(item:EquipmentItem){
 const stats=equipmentItemStats(item);
 const labels={attack:'공격력',defense:'방어력',hp:'HP',critChance:'치명타 확률',critDamage:'치명타 피해',armorPenetration:'방어 관통'};
 return (Object.keys(labels) as (keyof typeof labels)[]).flatMap(key=>{
  const value=stats[key];if(!value)return [];
  const percent=key==='critChance'||key==='critDamage'||key==='armorPenetration';
  return [{label:labels[key],value:'+'+(percent?Number((value*100).toFixed(2))+'%':value.toLocaleString())}];
 });
}
