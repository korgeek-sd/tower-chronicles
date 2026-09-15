import type {GameState,Tower,Monster} from '../types';
import {CONFIG,COMBAT,TOWERS,tierOf} from '../data/config';
import {log} from './state';
import {awardEquippedMastery} from './gearMastery';
import {IRON_T1_MONSTER_BY_ID,ironFloorContent} from '../data/ironSpire';
export function monsterFor(tower:Tower,floor:number,rng:()=>number=()=>0):Monster {const baseHp=COMBAT.monsterHp+(floor-1)*COMBAT.hpPerFloor,baseAttack=COMBAT.monsterAttack+(floor-1)*COMBAT.attackPerFloor,baseSpeed=COMBAT.monsterSpeed+floor*COMBAT.speedPerFloor,pool=tower==='ore'&&floor<=10?ironFloorContent(floor)?.normalPool:null,content=pool?.length?IRON_T1_MONSTER_BY_ID[pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))]]:undefined,hp=Math.round(baseHp*(content?.hpMultiplier??1));return {definitionId:content?.id??tower+':default',name:content?.displayName??TOWERS[tower].monster,hp,currentHp:hp,attack:baseAttack*(content?.attackMultiplier??1),defense:COMBAT.monsterDefense+(floor-1)*COMBAT.defensePerFloor,speed:baseSpeed*(content?.speedMultiplier??1),skillPower:1};}
export function reward(s:GameState,rng:()=>number=Math.random){
  const e=s.expedition;
  if(!e)return;
  const tier=tierOf(e.floor),silver=COMBAT.silverBase+e.floor*COMBAT.silverPerFloor;
  e.kills++;
  awardEquippedMastery(s);
  e.loot.silver+=silver;
  e.loot.materials[e.tower][tier-1]+=COMBAT.materialAmount;
  log(s,e.monster.name+' 처치! '+tier+'T '+TOWERS[e.tower].material+' ×'+COMBAT.materialAmount+' · Silver +'+silver+' (원정 임시 보관)');
  if(e.floor<50&&rng()<CONFIG.ticketChance){
    e.loot.tickets[e.tower][e.floor]++;
    log(s,(e.floor+1)+'층 입장권 획득 · 안전 귀환 후 보관');
  }
  // Books remain tradeable counts, even for skills already learned.
  if(rng()<CONFIG.bookChance){
    e.loot.skillBooks.execute=(e.loot.skillBooks.execute||0)+1;
    log(s,'[처형] 스킬북 획득 · 원정 임시 보관 (미학습)');
  }
}



