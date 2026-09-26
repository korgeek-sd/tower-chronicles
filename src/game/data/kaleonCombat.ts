import type {MonsterDefinition} from '../engine/monsterAi';

export const KALEON_NORMAL_DEFINITIONS:MonsterDefinition[]=[
 {
  id:'moss_spirit',name:'이끼 정령',
  skills:[{id:'moss_regen',name:'녹빛 재생',description:'자가 재생을 활성화합니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'kaleon_regen'}]}],
  aiRules:[{id:'regen',priority:20,actionId:'moss_regen',conditions:[{kind:'SELF_HP_BELOW',value:.7},{kind:'SELF_MISSING_EFFECT',effectId:'kaleon_regen'},{kind:'SKILL_READY',skillId:'moss_regen'}]}]
 },
 {
  id:'spore_hound',name:'포자 사냥개',
  skills:[
   {id:'spore_bite',name:'포자 이빨',description:'상처에 병성 포자를 심습니다.',cooldown:2,kind:'damage',multiplier:1.05,effects:[{target:'TARGET',effectId:'kaleon_blight'}]},
   {id:'sick_hunt',name:'병든 사냥',description:'오염된 대상을 집요하게 물어뜯습니다.',cooldown:2,kind:'damage',multiplier:1.45}
  ],
  aiRules:[
   {id:'hunt',priority:30,actionId:'sick_hunt',conditions:[{kind:'TARGET_HAS_EFFECT',effectId:'kaleon_blight'},{kind:'SKILL_READY',skillId:'sick_hunt'}]},
   {id:'bite',priority:20,actionId:'spore_bite',conditions:[{kind:'TARGET_MISSING_EFFECT',effectId:'kaleon_blight'},{kind:'SKILL_READY',skillId:'spore_bite'}]}
  ]
 },
 {
  id:'graft_stag',name:'접목뿔 사슴',
  skills:[
   {id:'bark_growth',name:'수피 증식',description:'비정상적으로 증식한 조직이 몸을 감쌉니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'kaleon_overgrowth'}]},
   {id:'graft_charge',name:'접목 돌진',description:'한 턴 준비 후 거대한 뿔로 돌진합니다.',cooldown:3,kind:'charge',multiplier:2.0}
  ],
  aiRules:[
   {id:'growth',priority:30,actionId:'bark_growth',conditions:[{kind:'SELF_MISSING_EFFECT',effectId:'kaleon_overgrowth'},{kind:'SKILL_READY',skillId:'bark_growth'}]},
   {id:'charge',priority:20,actionId:'graft_charge',conditions:[{kind:'SKILL_READY',skillId:'graft_charge'}]}
  ]
 },
 {
  id:'blight_leech',name:'녹병 거머리',
  skills:[
   {id:'blight_infect',name:'녹병 주입',description:'대상에게 녹병을 퍼뜨립니다.',cooldown:2,kind:'effect',effects:[{target:'TARGET',effectId:'kaleon_blight'}]},
   {id:'green_drain',name:'생기 흡수',description:'피해를 입히며 재생을 활성화합니다.',cooldown:3,kind:'damage',multiplier:1.15,effects:[{target:'SELF',effectId:'kaleon_regen'}]}
  ],
  aiRules:[
   {id:'infect',priority:30,actionId:'blight_infect',conditions:[{kind:'TARGET_MISSING_EFFECT',effectId:'kaleon_blight'},{kind:'SKILL_READY',skillId:'blight_infect'}]},
   {id:'drain',priority:20,actionId:'green_drain',conditions:[{kind:'SELF_HP_BELOW',value:.75},{kind:'SKILL_READY',skillId:'green_drain'}]}
  ]
 },
 {
  id:'receptor_aberrant',name:'수용체 변이체',
  skills:[
   {id:'transfer_mark',name:'전이 표식',description:'고통을 옮기기 위한 표식을 누적합니다.',cooldown:1,kind:'effect',effects:[{target:'TARGET',effectId:'kaleon_transfer_mark'}]},
   {id:'transfer_crush',name:'고통 역류',description:'전이 표식이 겹친 대상에게 강한 충격을 되돌립니다.',cooldown:3,kind:'damage',multiplier:1.75},
   {id:'receptor_regen',name:'수용 재생',description:'손상된 조직을 빠르게 재생합니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'kaleon_regen'}]}
  ],
  aiRules:[
   {id:'crush',priority:40,actionId:'transfer_crush',conditions:[{kind:'TARGET_EFFECT_STACKS_AT_LEAST',effectId:'kaleon_transfer_mark',requiredStacks:2},{kind:'SKILL_READY',skillId:'transfer_crush'}]},
   {id:'regen',priority:30,actionId:'receptor_regen',conditions:[{kind:'SELF_HP_BELOW',value:.55},{kind:'SELF_MISSING_EFFECT',effectId:'kaleon_regen'},{kind:'SKILL_READY',skillId:'receptor_regen'}]},
   {id:'mark',priority:20,actionId:'transfer_mark',conditions:[{kind:'SKILL_READY',skillId:'transfer_mark'}]}
  ]
 }
];

export const KALEON_BOSS_DEFINITIONS:MonsterDefinition[]=[
 {
  id:'greenwrought_gatekeeper',name:'녹화된 수문장',
  skills:[
   {id:'gate_growth',name:'녹화 장갑',description:'증식 조직으로 방어를 굳힙니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'kaleon_overgrowth'}]},
   {id:'gate_charge',name:'봉쇄 돌진',description:'한 턴 준비 후 침입자를 밀어냅니다.',cooldown:3,kind:'charge',multiplier:2.15}
  ],
  aiRules:[
   {id:'growth',priority:30,actionId:'gate_growth',conditions:[{kind:'SELF_MISSING_EFFECT',effectId:'kaleon_overgrowth'},{kind:'SKILL_READY',skillId:'gate_growth'}]},
   {id:'charge',priority:20,actionId:'gate_charge',conditions:[{kind:'SKILL_READY',skillId:'gate_charge'}]}
  ]
 },
 {
  id:'overgrowth_regenerator',name:'과잉재생 포식체',
  skills:[
   {id:'overflow_regen',name:'과잉 재생',description:'비정상적인 속도로 육체를 복구합니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'kaleon_regen'}]},
   {id:'rupture_bite',name:'증식 파열',description:'오염 조직을 터뜨려 녹병을 남깁니다.',cooldown:2,kind:'damage',multiplier:1.25,effects:[{target:'TARGET',effectId:'kaleon_blight'}]}
  ],
  aiRules:[
   {id:'regen',priority:30,actionId:'overflow_regen',conditions:[{kind:'SELF_HP_BELOW',value:.8},{kind:'SELF_MISSING_EFFECT',effectId:'kaleon_regen'},{kind:'SKILL_READY',skillId:'overflow_regen'}]},
   {id:'bite',priority:20,actionId:'rupture_bite',conditions:[{kind:'SKILL_READY',skillId:'rupture_bite'}]}
  ]
 },
 {
  id:'transfer_subject_c17',name:'전이실험체 C-17',
  skills:[
   {id:'c17_mark',name:'전이 표식',description:'고통의 전이 경로를 새깁니다.',cooldown:1,kind:'effect',effects:[{target:'TARGET',effectId:'kaleon_transfer_mark'}]},
   {id:'c17_backflow',name:'전이 역류',description:'누적된 전이 표식을 따라 고통을 되돌립니다.',cooldown:3,kind:'damage',multiplier:2.0}
  ],
  aiRules:[
   {id:'backflow',priority:30,actionId:'c17_backflow',conditions:[{kind:'TARGET_EFFECT_STACKS_AT_LEAST',effectId:'kaleon_transfer_mark',requiredStacks:3},{kind:'SKILL_READY',skillId:'c17_backflow'}]},
   {id:'mark',priority:20,actionId:'c17_mark',conditions:[{kind:'SKILL_READY',skillId:'c17_mark'}]}
  ]
 },
 {
  id:'atonement_prototype',name:'대속의 원형체',
  skills:[
   {id:'atonement_counter_prepare',name:'대속 반응 준비',description:'직접 피격을 받은 순간 고통을 되돌릴 준비를 합니다.',cooldown:3,kind:'reactive_prepare',reactiveTrigger:'DIRECT_HIT_RECEIVED',reactionSkillId:'atonement_counter'},
   {id:'atonement_counter',name:'고통 반환',description:'받아들인 고통의 일부를 즉시 되돌립니다.',cooldown:0,kind:'damage',multiplier:1.0},
   {id:'atonement_regen',name:'대속 재생',description:'흡수한 고통을 조직 재생으로 바꿉니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'kaleon_regen'}]},
   {id:'atonement_blight',name:'오염 이전',description:'축적된 오염을 대상에게 옮깁니다.',cooldown:2,kind:'effect',effects:[{target:'TARGET',effectId:'kaleon_blight'}]}
  ],
  aiRules:[
   {id:'reactive',priority:40,actionId:'atonement_counter_prepare',conditions:[{kind:'SKILL_READY',skillId:'atonement_counter_prepare'}]},
   {id:'regen',priority:30,actionId:'atonement_regen',conditions:[{kind:'SELF_HP_BELOW',value:.6},{kind:'SELF_MISSING_EFFECT',effectId:'kaleon_regen'},{kind:'SKILL_READY',skillId:'atonement_regen'}]},
   {id:'blight',priority:20,actionId:'atonement_blight',conditions:[{kind:'TARGET_MISSING_EFFECT',effectId:'kaleon_blight'},{kind:'SKILL_READY',skillId:'atonement_blight'}]}
  ]
 },
 {
  id:'false_saint_caleon',name:'거짓 성자 칼레온',
  skills:[
   {id:'saint_ward',name:'수용자의 장벽',description:'오염을 억누르는 조직 장벽을 전개합니다.',cooldown:5,kind:'effect',effects:[{target:'SELF',effectId:'kaleon_saint_ward'}]},
   {id:'caleon_mark',name:'고통의 전이',description:'대상에게 전이 표식을 누적합니다.',cooldown:1,kind:'effect',effects:[{target:'TARGET',effectId:'kaleon_transfer_mark'}]},
   {id:'caleon_blight',name:'녹화 누출',description:'억제하던 오염 일부가 새어 나옵니다.',cooldown:3,kind:'effect',effects:[{target:'TARGET',effectId:'kaleon_blight'}]},
   {id:'caleon_backflow',name:'대속 역류',description:'누적된 전이 표식을 따라 압축된 고통을 되돌립니다.',cooldown:3,kind:'damage',multiplier:2.1},
   {id:'last_receptor',name:'마지막 수용',description:'쇠약해진 칼레온이 남은 오염을 끌어안고 강한 일격을 준비합니다.',cooldown:4,kind:'charge',multiplier:2.7}
  ],
  aiRules:[
   {id:'ward',priority:50,actionId:'saint_ward',conditions:[{kind:'SELF_MISSING_EFFECT',effectId:'kaleon_saint_ward'},{kind:'SKILL_READY',skillId:'saint_ward'}]},
   {id:'last',priority:40,actionId:'last_receptor',conditions:[{kind:'SELF_HP_BELOW',value:.45},{kind:'SKILL_READY',skillId:'last_receptor'}]},
   {id:'backflow',priority:35,actionId:'caleon_backflow',conditions:[{kind:'TARGET_EFFECT_STACKS_AT_LEAST',effectId:'kaleon_transfer_mark',requiredStacks:3},{kind:'SKILL_READY',skillId:'caleon_backflow'}]},
   {id:'blight',priority:30,actionId:'caleon_blight',conditions:[{kind:'TARGET_MISSING_EFFECT',effectId:'kaleon_blight'},{kind:'SKILL_READY',skillId:'caleon_blight'}]},
   {id:'mark',priority:20,actionId:'caleon_mark',conditions:[{kind:'SKILL_READY',skillId:'caleon_mark'}]}
  ]
 }
];
