import {lifeMasteryLevel,LIFE_MASTERY_LEVEL_XP,LIFE_MASTERY_LEVEL_BONUS,LIFE_MASTERY_MAX_XP} from '../../game/life/crafting';
import type {HuntingState} from '../../game/hunting/model';
import {getHuntingState} from '../../online/hunting';
import {getVillageLife,type VillageLifeState} from '../../online/villageLife';
import type {GameplayLease} from '../../online/gameSession';

/** Display-only progress; the existing gameplay tables remain the authority. */
export function growthMasteryProgress(value:number|undefined){
 if(value===undefined||!Number.isFinite(value))return null;
 const xp=Math.max(0,Math.min(LIFE_MASTERY_MAX_XP,Math.floor(value))),level=lifeMasteryLevel(xp);
 const next=LIFE_MASTERY_LEVEL_XP[level],start=LIFE_MASTERY_LEVEL_XP[level-1];
 const required=next===undefined?0:next-start,earned=required===0?0:xp-start;
 return {level,earned,required,remaining:Math.max(0,required-earned),percent:required===0?100:Math.floor(earned/required*100),bonus:LIFE_MASTERY_LEVEL_BONUS[level-1],nextBonus:LIFE_MASTERY_LEVEL_BONUS[level]??null};
}
export async function loadGrowthRecord(
 lease:GameplayLease,
 readHunting:(lease:GameplayLease)=>Promise<HuntingState>=getHuntingState,
 readLife:(lease:GameplayLease)=>Promise<VillageLifeState>=getVillageLife,
){
 const [hunt,life]=await Promise.allSettled([readHunting(lease),readLife(lease)]);
 return {
  hunting:hunt.status==='fulfilled'?hunt.value:null,
  life:life.status==='fulfilled'?life.value:null,
  huntingError:hunt.status==='rejected'?'캐릭터 정보를 불러오지 못했습니다.':'',
  lifeError:life.status==='rejected'?'생활 숙련도를 불러오지 못했습니다.':'',
 };
}
