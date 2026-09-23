import {resolveEvent} from '../events/service';
import type {BossTracking,GameState,Monster,Tower} from '../types';
import {COMBAT} from '../data/config';
import {IRON_T1_MONSTER_BY_ID,IRON_T1_MONSTERS,ironFloorContent,IRON_BOSS_SLOTS,IRON_BOSS_STATS} from '../data/ironSpire';
import {RED_T1_MONSTER_BY_ID,redFloorContent,RED_BOSS_SLOTS,RED_BOSS_STATS} from '../data/redFang';
import {CRYSTAL_T1_MONSTER_BY_ID,crystalFloorContent,CRYSTAL_BOSS_SLOTS,CRYSTAL_BOSS_STATS} from '../data/crystalTower';

/** @deprecated Historical v0.1.8 values; current tuning lives in events/selector.ts. */
export const BOSS_TRACKING_BALANCE={gainPerKill:20,earlyEncounterChance:.12} as const;
export const initialBossTracking=():BossTracking=>({progress:0,pendingBossId:null,encounterReason:null,bossDefeated:false});
export const bossIdFor=(tower:Tower,floor:number):string|null=>
  tower==='ore'?ironFloorContent(floor)?.bossId??null:
  tower==='leather'?redFloorContent(floor)?.bossId??null:
  tower==='gem'?crystalFloorContent(floor)?.bossId??null:null;

export const bossById=(id:string)=>
  IRON_T1_MONSTER_BY_ID[id]??
  RED_T1_MONSTER_BY_ID[id]??
  CRYSTAL_T1_MONSTER_BY_ID[id]??
  (Object.values(IRON_BOSS_SLOTS).find(slot=>slot.bossId===id)?{id,displayName:Object.values(IRON_BOSS_SLOTS).find(slot=>slot.bossId===id)!.name,boss:true,...IRON_BOSS_STATS[id]}:undefined)??
  (Object.values(RED_BOSS_SLOTS).find(slot=>slot.bossId===id)?{id,displayName:Object.values(RED_BOSS_SLOTS).find(slot=>slot.bossId===id)!.name,boss:true,...RED_BOSS_STATS[id]}:undefined)??
  (Object.values(CRYSTAL_BOSS_SLOTS).find(slot=>slot.bossId===id)?{id,displayName:Object.values(CRYSTAL_BOSS_SLOTS).find(slot=>slot.bossId===id)!.name,boss:true,...CRYSTAL_BOSS_STATS[id]}:undefined);

export const bossIdByName=(name:string)=>IRON_T1_MONSTERS.find(m=>m.boss&&m.displayName===name)?.id??null;
export function bossMonsterFor(id:string,floor:number):Monster|null {
  const m=bossById(id);
  if(!m?.boss)return null;
  const hp=Math.round((COMBAT.monsterHp+(floor-1)*COMBAT.hpPerFloor)*m.hpMultiplier),defenseBonus=(m as {defenseBonus?:number}).defenseBonus??0;
  return {definitionId:m.id,name:m.displayName,hp,currentHp:hp,attack:(COMBAT.monsterAttack+(floor-1)*COMBAT.attackPerFloor)*m.attackMultiplier,defense:COMBAT.monsterDefense+(floor-1)*COMBAT.defensePerFloor+defenseBonus,speed:(COMBAT.monsterSpeed+floor*COMBAT.speedPerFloor)*m.speedMultiplier,skillPower:1};
}
/** @deprecated Victory now calls postBattle. Never roll twice through this old hook. */
export function advanceBossTracking(_s:GameState,_rng:()=>number=Math.random):void {}
/** @deprecated Kept for old integrations; uses the same event guards and resolver. */
export function challengeBoss(s:GameState):GameState {const p=s.expedition?.events.pendingEvent;return p?.bossId?resolveEvent(s,p.instanceId,'challenge'):s;}
export function declineBoss(s:GameState,_rng:()=>number=Math.random):GameState {const p=s.expedition?.events.pendingEvent;return p?.bossId?resolveEvent(s,p.instanceId,'skip'):s;}
