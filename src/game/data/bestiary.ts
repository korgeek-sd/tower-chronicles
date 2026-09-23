import type {Tower} from '../types';
import {IRON_NORMAL_POOL,IRON_T1_MONSTER_BY_ID,IRON_BOSS_SLOTS,IRON_T1_FLOORS} from './ironSpire';
import {RED_NORMAL_POOL,RED_T1_MONSTER_BY_ID,RED_BOSS_SLOTS,RED_T1_FLOORS} from './redFang';
import {CRYSTAL_NORMAL_POOL,CRYSTAL_T1_MONSTER_BY_ID,CRYSTAL_BOSS_SLOTS,CRYSTAL_T1_FLOORS} from './crystalTower';

export interface BestiaryEntry {
  id:string;
  tower:Tower;
  name:string;
  boss:boolean;
  floorMin:number;
  floorMax:number;
  graphicId:string;
  definitionId:string;
}

function normalEntries(
  tower:Tower,
  pool:string[],
  byId:Record<string,{displayName:string;graphicId:string}>,
  floors:Record<number,{normalPool:string[]}>
):BestiaryEntry[]{
  return pool.map(id=>{
    const floorNumbers=Object.entries(floors).filter(([,floor])=>floor.normalPool.includes(id)).map(([floor])=>Number(floor));
    const content=byId[id];
    if(!content||!floorNumbers.length)throw Error('생물록 일반 몬스터 데이터 불일치: '+tower+'/'+id);
    return {id,tower,name:content.displayName,boss:false,floorMin:Math.min(...floorNumbers),floorMax:Math.max(...floorNumbers),graphicId:content.graphicId,definitionId:id};
  });
}

function bossEntries(tower:Tower,slots:Record<number,{name:string;bossId:string}>):BestiaryEntry[]{
  return Object.entries(slots).map(([floor,slot])=>({
    id:slot.bossId,
    tower,
    name:slot.name,
    boss:true,
    floorMin:Number(floor),
    floorMax:Number(floor),
    graphicId:slot.bossId,
    definitionId:slot.bossId,
  }));
}

export const BESTIARY_ENTRIES:BestiaryEntry[]=[
  ...normalEntries('ore',IRON_NORMAL_POOL,IRON_T1_MONSTER_BY_ID,IRON_T1_FLOORS),
  ...bossEntries('ore',IRON_BOSS_SLOTS as unknown as Record<number,{name:string;bossId:string}>),
  ...normalEntries('leather',RED_NORMAL_POOL,RED_T1_MONSTER_BY_ID,RED_T1_FLOORS),
  ...bossEntries('leather',RED_BOSS_SLOTS as unknown as Record<number,{name:string;bossId:string}>),
  ...normalEntries('gem',CRYSTAL_NORMAL_POOL,CRYSTAL_T1_MONSTER_BY_ID,CRYSTAL_T1_FLOORS),
  ...bossEntries('gem',CRYSTAL_BOSS_SLOTS as unknown as Record<number,{name:string;bossId:string}>),
];

const BY_ID=new Map(BESTIARY_ENTRIES.map(entry=>[entry.id,entry]));
export const bestiaryEntryById=(id:string)=>BY_ID.get(id);
export const bestiaryEntriesForTower=(tower:Tower)=>BESTIARY_ENTRIES.filter(entry=>entry.tower===tower);
export const bestiaryCountForTower=(tower:Tower)=>bestiaryEntriesForTower(tower).length;
export const bestiaryFloorLabel=(entry:BestiaryEntry)=>entry.floorMin===entry.floorMax?entry.floorMin+'F':entry.floorMin+'F ~ '+entry.floorMax+'F';
