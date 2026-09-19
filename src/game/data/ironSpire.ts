export interface MonsterContent {
  id:string;displayName:string;role:'normal'|'swift'|'reward'|'elite'|'boss';graphicId:string;boss:boolean;
  hpMultiplier:number;attackMultiplier:number;speedMultiplier:number;silverMultiplier:number;
}
export interface FloorContent {normalPool:string[];bossId?:string}

export const IRON_T1_MONSTERS:MonsterContent[]=[
 {id:'muan_miner',displayName:'무안광부',role:'normal',graphicId:'muan_miner',boss:false,hpMultiplier:.9,attackMultiplier:.95,speedMultiplier:1.05,silverMultiplier:1},
 {id:'tunnel_blocker',displayName:'갱도 봉쇄체',role:'normal',graphicId:'tunnel_blocker',boss:false,hpMultiplier:1.2,attackMultiplier:1,speedMultiplier:.9,silverMultiplier:1},
 {id:'goblin_overseer',displayName:'고블린 감독관',role:'normal',graphicId:'goblin_overseer',boss:false,hpMultiplier:1,attackMultiplier:1,speedMultiplier:1,silverMultiplier:1},
 {id:'goblin_miner',displayName:'고블린 광부',role:'normal',graphicId:'goblin_miner',boss:false,hpMultiplier:1,attackMultiplier:1,speedMultiplier:1,silverMultiplier:1},
 {id:'goblin_carrier',displayName:'고블린 운반꾼',role:'normal',graphicId:'goblin_carrier',boss:false,hpMultiplier:1,attackMultiplier:1,speedMultiplier:.95,silverMultiplier:1},
 {id:'hollow_minecart',displayName:'공허한 광차',role:'normal',graphicId:'hollow_minecart',boss:false,hpMultiplier:1.15,attackMultiplier:1.05,speedMultiplier:.85,silverMultiplier:1},
 {id:'vein_cutter',displayName:'광맥 절삭기',role:'normal',graphicId:'vein_cutter',boss:false,hpMultiplier:1,attackMultiplier:1,speedMultiplier:1,silverMultiplier:1},
 {id:'vein_probe',displayName:'광맥 탐침체',role:'normal',graphicId:'vein_probe',boss:false,hpMultiplier:.95,attackMultiplier:.95,speedMultiplier:1.05,silverMultiplier:1},
 {id:'mine_bat',displayName:'광산 박쥐',role:'normal',graphicId:'mine_bat',boss:false,hpMultiplier:.85,attackMultiplier:.9,speedMultiplier:1.2,silverMultiplier:1},
 {id:'ore_sorter',displayName:'맥석 선별체',role:'normal',graphicId:'ore_sorter',boss:false,hpMultiplier:1,attackMultiplier:.95,speedMultiplier:1,silverMultiplier:1},
 {id:'mutant_rat',displayName:'변이된 동굴쥐',role:'normal',graphicId:'mutant_rat',boss:false,hpMultiplier:.9,attackMultiplier:.95,speedMultiplier:1.15,silverMultiplier:1},
 {id:'deep_overseer',displayName:'심층 감독체',role:'normal',graphicId:'deep_overseer',boss:false,hpMultiplier:1.05,attackMultiplier:1.05,speedMultiplier:.95,silverMultiplier:1},
 {id:'deep_hoist',displayName:'심층 권양체',role:'normal',graphicId:'deep_hoist',boss:false,hpMultiplier:1.25,attackMultiplier:1.1,speedMultiplier:.8,silverMultiplier:1},
 {id:'iron_carrier',displayName:'철맥 운반체',role:'normal',graphicId:'iron_carrier',boss:false,hpMultiplier:1.2,attackMultiplier:1.05,speedMultiplier:.85,silverMultiplier:1},
 {id:'waste_compactor',displayName:'폐석 압착체',role:'normal',graphicId:'waste_compactor',boss:false,hpMultiplier:1.15,attackMultiplier:1.05,speedMultiplier:.9,silverMultiplier:1},
 {id:'mining_ogre',displayName:'광산 오우거',role:'boss',graphicId:'mining_ogre',boss:true,hpMultiplier:3.2,attackMultiplier:1.75,speedMultiplier:.72,silverMultiplier:4}
];export const IRON_T1_MONSTER_BY_ID=Object.fromEntries(IRON_T1_MONSTERS.map(m=>[m.id,m])) as Record<string,MonsterContent>;
export const ironMonsterByName=(name:string)=>IRON_T1_MONSTERS.find(m=>m.displayName===name);
const floor=(normalPool:string[],bossId?:string):FloorContent=>({normalPool,bossId});
/** One tower-wide normal pool. Floors only alter runtime stat scaling. */
export const IRON_NORMAL_POOL=IRON_T1_MONSTERS.filter(monster=>!monster.boss).map(monster=>monster.id);
/** Content slots are explicit: only 10F has an authored boss definition today. */
export const IRON_BOSS_SLOTS={6:{name:'쇄철턱 굴혈수',bossId:'iron_maw_burrower'},7:{name:'흑맥갑주 파쇄충',bossId:'black_vein_armor_breaker'},8:{name:'울림포식자',bossId:'echo_devourer'},9:{name:'심층 권양감독체',bossId:'deep_hoist_overseer'},10:{name:'철심 맥동체',bossId:'iron_core_pulsator'}} as const;
export const IRON_BOSS_STATS:Record<string,{hpMultiplier:number;attackMultiplier:number;defenseBonus:number;speedMultiplier:number}>={iron_maw_burrower:{hpMultiplier:3.4,attackMultiplier:1.45,defenseBonus:2,speedMultiplier:.88},black_vein_armor_breaker:{hpMultiplier:4.1,attackMultiplier:1.55,defenseBonus:4,speedMultiplier:.9},echo_devourer:{hpMultiplier:4.8,attackMultiplier:1.7,defenseBonus:5,speedMultiplier:1},deep_hoist_overseer:{hpMultiplier:5.6,attackMultiplier:1.82,defenseBonus:6,speedMultiplier:.92},iron_core_pulsator:{hpMultiplier:6.6,attackMultiplier:2,defenseBonus:8,speedMultiplier:.95}};
export const IRON_T1_FLOORS:Record<number,FloorContent>=Object.fromEntries(Array.from({length:10},(_,index)=>{
 const floorNumber=index+1,slot=IRON_BOSS_SLOTS[floorNumber as keyof typeof IRON_BOSS_SLOTS];
 return [floorNumber,floor([...IRON_NORMAL_POOL],slot?.bossId??undefined)];
})) as Record<number,FloorContent>;
export const ironFloorContent=(floorNumber:number)=>IRON_T1_FLOORS[floorNumber];
