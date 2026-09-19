import type {EventChoice,ExpeditionEventDefinition} from '../types';

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

/** Iron Vein Spire authored exploration events. */
export const ORE_EVENTS:ExpeditionEventDefinition[]=[
 {
  id:'ore_exposed_vein',
  type:'DISCOVERY',
  tags:['DISCOVERY','RESOURCE','RISK_REWARD'],
  title:'드러난 철맥',
  description:'벽면이 갈라진 틈 사이로 아직 손대지 않은 광맥이 드러나 있습니다. 안전하게 일부만 채굴하거나 더 깊이 파고들 수 있습니다.',
  imageAssetKey:'ore_exposed_vein',
  towerIds:['ore'],
  weight:.9,
  choices:[
   {id:'careful_mine',label:'안전하게 채굴한다',description:'무리하지 않고 드러난 부분만 캐냅니다.',icon:'◇',styleVariant:'PRIMARY',effects:[{kind:'ADD_TEMP_LOOT',loot:{kind:'MATERIAL',tower:'CURRENT',tier:'CURRENT',amount:3}}],resultText:'붕괴 위험이 없는 구간에서 광석을 확보했습니다.'},
   {id:'deep_mine',label:'더 깊이 파낸다',description:'더 많은 광석을 노리지만 벽면이 무너질 수 있습니다.',icon:'⚠',styleVariant:'DANGER',effects:[],outcomes:[
    {id:'rich_vein',weight:2,effects:[{kind:'ADD_TEMP_LOOT',loot:{kind:'MATERIAL',tower:'CURRENT',tier:'CURRENT',amount:6}},{kind:'ADD_EXPEDITION_SILVER',amount:12}],resultText:'안쪽에서 굵은 광맥을 찾아 예상보다 많은 자원을 확보했습니다.'},
    {id:'vein_collapse',weight:1,effects:[{kind:'TAKE_DAMAGE_RATIO',ratio:.12,minimum:10}],resultText:'금이 간 암반이 무너지며 부상을 입었습니다.'}
   ]},
   skip('광맥의 위치만 기억해 두고 탐사를 계속합니다.')
  ],
  rewardPreview:[{label:'철맥 재료',note:'현재 티어'}]
 },
 {
  id:'ore_derailed_cart',
  type:'RISK',
  tags:['RESOURCE','RISK_REWARD'],
  title:'탈선한 광차',
  description:'선로를 벗어난 광차가 벽에 처박혀 있습니다. 적재함 안에는 아직 회수되지 않은 광석과 작업비가 남아 있습니다.',
  imageAssetKey:'ore_derailed_cart',
  towerIds:['ore'],
  weight:.75,
  conditions:[{kind:'FLOOR_TYPE',value:'NORMAL'}],
  choices:[
   {id:'salvage',label:'광차를 뒤진다',description:'뒤틀린 금속 사이로 손을 넣어 남은 화물을 회수합니다.',icon:'⌕',styleVariant:'DANGER',effects:[],outcomes:[
    {id:'cargo_found',weight:3,effects:[{kind:'ADD_TEMP_LOOT',loot:{kind:'MATERIAL',tower:'CURRENT',tier:'CURRENT',amount:4}},{kind:'ADD_EXPEDITION_SILVER',amount:15}],resultText:'광차 깊숙한 곳에서 멀쩡한 화물을 찾아냈습니다.'},
    {id:'cut_by_frame',weight:1,effects:[{kind:'TAKE_DAMAGE_RATIO',ratio:.1,minimum:8}],resultText:'찌그러진 금속 프레임에 몸을 베였습니다.'}
   ]},
   skip('불안정한 광차를 건드리지 않고 지나갑니다.')
  ]
 },
 {
  id:'ore_clear_air_pocket',
  type:'RECOVERY',
  tags:['RECOVERY','STATUS'],
  title:'환기구의 맑은 공기',
  description:'막혀 있던 환기구 일부가 살아 있어 차갑고 깨끗한 공기가 흐릅니다. 잠시 머무르면 먼지와 독기를 털어낼 수 있을 것 같습니다.',
  imageAssetKey:'ore_clear_air_pocket',
  towerIds:['ore'],
  weight:.55,
  conditions:[{kind:'PLAYER_HP_BELOW',ratio:.9}],
  choices:[
   {id:'recover',label:'호흡을 가다듬는다',description:'장비를 정리하고 맑은 공기 속에서 잠시 쉽니다.',icon:'✚',styleVariant:'PRIMARY',effects:[{kind:'HEAL_HP',ratio:.15},{kind:'REMOVE_EFFECT',effectId:'poison'}],resultText:'호흡을 가다듬고 몸에 남은 독기를 씻어냈습니다.'},
   skip('오래 머물지 않고 계속 이동합니다.')
  ]
 },
 {
  id:'ore_stranded_surveyor',
  type:'SPECIAL',
  tags:['RESOURCE','LORE'],
  title:'고립된 측량 탐사자',
  description:'무너진 갱도 한쪽에서 다른 탐사자가 몸을 기대고 있습니다. 가지고 있던 표본과 경로 기록을 내어줄 테니 회복 포션을 나눠 달라고 합니다.',
  imageAssetKey:'ore_stranded_surveyor',
  towerIds:['ore'],
  weight:.45,
  choices:[
   {id:'share_potion',label:'회복 포션을 건넨다',description:'하급 회복 포션 1개를 건네고 표본과 기록을 받습니다.',icon:'▣',styleVariant:'PRIMARY',conditions:[{kind:'HAS_POTION',potion:'healing_lesser',amount:1}],effects:[{kind:'CONSUME_POTION',potion:'healing_lesser',amount:1},{kind:'ADD_TEMP_LOOT',loot:{kind:'MATERIAL',tower:'CURRENT',tier:'CURRENT',amount:5}},{kind:'ADD_EXPEDITION_SILVER',amount:25}],resultText:'탐사자는 감사 인사와 함께 확보한 표본과 남은 경비를 건넸습니다.'},
   skip('서로의 안전을 위해 더 머물지 않고 갈 길을 갑니다.')
  ],
  rewardPreview:[{label:'철맥 표본',note:'현재 티어'},{label:'Silver',iconAssetKey:'silver',note:'교환 보상'}]
 },
 {
  id:'ore_reinforced_workbench',
  type:'STATUS',
  tags:['STATUS'],
  title:'버려진 정비 작업대',
  description:'광부와 탐사자가 장비를 손보던 튼튼한 작업대가 아직 사용할 만한 상태로 남아 있습니다.',
  imageAssetKey:'ore_reinforced_workbench',
  towerIds:['ore'],
  weight:.5,
  choices:[
   {id:'sharpen',label:'무기를 정비한다',description:'날과 결속을 손봐 공격 준비를 마칩니다.',icon:'⚔',styleVariant:'PRIMARY',effects:[{kind:'APPLY_EFFECT',effectId:'attack_up',scope:'EXPEDITION'}],resultText:'무기를 정비해 남은 원정 동안 공격 준비를 강화했습니다.'},
   {id:'reinforce',label:'방어구를 정비한다',description:'버클과 보호판을 다시 조여 방어를 보강합니다.',icon:'◆',styleVariant:'SECONDARY',effects:[{kind:'APPLY_EFFECT',effectId:'defense_up',scope:'EXPEDITION'}],resultText:'방어구를 정비해 남은 원정 동안 방어 준비를 강화했습니다.'},
   skip('작업대를 사용하지 않고 지나갑니다.')
  ]
 }
];
