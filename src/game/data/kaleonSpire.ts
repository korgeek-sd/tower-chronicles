import type {MonsterContent,FloorContent} from './ironSpire';

export const KALEON_T1_MONSTERS:MonsterContent[]=[
 {id:'verdant_penitent',displayName:'녹흔 순례자',role:'normal',graphicId:'verdant_penitent',boss:false,hpMultiplier:1,attackMultiplier:1,speedMultiplier:1,silverMultiplier:1},
 {id:'anointed_censer_bearer',displayName:'성유 향로지기',role:'reward',graphicId:'anointed_censer_bearer',boss:false,hpMultiplier:.92,attackMultiplier:.9,speedMultiplier:.94,silverMultiplier:1.08},
 {id:'vicarious_armor_monk',displayName:'대속 갑주수도사',role:'elite',graphicId:'vicarious_armor_monk',boss:false,hpMultiplier:1.32,attackMultiplier:.96,speedMultiplier:.82,silverMultiplier:1.12},
 {id:'confession_binder',displayName:'고해 속박자',role:'normal',graphicId:'confession_binder',boss:false,hpMultiplier:1.08,attackMultiplier:1.12,speedMultiplier:.94,silverMultiplier:1.06},
 {id:'stigmata_reaper',displayName:'성흔 수확자',role:'swift',graphicId:'stigmata_reaper',boss:false,hpMultiplier:.84,attackMultiplier:1.24,speedMultiplier:1.2,silverMultiplier:1.12}
];

export const KALEON_T1_MONSTER_BY_ID=Object.fromEntries(KALEON_T1_MONSTERS.map(m=>[m.id,m])) as Record<string,MonsterContent>;
export const KALEON_NORMAL_POOL=['verdant_penitent','anointed_censer_bearer','vicarious_armor_monk','confession_binder','stigmata_reaper'];
export const KALEON_BOSS_SLOTS={
 6:{name:'성흔을 품은 치유사',bossId:'stigmata_healer'},
 7:{name:'대속 십자가 운반자',bossId:'atonement_cross_bearer'},
 8:{name:'희생의 집전관',bossId:'sacrament_executioner'},
 9:{name:'거짓 구원의 사도',bossId:'false_salvation_apostle'},
 10:{name:'칼레온, 녹빛 구원자',bossId:'kaleon_green_messiah'}
} as const;
export const KALEON_BOSS_STATS:Record<string,{hpMultiplier:number;attackMultiplier:number;defenseBonus:number;speedMultiplier:number}>={
 stigmata_healer:{hpMultiplier:3.5,attackMultiplier:1.35,defenseBonus:1,speedMultiplier:.92},
 atonement_cross_bearer:{hpMultiplier:4.2,attackMultiplier:1.5,defenseBonus:4,speedMultiplier:.78},
 sacrament_executioner:{hpMultiplier:4.9,attackMultiplier:1.65,defenseBonus:5,speedMultiplier:.9},
 false_salvation_apostle:{hpMultiplier:5.7,attackMultiplier:1.8,defenseBonus:6,speedMultiplier:1},
 kaleon_green_messiah:{hpMultiplier:6.8,attackMultiplier:2.05,defenseBonus:8,speedMultiplier:.95}
};
const floor=(normalPool:string[],bossId?:string):FloorContent=>({normalPool,bossId});
export const KALEON_T1_FLOORS:Record<number,FloorContent>=Object.fromEntries(Array.from({length:10},(_,index)=>{
 const floorNumber=index+1,slot=KALEON_BOSS_SLOTS[floorNumber as keyof typeof KALEON_BOSS_SLOTS];
 return [floorNumber,floor([...KALEON_NORMAL_POOL],slot?.bossId??undefined)];
})) as Record<number,FloorContent>;
export const kaleonFloorContent=(floorNumber:number)=>KALEON_T1_FLOORS[floorNumber];
