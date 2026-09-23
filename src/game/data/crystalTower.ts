export interface MonsterContent {
  id:string;displayName:string;role:'normal'|'swift'|'reward'|'elite'|'boss';graphicId:string;boss:boolean;
  hpMultiplier:number;attackMultiplier:number;speedMultiplier:number;silverMultiplier:number;
}
export interface FloorContent {normalPool:string[];bossId?:string}

export const CRYSTAL_T1_MONSTERS:MonsterContent[]=[
 {id:'quartz_carapace_beetle',displayName:'석영등갑충',role:'normal',graphicId:'quartz_carapace_beetle',boss:false,hpMultiplier:1.18,attackMultiplier:.9,speedMultiplier:.82,silverMultiplier:1.05},
 {id:'glassjaw_stalker',displayName:'유리턱 추적충',role:'normal',graphicId:'glassjaw_stalker',boss:false,hpMultiplier:.88,attackMultiplier:1.18,speedMultiplier:1.08,silverMultiplier:1},
 {id:'refractive_scale_lizard',displayName:'굴절비늘 도마뱀',role:'swift',graphicId:'refractive_scale_lizard',boss:false,hpMultiplier:.82,attackMultiplier:.9,speedMultiplier:1.28,silverMultiplier:.95},
 {id:'echo_crystal',displayName:'반향결정체',role:'normal',graphicId:'echo_crystal',boss:false,hpMultiplier:1,attackMultiplier:1,speedMultiplier:.96,silverMultiplier:1},
 {id:'vein_clinger',displayName:'광맥흡착체',role:'reward',graphicId:'vein_clinger',boss:false,hpMultiplier:.94,attackMultiplier:.82,speedMultiplier:.9,silverMultiplier:1.18},
 {id:'crystal_needle_centipede',displayName:'수정침 지네',role:'swift',graphicId:'crystal_needle_centipede',boss:false,hpMultiplier:.78,attackMultiplier:.92,speedMultiplier:1.25,silverMultiplier:.95},
 {id:'whiteglow_burrower',displayName:'백광 굴착충',role:'normal',graphicId:'whiteglow_burrower',boss:false,hpMultiplier:1.08,attackMultiplier:1.08,speedMultiplier:.9,silverMultiplier:1.05},
 {id:'clouded_crystal_beast',displayName:'탁정 갑각수',role:'normal',graphicId:'clouded_crystal_beast',boss:false,hpMultiplier:1.2,attackMultiplier:.95,speedMultiplier:.84,silverMultiplier:1.08},
 {id:'translucent_bat',displayName:'투광박쥐',role:'swift',graphicId:'translucent_bat',boss:false,hpMultiplier:.72,attackMultiplier:.88,speedMultiplier:1.35,silverMultiplier:.9},
 {id:'shardback_spider',displayName:'파편등 거미',role:'swift',graphicId:'shardback_spider',boss:false,hpMultiplier:.8,attackMultiplier:.96,speedMultiplier:1.2,silverMultiplier:.98},
 {id:'crystalhorn_goat',displayName:'결정뿔 산양',role:'normal',graphicId:'crystalhorn_goat',boss:false,hpMultiplier:1.06,attackMultiplier:1.14,speedMultiplier:1.02,silverMultiplier:1.05},
 {id:'lens_eye_watcher',displayName:'렌즈눈 감시충',role:'reward',graphicId:'lens_eye_watcher',boss:false,hpMultiplier:.9,attackMultiplier:1.02,speedMultiplier:1.08,silverMultiplier:1.2},
 {id:'hardening_slime',displayName:'경화수액충',role:'normal',graphicId:'hardening_slime',boss:false,hpMultiplier:1.15,attackMultiplier:.82,speedMultiplier:.78,silverMultiplier:1.08},
 {id:'crystal_scale_serpent',displayName:'수정비늘 뱀',role:'elite',graphicId:'crystal_scale_serpent',boss:false,hpMultiplier:.96,attackMultiplier:1.12,speedMultiplier:1.18,silverMultiplier:1.12},
 {id:'vein_hound',displayName:'광맥 사냥개',role:'swift',graphicId:'vein_hound',boss:false,hpMultiplier:.9,attackMultiplier:1.2,speedMultiplier:1.2,silverMultiplier:1.08},
 {id:'shatter_mole',displayName:'파광 두더지',role:'normal',graphicId:'shatter_mole',boss:false,hpMultiplier:1.14,attackMultiplier:1.1,speedMultiplier:.88,silverMultiplier:1.1},
 {id:'quartz_spine_predator',displayName:'석영등뼈 포식자',role:'elite',graphicId:'quartz_spine_predator',boss:false,hpMultiplier:1.12,attackMultiplier:1.2,speedMultiplier:1.02,silverMultiplier:1.14},
 {id:'fracture_claw_hunter',displayName:'균열발톱 수렵수',role:'elite',graphicId:'fracture_claw_hunter',boss:false,hpMultiplier:1.02,attackMultiplier:1.24,speedMultiplier:1.1,silverMultiplier:1.16},
 {id:'whitevein_leech',displayName:'백정맥 거머리',role:'reward',graphicId:'whitevein_leech',boss:false,hpMultiplier:1.08,attackMultiplier:.94,speedMultiplier:.86,silverMultiplier:1.25},
 {id:'celestial_crystal_brute',displayName:'천광각질 거수',role:'elite',graphicId:'celestial_crystal_brute',boss:false,hpMultiplier:1.35,attackMultiplier:1.24,speedMultiplier:.78,silverMultiplier:1.22},
];

export const CRYSTAL_T1_MONSTER_BY_ID=Object.fromEntries(CRYSTAL_T1_MONSTERS.map(m=>[m.id,m])) as Record<string,MonsterContent>;
export const CRYSTAL_NORMAL_POOL=CRYSTAL_T1_MONSTERS.map(m=>m.id);

const floor=(normalPool:string[],bossId?:string):FloorContent=>({normalPool,bossId});
const FLOOR_POOLS:Record<number,string[]>={
 1:CRYSTAL_NORMAL_POOL.slice(0,5),
 2:CRYSTAL_NORMAL_POOL.slice(0,7),
 3:CRYSTAL_NORMAL_POOL.slice(0,10),
 4:CRYSTAL_NORMAL_POOL.slice(0,12),
 5:CRYSTAL_NORMAL_POOL.slice(0,14),
 6:CRYSTAL_NORMAL_POOL.slice(4,15),
 7:CRYSTAL_NORMAL_POOL.slice(6,17),
 8:CRYSTAL_NORMAL_POOL.slice(8,19),
 9:CRYSTAL_NORMAL_POOL.slice(9,20),
 10:CRYSTAL_NORMAL_POOL.slice(10,20),
};

export const CRYSTAL_BOSS_SLOTS={
 6:{name:'백정갑주 거수',bossId:'white_crystal_armor_behemoth'},
 7:{name:'만광굴절 포식자',bossId:'myriad_refraction_predator'},
 8:{name:'맥동광핵 증식체',bossId:'pulsing_crystal_core_growth'},
 9:{name:'천면결정수',bossId:'thousand_face_crystal_beast'},
 10:{name:'천광심핵 모체',bossId:'celestial_core_matrix'}
} as const;

export const CRYSTAL_BOSS_STATS:Record<string,{hpMultiplier:number;attackMultiplier:number;defenseBonus:number;speedMultiplier:number}>={
 white_crystal_armor_behemoth:{hpMultiplier:3.5,attackMultiplier:1.42,defenseBonus:3,speedMultiplier:.84},
 myriad_refraction_predator:{hpMultiplier:4,attackMultiplier:1.58,defenseBonus:3,speedMultiplier:1.08},
 pulsing_crystal_core_growth:{hpMultiplier:4.8,attackMultiplier:1.62,defenseBonus:5,speedMultiplier:.92},
 thousand_face_crystal_beast:{hpMultiplier:5.7,attackMultiplier:1.78,defenseBonus:6,speedMultiplier:.98},
 celestial_core_matrix:{hpMultiplier:6.8,attackMultiplier:2,defenseBonus:8,speedMultiplier:.9}
};

export const CRYSTAL_T1_FLOORS:Record<number,FloorContent>=Object.fromEntries(Array.from({length:10},(_,index)=>{
 const floorNumber=index+1,slot=CRYSTAL_BOSS_SLOTS[floorNumber as keyof typeof CRYSTAL_BOSS_SLOTS];
 return [floorNumber,floor([...FLOOR_POOLS[floorNumber]],slot?.bossId??undefined)];
})) as Record<number,FloorContent>;

export const crystalFloorContent=(floorNumber:number)=>CRYSTAL_T1_FLOORS[floorNumber];
