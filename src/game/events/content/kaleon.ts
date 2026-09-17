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

/** Kaleon Spire authored exploration events. */
export const KALEON_EVENTS:ExpeditionEventDefinition[]=[
  {
    id:'kaleon_verdant_herb_garden',
    type:'RISK',
    tags:['DISCOVERY','RESOURCE','RISK_REWARD'],
    title:'녹빛 약초 정원',
    description:'철문 너머로 녹빛 수액이 흐르는 약초 정원이 보입니다. 안전하게 가장자리의 약초만 채집하거나, 더 깊은 곳으로 들어가 더 많은 수확을 노릴 수 있습니다.',
    towerIds:['kaleon'],
    weight:.9,
    choices:[
      {id:'careful_harvest',label:'안전하게 채집한다',description:'가장자리의 약초만 조심스럽게 캐냅니다.',icon:'◇',styleVariant:'PRIMARY',effects:[{kind:'ADD_TEMP_LOOT',loot:{kind:'MATERIAL',tower:'CURRENT',tier:'CURRENT',amount:3}}],resultText:'안전한 구간에서 약초를 확보했습니다.'},
      {id:'deep_harvest',label:'깊은 곳으로 들어간다',description:'더 많은 약초를 노리지만 독성 수액과 뿌리에 당할 수 있습니다.',icon:'⚠',styleVariant:'DANGER',effects:[],outcomes:[
        {id:'bountiful_garden',weight:2,effects:[{kind:'ADD_TEMP_LOOT',loot:{kind:'MATERIAL',tower:'CURRENT',tier:'CURRENT',amount:6}},{kind:'ADD_EXPEDITION_SILVER',amount:12}],resultText:'깊은 곳에서 자라는 강렬한 약초들을 다량 확보했습니다.'},
        {id:'toxic_sap',weight:1,effects:[{kind:'TAKE_DAMAGE_RATIO',ratio:.12,minimum:10}],resultText:'뿌리에서 뿜어져 나온 독성 수액에 당했습니다.'}
      ]},
      skip('정원의 위치만 기억해 두고 탐사를 계속합니다.')
    ],
    rewardPreview:[{label:'칼레온 재료',note:'현재 티어'}]
  },
  {
    id:'kaleon_abandoned_infirmary',
    type:'RECOVERY',
    tags:['RECOVERY','STATUS','LORE'],
    title:'버려진 치료실',
    description:'교단이 완전히 타락하기 전 사용하던 오래된 치료실입니다. 먼지 쌓인 침상과 마른 약초 다발이 여전히 남아 있습니다. 희생을 요구하지 않는 옛 치료법이 아직 남아 있습니다.',
    towerIds:['kaleon'],
    weight:.65,
    conditions:[{kind:'PLAYER_HP_BELOW',ratio:.9}],
    choices:[
      {id:'rest_and_treat',label:'치료를 받는다',description:'남아 있는 약초와 붕대로 상처를 돌봅니다.',icon:'✚',styleVariant:'PRIMARY',effects:[{kind:'HEAL_HP',ratio:.25},{kind:'REMOVE_EFFECT',effectId:'poison'},{kind:'REMOVE_EFFECT',effectId:'green_incense'}],resultText:'옛 치료법으로 상처를 씻고 독기를 털어냈습니다.'},
      skip('치료실을 지나쳐 계속 나아갑니다.')
    ]
  },
  {
    id:'kaleon_atonement_bed',
    type:'RISK',
    tags:['RESOURCE','RISK_REWARD','LORE'],
    title:'대속 침상',
    description:'고통을 다른 사람에게 전달하기 위해 사용했던 의식용 침상입니다. 녹빛 얼룩이 배어 있는 침대에 누우면 대속의 의식이 시작될지도 모릅니다.',
    towerIds:['kaleon'],
    weight:.55,
    choices:[
      {id:'lie_down',label:'침상에 눕는다',description:'대속의 의식을 감수하고 자원을 얻으려 시도합니다.',icon:'⚠',styleVariant:'DANGER',effects:[],outcomes:[
        {id:'atonement_success',weight:2,effects:[{kind:'ADD_TEMP_LOOT',loot:{kind:'MATERIAL',tower:'CURRENT',tier:'CURRENT',amount:5}},{kind:'ADD_EXPEDITION_SILVER',amount:20}],resultText:'잠시 고통이 전가되는 감각과 함께 약초와 은화를 얻었습니다.'},
        {id:'pain_transferred',weight:1,effects:[{kind:'TAKE_DAMAGE_RATIO',ratio:.18,minimum:15},{kind:'APPLY_EFFECT',effectId:'transferred_pain',scope:'EXPEDITION'}],resultText:'고통이 되돌아와 몸에 새겨졌습니다.'}
      ]},
      skip('침상을 건드리지 않고 지나갑니다.')
    ],
    rewardPreview:[{label:'칼레온 재료',note:'현재 티어'},{label:'Silver',iconAssetKey:'silver',note:'원정 임시 보관'}]
  },
  {
    id:'kaleon_confessional',
    type:'STATUS',
    tags:['STATUS','LORE'],
    title:'고해실',
    description:'초기에는 자발적 고해를 위한 장소였지만 이후에는 누가 고통받을지를 판단하는 장소로 변질되었습니다. 낡은 격자 너머로 무언가가 기다리고 있는 듯합니다.',
    towerIds:['kaleon'],
    weight:.6,
    choices:[
      {id:'confess',label:'고백한다',description:'자신의 죄를 고백하고 공격의 의지를 다집니다.',icon:'⚔',styleVariant:'PRIMARY',effects:[{kind:'APPLY_EFFECT',effectId:'attack_up',scope:'EXPEDITION'}],resultText:'고백을 마친 뒤 공격 준비가 강화되었습니다.'},
      {id:'remain_silent',label:'침묵한다',description:'방어의 각오를 다지고 견딜 준비를 합니다.',icon:'◆',styleVariant:'SECONDARY',effects:[{kind:'APPLY_EFFECT',effectId:'defense_up',scope:'EXPEDITION'}],resultText:'침묵 속에서 방어 준비가 강화되었습니다.'},
      skip('고해실을 지나쳐 나아갑니다.')
    ]
  },
  {
    id:'kaleon_anointing_store',
    type:'RISK',
    tags:['RESOURCE','RECOVERY','RISK_REWARD','LORE'],
    title:'녹빛 성유 저장고',
    description:'오래된 성유와 약초 추출물이 보관된 저장실입니다. 안전한 약품에서는 회복 포션을 얻을 수 있지만, 깊은 곳의 봉인 용기는 오염된 녹빛 성유일지도 모릅니다.',
    towerIds:['kaleon'],
    weight:.7,
    choices:[
      {id:'safe_salvage',label:'안전한 약품을 챙긴다',description:'봉인되지 않은 선반에서 회복 포션을 확보합니다.',icon:'▣',styleVariant:'PRIMARY',effects:[{kind:'ADD_POTION',potion:'healing_lesser',amount:1}],resultText:'하급 회복 포션을 챙겼습니다.'},
      {id:'deep_investigate',label:'봉인된 용기를 조사한다',description:'깊은 곳의 봉인 용기를 열면 추가 약초를 얻을 수 있지만 중독될 위험이 있습니다.',icon:'⚠',styleVariant:'DANGER',effects:[],outcomes:[
        {id:'rich_extract',weight:2,effects:[{kind:'ADD_TEMP_LOOT',loot:{kind:'MATERIAL',tower:'CURRENT',tier:'CURRENT',amount:4}},{kind:'ADD_POTION',potion:'healing_standard',amount:1}],resultText:'농축된 녹빛 추출물과 중급 회복 포션을 확보했습니다.'},
        {id:'corrupted_anointing',weight:1,effects:[{kind:'TAKE_DAMAGE_RATIO',ratio:.15,minimum:12},{kind:'APPLY_EFFECT',effectId:'green_incense',scope:'EXPEDITION'}],resultText:'오염된 녹빛 성유에 중독되었습니다.'}
      ]},
      skip('저장고를 봉인한 채로 탐사를 계속합니다.')
    ],
    rewardPreview:[{label:'하급 회복 포션',iconAssetKey:'potion',note:'확정'},{label:'칼레온 재료',note:'현재 티어 (확률)'},{label:'중급 회복 포션',iconAssetKey:'potion',note:'확률'}]
  }
];
