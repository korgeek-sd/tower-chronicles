export type JobSkillPreview={
 name:string;
 kind:'GENERATOR'|'NEUTRAL'|'SPENDER';
 cooldown:number;
 resourceLabel:string;
 description:string;
 facts:string[];
};

export type JobDetailDefinition={
 description:string;
 resourceSummary:string;
 skills:[JobSkillPreview,JobSkillPreview,JobSkillPreview];
};

export const JOB_DETAIL_CATALOG:Record<string,JobDetailDefinition>={
 contract_mercenary:{
  description:'가장 정석적인 자원 운용을 사용하는 용병. 공격으로 자원을 확보하고 공격력 강화 뒤 강력한 단일 공격으로 마무리합니다.',
  resourceSummary:'전투 자원 · 시작 0 · 최대 4칸',
  skills:[
   {name:'계약자의 베기',kind:'GENERATOR',cooldown:1,resourceLabel:'자원 +1',description:'적에게 공격력의 120%만큼 물리 피해를 주고 자원을 1 생성합니다.',facts:['피해 120%','1회 공격','치명타 가능']},
   {name:'전투 수당',kind:'NEUTRAL',cooldown:4,resourceLabel:'자원 변화 없음',description:'2턴 동안 자신의 공격력을 30% 증가시킵니다.',facts:['공격력 +30%','지속 2턴']},
   {name:'계약 이행',kind:'SPENDER',cooldown:2,resourceLabel:'자원 -2',description:'자원을 2 소비하여 적에게 공격력의 260%만큼 물리 피해를 줍니다.',facts:['피해 260%','1회 공격','치명타 가능']},
  ],
 },
 hunter:{
  description:'직접 피해와 출혈을 함께 누적하는 사냥꾼. 지속피해를 걸어두고 다단 공격으로 꾸준히 압박합니다.',
  resourceSummary:'전투 자원 · 시작 0 · 최대 4칸',
  skills:[
   {name:'추적 사격',kind:'GENERATOR',cooldown:1,resourceLabel:'자원 +1',description:'적에게 공격력의 110%만큼 물리 피해를 주고 자원을 1 생성합니다.',facts:['피해 110%','1회 공격','치명타 가능']},
   {name:'출혈 화살',kind:'NEUTRAL',cooldown:3,resourceLabel:'자원 변화 없음',description:'적에게 공격력의 90%만큼 물리 피해를 주고 3턴 동안 출혈을 부여합니다. 출혈은 매 턴 공격력의 35%만큼 피해를 주며 보호막을 무시합니다.',facts:['최초 피해 90%','출혈 35% × 3턴','보호막 무시']},
   {name:'연속 사냥',kind:'SPENDER',cooldown:2,resourceLabel:'자원 -2',description:'자원을 2 소비하여 적을 3회 연속 공격합니다. 각 공격은 공격력의 75%만큼 물리 피해를 줍니다.',facts:['75% × 3회','총 225%','타격별 치명타']},
  ],
 },
 excavator:{
  description:'한 번 한 번 묵직하게 때리는 굴착 인부. 자원을 오래 모아 강한 단타와 기절로 상대의 행동을 끊습니다.',
  resourceSummary:'전투 자원 · 시작 0 · 최대 4칸',
  skills:[
   {name:'곡괭이 타격',kind:'GENERATOR',cooldown:1,resourceLabel:'자원 +1',description:'적에게 공격력의 125%만큼 물리 피해를 주고 자원을 1 생성합니다.',facts:['피해 125%','1회 공격','치명타 가능']},
   {name:'작업 자세',kind:'NEUTRAL',cooldown:4,resourceLabel:'자원 변화 없음',description:'2턴 동안 자신의 공격력을 20%, 방어력을 25% 증가시킵니다.',facts:['공격력 +20%','방어력 +25%','지속 2턴']},
   {name:'암반 분쇄',kind:'SPENDER',cooldown:4,resourceLabel:'자원 -3',description:'자원을 3 소비하여 적에게 공격력의 280%만큼 물리 피해를 주고 1턴 동안 기절시킵니다.',facts:['피해 280%','기절 1턴','치명타 가능']},
  ],
 },
 field_medic:{
  description:'공격으로 자원을 확보하면서 스스로 치료하는 생존형 직능. 지속회복과 긴급 회복으로 장기전을 버팁니다.',
  resourceSummary:'전투 자원 · 시작 0 · 최대 4칸',
  skills:[
   {name:'구호용 단검',kind:'GENERATOR',cooldown:1,resourceLabel:'자원 +1',description:'적에게 공격력의 105%만큼 물리 피해를 주고 자원을 1 생성합니다.',facts:['피해 105%','1회 공격','치명타 가능']},
   {name:'붕대 처치',kind:'NEUTRAL',cooldown:3,resourceLabel:'자원 변화 없음',description:'자신에게 3턴 동안 지속회복을 부여합니다. 매 턴 공격력의 45%만큼 HP를 회복합니다.',facts:['회복 45% × 3턴','총 135%','초과회복 가능']},
   {name:'긴급 구호',kind:'SPENDER',cooldown:3,resourceLabel:'자원 -2',description:'자원을 2 소비하여 자신의 HP를 공격력의 240%만큼 즉시 회복합니다.',facts:['회복 240%','회복 치명타 가능','초과회복 가능']},
  ],
 },
 reclaimer:{
  description:'상대를 공격하면서 자신의 체력도 챙기는 회수업자. 화력을 포기하지 않고 전투 지속력을 확보합니다.',
  resourceSummary:'전투 자원 · 시작 0 · 최대 4칸',
  skills:[
   {name:'회수용 칼질',kind:'GENERATOR',cooldown:1,resourceLabel:'자원 +1',description:'적에게 공격력의 115%만큼 물리 피해를 주고 자원을 1 생성합니다.',facts:['피해 115%','1회 공격','치명타 가능']},
   {name:'악착같은 회수',kind:'NEUTRAL',cooldown:3,resourceLabel:'자원 변화 없음',description:'적에게 공격력의 100%만큼 물리 피해를 주고 자신의 HP를 공격력의 50%만큼 회복합니다.',facts:['피해 100%','회복 50%','공격·회복 치명타 가능']},
   {name:'싹쓸이',kind:'SPENDER',cooldown:3,resourceLabel:'자원 -2',description:'자원을 2 소비하여 적에게 공격력의 250%만큼 물리 피해를 주고 자신의 HP를 공격력의 80%만큼 회복합니다.',facts:['피해 250%','회복 80%','초과회복 가능']},
  ],
 },
 green_crown_pilgrim:{
  description:'자기 강화와 회복을 함께 사용하는 순례자. 공격과 방어를 고르게 끌어올리며 안정적으로 버팁니다.',
  resourceSummary:'전투 자원 · 시작 0 · 최대 4칸',
  skills:[
   {name:'순례자의 지팡이',kind:'GENERATOR',cooldown:1,resourceLabel:'자원 +1',description:'적에게 공격력의 110%만큼 물리 피해를 주고 자원을 1 생성합니다.',facts:['피해 110%','1회 공격','치명타 가능']},
   {name:'고행의 기도',kind:'NEUTRAL',cooldown:4,resourceLabel:'자원 변화 없음',description:'3턴 동안 자신의 공격력을 15%, 방어력을 25% 증가시킵니다.',facts:['공격력 +15%','방어력 +25%','지속 3턴']},
   {name:'녹관의 은총',kind:'SPENDER',cooldown:3,resourceLabel:'자원 -2',description:'자원을 2 소비하여 자신의 HP를 공격력의 190%만큼 회복하고 2턴 동안 방어력을 30% 증가시킵니다.',facts:['회복 190%','방어력 +30%','지속 2턴']},
  ],
 },
 porter:{
  description:'회복 대신 보호막과 방어력으로 피해를 받아내는 짐꾼. 낮은 화력을 높은 생존력으로 보완합니다.',
  resourceSummary:'전투 자원 · 시작 0 · 최대 4칸',
  skills:[
   {name:'짐짝 후려치기',kind:'GENERATOR',cooldown:1,resourceLabel:'자원 +1',description:'적에게 공격력의 105%만큼 물리 피해를 주고 자원을 1 생성합니다.',facts:['피해 105%','1회 공격','치명타 가능']},
   {name:'짐으로 막기',kind:'NEUTRAL',cooldown:3,resourceLabel:'자원 변화 없음',description:'자신에게 최대 HP의 18%만큼 보호막을 부여합니다.',facts:['보호막 최대 HP 18%','자신 대상']},
   {name:'악착같이 버티기',kind:'SPENDER',cooldown:4,resourceLabel:'자원 -2',description:'자원을 2 소비하여 자신에게 최대 HP의 30%만큼 보호막을 부여하고 2턴 동안 방어력을 30% 증가시킵니다.',facts:['보호막 최대 HP 30%','방어력 +30%','지속 2턴']},
  ],
 },
 guide:{
  description:'상대의 핵심 스킬 타이밍을 끊는 운영형 길잡이. 공격력을 끌어올린 뒤 침묵으로 전투 흐름을 제어합니다.',
  resourceSummary:'전투 자원 · 시작 0 · 최대 4칸',
  skills:[
   {name:'길목 베기',kind:'GENERATOR',cooldown:1,resourceLabel:'자원 +1',description:'적에게 공격력의 110%만큼 물리 피해를 주고 자원을 1 생성합니다.',facts:['피해 110%','1회 공격','치명타 가능']},
   {name:'길잡이의 판단',kind:'NEUTRAL',cooldown:4,resourceLabel:'자원 변화 없음',description:'2턴 동안 자신의 공격력을 25% 증가시킵니다.',facts:['공격력 +25%','지속 2턴']},
   {name:'퇴로 차단',kind:'SPENDER',cooldown:4,resourceLabel:'자원 -2',description:'자원을 2 소비하여 적에게 공격력의 220%만큼 물리 피해를 주고 1턴 동안 침묵시킵니다.',facts:['피해 220%','침묵 1턴','치명타 가능']},
  ],
 },
};

export function jobDetailById(id:string|null){return id?JOB_DETAIL_CATALOG[id]??null:null;}
