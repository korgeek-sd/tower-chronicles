import type {JobDetailDefinition} from './details';

export const A_JOB_DETAILS:Record<string,JobDetailDefinition>={
 executor:{
  description:'갑옷을 깨뜨리고 체력이 낮아진 적에게 강한 마무리 공격을 가하는 집행인.',
  resourceSummary:'전투 자원 · 시작 0 · 최대 4칸',
  skills:[
   {name:'집행검 내려치기',kind:'GENERATOR',cooldown:1,resourceLabel:'자원 +1',description:'적에게 공격력의 135%만큼 피해를 주고 자원을 1 생성합니다.',facts:['피해 135%']},
   {name:'형벌의 일격',kind:'NEUTRAL',cooldown:4,resourceLabel:'자원 변화 없음',description:'적에게 공격력의 120%만큼 피해를 주고 2턴 동안 적의 방어력을 20% 감소시킵니다.',facts:['피해 120%','방어력 -20% · 2턴']},
   {name:'처형',kind:'SPENDER',cooldown:4,resourceLabel:'자원 -3',description:'자원을 3 소비하여 적에게 공격력의 260%만큼 피해를 줍니다. 적의 HP가 최대 HP의 30% 이하이면 피해 배율이 360%로 증가합니다.',facts:['피해 260%','적 HP 30% 이하 · 피해 360%']},
  ],
 },
 inquisitor:{
  description:'출혈과 자신의 피해 증가를 함께 사용하고 세 번의 연격으로 몰아치는 심문관.',
  resourceSummary:'전투 자원 · 시작 0 · 최대 4칸',
  skills:[
   {name:'심문칼 찌르기',kind:'GENERATOR',cooldown:1,resourceLabel:'자원 +1',description:'적에게 공격력의 120%만큼 피해를 주고 자원을 1 생성합니다.',facts:['피해 120%']},
   {name:'엄정한 심문',kind:'NEUTRAL',cooldown:4,resourceLabel:'자원 변화 없음',description:'적에게 공격력의 90%만큼 피해를 주고 2턴 동안 출혈을 부여합니다. 출혈은 매 턴 5의 피해를 줍니다. 2턴 동안 자신이 주는 피해가 20% 증가합니다.',facts:['피해 90%','출혈 · 매 턴 5 · 2턴','주는 피해 +20% · 2턴']},
   {name:'판결의 연격',kind:'SPENDER',cooldown:4,resourceLabel:'자원 -3',description:'자원을 3 소비하여 적을 3회 공격합니다. 각 타격은 공격력의 100%만큼 피해를 줍니다.',facts:['100% × 3회','총 300%']},
  ],
 },
 deep_delver:{
  description:'곡괭이로 적의 방어를 무너뜨리고 연속 타격으로 파고드는 심층 도굴꾼.',
  resourceSummary:'전투 자원 · 시작 0 · 최대 4칸',
  skills:[
   {name:'도굴 곡괭이',kind:'GENERATOR',cooldown:1,resourceLabel:'자원 +1',description:'적에게 공격력의 125%만큼 피해를 주고 자원을 1 생성합니다.',facts:['피해 125%']},
   {name:'방호 파쇄',kind:'NEUTRAL',cooldown:3,resourceLabel:'자원 변화 없음',description:'적에게 공격력의 100%만큼 피해를 주고 2턴 동안 적의 방어력을 20% 감소시킵니다.',facts:['피해 100%','방어력 -20% · 2턴']},
   {name:'심층 굴진',kind:'SPENDER',cooldown:4,resourceLabel:'자원 -2',description:'자원을 2 소비하여 적을 3회 공격합니다. 각 타격은 공격력의 90%만큼 피해를 줍니다.',facts:['90% × 3회','총 270%']},
  ],
 },
 bloodfighter:{
  description:'출혈을 누적하고 강력한 공격과 자기 회복을 함께 사용하는 혈전가.',
  resourceSummary:'전투 자원 · 시작 0 · 최대 4칸',
  skills:[
   {name:'혈전 베기',kind:'GENERATOR',cooldown:1,resourceLabel:'자원 +1',description:'적에게 공격력의 130%만큼 피해를 주고 자원을 1 생성합니다.',facts:['피해 130%']},
   {name:'상처 벌리기',kind:'NEUTRAL',cooldown:3,resourceLabel:'자원 변화 없음',description:'적에게 공격력의 130%만큼 피해를 주고 2턴 동안 출혈을 부여합니다. 출혈은 매 턴 5의 피해를 줍니다.',facts:['피해 130%','출혈 · 매 턴 5 · 2턴']},
   {name:'혈전 돌파',kind:'SPENDER',cooldown:5,resourceLabel:'자원 -3',description:'자원을 3 소비하여 적에게 공격력의 270%만큼 피해를 주고 자신의 최대 HP의 15%만큼 HP를 회복합니다.',facts:['피해 270%','회복 · 최대 HP 15%']},
  ],
 },
 expedition_tactician:{
  description:'주는 피해와 받는 피해를 함께 조절하고 두 번의 집중 공격으로 공세를 펼치는 원정 전술가.',
  resourceSummary:'전투 자원 · 시작 0 · 최대 4칸',
  skills:[
   {name:'전술검 타격',kind:'GENERATOR',cooldown:1,resourceLabel:'자원 +1',description:'적에게 공격력의 120%만큼 피해를 주고 자원을 1 생성합니다.',facts:['피해 120%']},
   {name:'공방 전술',kind:'NEUTRAL',cooldown:4,resourceLabel:'자원 변화 없음',description:'2턴 동안 자신이 주는 피해가 25% 증가하고 받는 피해가 20% 감소합니다.',facts:['주는 피해 +25%','받는 피해 -20%','지속 2턴']},
   {name:'집중 공세',kind:'SPENDER',cooldown:4,resourceLabel:'자원 -2',description:'자원을 2 소비하여 적을 2회 공격합니다. 각 타격은 공격력의 130%만큼 피해를 줍니다.',facts:['130% × 2회','총 260%']},
  ],
 },
};
