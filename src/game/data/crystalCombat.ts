import type {MonsterDefinition} from '../engine/monsterAi';

export const CRYSTAL_NORMAL_DEFINITIONS:MonsterDefinition[]=[
 {
  id:'quartz_carapace_beetle',name:'석영등갑충',
  skills:[
   {id:'quartz_shell',name:'결정막',description:'결정 보호막을 전개합니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'crystal_shell'}]},
   {id:'carapace_slam',name:'갑각충돌',description:'무거운 등갑으로 들이받습니다.',cooldown:2,kind:'damage',multiplier:1.35}
  ],
  aiRules:[
   {id:'shell',priority:20,actionId:'quartz_shell',conditions:[{kind:'SELF_MISSING_EFFECT',effectId:'crystal_shell'},{kind:'SKILL_READY',skillId:'quartz_shell'}]},
   {id:'slam',priority:10,actionId:'carapace_slam',conditions:[{kind:'SKILL_READY',skillId:'carapace_slam'}]}
  ]
 },
 {
  id:'glassjaw_stalker',name:'유리턱 추적충',
  skills:[
   {id:'glass_bite',name:'쇄광교상',description:'결정턱으로 강하게 물어뜯습니다.',cooldown:2,kind:'damage',multiplier:1.5},
   {id:'predatory_focus',name:'포식흥분',description:'공격성을 끌어올립니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'attack_up'}]}
  ],
  aiRules:[
   {id:'focus',priority:20,actionId:'predatory_focus',conditions:[{kind:'SELF_MISSING_EFFECT',effectId:'attack_up'},{kind:'SKILL_READY',skillId:'predatory_focus'}]},
   {id:'bite',priority:10,actionId:'glass_bite',conditions:[{kind:'SKILL_READY',skillId:'glass_bite'}]}
  ]
 },
 {
  id:'refractive_scale_lizard',name:'굴절비늘 도마뱀',
  skills:[
   {id:'refraction_stance',name:'굴절자세',description:'직접 피격에 반응할 준비를 합니다.',cooldown:4,kind:'reactive_prepare',reactiveTrigger:'DIRECT_HIT_RECEIVED',reactionSkillId:'refraction_tail'},
   {id:'refraction_tail',name:'반광꼬리치기',description:'굴절잔상 뒤에서 즉시 반격합니다.',cooldown:0,kind:'damage',multiplier:.72},
   {id:'dulling_glare',name:'탁광분사',description:'빛을 흐려 공격력을 낮춥니다.',cooldown:3,kind:'effect',effects:[{target:'TARGET',effectId:'crystal_glare'}]}
  ],
  aiRules:[
   {id:'counter',priority:20,actionId:'refraction_stance',conditions:[{kind:'SKILL_READY',skillId:'refraction_stance'}]},
   {id:'glare',priority:10,actionId:'dulling_glare',conditions:[{kind:'TARGET_MISSING_EFFECT',effectId:'crystal_glare'},{kind:'SKILL_READY',skillId:'dulling_glare'}]}
  ]
 },
 {
  id:'echo_crystal',name:'반향결정체',
  skills:[
   {id:'echo_stance',name:'반향대기',description:'직접 충격에 반응할 준비를 합니다.',cooldown:4,kind:'reactive_prepare',reactiveTrigger:'DIRECT_HIT_RECEIVED',reactionSkillId:'echo_burst'},
   {id:'echo_burst',name:'반향충격',description:'축적한 충격을 즉시 되돌립니다.',cooldown:0,kind:'damage',multiplier:.8},
   {id:'crystal_pressure',name:'결정압박',description:'결정질 몸체로 압박합니다.',cooldown:2,kind:'damage',multiplier:1.3}
  ],
  aiRules:[
   {id:'echo',priority:20,actionId:'echo_stance',conditions:[{kind:'SKILL_READY',skillId:'echo_stance'}]},
   {id:'pressure',priority:10,actionId:'crystal_pressure',conditions:[{kind:'SKILL_READY',skillId:'crystal_pressure'}]}
  ]
 },
 {
  id:'vein_clinger',name:'광맥흡착체',
  skills:[
   {id:'vein_regen',name:'광맥흡수',description:'광맥의 힘으로 체력을 회복합니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'crystal_regen'}]},
   {id:'vein_harden',name:'광맥경화',description:'광질을 응축해 방어를 높입니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'crystal_hardening'}]}
  ],
  aiRules:[
   {id:'regen',priority:20,actionId:'vein_regen',conditions:[{kind:'SELF_HP_BELOW',value:.65},{kind:'SELF_MISSING_EFFECT',effectId:'crystal_regen'},{kind:'SKILL_READY',skillId:'vein_regen'}]},
   {id:'harden',priority:10,actionId:'vein_harden',conditions:[{kind:'SELF_MISSING_EFFECT',effectId:'crystal_hardening'},{kind:'SKILL_READY',skillId:'vein_harden'}]}
  ]
 },
 {
  id:'crystal_needle_centipede',name:'수정침 지네',
  skills:[
   {id:'crystal_venom',name:'광독침',description:'수정침으로 광독을 남깁니다.',cooldown:2,kind:'effect',effects:[{target:'TARGET',effectId:'crystal_venom'}]},
   {id:'needle_bite',name:'독니찌르기',description:'광독에 물든 대상을 강하게 찌릅니다.',cooldown:2,kind:'damage',multiplier:1.35}
  ],
  aiRules:[
   {id:'bite-poisoned',priority:20,actionId:'needle_bite',conditions:[{kind:'TARGET_HAS_EFFECT',effectId:'crystal_venom'},{kind:'SKILL_READY',skillId:'needle_bite'}]},
   {id:'venom',priority:10,actionId:'crystal_venom',conditions:[{kind:'TARGET_MISSING_EFFECT',effectId:'crystal_venom'},{kind:'SKILL_READY',skillId:'crystal_venom'}]}
  ]
 },
 {
  id:'whiteglow_burrower',name:'백광 굴착충',
  skills:[
   {id:'whiteglow_charge',name:'백광돌진',description:'한 턴 준비한 뒤 돌진합니다.',cooldown:3,kind:'charge',multiplier:1.9},
   {id:'ground_harden',name:'지각경화',description:'결정층을 두껍게 만듭니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'crystal_hardening'}]}
  ],
  aiRules:[
   {id:'harden',priority:20,actionId:'ground_harden',conditions:[{kind:'SELF_MISSING_EFFECT',effectId:'crystal_hardening'},{kind:'SKILL_READY',skillId:'ground_harden'}]},
   {id:'charge',priority:10,actionId:'whiteglow_charge',conditions:[{kind:'SKILL_READY',skillId:'whiteglow_charge'}]}
  ]
 },
 {
  id:'clouded_crystal_beast',name:'탁정 갑각수',
  skills:[
   {id:'clouded_dust',name:'탁정분진',description:'탁한 결정가루로 공격력을 낮춥니다.',cooldown:3,kind:'effect',effects:[{target:'TARGET',effectId:'crystal_glare'}]},
   {id:'heavy_headbutt',name:'중갑박치기',description:'두꺼운 갑각으로 들이받습니다.',cooldown:2,kind:'damage',multiplier:1.4}
  ],
  aiRules:[
   {id:'dust',priority:20,actionId:'clouded_dust',conditions:[{kind:'TARGET_MISSING_EFFECT',effectId:'crystal_glare'},{kind:'SKILL_READY',skillId:'clouded_dust'}]},
   {id:'headbutt',priority:10,actionId:'heavy_headbutt',conditions:[{kind:'SKILL_READY',skillId:'heavy_headbutt'}]}
  ]
 },
 {
  id:'translucent_bat',name:'투광박쥐',
  skills:[
   {id:'scattered_light',name:'산란광',description:'빛을 흩어 공격력을 낮춥니다.',cooldown:3,kind:'effect',effects:[{target:'TARGET',effectId:'crystal_glare'}]},
   {id:'falling_glow',name:'낙광습격',description:'한 턴 준비 후 급강하합니다.',cooldown:3,kind:'charge',multiplier:1.8}
  ],
  aiRules:[
   {id:'glare',priority:20,actionId:'scattered_light',conditions:[{kind:'TARGET_MISSING_EFFECT',effectId:'crystal_glare'},{kind:'SKILL_READY',skillId:'scattered_light'}]},
   {id:'dive',priority:10,actionId:'falling_glow',conditions:[{kind:'SKILL_READY',skillId:'falling_glow'}]}
  ]
 },
 {
  id:'shardback_spider',name:'파편등 거미',
  skills:[
   {id:'crystal_spit',name:'수정독액',description:'광독이 섞인 액체를 뿜습니다.',cooldown:3,kind:'effect',effects:[{target:'TARGET',effectId:'crystal_venom'}]},
   {id:'shard_bite',name:'파편물기',description:'날카로운 결정턱으로 물어뜯습니다.',cooldown:2,kind:'damage',multiplier:1.35}
  ],
  aiRules:[
   {id:'venom',priority:20,actionId:'crystal_spit',conditions:[{kind:'TARGET_MISSING_EFFECT',effectId:'crystal_venom'},{kind:'SKILL_READY',skillId:'crystal_spit'}]},
   {id:'bite',priority:10,actionId:'shard_bite',conditions:[{kind:'SKILL_READY',skillId:'shard_bite'}]}
  ]
 },
 {
  id:'crystalhorn_goat',name:'결정뿔 산양',
  skills:[
   {id:'horn_charge',name:'결정뿔 돌진',description:'한 턴 준비한 뒤 뿔로 돌진합니다.',cooldown:3,kind:'charge',multiplier:1.95},
   {id:'cornered_beast',name:'몰린 짐승',description:'위기에 몰리면 공격력이 상승합니다.',cooldown:5,kind:'effect',effects:[{target:'SELF',effectId:'attack_up'}]}
  ],
  aiRules:[
   {id:'rage',priority:20,actionId:'cornered_beast',conditions:[{kind:'SELF_HP_BELOW',value:.45},{kind:'SELF_MISSING_EFFECT',effectId:'attack_up'},{kind:'SKILL_READY',skillId:'cornered_beast'}]},
   {id:'charge',priority:10,actionId:'horn_charge',conditions:[{kind:'SKILL_READY',skillId:'horn_charge'}]}
  ]
 },
 {
  id:'lens_eye_watcher',name:'렌즈눈 감시충',
  skills:[
   {id:'focused_gaze',name:'집광주시',description:'집중광으로 공격력을 낮춥니다.',cooldown:3,kind:'effect',effects:[{target:'TARGET',effectId:'crystal_glare'}]},
   {id:'focused_beam',name:'집광사출',description:'한 턴 집광한 뒤 강한 충격을 냅니다.',cooldown:3,kind:'charge',multiplier:1.9}
  ],
  aiRules:[
   {id:'gaze',priority:20,actionId:'focused_gaze',conditions:[{kind:'TARGET_MISSING_EFFECT',effectId:'crystal_glare'},{kind:'SKILL_READY',skillId:'focused_gaze'}]},
   {id:'beam',priority:10,actionId:'focused_beam',conditions:[{kind:'SKILL_READY',skillId:'focused_beam'}]}
  ]
 },
 {
  id:'hardening_slime',name:'경화수액충',
  skills:[
   {id:'condensed_membrane',name:'응결막',description:'결정성 보호막을 만듭니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'crystal_shell'}]},
   {id:'mineral_recovery',name:'광질회복',description:'상처를 광물질로 메우며 회복합니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'crystal_regen'}]}
  ],
  aiRules:[
   {id:'heal',priority:20,actionId:'mineral_recovery',conditions:[{kind:'SELF_HP_BELOW',value:.55},{kind:'SELF_MISSING_EFFECT',effectId:'crystal_regen'},{kind:'SKILL_READY',skillId:'mineral_recovery'}]},
   {id:'shield',priority:10,actionId:'condensed_membrane',conditions:[{kind:'SELF_MISSING_EFFECT',effectId:'crystal_shell'},{kind:'SKILL_READY',skillId:'condensed_membrane'}]}
  ]
 },
 {
  id:'crystal_scale_serpent',name:'수정비늘 뱀',
  skills:[
   {id:'fracture_fang',name:'균열독니',description:'상처에 균열을 누적합니다.',cooldown:1,kind:'damage',multiplier:1.05,effects:[{target:'TARGET',effectId:'crystal_fracture'}]},
   {id:'shatter_bite',name:'파쇄교상',description:'균열이 누적된 대상을 강하게 물어뜯습니다.',cooldown:2,kind:'damage',multiplier:1.7}
  ],
  aiRules:[
   {id:'shatter',priority:20,actionId:'shatter_bite',conditions:[{kind:'TARGET_EFFECT_STACKS_AT_LEAST',effectId:'crystal_fracture',requiredStacks:2},{kind:'SKILL_READY',skillId:'shatter_bite'}]},
   {id:'fracture',priority:10,actionId:'fracture_fang',conditions:[{kind:'SKILL_READY',skillId:'fracture_fang'}]}
  ]
 },
 {
  id:'vein_hound',name:'광맥 사냥개',
  skills:[
   {id:'vein_frenzy',name:'맥광흥분',description:'광맥의 빛으로 공격성을 높입니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'attack_up'}]},
   {id:'throat_bite',name:'숨통물기',description:'약해진 대상을 노려 물어뜯습니다.',cooldown:2,kind:'damage',multiplier:1.6}
  ],
  aiRules:[
   {id:'finish',priority:20,actionId:'throat_bite',conditions:[{kind:'TARGET_HP_BELOW',value:.4},{kind:'SKILL_READY',skillId:'throat_bite'}]},
   {id:'frenzy',priority:10,actionId:'vein_frenzy',conditions:[{kind:'SELF_MISSING_EFFECT',effectId:'attack_up'},{kind:'SKILL_READY',skillId:'vein_frenzy'}]}
  ]
 },
 {
  id:'shatter_mole',name:'파광 두더지',
  skills:[
   {id:'underground_charge',name:'지하축력',description:'한 턴 준비한 뒤 지면을 뚫고 솟구칩니다.',cooldown:3,kind:'charge',multiplier:2},
   {id:'stone_skin',name:'석피경화',description:'몸 표면을 단단하게 굳힙니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'crystal_hardening'}]}
  ],
  aiRules:[
   {id:'skin',priority:20,actionId:'stone_skin',conditions:[{kind:'SELF_MISSING_EFFECT',effectId:'crystal_hardening'},{kind:'SKILL_READY',skillId:'stone_skin'}]},
   {id:'charge',priority:10,actionId:'underground_charge',conditions:[{kind:'SKILL_READY',skillId:'underground_charge'}]}
  ]
 },
 {
  id:'quartz_spine_predator',name:'석영등뼈 포식자',
  skills:[
   {id:'quartz_claw',name:'석영할퀴기',description:'석영 돌기로 깊게 할퀴어 공격합니다.',cooldown:2,kind:'damage',multiplier:1.45},
   {id:'crystal_blood',name:'결정독혈',description:'광독을 남기는 결정혈을 흩뿌립니다.',cooldown:3,kind:'effect',effects:[{target:'TARGET',effectId:'crystal_venom'}]}
  ],
  aiRules:[
   {id:'venom',priority:20,actionId:'crystal_blood',conditions:[{kind:'TARGET_MISSING_EFFECT',effectId:'crystal_venom'},{kind:'SKILL_READY',skillId:'crystal_blood'}]},
   {id:'claw',priority:10,actionId:'quartz_claw',conditions:[{kind:'SKILL_READY',skillId:'quartz_claw'}]}
  ]
 },
 {
  id:'fracture_claw_hunter',name:'균열발톱 수렵수',
  skills:[
   {id:'fracture_claw',name:'균열할퀴기',description:'발톱으로 균열을 누적합니다.',cooldown:1,kind:'damage',multiplier:1.08,effects:[{target:'TARGET',effectId:'crystal_fracture'}]},
   {id:'armor_break_claw',name:'쇄갑발톱',description:'균열이 쌓인 대상을 강하게 파고듭니다.',cooldown:2,kind:'damage',multiplier:1.75}
  ],
  aiRules:[
   {id:'break',priority:20,actionId:'armor_break_claw',conditions:[{kind:'TARGET_EFFECT_STACKS_AT_LEAST',effectId:'crystal_fracture',requiredStacks:2},{kind:'SKILL_READY',skillId:'armor_break_claw'}]},
   {id:'fracture',priority:10,actionId:'fracture_claw',conditions:[{kind:'SKILL_READY',skillId:'fracture_claw'}]}
  ]
 },
 {
  id:'whitevein_leech',name:'백정맥 거머리',
  skills:[
   {id:'vein_siphon',name:'광맥흡수',description:'광맥을 빨아들이듯 대상을 공격합니다.',cooldown:2,kind:'damage',multiplier:1.25},
   {id:'stored_recovery',name:'축적회복',description:'축적한 광질로 체력을 회복합니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'crystal_regen'}]}
  ],
  aiRules:[
   {id:'heal',priority:20,actionId:'stored_recovery',conditions:[{kind:'SELF_HP_BELOW',value:.55},{kind:'SELF_MISSING_EFFECT',effectId:'crystal_regen'},{kind:'SKILL_READY',skillId:'stored_recovery'}]},
   {id:'siphon',priority:10,actionId:'vein_siphon',conditions:[{kind:'SKILL_READY',skillId:'vein_siphon'}]}
  ]
 },
 {
  id:'celestial_crystal_brute',name:'천광각질 거수',
  skills:[
   {id:'keratin_barrier',name:'각질장벽',description:'두꺼운 결정각질로 보호막을 만듭니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'crystal_shell'}]},
   {id:'celestial_crush',name:'천광압쇄',description:'한 턴 준비한 뒤 전신으로 압쇄합니다.',cooldown:3,kind:'charge',multiplier:2.1},
   {id:'crystal_frenzy',name:'광폭결정',description:'위기에서 공격력을 끌어올립니다.',cooldown:5,kind:'effect',effects:[{target:'SELF',effectId:'attack_up'}]}
  ],
  aiRules:[
   {id:'frenzy',priority:30,actionId:'crystal_frenzy',conditions:[{kind:'SELF_HP_BELOW',value:.4},{kind:'SELF_MISSING_EFFECT',effectId:'attack_up'},{kind:'SKILL_READY',skillId:'crystal_frenzy'}]},
   {id:'shield',priority:20,actionId:'keratin_barrier',conditions:[{kind:'SELF_MISSING_EFFECT',effectId:'crystal_shell'},{kind:'SKILL_READY',skillId:'keratin_barrier'}]},
   {id:'crush',priority:10,actionId:'celestial_crush',conditions:[{kind:'SKILL_READY',skillId:'celestial_crush'}]}
  ]
 }
];

export const CRYSTAL_BOSS_DEFINITIONS:MonsterDefinition[]=[
 {
  id:'white_crystal_armor_behemoth',name:'백정갑주 균열거수',
  skills:[
   {id:'white_bastion',name:'백정장벽',description:'두꺼운 결정 보호막을 전개합니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'crystal_bastion'}]},
   {id:'armor_collision',name:'갑주충돌',description:'거대한 결정갑주로 강타합니다.',cooldown:2,kind:'damage',multiplier:1.55},
   {id:'crust_crush',name:'지각압쇄',description:'한 턴 준비한 뒤 강하게 압쇄합니다.',cooldown:3,kind:'charge',multiplier:2.15},
   {id:'boss_hardening',name:'결정경화',description:'갑주를 더욱 단단하게 만듭니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'crystal_hardening'}]}
  ],
  aiRules:[
   {id:'shield',priority:40,actionId:'white_bastion',conditions:[{kind:'SELF_MISSING_EFFECT',effectId:'crystal_bastion'},{kind:'SKILL_READY',skillId:'white_bastion'}]},
   {id:'harden',priority:30,actionId:'boss_hardening',conditions:[{kind:'SELF_MISSING_EFFECT',effectId:'crystal_hardening'},{kind:'SKILL_READY',skillId:'boss_hardening'}]},
   {id:'charge',priority:20,actionId:'crust_crush',conditions:[{kind:'SKILL_READY',skillId:'crust_crush'}]},
   {id:'slam',priority:10,actionId:'armor_collision',conditions:[{kind:'SKILL_READY',skillId:'armor_collision'}]}
  ]
 },
 {
  id:'myriad_refraction_predator',name:'만광굴절 포식자',
  skills:[
   {id:'myriad_stance',name:'굴절자세',description:'직접 피격에 반응할 준비를 합니다.',cooldown:3,kind:'reactive_prepare',reactiveTrigger:'DIRECT_HIT_RECEIVED',reactionSkillId:'reflected_claw'},
   {id:'reflected_claw',name:'반광발톱',description:'굴절잔상에서 튀어나와 즉시 반격합니다.',cooldown:0,kind:'damage',multiplier:.95},
   {id:'boss_scattered_light',name:'산란광',description:'빛을 흐려 공격력을 낮춥니다.',cooldown:3,kind:'effect',effects:[{target:'TARGET',effectId:'crystal_glare'}]},
   {id:'myriad_leap',name:'만광도약',description:'한 턴 준비한 뒤 도약해 덮칩니다.',cooldown:3,kind:'charge',multiplier:2.2},
   {id:'predation_strike',name:'포식일격',description:'약해진 대상을 집중적으로 노립니다.',cooldown:2,kind:'damage',multiplier:1.75}
  ],
  aiRules:[
   {id:'finish',priority:50,actionId:'predation_strike',conditions:[{kind:'TARGET_HP_BELOW',value:.35},{kind:'SKILL_READY',skillId:'predation_strike'}]},
   {id:'counter',priority:40,actionId:'myriad_stance',conditions:[{kind:'SKILL_READY',skillId:'myriad_stance'}]},
   {id:'glare',priority:30,actionId:'boss_scattered_light',conditions:[{kind:'TARGET_MISSING_EFFECT',effectId:'crystal_glare'},{kind:'SKILL_READY',skillId:'boss_scattered_light'}]},
   {id:'charge',priority:20,actionId:'myriad_leap',conditions:[{kind:'SKILL_READY',skillId:'myriad_leap'}]}
  ]
 },
 {
  id:'pulsing_crystal_core_growth',name:'맥동광핵 증식체',
  skills:[
   {id:'core_regen',name:'광핵재생',description:'결정핵이 체력을 지속 회복합니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'crystal_regen'}]},
   {id:'crystal_amplify',name:'결정증폭',description:'결정핵의 출력으로 공격력을 높입니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'crystal_growth'}]},
   {id:'vein_fortify',name:'광맥경화',description:'외피를 굳혀 방어력을 높입니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'crystal_hardening'}]},
   {id:'pulse_impact',name:'맥동충격',description:'맥동을 압축해 강하게 공격합니다.',cooldown:2,kind:'damage',multiplier:1.55},
   {id:'core_compression',name:'심핵압축',description:'한 턴 압축한 뒤 강한 충격을 방출합니다.',cooldown:3,kind:'charge',multiplier:2.25}
  ],
  aiRules:[
   {id:'regen',priority:50,actionId:'core_regen',conditions:[{kind:'SELF_HP_BELOW',value:.6},{kind:'SELF_MISSING_EFFECT',effectId:'crystal_regen'},{kind:'SKILL_READY',skillId:'core_regen'}]},
   {id:'amplify',priority:40,actionId:'crystal_amplify',conditions:[{kind:'SELF_MISSING_EFFECT',effectId:'crystal_growth'},{kind:'SKILL_READY',skillId:'crystal_amplify'}]},
   {id:'harden',priority:30,actionId:'vein_fortify',conditions:[{kind:'SELF_MISSING_EFFECT',effectId:'crystal_hardening'},{kind:'SKILL_READY',skillId:'vein_fortify'}]},
   {id:'charge',priority:20,actionId:'core_compression',conditions:[{kind:'SKILL_READY',skillId:'core_compression'}]},
   {id:'impact',priority:10,actionId:'pulse_impact',conditions:[{kind:'SKILL_READY',skillId:'pulse_impact'}]}
  ]
 },
 {
  id:'thousand_face_crystal_beast',name:'천면결정수',
  skills:[
   {id:'white_face',name:'백정면',description:'백색 결정면으로 방어력을 높입니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'crystal_hardening'}]},
   {id:'mirror_face',name:'경정면',description:'직접 피격에 반응할 준비를 합니다.',cooldown:3,kind:'reactive_prepare',reactiveTrigger:'DIRECT_HIT_RECEIVED',reactionSkillId:'mirror_shatter'},
   {id:'mirror_shatter',name:'경면파쇄',description:'거울결정을 깨뜨리며 즉시 반격합니다.',cooldown:0,kind:'damage',multiplier:1},
   {id:'clouded_face',name:'탁정면',description:'공격적인 결정면으로 전환합니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'crystal_growth'}]},
   {id:'manyface_collision',name:'천면충돌',description:'결정면을 앞세워 강하게 충돌합니다.',cooldown:2,kind:'damage',multiplier:1.6},
   {id:'manyface_fall',name:'천면낙광',description:'한 턴 준비 후 결정광을 압축해 떨어뜨립니다.',cooldown:3,kind:'charge',multiplier:2.3}
  ],
  aiRules:[
   {id:'defense',priority:50,actionId:'white_face',conditions:[{kind:'SELF_MISSING_EFFECT',effectId:'crystal_hardening'},{kind:'SKILL_READY',skillId:'white_face'}]},
   {id:'counter',priority:40,actionId:'mirror_face',conditions:[{kind:'SKILL_READY',skillId:'mirror_face'}]},
   {id:'attack',priority:30,actionId:'clouded_face',conditions:[{kind:'SELF_MISSING_EFFECT',effectId:'crystal_growth'},{kind:'SKILL_READY',skillId:'clouded_face'}]},
   {id:'charge',priority:20,actionId:'manyface_fall',conditions:[{kind:'SKILL_READY',skillId:'manyface_fall'}]},
   {id:'collision',priority:10,actionId:'manyface_collision',conditions:[{kind:'SKILL_READY',skillId:'manyface_collision'}]}
  ]
 },
 {
  id:'celestial_core_matrix',name:'천광심핵 모체',
  skills:[
   {id:'core_barrier',name:'심핵장벽',description:'심핵 주변에 두꺼운 결정막을 만듭니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'crystal_core_shield'}]},
   {id:'matrix_regen',name:'광핵재생',description:'저체력에서 심핵이 지속 회복합니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'crystal_regen'}]},
   {id:'celestial_amplify',name:'천광증폭',description:'저체력에서 공격 출력을 높입니다.',cooldown:4,kind:'effect',effects:[{target:'SELF',effectId:'crystal_growth'}]},
   {id:'core_echo_stance',name:'심핵반향',description:'직접 피격에 반응할 준비를 합니다.',cooldown:4,kind:'reactive_prepare',reactiveTrigger:'DIRECT_HIT_RECEIVED',reactionSkillId:'core_echo_wave'},
   {id:'core_echo_wave',name:'반향파동',description:'심핵이 충격에 반응해 즉시 파동을 방출합니다.',cooldown:0,kind:'damage',multiplier:1.05},
   {id:'dulling_pulse',name:'탁광맥동',description:'탁한 광맥동으로 공격력을 낮춥니다.',cooldown:3,kind:'effect',effects:[{target:'TARGET',effectId:'crystal_glare'}]},
   {id:'celestial_compression',name:'천광압축',description:'한 턴 준비한 뒤 심핵 에너지를 방출합니다.',cooldown:3,kind:'charge',multiplier:2.55},
   {id:'core_impact',name:'심핵충격',description:'심핵의 맥동으로 강하게 충격합니다.',cooldown:2,kind:'damage',multiplier:1.65}
  ],
  aiRules:[
   {id:'regen',priority:70,actionId:'matrix_regen',conditions:[{kind:'SELF_HP_BELOW',value:.45},{kind:'SELF_MISSING_EFFECT',effectId:'crystal_regen'},{kind:'SKILL_READY',skillId:'matrix_regen'}]},
   {id:'amplify',priority:60,actionId:'celestial_amplify',conditions:[{kind:'SELF_HP_BELOW',value:.5},{kind:'SELF_MISSING_EFFECT',effectId:'crystal_growth'},{kind:'SKILL_READY',skillId:'celestial_amplify'}]},
   {id:'terminal',priority:50,actionId:'celestial_compression',conditions:[{kind:'SELF_HP_BELOW',value:.5},{kind:'SKILL_READY',skillId:'celestial_compression'}]},
   {id:'shield',priority:40,actionId:'core_barrier',conditions:[{kind:'SELF_MISSING_EFFECT',effectId:'crystal_core_shield'},{kind:'SKILL_READY',skillId:'core_barrier'}]},
   {id:'counter',priority:30,actionId:'core_echo_stance',conditions:[{kind:'SKILL_READY',skillId:'core_echo_stance'}]},
   {id:'glare',priority:20,actionId:'dulling_pulse',conditions:[{kind:'TARGET_MISSING_EFFECT',effectId:'crystal_glare'},{kind:'SKILL_READY',skillId:'dulling_pulse'}]},
   {id:'impact',priority:10,actionId:'core_impact',conditions:[{kind:'SKILL_READY',skillId:'core_impact'}]}
  ]
 }
];

export const CRYSTAL_MONSTER_DEFINITIONS:MonsterDefinition[]=[...CRYSTAL_NORMAL_DEFINITIONS,...CRYSTAL_BOSS_DEFINITIONS];
