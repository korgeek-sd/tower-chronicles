import type {GameState,Tower} from '../types';
import {towerIds,tierOf,isValidTowerFloor} from '../data/config';
import {ironFloorContent} from '../data/ironSpire';
import {redFloorContent} from '../data/redFang';
import {crystalFloorContent} from '../data/crystalTower';
import {kaleonFloorContent} from '../data/kaleon';

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
