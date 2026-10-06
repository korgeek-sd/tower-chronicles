import type {JobCombatDefinition} from './framework';

export const A_JOB_DEFINITIONS:JobCombatDefinition[]=[
 {
  jobId:'executor',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {id:'executor_skill_1',name:'처단 베기',description:'공격력 140% 단일 피해',cooldown:0,resource:{kind:'GENERATOR',gain:1},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:1.4}]},
   {id:'executor_skill_2',name:'유죄 선고',description:'공격력 120% 피해, 2턴간 약화',cooldown:3,resource:{kind:'NEUTRAL'},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:1.2},{kind:'APPLY_EFFECT',target:'TARGET',effectId:'weaken',duration:2}]},
   {id:'executor_skill_3',name:'최종 집행',description:'공격력 300% 피해. 적 HP 30% 이하라면 380%',cooldown:4,resource:{kind:'SPENDER',cost:{mode:'FIXED',amount:3}},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:3,conditionalLastHitMultiplier:{condition:{kind:'TARGET_HP_RATIO_LE',ratio:.3},multiplier:3.8}}]},
  ],
 },
 {
  jobId:'inquisitor',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {id:'inquisitor_skill_1',name:'심문봉 타격',description:'공격력 130% 피해',cooldown:0,resource:{kind:'GENERATOR',gain:1},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:1.3}]},
   {id:'inquisitor_skill_2',name:'약점 추궁',description:'공격력 100% 피해, 2턴간 약화',cooldown:2,resource:{kind:'NEUTRAL'},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:1},{kind:'APPLY_EFFECT',target:'TARGET',effectId:'weaken',duration:2}]},
   {id:'inquisitor_skill_3',name:'이단 단죄',description:'방어 관통 35%, 공격력 310% 피해. 대상이 약화 상태면 350%',cooldown:4,resource:{kind:'SPENDER',cost:{mode:'FIXED',amount:3}},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:3.1,penetrationRate:.35,conditionalLastHitMultiplier:{condition:{kind:'TARGET_HAS_EFFECT',effectId:'weaken'},multiplier:3.5}}]},
  ],
 },
 {
  jobId:'deep_delver',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {id:'deep_delver_skill_1',name:'곡괭이 강타',description:'공격력 145% 피해',cooldown:0,resource:{kind:'GENERATOR',gain:1},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:1.45}]},
   {id:'deep_delver_skill_2',name:'틈새 파고들기',description:'방어 관통 30%, 공격력 180% 피해',cooldown:3,resource:{kind:'NEUTRAL'},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:1.8,penetrationRate:.3}]},
   {id:'deep_delver_skill_3',name:'심층 붕괴',description:'공격력 120% × 3회',cooldown:4,resource:{kind:'SPENDER',cost:{mode:'FIXED',amount:3}},effectActions:[{kind:'DIRECT_ATTACK',hits:3,baseMultiplier:1.2}]},
  ],
 },
 {
  jobId:'bloodfighter',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {id:'bloodfighter_skill_1',name:'혈흔 베기',description:'공격력 140% 피해, 2턴간 출혈',cooldown:0,resource:{kind:'GENERATOR',gain:1},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:1.4},{kind:'APPLY_EFFECT',target:'TARGET',effectId:'bleed',duration:2}]},
   {id:'bloodfighter_skill_2',name:'피의 대가',description:'최대 HP 8% 소비, 공격력 240% 피해',cooldown:3,resource:{kind:'NEUTRAL'},effectActions:[{kind:'SELF_HP_COST_PERCENT',percentOfMax:.08},{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:2.4}]},
   {id:'bloodfighter_skill_3',name:'혈전 종결',description:'최대 HP 12% 소비, 공격력 340% 피해. 자신의 HP 50% 이하라면 400%',cooldown:4,resource:{kind:'SPENDER',cost:{mode:'FIXED',amount:3}},effectActions:[{kind:'SELF_HP_COST_PERCENT',percentOfMax:.12},{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:3.4,conditionalLastHitMultiplier:{condition:{kind:'SELF_HP_RATIO_LE',ratio:.5},multiplier:4}}]},
  ],
 },
 {
  jobId:'expedition_tactician',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {id:'expedition_tactician_skill_1',name:'전술 타격',description:'공격력 125% 피해',cooldown:0,resource:{kind:'GENERATOR',gain:1},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:1.25}]},
   {id:'expedition_tactician_skill_2',name:'공세 전환',description:'2턴간 공격 피해 +25%, 받는 피해 -15%',cooldown:4,resource:{kind:'NEUTRAL'},effectActions:[{kind:'APPLY_EFFECT',target:'SELF',effectId:'b_attack_25',duration:2},{kind:'APPLY_EFFECT',target:'SELF',effectId:'b_guard_15',duration:2}]},
   {id:'expedition_tactician_skill_3',name:'집중 공세',description:'공격력 105% × 3회',cooldown:4,resource:{kind:'SPENDER',cost:{mode:'FIXED',amount:3}},effectActions:[{kind:'DIRECT_ATTACK',hits:3,baseMultiplier:1.05}]},
  ],
 },
 {
  jobId:'ascetic_priest',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {id:'ascetic_priest_skill_1',name:'고행봉 타격',description:'공격력 125% 피해',cooldown:0,resource:{kind:'GENERATOR',gain:1},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:1.25}]},
   {id:'ascetic_priest_skill_2',name:'육신의 대가',description:'최대 HP 10% 소비, 3턴간 공격력 증가',cooldown:4,resource:{kind:'NEUTRAL'},effectActions:[{kind:'SELF_HP_COST_PERCENT',percentOfMax:.1},{kind:'APPLY_EFFECT',target:'SELF',effectId:'attack_up',duration:3}]},
   {id:'ascetic_priest_skill_3',name:'고통의 응보',description:'공격력 320% 피해. 자신의 HP 50% 이하라면 380%',cooldown:4,resource:{kind:'SPENDER',cost:{mode:'FIXED',amount:3}},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:3.2,conditionalLastHitMultiplier:{condition:{kind:'SELF_HP_RATIO_LE',ratio:.5},multiplier:3.8}}]},
  ],
 },
 {
  jobId:'life_stitcher',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {id:'life_stitcher_skill_1',name:'봉합침 찌르기',description:'공격력 115% 피해',cooldown:0,resource:{kind:'GENERATOR',gain:1},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:1.15}]},
   {id:'life_stitcher_skill_2',name:'응급 봉합',description:'최대 HP 20% 회복, 출혈 제거',cooldown:3,resource:{kind:'NEUTRAL'},effectActions:[{kind:'HEAL_PERCENT',percent:.2},{kind:'REMOVE_EFFECT_TAG',target:'SELF',tag:'BLEED'}]},
   {id:'life_stitcher_skill_3',name:'생명 재구성',description:'최대 HP 30% 회복, 3턴간 재생, 출혈·중독 제거',cooldown:5,resource:{kind:'SPENDER',cost:{mode:'FIXED',amount:3}},effectActions:[{kind:'HEAL_PERCENT',percent:.3},{kind:'APPLY_EFFECT',target:'SELF',effectId:'regen',duration:3},{kind:'REMOVE_EFFECT_TAG',target:'SELF',tag:'BLEED'},{kind:'REMOVE_EFFECT_TAG',target:'SELF',tag:'POISON'}]},
  ],
 },
 {
  jobId:'subjugation_officer',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {id:'subjugation_officer_skill_1',name:'제압 타격',description:'공격력 140% 피해',cooldown:0,resource:{kind:'GENERATOR',gain:1},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:1.4}]},
   {id:'subjugation_officer_skill_2',name:'방어 파쇄',description:'공격력 130% 피해, 2턴간 약화',cooldown:3,resource:{kind:'NEUTRAL'},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:1.3},{kind:'APPLY_EFFECT',target:'TARGET',effectId:'weaken',duration:2}]},
   {id:'subjugation_officer_skill_3',name:'토벌 명령',description:'방어 관통 40%, 공격력 330% 피해',cooldown:4,resource:{kind:'SPENDER',cost:{mode:'FIXED',amount:3}},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:3.3,penetrationRate:.4}]},
  ],
 },
 {
  jobId:'rescuer',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {id:'rescuer_skill_1',name:'구조용 철퇴',description:'공격력 120% 피해',cooldown:0,resource:{kind:'GENERATOR',gain:1},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:1.2}]},
   {id:'rescuer_skill_2',name:'긴급 방호',description:'2턴간 받는 피해 -30%, 최대 HP 10% 회복',cooldown:4,resource:{kind:'NEUTRAL'},effectActions:[{kind:'APPLY_EFFECT',target:'SELF',effectId:'b_guard_30',duration:2},{kind:'HEAL_PERCENT',percent:.1}]},
   {id:'rescuer_skill_3',name:'생환 조치',description:'최대 HP 28% 회복, 출혈·중독 제거',cooldown:5,resource:{kind:'SPENDER',cost:{mode:'FIXED',amount:3}},effectActions:[{kind:'HEAL_PERCENT',percent:.28},{kind:'REMOVE_EFFECT_TAG',target:'SELF',tag:'BLEED'},{kind:'REMOVE_EFFECT_TAG',target:'SELF',tag:'POISON'}]},
  ],
 },
 {
  jobId:'quartermaster',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {id:'quartermaster_skill_1',name:'보급검 타격',description:'공격력 120% 피해',cooldown:0,resource:{kind:'GENERATOR',gain:1},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:1.2}]},
   {id:'quartermaster_skill_2',name:'전투 보급',description:'3턴간 공격력 증가',cooldown:4,resource:{kind:'NEUTRAL'},effectActions:[{kind:'APPLY_EFFECT',target:'SELF',effectId:'attack_up',duration:3}]},
   {id:'quartermaster_skill_3',name:'비상 물자 투입',description:'최대 HP 20% 회복, 3턴간 방어력 증가와 재생',cooldown:5,resource:{kind:'SPENDER',cost:{mode:'FIXED',amount:3}},effectActions:[{kind:'HEAL_PERCENT',percent:.2},{kind:'APPLY_EFFECT',target:'SELF',effectId:'defense_up',duration:3},{kind:'APPLY_EFFECT',target:'SELF',effectId:'regen',duration:3}]},
  ],
 },
 {
  jobId:'coroner',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {id:'coroner_skill_1',name:'해부도 절개',description:'공격력 125% 피해, 2턴간 출혈',cooldown:0,resource:{kind:'GENERATOR',gain:1},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:1.25},{kind:'APPLY_EFFECT',target:'TARGET',effectId:'bleed',duration:2}]},
   {id:'coroner_skill_2',name:'사인 분석',description:'공격력 110% 피해, 2턴간 약화',cooldown:3,resource:{kind:'NEUTRAL'},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:1.1},{kind:'APPLY_EFFECT',target:'TARGET',effectId:'weaken',duration:2}]},
   {id:'coroner_skill_3',name:'사망 판정',description:'공격력 290% 피해. 적 HP 30% 이하라면 390%',cooldown:4,resource:{kind:'SPENDER',cost:{mode:'FIXED',amount:3}},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:2.9,conditionalLastHitMultiplier:{condition:{kind:'TARGET_HP_RATIO_LE',ratio:.3},multiplier:3.9}}]},
  ],
 },
 {
  jobId:'stair_scout',resource:{id:'combat',initialValue:0,maxValue:4},passives:[],skills:[
   {id:'stair_scout_skill_1',name:'선행 찌르기',description:'공격력 130% 피해',cooldown:0,resource:{kind:'GENERATOR',gain:1},effectActions:[{kind:'DIRECT_ATTACK',hits:1,baseMultiplier:1.3}]},
   {id:'stair_scout_skill_2',name:'틈새 연격',description:'공격력 85% × 2회, 방어 관통 20%',cooldown:2,resource:{kind:'NEUTRAL'},effectActions:[{kind:'DIRECT_ATTACK',hits:2,baseMultiplier:.85,penetrationRate:.2}]},
   {id:'stair_scout_skill_3',name:'층계 돌파',description:'공격력 90% × 4회',cooldown:4,resource:{kind:'SPENDER',cost:{mode:'FIXED',amount:3}},effectActions:[{kind:'DIRECT_ATTACK',hits:4,baseMultiplier:.9}]},
  ],
 },
];
