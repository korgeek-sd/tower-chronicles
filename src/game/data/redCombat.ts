import type {MonsterDefinition} from '../engine/monsterAi';

export const RED_NORMAL_DEFINITIONS:MonsterDefinition[]=[
 {
  id:'wasteland_boar',name:'황야 멧돼지',
  skills:[
   {id:'boar_hide_brace',name:'거친가죽 버티기',description:'질긴 가죽과 자세로 방어를 끌어올립니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'defense_up'}]},
   {id:'boar_charge',name:'황야 돌진',description:'한 턴 자세를 낮춘 뒤 거칠게 돌진합니다.',cooldown:3,kind:'charge',multiplier:1.75}
  ],
  aiRules:[
   {id:'brace',priority:20,actionId:'boar_hide_brace',conditions:[{kind:'SELF_MISSING_EFFECT',effectId:'defense_up'},{kind:'SKILL_READY',skillId:'boar_hide_brace'}]},
   {id:'charge',priority:10,actionId:'boar_charge',conditions:[{kind:'SKILL_READY',skillId:'boar_charge'}]}
  ]
 },
 {
  id:'thorn_jackal',name:'가시 자칼',
  skills:[
   {id:'thorn_bite',name:'가시교상',description:'날카로운 이빨로 물어 출혈을 남깁니다.',cooldown:1,kind:'damage',multiplier:1.0,effects:[{target:'TARGET',effectId:'fang_wound'}]},
   {id:'blood_scent_bite',name:'피냄새 추격',description:'상처 입은 대상을 집요하게 물어뜯습니다.',cooldown:2,kind:'damage',multiplier:1.45}
  ],
  aiRules:[
   {id:'hunt-wounded',priority:20,actionId:'blood_scent_bite',conditions:[{kind:'TARGET_HAS_EFFECT',effectId:'fang_wound'},{kind:'SKILL_READY',skillId:'blood_scent_bite'}]},
   {id:'bite',priority:10,actionId:'thorn_bite',conditions:[{kind:'SKILL_READY',skillId:'thorn_bite'}]}
  ]
 },
 {
  id:'carrion_vulture',name:'썩은날 독수리',
  skills:[
   {id:'wing_feint',name:'흙먼지 날갯짓',description:'흙먼지를 일으켜 방어를 흐트러뜨립니다.',cooldown:3,kind:'effect',effects:[{target:'TARGET',effectId:'weaken'}]},
   {id:'carrion_dive',name:'부리연격',description:'급강하하며 두 차례 연속으로 쪼아댑니다.',cooldown:2,kind:'damage',hits:2,multiplier:.72}
  ],
  aiRules:[
   {id:'feint',priority:20,actionId:'wing_feint',conditions:[{kind:'TARGET_MISSING_EFFECT',effectId:'weaken'},{kind:'SKILL_READY',skillId:'wing_feint'}]},
   {id:'dive',priority:10,actionId:'carrion_dive',conditions:[{kind:'SKILL_READY',skillId:'carrion_dive'}]}
  ]
 },
 {
  id:'hide_gnawer',name:'가죽 갉는 하이에나',
  skills:[
   {id:'gnaw_wound',name:'가죽뜯기',description:'질긴 부위를 노려 물어 출혈을 누적합니다.',cooldown:1,kind:'damage',multiplier:1.05,effects:[{target:'TARGET',effectId:'fang_wound'}]},
   {id:'gnaw_frenzy',name:'포식흥분',description:'상처와 피냄새에 흥분해 공격력이 상승합니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'attack_up'}]},
   {id:'rending_bite',name:'찢는교상',description:'출혈이 깊어진 대상을 강하게 찢습니다.',cooldown:2,kind:'damage',multiplier:1.6}
  ],
  aiRules:[
   {id:'rend',priority:30,actionId:'rending_bite',conditions:[{kind:'TARGET_EFFECT_STACKS_AT_LEAST',effectId:'fang_wound',requiredStacks:2},{kind:'SKILL_READY',skillId:'rending_bite'}]},
   {id:'frenzy',priority:20,actionId:'gnaw_frenzy',conditions:[{kind:'SELF_HP_BELOW',value:.55},{kind:'SELF_MISSING_EFFECT',effectId:'attack_up'},{kind:'SKILL_READY',skillId:'gnaw_frenzy'}]},
   {id:'gnaw',priority:10,actionId:'gnaw_wound',conditions:[{kind:'SKILL_READY',skillId:'gnaw_wound'}]}
  ]
 },
 {
  id:'pack_vanguard',name:'무리 선봉',
  skills:[
   {id:'vanguard_counter_prepare',name:'선봉 반격 자세',description:'정면 직접 공격을 받아칠 준비를 합니다.',cooldown:4,kind:'reactive_prepare',reactiveTrigger:'DIRECT_HIT_RECEIVED',reactionSkillId:'vanguard_counter'},
   {id:'vanguard_counter',name:'선봉 반격',description:'공격자의 빈틈을 노려 즉시 반격합니다.',cooldown:0,kind:'damage',multiplier:.68},
   {id:'vanguard_howl',name:'선봉 포효',description:'무리의 기세를 끌어올려 공격력을 높입니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'attack_up'}]},
   {id:'vanguard_charge',name:'송곳니 돌파',description:'한 턴 준비한 뒤 정면을 돌파합니다.',cooldown:3,kind:'charge',multiplier:1.9}
  ],
  aiRules:[
   {id:'counter',priority:30,actionId:'vanguard_counter_prepare',conditions:[{kind:'SKILL_READY',skillId:'vanguard_counter_prepare'}]},
   {id:'howl',priority:20,actionId:'vanguard_howl',conditions:[{kind:'SELF_MISSING_EFFECT',effectId:'attack_up'},{kind:'SKILL_READY',skillId:'vanguard_howl'}]},
   {id:'charge',priority:10,actionId:'vanguard_charge',conditions:[{kind:'SKILL_READY',skillId:'vanguard_charge'}]}
  ]
 }
];
