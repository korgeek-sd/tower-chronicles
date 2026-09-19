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

/** Red Fang Sanctuary authored exploration events. */
export const LEATHER_EVENTS:ExpeditionEventDefinition[]=[
  {
    id:'leather_blood_trail',
    type:'RISK',
    tags:['DISCOVERY','RESOURCE','RISK_REWARD','LORE'],
    title:'핏자국 추적',
    description:'바닥에 선명한 핏자국이 나 있습니다. 안전하게 가장자리만 따라가며 가죽을 수거하거나, 더 깊은 곳으로 따라가 더 많은 전리품을 노릴 수 있습니다.',
    towerIds:['leather'],
    weight:.9,
    choices:[
      {id:'careful_follow',label:'안전하게 따라간다',description:'핏자국 가장자리에서 떨어져 나온 가죽 조각만 수거합니다.',icon:'◇',styleVariant:'PRIMARY',effects:[{kind:'ADD_TEMP_LOOT',loot:{kind:'MATERIAL',tower:'CURRENT',tier:'CURRENT',amount:3}}],resultText:'안전한 거리에서 가죽을 확보했습니다.'},
      {id:'deep_track',label:'깊숙이 추적한다',description:'사냥감의 본거지를 찾아 더 많은 가죽을 노리지만 포식자와 마주칠 수 있습니다.',icon:'⚠',styleVariant:'DANGER',effects:[],outcomes:[
        {id:'rich_kill_site',weight:2,effects:[{kind:'ADD_TEMP_LOOT',loot:{kind:'MATERIAL',tower:'CURRENT',tier:'CURRENT',amount:6}},{kind:'ADD_EXPEDITION_SILVER',amount:15}],resultText:'사냥터 중심에서 질 좋은 가죽 다량과 은화를 확보했습니다.'},
        {id:'ambushed',weight:1,effects:[{kind:'TAKE_DAMAGE_RATIO',ratio:.15,minimum:12}],resultText:'매복해 있던 포식자의 기습을 받았습니다.'}
      ]},
      skip('핏자국을 남겨두고 탐사를 계속합니다.')
    ],
    rewardPreview:[{label:'붉은 송곳니 재료',note:'현재 티어'}]
  },
  {
    id:'leather_abandoned_camp',
    type:'RECOVERY',
    tags:['RECOVERY','STATUS','LORE'],
    title:'버려진 사냥꾼 야영지',
    description:'오래전 무리가 떠난 야영지입니다. 꺼지지 않은 모닥불과 마른 고기, 손질된 가죽이 남아 있습니다. 무리의 온기가 아직 남아 있어 상처를 돌볼 수 있습니다.',
    towerIds:['leather'],
    weight:.65,
    conditions:[{kind:'PLAYER_HP_BELOW',ratio:.9}],
    choices:[
      {id:'rest_at_camp',label:'야영지에서 쉰다',description:'모닥불 곁에서 상처를 치료하고 체력을 회복합니다.',icon:'✚',styleVariant:'PRIMARY',effects:[{kind:'HEAL_HP',ratio:.25},{kind:'REMOVE_EFFECT',effectId:'poison'},{kind:'REMOVE_EFFECT',effectId:'predator_wound'}],resultText:'야영지의 온기로 상처를 씻고 독기를 털어냈습니다.'},
      skip('야영지를 지나쳐 계속 나아갑니다.')
    ]
  },
  {
    id:'leather_ritual_altar',
    type:'RISK',
    tags:['RESOURCE','RISK_REWARD','LORE'],
    title:'의식의 제단',
    description:'뼈와 가죽으로 쌓아 올린 원시적인 제단입니다. 피 묻은 제물과 제례용 도구가 놓여 있습니다. 제단에 제물을 바치면 가죽을 얻을 수 있지만, 무리의 주의를 끌지도 모릅니다.',
    towerIds:['leather'],
    weight:.55,
    choices:[
      {id:'offer_tribute',label:'제물을 바친다',description:'자신의 피를 제물로 바치고 가죽을 얻으려 시도합니다.',icon:'⚠',styleVariant:'DANGER',effects:[],outcomes:[
        {id:'blessed_hide',weight:2,effects:[{kind:'ADD_TEMP_LOOT',loot:{kind:'MATERIAL',tower:'CURRENT',tier:'CURRENT',amount:5}},{kind:'ADD_EXPEDITION_SILVER',amount:20}],resultText:'제단이 응답해 질긴 가죽과 은화를 내어주었습니다.'},
        {id:'pack_wrath',weight:1,effects:[{kind:'TAKE_DAMAGE_RATIO',ratio:.18,minimum:15},{kind:'APPLY_EFFECT',effectId:'ritual_brand',scope:'EXPEDITION'}],resultText:'무리의 분노가 제단을 통해 되돌아왔습니다.'}
      ]},
      skip('제단을 건드리지 않고 지나갑니다.')
    ],
    rewardPreview:[{label:'붉은 송곳니 재료',note:'현재 티어'},{label:'Silver',iconAssetKey:'silver',note:'원정 임시 보관'}]
  },
  {
    id:'leather_alpha_den',
    type:'STATUS',
    tags:['STATUS','LORE'],
    title:'알파의 둥지',
    description:'무리 우두머리가 머물던 둥지입니다. 발톱 자국과 이빨 자국이 벽면을 뒤덮고 있습니다. 알파의 흔적을 따라 공격의 의지를 다지거나, 방어의 각오를 굳힐 수 있습니다.',
    towerIds:['leather'],
    weight:.6,
    choices:[
      {id:'embrace_ferocity',label:'사나움을 받아들인다',description:'알파의 흔적에서 포식자의 본능을 깨웁니다.',icon:'⚔',styleVariant:'PRIMARY',effects:[{kind:'APPLY_EFFECT',effectId:'attack_up',scope:'EXPEDITION'}],resultText:'알파의 기세를 이어받아 공격 준비가 강화되었습니다.'},
      {id:'learn_caution',label:'경계를 배운다',description:'무리 우두머리의 신중함을 본받습니다.',icon:'◆',styleVariant:'SECONDARY',effects:[{kind:'APPLY_EFFECT',effectId:'defense_up',scope:'EXPEDITION'}],resultText:'알파의 신중함을 배워 방어 준비가 강화되었습니다.'},
      skip('둥지를 지나쳐 나아갑니다.')
    ]
  },
  {
    id:'leather_scavenger_cache',
    type:'RISK',
    tags:['RESOURCE','RECOVERY','RISK_REWARD','LORE'],
    title:'청소부의 은신처',
    description:'하이에나 같은 청소부들이 모아둔 은신처입니다. 안전한 곳에는 회복 포션이, 깊은 곳에는 농축된 가죽 추출물이 있지만 독기에 중독될 위험이 있습니다.',
    towerIds:['leather'],
    weight:.7,
    choices:[
      {id:'safe_take',label:'안전한 약품을 챙긴다',description:'입구 쪽 선반에서 회복 포션을 확보합니다.',icon:'▣',styleVariant:'PRIMARY',effects:[{kind:'ADD_POTION',potion:'healing_lesser',amount:1}],resultText:'하급 회복 포션을 챙겼습니다.'},
      {id:'deep_search',label:'깊은 곳을 뒤진다',description:'안쪽 깊숙한 곳의 농축 추출물을 노리지만 맹독에 당할 수 있습니다.',icon:'⚠',styleVariant:'DANGER',effects:[],outcomes:[
        {id:'concentrated_hide',weight:2,effects:[{kind:'ADD_TEMP_LOOT',loot:{kind:'MATERIAL',tower:'CURRENT',tier:'CURRENT',amount:4}},{kind:'ADD_POTION',potion:'healing_standard',amount:1}],resultText:'농축된 가죽 추출물과 중급 회복 포션을 확보했습니다.'},
        {id:'toxic_gas',weight:1,effects:[{kind:'TAKE_DAMAGE_RATIO',ratio:.15,minimum:12},{kind:'APPLY_EFFECT',effectId:'poison',scope:'EXPEDITION'}],resultText:'청소부들의 독가스에 중독되었습니다.'}
      ]},
      skip('은신처를 봉인한 채로 탐사를 계속합니다.')
    ],
    rewardPreview:[{label:'하급 회복 포션',iconAssetKey:'potion',note:'확정'},{label:'붉은 송곳니 재료',note:'현재 티어 (확률)'},{label:'중급 회복 포션',iconAssetKey:'potion',note:'확률'}]
  }
];