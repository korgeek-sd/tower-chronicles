import type {GameState,Tower,Slot} from '../types';
import {towerIds,tierOf,SKILLS,potionIds,generalPotionIds,CONFIG,isValidTowerFloor} from '../data/config';
import {ironFloorContent} from '../data/ironSpire';
import {redFloorContent} from '../data/redFang';
import {crystalFloorContent} from '../data/crystalTower';
import {kaleonFloorContent} from '../data/kaleonSpire';
import {itemSlot} from './state';
import {enter} from './expedition';

export const REGIONS:Record<Tower,string[]>={ore:['폐광','붕괴한 광맥','녹슨 채굴광도','심층 용광 갱도','철맥의 심장부'],leather:['황혼의 외곽 초원','붉은결 수림','야성의 침수림','포식자의 협곡','붉은 송곳니의 심장부'],gem:['천광의 결정동','응축 수정림','공진의 회랑','중첩광정','천광의 심핵'],kaleon:['녹빛 약초원','안정의 수림','활성의 포자습원','자가연성림','녹빛 연성심원']};
export const RESOURCES:Record<Tower,string>={ore:'광석 · 무기 · 군수 자원',leather:'가죽 · 갑옷·신발 · 야수 자원',gem:'보석 · 장신구 · 희귀 자원',kaleon:'약재 · 포션 · 연금술 재료'};
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
/** The only UI entry point. Revalidates the live state before the atomic legacy transition. */
export function startExpedition(s:GameState,tower:Tower,floor:number):GameState{
 const status=entryStatus(s,tower,floor);
 if(status!=='READY')return {...s,notice:ENTRY_LABEL[status]};
 const error=setupError(s);if(error)return {...s,notice:error};
 return enter(s,tower,floor);
}

