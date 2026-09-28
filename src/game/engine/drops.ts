import type {GameState,Tower,Monster} from '../types';
import {CONFIG,COMBAT,TOWERS,tierOf} from '../data/config';
import {log} from './state';
import {awardEquippedMastery} from './gearMastery';
import {IRON_T1_MONSTER_BY_ID,ironFloorContent} from '../data/ironSpire';
import {RED_T1_MONSTER_BY_ID,redFloorContent} from '../data/redFang';
import {CRYSTAL_T1_MONSTER_BY_ID,crystalFloorContent} from '../data/crystalTower';
import {KALEON_T1_MONSTER_BY_ID,kaleonFloorContent} from '../data/kaleon';
import {rollIronEnhancementStoneDrop,rollIronEquipmentDrop} from '../data/equipmentDrops';
import {EQUIPMENT_DEFINITIONS} from '../data/equipment';

export function monsterFor(tower:Tower,floor:number,rng:()=>number=()=>0):Monster {
  const baseHp=COMBAT.monsterHp+(floor-1)*COMBAT.hpPerFloor;
  const baseAttack=COMBAT.monsterAttack+(floor-1)*COMBAT.attackPerFloor;
  const baseSpeed=COMBAT.monsterSpeed+floor*COMBAT.speedPerFloor;
  const pool=tower==='ore'&&floor<=10?ironFloorContent(floor)?.normalPool:
    tower==='leather'&&floor<=10?redFloorContent(floor)?.normalPool:
    tower==='gem'&&floor<=10?crystalFloorContent(floor)?.normalPool:
    tower==='kaleon'&&floor<=10?kaleonFloorContent(floor)?.normalPool:null;
  const id=pool?.length?pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))]:undefined;
  const content=id?(tower==='ore'?IRON_T1_MONSTER_BY_ID[id]:tower==='leather'?RED_T1_MONSTER_BY_ID[id]:tower==='gem'?CRYSTAL_T1_MONSTER_BY_ID[id]:tower==='kaleon'?KALEON_T1_MONSTER_BY_ID[id]:undefined):undefined;
  const hp=Math.round(baseHp*(content?.hpMultiplier??1));
  return {definitionId:content?.id??tower+':default',name:content?.displayName??TOWERS[tower].monster,hp,currentHp:hp,attack:baseAttack*(content?.attackMultiplier??1),defense:COMBAT.monsterDefense+(floor-1)*COMBAT.defensePerFloor,speed:baseSpeed*(content?.speedMultiplier??1),skillPower:1};
}

export function reward(s:GameState,rng:()=>number=Math.random,equipmentRng:()=>number=Math.random,stoneRng:()=>number=Math.random){
  const e=s.expedition;
  if(!e)return;
  const tier=tierOf(e.floor),silver=COMBAT.silverBase+e.floor*COMBAT.silverPerFloor;
  e.kills++;
  awardEquippedMastery(s);
  e.loot.silver+=silver;
  e.loot.materials[e.tower][tier-1]+=COMBAT.materialAmount;
  log(s,e.monster.name+' 처치! '+tier+'T '+TOWERS[e.tower].material+' ×'+COMBAT.materialAmount+' · Silver +'+silver+' (원정 임시 보관)');
  if(e.floor<CONFIG.maxFloor&&rng()<CONFIG.ticketChance){
    e.loot.tickets[e.tower][e.floor]++;
    log(s,(e.floor+1)+'층 입장권 획득 · 안전 귀환 후 보관');
  }
  if(e.tower==='ore'){
    const boss=e.events.activeBossId!==null;
    const drop=rollIronEquipmentDrop(e.floor,e.monster.definitionId??'',boss,equipmentRng);
    if(drop){
      const item={id:'equipment-'+(++s.nextId),...drop};
      (e.loot.equipment??=[]).push(item);
      const gradeName={common:'일반',uncommon:'고급',rare:'희귀',heroic:'영웅',legendary:'전설'}[item.grade];
      log(s,gradeName+' '+EQUIPMENT_DEFINITIONS[item.kind].name+' +0 획득 · 안전 귀환 후 보관');
    }
    const stones=rollIronEnhancementStoneDrop(e.floor,boss,stoneRng);
    if(stones>0){
      e.loot.items.enhancement_stone=(e.loot.items.enhancement_stone??0)+stones;
      log(s,'강화석 ×'+stones+' 획득 · 안전 귀환 후 보관');
    }
  }
}
