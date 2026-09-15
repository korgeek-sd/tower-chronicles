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
export const IRON_T1_FLOORS:Record<number,FloorContent>={
  1:floor(['goblin_miner','cave_rat']),2:floor(['goblin_miner','cave_rat']),
  3:floor(['goblin_miner','mine_bat','cave_rat']),4:floor(['goblin_miner','mine_bat','cave_rat']),
  5:floor(['mine_bat','goblin_carrier','goblin_miner']),6:floor(['mine_bat','goblin_carrier','goblin_miner']),
  7:floor(['goblin_carrier','goblin_overseer','mine_bat']),8:floor(['goblin_carrier','goblin_overseer','mine_bat']),
  9:floor(['goblin_overseer','goblin_carrier']),
  10:floor(['goblin_overseer','goblin_carrier','mine_bat'],'mining_ogre')
};
export const ironFloorContent=(floorNumber:number)=>IRON_T1_FLOORS[floorNumber];
