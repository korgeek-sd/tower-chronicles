import type {EventChoice,ExpeditionEventDefinition} from './types';
import {ORE_EVENTS} from './content/ore';

const skip=(resultText:string):EventChoice=>({
 id:'skip',
 label:'지나간다',
 description:'위험을 늘리지 않고 탐사를 계속합니다.',
 icon:'⇥',
 styleVariant:'SKIP',
 behavior:'SKIP',
 effects:[],
 resultText
});

export const COMMON_EVENTS:ExpeditionEventDefinition[]=[
 {
  id:'sheltered_rest_niche',
  type:'RECOVERY',
  tags:['COMMON','RECOVERY'],
  title:'바람 막힌 휴식처',
  description:'무너진 구조물 안쪽에 잠시 숨을 고를 만한 공간이 남아 있습니다.',
  weight:1,
  conditions:[{kind:'PLAYER_HP_BELOW',ratio:.85}],
  choices:[
   {id:'rest',label:'잠시 쉰다',description:'주변을 경계하며 상처를 정리합니다.',icon:'✚',styleVariant:'PRIMARY',effects:[{kind:'HEAL_HP',ratio:.25}],resultText:'짧은 휴식으로 체력을 회복했습니다.'},
   skip('머무르지 않고 원래 경로로 돌아갑니다.')
  ]
 },
 {
  id:'sealed_emergency_cache',
  type:'SUPPLY',
  tags:['COMMON','RESOURCE'],
  title:'봉인된 비상 보급함',
  description:'탐사대가 공용으로 남긴 낡은 보급함 하나가 벽면에 고정되어 있습니다.',
  weight:1,
  choices:[
   {id:'take_potion',label:'보급품을 챙긴다',description:'사용 가능한 회복 포션 한 병만 꺼냅니다.',icon:'▣',styleVariant:'PRIMARY',effects:[{kind:'ADD_POTION',potion:'healing_lesser',amount:1}],resultText:'밀봉 상태가 괜찮은 하급 회복 포션을 챙겼습니다.'},
   skip('보급함을 다음 탐사자를 위해 그대로 둡니다.')
  ],
  rewardPreview:[{label:'하급 회복 포션',iconAssetKey:'potion',note:'원정 가방'}]
 },
 {
  id:'unclaimed_route_satchel',
  type:'DISCOVERY',
  tags:['COMMON','DISCOVERY','RESOURCE'],
  title:'회수되지 않은 표식 주머니',
  description:'오래된 경로 표식 아래에 소유자를 알 수 없는 작은 작업 주머니가 놓여 있습니다.',
  weight:1,
  choices:[
   {id:'inspect',label:'내용물을 확인한다',description:'쓸 수 있는 자원만 골라 임시 전리품에 보관합니다.',icon:'⌕',styleVariant:'PRIMARY',effects:[{kind:'ADD_TEMP_LOOT',loot:{kind:'MATERIAL',tower:'CURRENT',tier:'CURRENT',amount:2}},{kind:'ADD_EXPEDITION_SILVER',amount:10}],resultText:'주머니에서 현지 재료와 소량의 Silver를 회수했습니다.'},
   skip('표식과 주머니를 건드리지 않고 지나갑니다.')
  ],
  rewardPreview:[{label:'현재 탑 재료',note:'현재 티어'},{label:'Silver',iconAssetKey:'silver',note:'원정 임시 보관'}]
 },
 {
  id:'collapsed_haulway',
  type:'RISK',
  tags:['COMMON','RISK_REWARD'],
  title:'무너진 운반로',
  description:'잔해 너머로 버려진 화물이 보입니다. 통로가 더 무너지기 전에 꺼낼 수 있을지도 모릅니다.',
  weight:.8,
  conditions:[{kind:'FLOOR_TYPE',value:'NORMAL'}],
  choices:[
   {id:'clear_debris',label:'잔해를 치운다',description:'부상 위험을 감수하고 화물을 회수합니다.',icon:'⚠',styleVariant:'DANGER',effects:[],outcomes:[
    {id:'recovered_cargo',weight:3,effects:[{kind:'ADD_TEMP_LOOT',loot:{kind:'MATERIAL',tower:'CURRENT',tier:'CURRENT',amount:4}},{kind:'ADD_EXPEDITION_SILVER',amount:15}],resultText:'통로가 버텨 주는 사이 화물을 안전하게 꺼냈습니다.'},
    {id:'falling_debris',weight:1,effects:[{kind:'TAKE_DAMAGE_RATIO',ratio:.12,minimum:8}],resultText:'잔해가 다시 무너지며 몸을 덮쳤습니다.'}
   ]},
   skip('불안정한 통로를 표시해 두고 우회합니다.')
  ]
 },
 {
  id:'surveyor_dead_drop',
  type:'DISCOVERY',
  tags:['COMMON','DISCOVERY'],
  title:'측량사의 비밀 보관함',
  description:'벽 틈에서 탐사 경로를 기록하던 측량사의 작은 철제 보관함을 발견했습니다.',
  weight:.75,
  choices:[
   {id:'take_silver',label:'은화를 회수한다',description:'운반이 쉬운 은화만 챙깁니다.',icon:'◈',styleVariant:'PRIMARY',effects:[{kind:'ADD_EXPEDITION_SILVER',amount:22}],resultText:'비상 자금으로 남겨 둔 Silver를 회수했습니다.'},
   {id:'take_materials',label:'표본을 회수한다',description:'현지에서 채집한 표본 묶음을 챙깁니다.',icon:'◇',styleVariant:'SECONDARY',effects:[{kind:'ADD_TEMP_LOOT',loot:{kind:'MATERIAL',tower:'CURRENT',tier:'CURRENT',amount:3}}],resultText:'분류가 끝난 현지 재료 표본을 회수했습니다.'},
   skip('기록의 주인이 돌아올 가능성을 생각해 그대로 둡니다.')
  ]
 },
 {
  id:'abandoned_guard_post',
  type:'STATUS',
  tags:['COMMON','STATUS'],
  title:'버려진 방호 거점',
  description:'탐사대가 전투 직전 장비를 정비하던 임시 방호 거점이 남아 있습니다.',
  weight:.65,
  choices:[
   {id:'brace',label:'방호 장비를 정비한다',description:'다음 전투를 대비해 보호구의 결속을 다시 조입니다.',icon:'◆',styleVariant:'PRIMARY',effects:[{kind:'APPLY_EFFECT',effectId:'defense_up',scope:'EXPEDITION'}],resultText:'장비를 정비해 다음 전투에 대비했습니다.'},
   skip('낡은 설비에 의존하지 않고 탐사를 계속합니다.')
  ]
 }
];

export const EVENT_CATALOG:ExpeditionEventDefinition[]=[...COMMON_EVENTS,...ORE_EVENTS];

export const BOSS_EVENT:ExpeditionEventDefinition={id:'boss_encounter',type:'BOSS',title:'강력한 존재의 흔적',description:'앞쪽에서 거대한 발소리가 들려옵니다. 흔적을 따라가면 이 구역의 보스와 마주할 수 있습니다.',weight:1,conditions:[{kind:'BOSS_FLOOR',value:true}],choices:[{id:'challenge',label:'도전한다',description:'준비를 마치고 보스에게 향합니다.',icon:'⚔',styleVariant:'PRIMARY',effects:[{kind:'START_BOSS_BATTLE'}],resultText:'보스에게 향할 준비를 마쳤습니다.'},{id:'skip',label:'지나간다',description:'이번 흔적을 포기하고 탐사를 계속합니다.',icon:'⇥',styleVariant:'SKIP',behavior:'SKIP',effects:[],resultText:'흔적을 뒤로하고 다른 길로 나아갑니다.'}]};
// Asset keys are resolved centrally; missing or failed art receives a neutral placeholder.
export const EVENT_ASSETS:Record<string,string>={dev_mine_backdrop:'./assets/backgrounds/ore/t1.png',potion:'./assets/ui/inventory/health.png',ore:'./assets/ui/inventory/ore.png',silver:'./assets/ui/pixel-v1/13-silver-icon.png'};
export const eventAsset=(key?:string)=>key?EVENT_ASSETS[key]:undefined;
