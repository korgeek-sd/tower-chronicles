import {EQUIPMENT_GRADES,equipmentItemStats} from '../../game/data/equipment';
import type {EquipmentItem} from '../../game/types';
export function boxReveal(rewards:readonly EquipmentItem[],reducedMotion=false){
 if(!rewards.length)return null;
 const rank=rewards.reduce((highest,item)=>Math.max(highest,EQUIPMENT_GRADES.indexOf(item.grade)),0);
 const duration=reducedMotion?0:[3100,3400,3800,4500,5200][rank];
 return {grade:EQUIPMENT_GRADES[rank],duration,chargeAt:650,holdAt:duration-(rank>=3?1950:1680),burstAt:duration-(rank>=3?1350:1280)};
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

export const BOX_FRAME_WIDTH=112;
export const BOX_FRAME_HEIGHT=128;
export const BOX_FRAME_COUNT=8;
/** Authored opening frames: slower latch release, accelerating hinge, brief overshoot, settle. */
export function boxOpeningFrame(elapsedMs:number){
 const beats=[0,90,180,245,315,395,490,590];
 let frame=0;
 for(let i=1;i<beats.length;i++)if(elapsedMs>=beats[i])frame=i;
 return frame;
}
