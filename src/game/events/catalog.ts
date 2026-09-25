import type {ExpeditionEventDefinition} from './types';
import type {Tower} from '../types';
import {STRONGHOLD_BALANCE} from './resourceStronghold';

const riskOutcome=(tower:Tower)=>{
 switch(tower){
  case 'ore':return {effects:[{kind:'TAKE_DAMAGE',amount:14} as const],resultText:'채굴 중 지지대가 무너지며 낙석에 맞았습니다.'};
  case 'leather':return {effects:[{kind:'APPLY_EFFECT',effectId:'fang_wound',scope:'EXPEDITION'} as const],resultText:'사냥감 더미에 숨은 가시에 베여 깊은 상처가 남았습니다.'};
  case 'gem':return {effects:[{kind:'APPLY_EFFECT',effectId:'crystal_fracture',scope:'EXPEDITION'} as const],resultText:'깨진 결정 파편이 몸에 박혀 결정 균열이 남았습니다.'};
  case 'kaleon':return {effects:[{kind:'APPLY_EFFECT',effectId:'kaleon_blight',scope:'EXPEDITION'} as const],resultText:'재배대에서 터진 포자에 노출되어 녹병에 감염되었습니다.'};
 }
};

const resourceGather=(tower:Tower,title:string,description:string):ExpeditionEventDefinition=>{
 const failure=riskOutcome(tower);
 return {
  id:'resource_gather_'+tower,
  type:'DISCOVERY',
  title,
  description,
  towerIds:[tower],
  weight:1,
  choices:[
   {
    id:'gather',
    label:'채집한다',
    description:'자원을 확보하지만 채집 과정에서 위험이 발생할 수 있습니다.',
    icon:'⌕',
    styleVariant:'DANGER',
    effects:[],
    outcomes:[
     {id:'great',weight:15,effects:[{kind:'ADD_TEMP_LOOT',loot:{kind:'MATERIAL',tower:'CURRENT',tier:'CURRENT',amount:5}},{kind:'ADD_EXPEDITION_SILVER',amount:15}],resultText:'대성공 · 상태 좋은 자원과 은화를 함께 확보했습니다.'},
     {id:'success',weight:60,effects:[{kind:'ADD_TEMP_LOOT',loot:{kind:'MATERIAL',tower:'CURRENT',tier:'CURRENT',amount:3}}],resultText:'성공 · 쓸 만한 자원을 확보했습니다.'},
     {id:'failure',weight:25,effects:failure.effects,resultText:'실패 · '+failure.resultText},
    ],
   },
   {id:'skip',label:'지나간다',description:'위험을 감수하지 않고 이동합니다.',icon:'⇥',styleVariant:'SKIP',effects:[],resultText:'자원 지대를 뒤로하고 탐사를 계속합니다.'},
  ],
 };
};

// Authored tower events go here. Test content is NEVER merged into this catalog.
// Engaging with a normal event always carries a failure outcome; SKIP is the safe opt-out.
export const EVENT_CATALOG:ExpeditionEventDefinition[]=[
 {
  id:'common_rest',type:'RECOVERY',title:'불안정한 휴식처',description:'전투 흔적 사이에 잠시 몸을 누일 공간이 보입니다. 제대로 쉬면 회복할 수 있지만 구조물이 불안정합니다.',weight:1,conditions:[{kind:'PLAYER_HP_BELOW',ratio:.8}],
  choices:[
   {id:'rest',label:'휴식한다',description:'회복을 시도하지만 사고가 날 수 있습니다.',icon:'♥',styleVariant:'DANGER',effects:[],outcomes:[
    {id:'great',weight:20,effects:[{kind:'HEAL_HP',ratio:.25}],resultText:'대성공 · 안전한 자리를 찾아 충분히 회복했습니다.'},
    {id:'success',weight:60,effects:[{kind:'HEAL_HP',ratio:.15}],resultText:'성공 · 짧게 숨을 고르고 체력을 회복했습니다.'},
    {id:'failure',weight:20,effects:[{kind:'TAKE_DAMAGE',amount:8}],resultText:'실패 · 무너진 잔해에 다쳐 오히려 체력을 잃었습니다.'},
   ]},
   {id:'skip',label:'지나간다',description:'회복 기회를 포기하고 안전하게 이동합니다.',icon:'⇥',styleVariant:'SKIP',effects:[],resultText:'휴식처를 뒤로하고 이동합니다.'},
  ],
 },
 {
  id:'common_cache',type:'SUPPLY',title:'수상한 보급 상자',description:'이전 탐사자가 남긴 듯한 보급 상자가 있습니다. 안에는 포션이 있을 수 있지만 함정 여부는 알 수 없습니다.',weight:1,
  choices:[
   {id:'take',label:'상자를 연다',description:'보급품을 노리고 상자를 조사합니다.',icon:'♥',styleVariant:'DANGER',effects:[],outcomes:[
    {id:'great',weight:15,effects:[{kind:'ADD_POTION',potion:'healing_standard',amount:1},{kind:'ADD_POTION',potion:'healing_lesser',amount:1}],resultText:'대성공 · 손상되지 않은 포션 두 병을 찾아냈습니다.'},
    {id:'success',weight:60,effects:[{kind:'ADD_POTION',potion:'healing_lesser',amount:1}],resultText:'성공 · 하급 회복 포션을 챙겼습니다.'},
    {id:'failure',weight:25,effects:[{kind:'TAKE_DAMAGE',amount:12}],resultText:'실패 · 상자 안쪽의 함정이 작동해 부상을 입었습니다.'},
   ]},
   {id:'skip',label:'지나간다',description:'상자에 손대지 않습니다.',icon:'⇥',styleVariant:'SKIP',effects:[],resultText:'수상한 보급 상자를 두고 이동합니다.'},
  ],
 },
 resourceGather('ore','노출된 광맥','암벽 사이로 품질 좋은 철맥이 드러나 있습니다. 캐내는 동안 낙석이 일어날 수 있습니다.'),
 resourceGather('leather','사냥감 저장소','포식자들이 모아 둔 사냥감과 가죽 더미가 남아 있습니다. 쓸 만한 재료가 있지만 날카로운 흔적이 뒤섞여 있습니다.'),
 resourceGather('gem','고밀도 수정 군집','밀집된 천광 수정이 벽면을 뒤덮고 있습니다. 좋은 결정을 떼어낼 수 있지만 파편이 매우 불안정합니다.'),
 resourceGather('kaleon','녹빛 약초 재배대','오래된 재배대에 녹빛 약초가 과도하게 자라 있습니다. 귀한 재료지만 포자 오염의 흔적이 남아 있습니다.'),
 {
  id:'common_risk',type:'RISK',title:'불안한 틈새',description:'깊은 틈새에서 빛이 납니다. 안쪽을 뒤지면 큰 수확을 얻을 수도 있지만 무너질 위험이 큽니다.',weight:1,
  choices:[
   {id:'search',label:'안쪽을 뒤진다',description:'높은 보상을 노리고 위험을 감수합니다.',icon:'⚠',styleVariant:'DANGER',effects:[],outcomes:[
    {id:'great',weight:15,effects:[{kind:'ADD_EXPEDITION_SILVER',amount:50}],resultText:'대성공 · 숨겨진 은화 꾸러미를 발견했습니다.'},
    {id:'success',weight:45,effects:[{kind:'ADD_EXPEDITION_SILVER',amount:25}],resultText:'성공 · 틈새에서 은화를 찾아냈습니다.'},
    {id:'failure',weight:40,effects:[{kind:'TAKE_DAMAGE',amount:18}],resultText:'실패 · 틈새가 무너지며 크게 다쳤습니다.'},
   ]},
   {id:'skip',label:'지나간다',description:'위험을 피합니다.',icon:'⇥',styleVariant:'SKIP',effects:[],resultText:'불안한 틈새를 두고 이동합니다.'},
  ],
 },
 {
  id:'common_remedy',type:'STATUS',title:'이상한 공기층',description:'주변보다 맑아 보이는 공기가 한곳에 고여 있습니다. 몸의 오염을 씻어낼 수도 있지만 성분을 확신할 수 없습니다.',weight:1,
  choices:[
   {id:'breathe',label:'공기를 들이마신다',description:'상태를 정화하려 시도합니다.',icon:'✦',styleVariant:'DANGER',effects:[],outcomes:[
    {id:'great',weight:20,effects:[{kind:'REMOVE_EFFECT',effectId:'poison'},{kind:'REMOVE_EFFECT',effectId:'kaleon_blight'},{kind:'HEAL_HP',ratio:.15}],resultText:'대성공 · 오염이 가라앉고 몸 상태까지 회복되었습니다.'},
    {id:'success',weight:55,effects:[{kind:'REMOVE_EFFECT',effectId:'poison'},{kind:'REMOVE_EFFECT',effectId:'kaleon_blight'},{kind:'HEAL_HP',ratio:.05}],resultText:'성공 · 몸에 남은 독기와 오염이 옅어졌습니다.'},
    {id:'failure',weight:25,effects:[{kind:'APPLY_EFFECT',effectId:'weaken',scope:'EXPEDITION'}],resultText:'실패 · 자극성 기체를 들이마셔 방어가 약해졌습니다.'},
   ]},
   {id:'skip',label:'지나간다',description:'정체를 알 수 없는 공기를 피합니다.',icon:'⇥',styleVariant:'SKIP',effects:[],resultText:'공기층을 피해 탐사를 계속합니다.'},
  ],
 },
 {id:'resource_stronghold',type:'STRONGHOLD',title:'자원거점 발견',description:'고가치 자원이 밀집된 거점을 발견했습니다. 점령을 시작하면 15분 동안 자리를 지켜야 보상을 확보할 수 있습니다.',weight:.65,conditions:[{kind:'FLOOR',min:3,max:10}],decisionMs:STRONGHOLD_BALANCE.decisionMs,choices:[{id:'claim',label:'점령한다',description:'15분 점령을 시작합니다.',icon:'◆',styleVariant:'DANGER',effects:[{kind:'START_RESOURCE_STRONGHOLD'}],resultText:'자원거점 점령을 시작했습니다.'},{id:'skip',label:'지나간다',description:'거점에 개입하지 않습니다.',icon:'⇥',styleVariant:'SKIP',effects:[],resultText:'자원거점을 뒤로하고 탐사를 계속합니다.'}]},
];

export const BOSS_EVENT:ExpeditionEventDefinition={id:'boss_encounter',type:'BOSS',title:'강력한 존재의 흔적',description:'앞쪽에서 거대한 발소리가 들려옵니다. 흔적을 따라가면 이 구역의 보스와 마주할 수 있습니다.',weight:1,conditions:[{kind:'BOSS_FLOOR',value:true}],choices:[{id:'challenge',label:'도전한다',description:'준비를 마치고 보스에게 향합니다.',icon:'⚔',styleVariant:'PRIMARY',effects:[{kind:'START_BOSS_BATTLE'}],resultText:'보스에게 향할 준비를 마쳤습니다.'},{id:'skip',label:'지나간다',description:'이번 흔적을 포기하고 탐사를 계속합니다.',icon:'⇥',styleVariant:'SKIP',effects:[],resultText:'흔적을 뒤로하고 다른 길로 나아갑니다.'}]};

// Asset keys are resolved centrally; missing or failed art receives a neutral placeholder.
export const EVENT_ASSETS:Record<string,string>={dev_mine_backdrop:'./assets/backgrounds/ore/t1.png',potion:'./assets/ui/inventory/health.png',ore:'./assets/ui/inventory/ore.png',silver:'./assets/ui/pixel-v1/13-silver-icon.png'};
export const eventAsset=(key?:string)=>key?EVENT_ASSETS[key]:undefined;
