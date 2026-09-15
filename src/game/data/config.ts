import type {Weapon,Slot,Field,Potion,Tower,GearMasteryKey} from '../types';
export const CONFIG={baseHp:180,baseAttack:8,baseDefense:3,baseSpeed:1,starterTickets:20,starterHealth:30,starterOther:5,logLimit:80,spawnDelay:1.2,ticketChance:.4,bookChance:.07,craftCost:6,masteryRequired:4,discountPerCraft:.02,maxDiscount:.3,healingLimit:30,maxFloor:50,tick:.2};
export const MARKET_ITEM_TRADE_FEE_RATE=0;
export const WEAPONS:Record<Weapon,{name:string;icon:string;attack:number;defense:number;speed:number;skillPower:number;description:string}>={sword:{name:'검',icon:'⚔',attack:10,defense:4,speed:1,skillPower:1,description:'안정적인 공격과 방어'},dagger:{name:'단검',icon:'🗡',attack:7,defense:0,speed:1.65,skillPower:1.15,description:'빠른 공격과 순간 화력'},bow:{name:'활',icon:'🏹',attack:12,defense:1,speed:1.15,skillPower:1,description:'꾸준한 공격과 견제'},staff:{name:'지팡이',icon:'✦',attack:6,defense:0,speed:.85,skillPower:2.3,description:'강력한 자동 마법 스킬'}};
export const TOWERS:Record<Tower,{name:string;material:string;icon:string;color:string;monster:string}>={ore:{name:'철맥의 첨탑',material:'철광석',icon:'◆',color:'#83b4c5',monster:'고블린 광부'},leather:{name:'붉은 송곳니의 성소',material:'가죽',icon:'◈',color:'#c7a17a',monster:'황야 멧돼지'},gem:{name:'천광의 수정탑',material:'보석',icon:'◇',color:'#b0a5e1',monster:'수정 파수꾼'},kaleon:{name:'칼레온의 녹빛 첨탑',material:'약초',icon:'✣',color:'#85c6a6',monster:'이끼 정령'}};
export const FIELDS:Record<Field,string>={weapon:'무기 제작',armor:'방어구 제작',accessory:'장신구 제작',alchemy:'연금술'};
export const SLOTS:Record<Slot,string>={weapon:'무기',armor:'갑옷',boots:'신발',accessory:'장신구'};
export const GEAR_MASTERY_KEYS:GearMasteryKey[]=['sword','dagger','bow','staff','armor','boots','accessory'];
export const GEAR_MASTERY_NAMES:Record<GearMasteryKey,string>={sword:'검',dagger:'단검',bow:'활',staff:'지팡이',armor:'갑옷',boots:'신발',accessory:'장신구'};
export const GEAR_MASTERY_CONFIG={requiredByTargetTier:{2:100,3:250,4:500,5:1000} as Record<number,number>,baseGainByFloorTier:[10,20,35,55,80],endOfTierMultiplier:1.5};
export const PASSIVES={vampire:{name:'흡혈',description:'가한 피해의 8% 회복',value:.08,threshold:1},unyielding:{name:'불굴',description:'HP 35% 이하에서 받는 피해 30% 감소',value:.3,threshold:.35},berserker:{name:'광전사',description:'HP 40% 이하에서 공격력 40% 증가',value:.4,threshold:.4}};
export const EQUIPMENT={armor:{name:'탐험가 갑옷',hp:55,defense:7},boots:{name:'탐험가 신발',hp:15,speed:.1}};
export const POTIONS:Record<Potion,{name:string;icon:string;duration:number;cooldown:number;value:number;description:string}>={health:{name:'체력',icon:'♥',duration:0,cooldown:0,value:.25,description:'즉시 최대 HP 25% 회복 · 행동 1회 소모'},regen:{name:'재생',icon:'✚',duration:3,cooldown:0,value:.3,description:'3턴 동안 최대 HP 30% 회복'},attack:{name:'공격',icon:'⚔',duration:3,cooldown:0,value:.3,description:'3턴 동안 공격력 30% 증가'},defense:{name:'방어',icon:'⬡',duration:3,cooldown:0,value:.4,description:'3턴 동안 방어력 40% 증가'},haste:{name:'신속',icon:'»',duration:3,cooldown:0,value:.3,description:'현재 수동 턴제에서는 추가 효과 없음'}};
export const SKILLS=[
 {id:'heavy',name:'강공',description:'공격력 200% 피해',cooldown:6,weapons:['sword','dagger','bow','staff'] as Weapon[],condition:'always',effect:'damage',value:2,duration:0},
 {id:'execute',name:'처형',description:'적 HP 35% 이하 · 공격력 300% 피해',cooldown:8,weapons:['sword','dagger','bow','staff'] as Weapon[],condition:'enemyLow',effect:'damage',value:3,duration:0},
 {id:'guard',name:'방어 태세',description:'HP 70% 이하 · 4초간 받는 피해 40% 감소',cooldown:10,weapons:['sword','staff'] as Weapon[],condition:'selfLow',effect:'guard',value:.4,duration:4},
 {id:'quick',name:'신속',description:'현재 수동 턴제에서는 추가 효과 없음',cooldown:12,weapons:['sword','dagger','bow','staff'] as Weapon[],condition:'always',effect:'quick',value:.5,duration:5}
];
export const COMBAT={monsterHp:42,hpPerFloor:10,monsterAttack:11,attackPerFloor:2.3,monsterDefense:1,defensePerFloor:1.1,monsterSpeed:.8,speedPerFloor:.004,silverBase:10,silverPerFloor:3,materialAmount:2,enemyLow:.35,selfLow:.7};
export const towerIds=Object.keys(TOWERS) as Tower[];
export const potionIds=Object.keys(POTIONS) as Potion[];
export const tierOf=(floor:number)=>Math.ceil(floor/10);

export const STARTER={name:'낡은 훈련용 검',scale:.55};

