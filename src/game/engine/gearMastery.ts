import type {GameState,GearMasteryKey,Item,Slot} from '../types';
import {GEAR_MASTERY_CONFIG,GEAR_MASTERY_NAMES,tierOf} from '../data/config';
import {masteryKeyOf,log} from './state';

export const masteryRequired=(targetTier:number)=>GEAR_MASTERY_CONFIG.requiredByTargetTier[targetTier]||0;
export function masteryGainForFloor(floor:number){
  const tier=tierOf(floor),position=(floor-1)%10;
  return Math.round(GEAR_MASTERY_CONFIG.baseGainByFloorTier[tier-1]*(1+(GEAR_MASTERY_CONFIG.endOfTierMultiplier-1)*position/9));
}
export const masteryPercent=(s:GameState,key:GearMasteryKey)=>s.gearMastery[key].unlockedTier>=5?100:Math.min(100,s.gearMastery[key].progress/masteryRequired(s.gearMastery[key].unlockedTier+1)*100);

/** Mastery is permanent kill progress and intentionally bypasses expedition loot. */
export function awardEquippedMastery(s:GameState){
  const e=s.expedition;if(!e)return [];
  const gain=masteryGainForFloor(e.floor),changes:string[]=[],unlocks:string[]=[];
  for(const slot of ['weapon','armor','boots','accessory'] as Slot[]){
    const item=s.items.find(i=>i.id===e.equipment[slot]);
    if(!item)continue;
    const key=masteryKeyOf(item),m=s.gearMastery[key];
    // Enhancement never participates: only item.tier is compared.
    if(m.unlockedTier>=5||item.tier!==m.unlockedTier)continue;
    m.progress+=gain;changes.push(GEAR_MASTERY_NAMES[key]+' +'+gain);
    const target=m.unlockedTier+1,required=masteryRequired(target);
    if(m.progress>=required){m.unlockedTier=target;m.progress=0;unlocks.push(`T${target} ${GEAR_MASTERY_NAMES[key]} 착용 자격을 획득했습니다.`);}
  }
  if(changes.length)log(s,'장비 숙련도 · '+changes.join(' · '));
  unlocks.forEach(message=>log(s,message));
  return changes;
}
