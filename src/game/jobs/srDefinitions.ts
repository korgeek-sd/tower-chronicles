import type {JobCombatDefinition} from './framework';

export const SR_JOB_DEFINITIONS:JobCombatDefinition[]=[
 {
  jobId:'mutagen_doctor',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {"id":"mutagen_doctor_skill_1","name":"변질침","description":"공격력 165% 피해, 3턴간 중독","cooldown":0,"resource":{"kind":"GENERATOR","gain":1},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":1.65},{"kind":"APPLY_EFFECT","target":"TARGET","effectId":"poison","duration":3}]},
   {"id":"mutagen_doctor_skill_2","name":"자가 처방","description":"최대 HP 25% 회복, 약화효과 2개 정화, 2턴간 공격력 +30%","cooldown":3,"resource":{"kind":"NEUTRAL"},"effectActions":[{"kind":"HEAL_PERCENT","percent":0.25},{"kind":"CLEANSE","target":"SELF","count":2},{"kind":"APPLY_EFFECT","target":"SELF","effectId":"attack_up","duration":2}]},
   {"id":"mutagen_doctor_skill_3","name":"변이 폭발","description":"공격력 450% 피해. 대상이 중독 상태면 550%","cooldown":4,"resource":{"kind":"SPENDER","cost":{"mode":"FIXED","amount":3}},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":4.5,"conditionalLastHitMultiplier":{"condition":{"kind":"TARGET_HAS_EFFECT","effectId":"poison"},"multiplier":5.5}}]},
  ],
 },
 {
  jobId:'soulcaster',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {"id":"soulcaster_skill_1","name":"잔혼탄","description":"공격력 175% 피해","cooldown":0,"resource":{"kind":"GENERATOR","gain":1},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":1.75}]},
   {"id":"soulcaster_skill_2","name":"혼백 침식","description":"공격력 230% 피해, 3턴간 방어력 -20% 약화","cooldown":3,"resource":{"kind":"NEUTRAL"},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":2.3},{"kind":"APPLY_EFFECT","target":"TARGET","effectId":"weaken","duration":3}]},
   {"id":"soulcaster_skill_3","name":"혼수확","description":"공격력 150% × 3회, 최대 HP 20% 회복","cooldown":4,"resource":{"kind":"SPENDER","cost":{"mode":"FIXED","amount":3}},"effectActions":[{"kind":"DIRECT_ATTACK","hits":3,"baseMultiplier":1.5},{"kind":"HEAL_PERCENT","percent":0.2}]},
  ],
 },
 {
  jobId:'ascetic_fighter',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {"id":"ascetic_fighter_skill_1","name":"고행권","description":"공격력 100% × 2회","cooldown":0,"resource":{"kind":"GENERATOR","gain":1},"effectActions":[{"kind":"DIRECT_ATTACK","hits":2,"baseMultiplier":1}]},
   {"id":"ascetic_fighter_skill_2","name":"육신 단련","description":"최대 HP 10% 소비, 3턴간 공격력 +30%, 받는 피해 -15%","cooldown":4,"resource":{"kind":"NEUTRAL"},"effectActions":[{"kind":"SELF_HP_COST_PERCENT","percentOfMax":0.1},{"kind":"APPLY_EFFECT","target":"SELF","effectId":"attack_up","duration":3},{"kind":"APPLY_EFFECT","target":"SELF","effectId":"b_guard_15","duration":3}]},
   {"id":"ascetic_fighter_skill_3","name":"고통 분쇄","description":"공격력 480% 피해. 자신의 HP 50% 이하라면 600%","cooldown":4,"resource":{"kind":"SPENDER","cost":{"mode":"FIXED","amount":3}},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":4.8,"conditionalLastHitMultiplier":{"condition":{"kind":"SELF_HP_RATIO_LE","ratio":0.5},"multiplier":6}}]},
  ],
 },
 {
  jobId:'field_engineer',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {"id":"field_engineer_skill_1","name":"철못 사출","description":"공격력 175% 피해, 방어 관통 20%","cooldown":0,"resource":{"kind":"GENERATOR","gain":1},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":1.75,"penetrationRate":0.2}]},
   {"id":"field_engineer_skill_2","name":"장갑 해체","description":"적 강화효과 2개 해제 후 공격력 230% 피해","cooldown":3,"resource":{"kind":"NEUTRAL"},"effectActions":[{"kind":"DISPEL","target":"TARGET","count":2},{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":2.3}]},
   {"id":"field_engineer_skill_3","name":"과부하 사출","description":"공격력 125% × 4회, 방어 관통 30%","cooldown":4,"resource":{"kind":"SPENDER","cost":{"mode":"FIXED","amount":3}},"effectActions":[{"kind":"DIRECT_ATTACK","hits":4,"baseMultiplier":1.25,"penetrationRate":0.3}]},
  ],
 },
 {
  jobId:'green_crown_martyr',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {"id":"green_crown_martyr_skill_1","name":"가시 채찍","description":"공격력 170% 피해, 3턴간 출혈","cooldown":0,"resource":{"kind":"GENERATOR","gain":1},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":1.7},{"kind":"APPLY_EFFECT","target":"TARGET","effectId":"bleed","duration":3}]},
   {"id":"green_crown_martyr_skill_2","name":"수난의 서약","description":"최대 HP 10% 소비, 3턴간 공격력 +30%, 받는 피해 -30%","cooldown":4,"resource":{"kind":"NEUTRAL"},"effectActions":[{"kind":"SELF_HP_COST_PERCENT","percentOfMax":0.1},{"kind":"APPLY_EFFECT","target":"SELF","effectId":"attack_up","duration":3},{"kind":"APPLY_EFFECT","target":"SELF","effectId":"b_guard_30","duration":3}]},
   {"id":"green_crown_martyr_skill_3","name":"가시의 응보","description":"공격력 460% 피해. 자신의 HP 50% 이하라면 580%","cooldown":4,"resource":{"kind":"SPENDER","cost":{"mode":"FIXED","amount":3}},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":4.6,"conditionalLastHitMultiplier":{"condition":{"kind":"SELF_HP_RATIO_LE","ratio":0.5},"multiplier":5.8}}]},
  ],
 },
 {
  jobId:'unity_apostle',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {"id":"unity_apostle_skill_1","name":"귀일의 빛","description":"공격력 160% 피해","cooldown":0,"resource":{"kind":"GENERATOR","gain":1},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":1.6}]},
   {"id":"unity_apostle_skill_2","name":"정화 기도","description":"최대 HP 25% 회복, 약화효과 2개 정화, 2턴간 받는 피해 -15%","cooldown":3,"resource":{"kind":"NEUTRAL"},"effectActions":[{"kind":"HEAL_PERCENT","percent":0.25},{"kind":"CLEANSE","target":"SELF","count":2},{"kind":"APPLY_EFFECT","target":"SELF","effectId":"b_guard_15","duration":2}]},
   {"id":"unity_apostle_skill_3","name":"귀일 선언","description":"공격력 420% 피해, 최대 HP 25% 회복","cooldown":4,"resource":{"kind":"SPENDER","cost":{"mode":"FIXED","amount":3}},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":4.2},{"kind":"HEAL_PERCENT","percent":0.25}]},
  ],
 },
 {
  jobId:'deep_rescue_officer',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {"id":"deep_rescue_officer_skill_1","name":"구조창 돌격","description":"공격력 165% 피해","cooldown":0,"resource":{"kind":"GENERATOR","gain":1},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":1.65}]},
   {"id":"deep_rescue_officer_skill_2","name":"비상 안정화","description":"최대 HP 25% 회복, 출혈·중독 제거, 2턴간 받는 피해 -15%","cooldown":3,"resource":{"kind":"NEUTRAL"},"effectActions":[{"kind":"HEAL_PERCENT","percent":0.25},{"kind":"REMOVE_EFFECT_TAG","target":"SELF","tag":"BLEED"},{"kind":"REMOVE_EFFECT_TAG","target":"SELF","tag":"POISON"},{"kind":"APPLY_EFFECT","target":"SELF","effectId":"b_guard_15","duration":2}]},
   {"id":"deep_rescue_officer_skill_3","name":"심층 생환","description":"최대 HP 40% 회복, 약화효과 2개 정화, 3턴간 받는 피해 -30%","cooldown":5,"resource":{"kind":"SPENDER","cost":{"mode":"FIXED","amount":3}},"effectActions":[{"kind":"HEAL_PERCENT","percent":0.4},{"kind":"CLEANSE","target":"SELF","count":2},{"kind":"APPLY_EFFECT","target":"SELF","effectId":"b_guard_30","duration":3}]},
  ],
 },
 {
  jobId:'boss_tracker',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {"id":"boss_tracker_skill_1","name":"추적 사격","description":"공격력 190% 피해","cooldown":0,"resource":{"kind":"GENERATOR","gain":1},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":1.9}]},
   {"id":"boss_tracker_skill_2","name":"급소 포착","description":"공격력 240% 피해, 3턴간 방어력 -20% 약화","cooldown":3,"resource":{"kind":"NEUTRAL"},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":2.4},{"kind":"APPLY_EFFECT","target":"TARGET","effectId":"weaken","duration":3}]},
   {"id":"boss_tracker_skill_3","name":"결정적 사격","description":"공격력 470% 피해, 방어 관통 45%. 대상이 약화 상태면 560%","cooldown":4,"resource":{"kind":"SPENDER","cost":{"mode":"FIXED","amount":3}},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":4.7,"penetrationRate":0.45,"conditionalLastHitMultiplier":{"condition":{"kind":"TARGET_HAS_EFFECT","effectId":"weaken"},"multiplier":5.6}}]},
  ],
 },
 {
  jobId:'return_guardian',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {"id":"return_guardian_skill_1","name":"수호검","description":"공격력 165% 피해","cooldown":0,"resource":{"kind":"GENERATOR","gain":1},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":1.65}]},
   {"id":"return_guardian_skill_2","name":"귀환 방벽","description":"2턴간 받는 피해 -40%, 최대 HP 15% 회복","cooldown":3,"resource":{"kind":"NEUTRAL"},"effectActions":[{"kind":"APPLY_EFFECT","target":"SELF","effectId":"guard","duration":2},{"kind":"HEAL_PERCENT","percent":0.15}]},
   {"id":"return_guardian_skill_3","name":"귀환의 맹세","description":"공격력 380% 피해, 최대 HP 30% 회복, 약화효과 2개 정화","cooldown":4,"resource":{"kind":"SPENDER","cost":{"mode":"FIXED","amount":3}},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":3.8},{"kind":"HEAL_PERCENT","percent":0.3},{"kind":"CLEANSE","target":"SELF","count":2}]},
  ],
 },
 {
  jobId:'green_crown_inquisitor',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {"id":"green_crown_inquisitor_skill_1","name":"녹관 낙인","description":"공격력 175% 피해","cooldown":0,"resource":{"kind":"GENERATOR","gain":1},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":1.75}]},
   {"id":"green_crown_inquisitor_skill_2","name":"이단 박탈","description":"적 강화효과 2개 해제 후 공격력 230% 피해, 2턴간 방어력 -20% 약화","cooldown":3,"resource":{"kind":"NEUTRAL"},"effectActions":[{"kind":"DISPEL","target":"TARGET","count":2},{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":2.3},{"kind":"APPLY_EFFECT","target":"TARGET","effectId":"weaken","duration":2}]},
   {"id":"green_crown_inquisitor_skill_3","name":"녹관 단죄","description":"공격력 460% 피해, 방어 관통 40%. 대상이 약화 상태면 550%","cooldown":4,"resource":{"kind":"SPENDER","cost":{"mode":"FIXED","amount":3}},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":4.6,"penetrationRate":0.4,"conditionalLastHitMultiplier":{"condition":{"kind":"TARGET_HAS_EFFECT","effectId":"weaken"},"multiplier":5.5}}]},
  ],
 },
];
