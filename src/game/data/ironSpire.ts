export interface MonsterContent {
  id:string;displayName:string;role:'normal'|'swift'|'reward'|'elite'|'boss';graphicId:string;boss:boolean;
  hpMultiplier:number;attackMultiplier:number;speedMultiplier:number;silverMultiplier:number;
}
export interface FloorContent {normalPool:string[];bossId?:string}

export const IRON_T1_MONSTERS:MonsterContent[]=[
 {id:'goblin_miner',displayName:'고블린 광부',role:'normal',graphicId:'goblin_miner',boss:false,hpMultiplier:1,attackMultiplier:1,speedMultiplier:1,silverMultiplier:1},
 {id:'cave_rat',displayName:'동굴 쥐',role:'swift',graphicId:'cave_rat',boss:false,hpMultiplier:.72,attackMultiplier:.78,speedMultiplier:1.22,silverMultiplier:.85},
 {id:'mine_bat',displayName:'광산 박쥐',role:'swift',graphicId:'mine_bat',boss:false,hpMultiplier:.8,attackMultiplier:.9,speedMultiplier:1.32,silverMultiplier:.95},
 {id:'goblin_carrier',displayName:'고블린 운반꾼',role:'reward',graphicId:'goblin_carrier',boss:false,hpMultiplier:1.05,attackMultiplier:.95,speedMultiplier:.92,silverMultiplier:1.25},
 {id:'goblin_overseer',displayName:'고블린 감독관',role:'elite',graphicId:'goblin_overseer',boss:false,hpMultiplier:1.25,attackMultiplier:1.18,speedMultiplier:1.03,silverMultiplier:1.15},
 {id:'mining_ogre',displayName:'광산 오우거',role:'boss',graphicId:'mining_ogre',boss:true,hpMultiplier:3.2,attackMultiplier:1.75,speedMultiplier:.72,silverMultiplier:4}
];
export const IRON_T1_MONSTER_BY_ID=Object.fromEntries(IRON_T1_MONSTERS.map(m=>[m.id,m])) as Record<string,MonsterContent>;
export const ironMonsterByName=(name:string)=>IRON_T1_MONSTERS.find(m=>m.displayName===name);
const floor=(normalPool:string[],bossId?:string):FloorContent=>({normalPool,bossId});
/** One tower-wide normal pool. Floors only alter runtime stat scaling. */
export const IRON_NORMAL_POOL=['goblin_miner','cave_rat','mine_bat','goblin_carrier','goblin_overseer'];
/** Each 6–10F slot has its own encounter, pattern, art, and temporary reward. */
export const IRON_BOSS_SLOTS={6:{name:'쇄철턱 굴혈수',bossId:'iron_maw_burrower'},7:{name:'흑맥갑주 파쇄충',bossId:'black_vein_armor_breaker'},8:{name:'울림포식자',bossId:'echo_devourer'},9:{name:'심층 권양감독체',bossId:'deep_hoist_overseer'},10:{name:'철심 맥동체',bossId:'iron_core_pulsator'}} as const;
export const IRON_BOSS_STATS:Record<string,{hpMultiplier:number;attackMultiplier:number;defenseBonus:number;speedMultiplier:number}>={iron_maw_burrower:{hpMultiplier:3.4,attackMultiplier:1.45,defenseBonus:2,speedMultiplier:.88},black_vein_armor_breaker:{hpMultiplier:4.1,attackMultiplier:1.55,defenseBonus:4,speedMultiplier:.9},echo_devourer:{hpMultiplier:4.8,attackMultiplier:1.7,defenseBonus:5,speedMultiplier:1},deep_hoist_overseer:{hpMultiplier:5.6,attackMultiplier:1.82,defenseBonus:6,speedMultiplier:.92},iron_core_pulsator:{hpMultiplier:6.6,attackMultiplier:2,defenseBonus:8,speedMultiplier:.95}};
export const IRON_BOSS_REWARDS:Record<string,{silverBonus:number;materialBonus:number}>={iron_maw_burrower:{silverBonus:80,materialBonus:4},black_vein_armor_breaker:{silverBonus:105,materialBonus:5},echo_devourer:{silverBonus:135,materialBonus:6},deep_hoist_overseer:{silverBonus:170,materialBonus:7},iron_core_pulsator:{silverBonus:220,materialBonus:8}};
export const IRON_T1_FLOORS:Record<number,FloorContent>=Object.fromEntries(Array.from({length:10},(_,index)=>{
 const floorNumber=index+1,slot=IRON_BOSS_SLOTS[floorNumber as keyof typeof IRON_BOSS_SLOTS];
 return [floorNumber,floor([...IRON_NORMAL_POOL],slot?.bossId??undefined)];
})) as Record<number,FloorContent>;
export const ironFloorContent=(floorNumber:number)=>IRON_T1_FLOORS[floorNumber];
