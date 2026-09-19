import type {GameState,Tower,Monster} from '../types';
import {CONFIG,COMBAT,TOWERS,getMaterialGrade} from '../data/config';
import {log} from './state';
import {awardEquippedMastery} from './gearMastery';
import {IRON_T1_MONSTER_BY_ID,ironFloorContent} from '../data/ironSpire';
export function monsterFor(tower:Tower,floor:number,rng:()=>number=()=>0):Monster {const baseHp=COMBAT.monsterHp+(floor-1)*COMBAT.hpPerFloor,baseAttack=COMBAT.monsterAttack+(floor-1)*COMBAT.attackPerFloor,baseSpeed=COMBAT.monsterSpeed+floor*COMBAT.speedPerFloor,pool=tower==='ore'&&floor<=10?ironFloorContent(floor)?.normalPool:null,content=pool?.length?IRON_T1_MONSTER_BY_ID[pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))]]:undefined,hp=Math.round(baseHp*(content?.hpMultiplier??1));return {definitionId:content?.id??tower+':default',name:content?.displayName??TOWERS[tower].monster,hp,currentHp:hp,attack:baseAttack*(content?.attackMultiplier??1),defense:COMBAT.monsterDefense+(floor-1)*COMBAT.defensePerFloor,speed:baseSpeed*(content?.speedMultiplier??1),skillPower:1};}
export function reward(s:GameState,rng:()=>number=Math.random){
  const e=s.expedition;
  if(!e||e.rewardClaimed)return;
  const grade=getMaterialGrade(e.floor),silver=COMBAT.silverBase+e.floor*COMBAT.silverPerFloor;
  e.rewardClaimed=true;
  e.kills++;
  awardEquippedMastery(s);
  e.loot.silver+=silver;
  const roll=e.events.activeBossId?1:rng();
  const quantity=e.events.activeBossId?({6:5,7:5,8:6,9:6,10:8}[e.floor]??5):(COMBAT.materialAmount+(roll<.25?1:0));
  e.loot.materials[e.tower][grade-1]+=quantity;
  log(s,e.monster.name+' 처치! '+grade+'등급 '+TOWERS[e.tower].material+' ×'+quantity+' · Silver +'+silver+' (원정 임시 보관)');
  if(e.floor<CONFIG.maxFloor&&rng()<CONFIG.ticketChance){
    e.loot.tickets[e.tower][e.floor]++;
    log(s,(e.floor+1)+'층 입장권 획득 · 안전 귀환 후 보관');
  }
}
