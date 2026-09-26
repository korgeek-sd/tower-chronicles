export interface MonsterContent {
  id:string;displayName:string;role:'normal'|'swift'|'reward'|'elite'|'boss';graphicId:string;boss:boolean;
  hpMultiplier:number;attackMultiplier:number;speedMultiplier:number;silverMultiplier:number;
}
export interface FloorContent {normalPool:string[];bossId?:string}

export const KALEON_T1_MONSTERS:MonsterContent[]=[
 {id:'moss_spirit',displayName:'이끼 정령',role:'normal',graphicId:'moss_spirit',boss:false,hpMultiplier:1.08,attackMultiplier:.86,speedMultiplier:.92,silverMultiplier:1},
 {id:'spore_hound',displayName:'포자 사냥개',role:'swift',graphicId:'spore_hound',boss:false,hpMultiplier:.82,attackMultiplier:1.08,speedMultiplier:1.22,silverMultiplier:1},
 {id:'graft_stag',displayName:'접목뿔 사슴',role:'normal',graphicId:'graft_stag',boss:false,hpMultiplier:1.2,attackMultiplier:1.05,speedMultiplier:.9,silverMultiplier:1.08},
 {id:'blight_leech',displayName:'녹병 거머리',role:'reward',graphicId:'blight_leech',boss:false,hpMultiplier:.94,attackMultiplier:.92,speedMultiplier:.88,silverMultiplier:1.24},
 {id:'receptor_aberrant',displayName:'수용체 변이체',role:'elite',graphicId:'receptor_aberrant',boss:false,hpMultiplier:1.3,attackMultiplier:1.18,speedMultiplier:.98,silverMultiplier:1.18},
];
export const KALEON_T1_MONSTER_BY_ID=Object.fromEntries(KALEON_T1_MONSTERS.map(m=>[m.id,m])) as Record<string,MonsterContent>;
export const KALEON_NORMAL_POOL=KALEON_T1_MONSTERS.map(m=>m.id);

const floor=(normalPool:string[],bossId?:string):FloorContent=>({normalPool,bossId});
export const KALEON_BOSS_SLOTS={
 6:{name:'녹화된 수문장',bossId:'greenwrought_gatekeeper'},
 7:{name:'과잉재생 포식체',bossId:'overgrowth_regenerator'},
 8:{name:'전이실험체 C-17',bossId:'transfer_subject_c17'},
 9:{name:'대속의 원형체',bossId:'atonement_prototype'},
 10:{name:'거짓 성자 칼레온',bossId:'false_saint_caleon'}
} as const;

export const KALEON_BOSS_STATS:Record<string,{hpMultiplier:number;attackMultiplier:number;defenseBonus:number;speedMultiplier:number}>={
 greenwrought_gatekeeper:{hpMultiplier:3.5,attackMultiplier:1.42,defenseBonus:4,speedMultiplier:.9},
 overgrowth_regenerator:{hpMultiplier:4.2,attackMultiplier:1.5,defenseBonus:4,speedMultiplier:.92},
 transfer_subject_c17:{hpMultiplier:4.8,attackMultiplier:1.65,defenseBonus:5,speedMultiplier:1.02},
 atonement_prototype:{hpMultiplier:5.6,attackMultiplier:1.78,defenseBonus:6,speedMultiplier:.96},
 false_saint_caleon:{hpMultiplier:6.8,attackMultiplier:2.0,defenseBonus:8,speedMultiplier:.98}
};

export const KALEON_T1_FLOORS:Record<number,FloorContent>=Object.fromEntries(Array.from({length:10},(_,index)=>{
 const floorNumber=index+1,slot=KALEON_BOSS_SLOTS[floorNumber as keyof typeof KALEON_BOSS_SLOTS];
 return [floorNumber,floor([...KALEON_NORMAL_POOL],slot?.bossId??undefined)];
})) as Record<number,FloorContent>;

export const kaleonFloorContent=(floorNumber:number)=>KALEON_T1_FLOORS[floorNumber];
