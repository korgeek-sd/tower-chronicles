export interface MonsterContent {
  id:string;displayName:string;role:'normal'|'swift'|'reward'|'elite'|'boss';graphicId:string;boss:boolean;
  hpMultiplier:number;attackMultiplier:number;speedMultiplier:number;silverMultiplier:number;
}
export interface FloorContent {normalPool:string[];bossId?:string}

export const LEATHER_T1_MONSTERS:MonsterContent[]=[
  {id:'wild_boar',displayName:'황야 멧돼지',role:'normal',graphicId:'wild_boar',boss:false,hpMultiplier:1,attackMultiplier:1,speedMultiplier:1,silverMultiplier:1},
  {id:'pack_stalker',displayName:'무리 추적자',role:'swift',graphicId:'pack_stalker',boss:false,hpMultiplier:.85,attackMultiplier:1.15,speedMultiplier:1.25,silverMultiplier:1.08},
  {id:'ritual_scarred',displayName:'의식의 상처입은 자',role:'elite',graphicId:'ritual_scarred',boss:false,hpMultiplier:1.3,attackMultiplier:.95,speedMultiplier:.8,silverMultiplier:1.12},
  {id:'scavenger_hyena',displayName:'청소부 하이에나',role:'reward',graphicId:'scavenger_hyena',boss:false,hpMultiplier:.9,attackMultiplier:.92,speedMultiplier:.98,silverMultiplier:1.15},
  {id:'alpha_maw',displayName:'알파의 아가리',role:'elite',graphicId:'alpha_maw',boss:false,hpMultiplier:1.45,attackMultiplier:1.1,speedMultiplier:.75,silverMultiplier:1.18},
];

export const LEATHER_T1_MONSTER_BY_ID=Object.fromEntries(LEATHER_T1_MONSTERS.map(m=>[m.id,m])) as Record<string,MonsterContent>;
export const LEATHER_NORMAL_POOL=['wild_boar','pack_stalker','ritual_scarred','scavenger_hyena','alpha_maw'];

/** Boss slots 6-10 assigned in order per worldbuilding. */
export const LEATHER_BOSS_SLOTS={
  6:{name:'핏갈기 추적자',bossId:'blood_maned_tracker'},
  7:{name:'붉은턱 가죽포식자',bossId:'red_jawed_predator'},
  8:{name:'송곳니 무리어미',bossId:'fang_pack_mother'},
  9:{name:'성소 발톱주교',bossId:'sanctuary_claw_bishop'},
  10:{name:'적아의 주인',bossId:'lord_of_red_fangs'}
} as const;
export const LEATHER_BOSS_STATS:Record<string,{hpMultiplier:number;attackMultiplier:number;defenseBonus:number;speedMultiplier:number}>={
  blood_maned_tracker:{hpMultiplier:3.5,attackMultiplier:1.4,defenseBonus:2,speedMultiplier:.88},
  red_jawed_predator:{hpMultiplier:4.2,attackMultiplier:1.55,defenseBonus:3,speedMultiplier:.92},
  fang_pack_mother:{hpMultiplier:4.9,attackMultiplier:1.65,defenseBonus:4,speedMultiplier:1},
  sanctuary_claw_bishop:{hpMultiplier:5.7,attackMultiplier:1.8,defenseBonus:5,speedMultiplier:.95},
  lord_of_red_fangs:{hpMultiplier:6.8,attackMultiplier:2.05,defenseBonus:7,speedMultiplier:.9}
};

const floor=(normalPool:string[],bossId?:string):FloorContent=>({normalPool,bossId});
export const LEATHER_T1_FLOORS:Record<number,FloorContent>=Object.fromEntries(Array.from({length:10},(_,index)=>{
  const floorNumber=index+1,slot=LEATHER_BOSS_SLOTS[floorNumber as keyof typeof LEATHER_BOSS_SLOTS];
  return [floorNumber,floor([...LEATHER_NORMAL_POOL],slot?.bossId??undefined)];
})) as Record<number,FloorContent>;
export const leatherFloorContent=(floorNumber:number)=>LEATHER_T1_FLOORS[floorNumber];