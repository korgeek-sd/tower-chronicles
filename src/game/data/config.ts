import type {Weapon,Slot,Field,Potion,Tower,GearMasteryKey,GeneralPotion} from '../types';
export const CONFIG={baseHp:180,baseAttack:8,baseDefense:3,baseSpeed:1,starterTickets:20,starterLesser:30,starterStandard:5,logLimit:80,spawnDelay:1.2,ticketChance:.4,bookChance:.07,craftCost:6,masteryRequired:4,discountPerCraft:.02,maxDiscount:.3,generalPotionLimit:30,revivalPotionLimit:1,revivalHealRatio:.3,maxFloor:10,tick:.2};
export const MARKET_ITEM_TRADE_FEE_RATE=0;
export const WEAPONS:Record<Weapon,{name:string;icon:string;attack:number;defense:number;speed:number;skillPower:number;description:string}>={sword:{name:'검',icon:'⚔',attack:10,defense:4,speed:1,skillPower:1,description:'안정적인 공격과 방어'},dagger:{name:'단검',icon:'🗡',attack:7,defense:0,speed:1.65,skillPower:1.15,description:'빠른 공격과 순간 화력'},bow:{name:'활',icon:'🏹',attack:12,defense:1,speed:1.15,skillPower:1,description:'꾸준한 공격과 견제'},staff:{name:'지팡이',icon:'✦',attack:6,defense:0,speed:.85,skillPower:2.3,description:'강력한 자동 마법 스킬'}};
export const TOWERS:Record<Tower,{name:string;material:string;icon:string;color:string;monster:string}>={ore:{name:'철맥의 첨탑',material:'철광석',icon:'◆',color:'#83b4c5',monster:'고블린 광부'},leather:{name:'붉은 송곳니의 성소',material:'가죽',icon:'◈',color:'#c7a17a',monster:'황야 멧돼지'},gem:{name:'천광의 수정탑',material:'수정',icon:'◇',color:'#b0a5e1',monster:'수정 파수꾼'},kaleon:{name:'칼레온의 녹빛 첨탑',material:'녹빛 성유',icon:'✣',color:'#85c6a6',monster:'이끼 정령'}};
export const TOWER_MATERIALS:Record<Tower,{id:string;field:Field;description:string}>={ore:{id:'iron_ore',field:'weapon',description:'철맥의 첨탑에서 회수되는 금속 원료. 무기 제작에 사용된다. 깊은 층에서 얻은 철광석일수록 품질이 높다.'},leather:{id:'leather',field:'armor',description:'붉은 송곳니의 성소에서 회수되는 질긴 가죽. 방어구 제작에 사용된다.'},gem:{id:'crystal',field:'accessory',description:'천광의 수정탑에서 회수되는 결정체. 장신구 제작에 사용된다.'},kaleon:{id:'verdant_anointing_oil',field:'alchemy',description:'칼레온의 치료 의식에 사용되던 성유가 오랜 대속과 희생으로 변질된 물질. 포션과 연금 소비품 제작에 사용된다.'}};
export const getTowerMaterial=(tower:Tower)=>TOWER_MATERIALS[tower].id;
export const getMaterialGrade=(floor:number)=>Math.min(5,Math.max(1,Math.ceil(floor/2)));
export const ENTRY_PERMITS={ore:{itemId:'iron_vein_entry_permit',name:'철맥의 첨탑 입장권',description:'노바르 탐사자 협회가 발급한 철맥의 첨탑 출입 허가증. 관문에서 검표 후 절취되며, 생환을 보장하지는 않는다.'}};
export const FIELDS:Record<Field,string>={weapon:'무기 제작',armor:'방어구 제작',accessory:'장신구 제작',alchemy:'연금술'};
export const SLOTS:Record<Slot,string>={weapon:'무기',armor:'갑옷',boots:'신발',accessory:'장신구'};
export const GEAR_MASTERY_KEYS:GearMasteryKey[]=['sword','dagger','bow','staff','armor','boots','accessory'];
export const GEAR_MASTERY_NAMES:Record<GearMasteryKey,string>={sword:'검',dagger:'단검',bow:'활',staff:'지팡이',armor:'갑옷',boots:'신발',accessory:'장신구'};
export const GEAR_MASTERY_CONFIG={requiredByTargetTier:{2:100,3:250,4:500,5:1000} as Record<number,number>,baseGainByFloorTier:[10,20,35,55,80],endOfTierMultiplier:1.5};
export const PASSIVES={vampire:{name:'흡혈',description:'가한 피해의 8% 회복',value:.08,threshold:1},unyielding:{name:'불굴',description:'HP 35% 이하에서 받는 피해 30% 감소',value:.3,threshold:.35},berserker:{name:'광전사',description:'HP 40% 이하에서 공격력 40% 증가',value:.4,threshold:.4}};
export const EQUIPMENT={armor:{name:'탐험가 갑옷',hp:55,defense:7},boots:{name:'탐험가 신발',hp:15,speed:.1}};
// Provisional gameplay values, not final balance. Revisit with T2–T5 content.
export const POTION_CRAFTING={generalBatch:10,revivalBatch:1,revivalProductionEnabled:false};
export const POTIONS:Record<Potion,{name:string;icon:string;tier:number;healRatio:number;description:string}>={
 healing_lesser:{name:'하급 회복',icon:'♥',tier:1,healRatio:.2,description:'최대 HP의 20%를 즉시 회복 · 행동 1회 소모'},
 healing_standard:{name:'중급 회복',icon:'♥',tier:2,healRatio:.35,description:'최대 HP의 35%를 즉시 회복 · 행동 1회 소모'},
 healing_greater:{name:'상급 회복',icon:'♥',tier:3,healRatio:.5,description:'최대 HP의 50%를 즉시 회복 · 행동 1회 소모'},
 healing_supreme:{name:'최상급 회복',icon:'♥',tier:4,healRatio:.75,description:'최대 HP의 75%를 즉시 회복 · 행동 1회 소모'},
 revival:{name:'회생',icon:'✦',tier:5,healRatio:.3,description:'치명상을 입으면 사용 여부를 선택 · 원정당 휴대 최대 1개'}
};
export const SKILLS=[
 {id:'heavy',name:'강공',description:'공격력 200% 피해',cooldown:6,weapons:['sword','dagger','bow','staff'] as Weapon[],condition:'always',effect:'damage',value:2,duration:0},
 {id:'execute',name:'처형',description:'적 HP 35% 이하 · 공격력 300% 피해',cooldown:8,weapons:['sword','dagger','bow','staff'] as Weapon[],condition:'enemyLow',effect:'damage',value:3,duration:0},
 {id:'guard',name:'방어 태세',description:'HP 70% 이하 · 4초간 받는 피해 40% 감소',cooldown:10,weapons:['sword','staff'] as Weapon[],condition:'selfLow',effect:'guard',value:.4,duration:4},
 {id:'quick',name:'신속',description:'현재 수동 턴제에서는 추가 효과 없음',cooldown:12,weapons:['sword','dagger','bow','staff'] as Weapon[],condition:'always',effect:'quick',value:.5,duration:5}
];
export const COMBAT={monsterHp:42,hpPerFloor:10,attackPerFloor:2.3,monsterAttack:11,monsterDefense:1,defensePerFloor:1.1,monsterSpeed:.8,speedPerFloor:.004,silverBase:10,silverPerFloor:3,materialAmount:1,enemyLow:.35,selfLow:.7};
export const towerIds=Object.keys(TOWERS) as Tower[];
export const potionIds=Object.keys(POTIONS) as Potion[];
export const generalPotionIds=potionIds.filter((id):id is GeneralPotion=>id!=='revival');
/** Equipment tiers are independent from tower floors after v0.1.30. */
export const tierOf=(_floor:number)=>1;
export type FloorSafety='SAFE'|'PK_ELIGIBLE';
export const floorSafety=(floor:number):FloorSafety=>floor<=2?'SAFE':'PK_ELIGIBLE';
export const isValidTowerFloor=(floor:number)=>Number.isInteger(floor)&&floor>=1&&floor<=CONFIG.maxFloor;

export const STARTER={name:'낡은 훈련용 검',scale:.55};
