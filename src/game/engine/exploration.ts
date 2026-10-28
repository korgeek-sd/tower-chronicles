import type {GameState,Tower} from '../types';
import {towerIds,tierOf,SKILLS,potionIds,generalPotionIds,CONFIG,isValidTowerFloor} from '../data/config';
import {ironFloorContent} from '../data/ironSpire';
import {redFloorContent} from '../data/redFang';
import {crystalFloorContent} from '../data/crystalTower';
import {kaleonFloorContent} from '../data/kaleon';
import {itemSlot} from './state';

export const contentReady=(tower:Tower,floor:number)=>
 tower==='ore'?!!ironFloorContent(floor)?.normalPool.length:
 tower==='leather'?!!redFloorContent(floor)?.normalPool.length:
 tower==='gem'?!!crystalFloorContent(floor)?.normalPool.length:
 tower==='kaleon'?!!kaleonFloorContent(floor)?.normalPool.length:false;
export const tierUnlocked=(s:GameState,tower:Tower,tier:number)=>tier>=1&&tier<=5&&Number.isInteger(tier)&&s.exploration.unlockedTier[tower]>=tier;
export type EntryStatus='READY'|'IN_EXPEDITION'|'COMING_SOON'|'LOCKED'|'NO_PASS'|'INVALID';
export const ENTRY_LABEL:Record<EntryStatus,string>={READY:'탐사 준비',IN_EXPEDITION:'현재 원정 중',COMING_SOON:'준비 중',LOCKED:'잠김',NO_PASS:'입장권 없음',INVALID:'잘못된 탐사 구역'};
export function entryStatus(s:GameState,tower:Tower,floor:number):EntryStatus{
 if(s.expedition)return 'IN_EXPEDITION';
 if(!towerIds.includes(tower)||!isValidTowerFloor(floor))return 'INVALID';
 if(!contentReady(tower,floor))return 'COMING_SOON';
 if(!tierUnlocked(s,tower,tierOf(floor)))return 'LOCKED';
 return Number.isSafeInteger(s.tickets[tower][floor-1])&&s.tickets[tower][floor-1]>0?'READY':'NO_PASS';
}
export function setupError(s:GameState):string|null{
 for(const [slot,id] of Object.entries(s.equipped)){if(id===null)continue;const item=s.items.find(i=>i.id===id);if(!item||itemSlot(item.kind)!==slot)return '장비 설정을 확인하세요.';}
 if(s.skills.length!==3||s.skills.some(id=>id!==null&&(!s.learned.includes(id)||!SKILLS.some(k=>k.id===id)))||new Set(s.skills.filter(Boolean)).size!==s.skills.filter(Boolean).length)return '스킬 설정을 확인하세요.';
 if(potionIds.some(p=>!Number.isSafeInteger(s.loadout[p])||s.loadout[p]<0||s.loadout[p]>s.potions[p]))return '창고의 포션 수량을 확인하세요.';
 if(generalPotionIds.reduce((sum,p)=>sum+s.loadout[p],0)>CONFIG.generalPotionLimit)return `일반 회복 포션은 합쳐서 ${CONFIG.generalPotionLimit}개까지 가져갈 수 있습니다.`;
 if(s.loadout.revival>CONFIG.revivalPotionLimit)return `회생 포션은 ${CONFIG.revivalPotionLimit}개까지만 가져갈 수 있습니다.`;
 if(![0,30,50,70].includes(s.threshold))return '자동 포션 설정을 확인하세요.';
 return null;
}
