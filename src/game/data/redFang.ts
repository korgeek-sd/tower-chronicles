export interface MonsterContent {
  id:string;displayName:string;role:'normal'|'swift'|'reward'|'elite'|'boss';graphicId:string;boss:boolean;
  hpMultiplier:number;attackMultiplier:number;speedMultiplier:number;silverMultiplier:number;
}
export interface FloorContent {normalPool:string[];bossId?:string}

export const RED_T1_MONSTERS:MonsterContent[]=[
 {id:'wasteland_boar',displayName:'황야 멧돼지',role:'normal',graphicId:'wasteland_boar',boss:false,hpMultiplier:1,attackMultiplier:1,speedMultiplier:1,silverMultiplier:1},
 {id:'thorn_jackal',displayName:'가시 자칼',role:'swift',graphicId:'thorn_jackal',boss:false,hpMultiplier:.72,attackMultiplier:.78,speedMultiplier:1.25,silverMultiplier:.85},
 {id:'carrion_vulture',displayName:'썩은날 독수리',role:'swift',graphicId:'carrion_vulture',boss:false,hpMultiplier:.78,attackMultiplier:.88,speedMultiplier:1.35,silverMultiplier:.95},
 {id:'hide_gnawer',displayName:'가죽 갉는 하이에나',role:'reward',graphicId:'hide_gnawer',boss:false,hpMultiplier:1.05,attackMultiplier:.95,speedMultiplier:.92,silverMultiplier:1.25},
 {id:'pack_vanguard',displayName:'무리 선봉',role:'elite',graphicId:'pack_vanguard',boss:false,hpMultiplier:1.25,attackMultiplier:1.18,speedMultiplier:1.05,silverMultiplier:1.15},
];
export const RED_T1_MONSTER_BY_ID=Object.fromEntries(RED_T1_MONSTERS.map(m=>[m.id,m])) as Record<string,MonsterContent>;
const floor=(normalPool:string[],bossId?:string):FloorContent=>({normalPool,bossId});
/** One tower-wide normal pool. Floors only alter runtime stat scaling. */
export const RED_NORMAL_POOL=['wasteland_boar','thorn_jackal','carrion_vulture','hide_gnawer','pack_vanguard'];
/** 6~10F boss slots. Order fixed per design. */
export const RED_BOSS_SLOTS={
 6:{name:'핏갈기 추적자',bossId:'bloodmane_tracker'},
 7:{name:'붉은턱 가죽포식자',bossId:'redjaw_hide_eater'},
 8:{name:'송곳니 무리어미',bossId:'fang_pack_matriarch'},
 9:{name:'성소 발톱주교',bossId:'sanctuary_talon_bishop'},
 10:{name:'적아의 주인',bossId:'lord_of_red_fang'}
} as const;
export const RED_BOSS_STATS:Record<string,{hpMultiplier:number;attackMultiplier:number;defenseBonus:number;speedMultiplier:number}>={
 bloodmane_tracker:{hpMultiplier:3.2,attackMultiplier:1.5,defenseBonus:2,speedMultiplier:1.02},
 redjaw_hide_eater:{hpMultiplier:3.9,attackMultiplier:1.6,defenseBonus:4,speedMultiplier:1},
 fang_pack_matriarch:{hpMultiplier:4.6,attackMultiplier:1.72,defenseBonus:5,speedMultiplier:1.05},
 sanctuary_talon_bishop:{hpMultiplier:5.4,attackMultiplier:1.85,defenseBonus:6,speedMultiplier:.98},
 lord_of_red_fang:{hpMultiplier:6.4,attackMultiplier:2.05,defenseBonus:8,speedMultiplier:1}
};
export const RED_T1_FLOORS:Record<number,FloorContent>=Object.fromEntries(Array.from({length:10},(_,index)=>{
 const floorNumber=index+1,slot=RED_BOSS_SLOTS[floorNumber as keyof typeof RED_BOSS_SLOTS];
 return [floorNumber,floor([...RED_NORMAL_POOL],slot?.bossId??undefined)];
})) as Record<number,FloorContent>;
export const redFloorContent=(floorNumber:number)=>RED_T1_FLOORS[floorNumber];
