import {rollHuntingEquipment} from './equipmentDrops';
import type {EquipmentItem,Tower} from '../types';
export type HuntMapId='plains'|'forest'|'mine'|'fortress'|'ruins';
export const VITALITY_CAP=100,VITALITY_INTERVAL=300000;
export const HUNT_MAPS=[
 {id:'plains' as const,name:'외곽 평야',recommendedLevel:'1–19',tower:'leather' as Tower,monsterId:'hide_gnawer',monsterName:'가죽 갉는 하이에나',hp:90,attack:12,defense:5,silver:1000,silverMax:1200,exp:100,materialName:'1T 가죽'},
 {id:'forest' as const,name:'어두운 숲',recommendedLevel:'20–39',tower:'leather' as Tower,monsterId:'thorn_jackal',monsterName:'가시 자칼',hp:130,attack:18,defense:8,silver:1600,silverMax:2000,exp:250,materialName:'1T 가죽'},
 {id:'mine' as const,name:'폐광',recommendedLevel:'40–59',tower:'ore' as Tower,monsterId:'goblin_miner',monsterName:'고블린 광부',hp:180,attack:24,defense:14,silver:2500,silverMax:3100,exp:600,materialName:'1T 철광석'},
 {id:'fortress' as const,name:'무너진 성채',recommendedLevel:'60–79',tower:'leather' as Tower,monsterId:'pack_vanguard',monsterName:'무리 선봉',hp:250,attack:32,defense:20,silver:3800,silverMax:4600,exp:1400,materialName:'1T 가죽'},
 {id:'ruins' as const,name:'심층 유적',recommendedLevel:'80–100',tower:'leather' as Tower,monsterId:'fang_nest',monsterName:'송곳니 둥지',hp:340,attack:42,defense:28,silver:5500,silverMax:6500,exp:3000,materialName:'1T 가죽'},
];
/** Current combat uses six stats; legacy expedition Stats remains save-compatible. */
export interface CombatStats {hp:number;attack:number;defense:number;critChance:number;critDamage:number;armorPenetration:number}
export type CombatInput=Pick<CombatStats,'hp'|'attack'|'defense'> & Partial<CombatStats>;
export function combatStats(input:CombatInput):CombatStats {
 const finite=(n:number|undefined,fallback:number)=>Number.isFinite(n)?n!:fallback;
 return {hp:Math.max(1,finite(input.hp,1)),attack:Math.max(0,finite(input.attack,0)),defense:Math.max(0,finite(input.defense,0)),critChance:Math.max(0,Math.min(1,finite(input.critChance,.05))),critDamage:Math.max(1,finite(input.critDamage,1.5)),armorPenetration:Math.max(0,Math.min(1,finite(input.armorPenetration,0)))};
}
export interface HuntTurn {turn:number;lines:string[];playerHp:number;monsterHp:number}
export interface HuntResult {equipment?:EquipmentItem|null;startHp?:number;recoveredHp?:number;potionsUsed?:number;requestId?:string;mapId:HuntMapId;outcome:'victory'|'defeat';player:CombatStats;playerHp:number;monsterHp:number;turns:HuntTurn[];silver:number;exp:number;mastery:number;materialCount:number;createdAt:number}
export const HUNT_SKILLS=[{id:'heavy',name:'강타',description:'공격력 180% 피해 · 3턴마다 사용'},{id:'guard',name:'방어',description:'HP 50% 이하 · 이번 턴 받는 피해 50% 감소 · 4턴마다 사용'},{id:'quick',name:'속공',description:'공격력 120% 피해 · 2턴마다 사용'}];
export interface HuntingState {currentHp?:number|null;maxHp?:number|null;potions?:number;foodTurns?:Partial<Record<'attack_food'|'defense_food'|'experience_food',number>>;skills:string[];vitality:number;recoveredAt:number;experience:number;mastery:number;lastResult:HuntResult|null}
export const initialHuntingState=(now=Date.now()):HuntingState=>({skills:['heavy','guard','quick'],vitality:100,recoveredAt:now,experience:0,mastery:0,lastResult:null});
export function recoverVitality(state:HuntingState,now:number):HuntingState {
 const elapsed=Math.max(0,now-state.recoveredAt),ticks=Math.floor(elapsed/VITALITY_INTERVAL);
 const vitality=Math.min(VITALITY_CAP,state.vitality+ticks);
 return {...state,vitality,recoveredAt:vitality===VITALITY_CAP?Math.max(now,state.recoveredAt):state.recoveredAt+ticks*VITALITY_INTERVAL};
}
/** Confirmed long-term curve: requirement for level L -> L+1. */
export function huntingExperienceToNextLevel(level:number):number {
 if(!Number.isInteger(level)||level<1||level>=100)return 0;
 if(level<20)return 100+(level-1)*280;
 if(level<40)return 15000+(level-20)*1700;
 if(level<60)return 120000+(level-40)*12600;
 if(level<80)return 800000+(level-60)*63000;
 if(level<90)return 5000000+(level-80)*550000;
 return 10000000+(level-90)*700000;
}
const thresholds=[0,0];
for(let level=1;level<100;level++)thresholds[level+1]=thresholds[level]+huntingExperienceToNextLevel(level);
export const huntingExperienceForLevel=(level:number)=>thresholds[Math.max(1,Math.min(100,Math.floor(Number.isFinite(level)?level:1)))];
export function huntingLevel(exp:number):number {
 const total=Number.isFinite(exp)?Math.max(0,exp):0;
 let level=1;while(level<100&&total>=thresholds[level+1])level++;
 return level;
}
export function huntingProgress(experience:number){
 const total=Number.isFinite(experience)?Math.max(0,experience):0,level=huntingLevel(total);
 return {level,exp:level===100?0:total-thresholds[level],nextExp:huntingExperienceToNextLevel(level)};
}
export const damage=(attack:number,defense:number,multiplier=1,armorPenetration=0)=>Math.max(1,Math.floor(attack*multiplier*100/(100+Math.max(0,defense)*(1-Math.max(0,Math.min(1,armorPenetration))))));
/** Guest-only resolver. Online results always originate in hunt_once. */
export function resolveHunt(before:HuntingState,mapId:HuntMapId,input:CombatInput,skills:readonly (string|null)[],now=Date.now(),rng:()=>number=Math.random){
 const map=HUNT_MAPS.find(m=>m.id===mapId);if(!map)throw Error('알 수 없는 지역입니다.');
 const state=recoverVitality(before,now);if(state.vitality<1)throw Error('활력이 부족합니다.');
 const player=combatStats(input),foods={...state.foodTurns};
 if((foods.attack_food??0)>0)player.attack*=1.1;
 if((foods.defense_food??0)>0)player.defense*=1.1;
 let potions=Math.max(0,Math.floor(state.potions??0));
 let hp=Math.max(1,Math.min(player.hp,state.currentHp??player.hp));
 const prePotions=Math.min(potions,Math.ceil(player.hp-hp));potions-=prePotions;hp=Math.min(player.hp,hp+prePotions);
 const startHp=hp;
 let mhp=map.hp;const turns:HuntTurn[]=[],cooldowns:Record<string,number>={};
 for(let turn=1;turn<=100&&hp>0&&mhp>0;turn++){
  const lines:string[]=[];let guard=false;
  const skill=skills.find(id=>id&&['heavy','guard','quick'].includes(id)&&!(cooldowns[id]>turn)&&(id!=='guard'||hp/player.hp<=.5));
  if(skill==='guard'){guard=true;cooldowns.guard=turn+4;lines.push('탐사자의 방어! 이번 턴 피해 50% 감소');}
  else if(skill) {const mult=skill==='heavy'?1.8:skill==='quick'?1.2:1,critical=rng()<(player.critChance??.05),hit=damage(player.attack,map.defense,mult*(critical?player.critDamage:1),player.armorPenetration);mhp=Math.max(0,mhp-hit);if(skill)cooldowns[skill]=turn+(skill==='heavy'?3:2);lines.push(`탐사자의 ${skill==='heavy'?'강타':skill==='quick'?'속공':'공격'}! ${hit} 피해${critical?' · 치명타':''}`);}
  else lines.push('탐사자의 대기 · 사용 가능한 스킬 없음');
  if(mhp>0){const hit=damage(map.attack,player.defense,guard?.5:1);hp=Math.max(0,hp-hit);lines.push(`${map.monsterName}의 공격! ${hit} 피해`);}
  turns.push({turn,lines,playerHp:hp,monsterHp:mhp});
 }
 const win=mhp===0&&hp>0;
 const postPotions=Math.min(potions,Math.ceil(player.hp-hp));potions-=postPotions;
 const recoveredHp=Math.max(1,Math.min(player.hp,hp+postPotions));
 for(const food of ['attack_food','defense_food','experience_food'] as const)foods[food]=Math.max(0,(foods[food]??0)-1);
 const draw=(size:number)=>Math.floor(Math.max(0,Math.min(1-Number.EPSILON,rng()))*size);
 const equipment=win?rollHuntingEquipment(mapId,draw(1000000),draw(9)):null;
 const result:HuntResult={equipment,startHp,recoveredHp,potionsUsed:prePotions+postPotions,mapId,outcome:win?'victory':'defeat',player:{...player},playerHp:hp,monsterHp:mhp,turns,silver:win?map.silver+Math.floor(Math.max(0,Math.min(1-Number.EPSILON,rng()))*(map.silverMax-map.silver+1)):0,exp:win?Math.floor(map.exp*((state.foodTurns?.experience_food??0)>0?1.1:1)):0,mastery:win?1:0,materialCount:win?1:0,createdAt:now};
 return {state:{...state,currentHp:recoveredHp,maxHp:player.hp,potions,foodTurns:foods,vitality:state.vitality-1,experience:state.experience+result.exp,mastery:state.mastery+result.mastery,lastResult:result},result};
}
