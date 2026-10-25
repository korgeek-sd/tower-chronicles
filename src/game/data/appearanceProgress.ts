import type {AppearanceData} from './cosmetics';
import type {Cosmetics} from '../types';
export const APPEARANCE_UNLOCK_COST=5;
export const APPEARANCE_UPGRADE_COST=10;
export const APPEARANCE_MAX_LEVEL=5;
export const APPEARANCE_LEVEL_MULTIPLIER:readonly number[]=[0,1,1.1,1.2,1.35,1.5];
export const appearanceLevel=(cosmetics:Cosmetics,id:string):number=>
 id==='default'?1:(cosmetics.appearanceLevels?.[id]??(cosmetics.unlockedAppearanceIds.includes(id)?1:0));
export const appearanceShardCount=(cosmetics:Cosmetics,id:string):number=>
 Math.max(0,cosmetics.appearanceItems[id]??0);
export const appearanceShardCost=(level:number):number=>
 level>=APPEARANCE_MAX_LEVEL?0:level===0?APPEARANCE_UNLOCK_COST:APPEARANCE_UPGRADE_COST;
export function appearanceEffectPercent(appearance:AppearanceData,level:number):number{
 if(level<1||level>APPEARANCE_MAX_LEVEL||!appearance.proposedBonus)return 0;
 return Math.round(appearance.proposedBonus.percent*APPEARANCE_LEVEL_MULTIPLIER[level]*100)/100;
}
