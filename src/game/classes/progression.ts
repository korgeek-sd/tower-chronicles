/** Three permanent combat professions. Existing appearance/job summons are intentionally separate. */
export const CLASS_LEVELS=[10,20,30,40,50,60,70,80,90,100] as const;
export const CLASS_STAGE_TYPES=['active','active','passive','trait','active','passive','active','trait','passive','active'] as const;
export type ClassStageType=typeof CLASS_STAGE_TYPES[number];
export type ClassId='warrior'|'mage'|'archer';
export type ClassChoice={name:string;description:string;mp?:number;cooldown?:number};
export type ClassStage={level:number;type:ClassStageType;options:[ClassChoice,ClassChoice,ClassChoice]};
export type ClassDefinition={id:ClassId;name:string;summary:string;description:string;art:string;stages:ClassStage[]};
type RawChoice=readonly [name:string,description:string,mp?:number,cooldown?:number];
type RawJob={name:string;summary:string;description:string;art:string;choices:RawChoice[][]};
const RAW:Record<ClassId,RawJob>={
 warrior:{
  name:'전사',summary:'근접 공격 · 생존 · 출혈',description:'강인한 체력과 방어력으로 전열을 지키며, 출혈과 흡혈로 적을 제압합니다.',art:'assets/characters/jobs/contract_mercenary.webp',
  choices:[
   [['강철 베기','공격력 150% 피해',15,2],['방패 강타','공격력 100% 피해 · 기절 확률 20%',15,3],['상처 내기','공격력 110% 피해 · 출혈 2턴',15,3]],
   [['파쇄격','공격력 170% 피해 · 방어력 감소 12%',25,3],['철벽 자세','최대 HP 20% 보호막 · 2턴',20,4],['맹공','공격력 75% 피해 × 2회',20,2]],
   [['전투 호흡','기본 공격 시 MP 15 회복'],['마력 순환','턴 시작 시 MP 6 회복'],['피의 투지','피격 시 MP 10 회복']],
   [['광전사의 길','스킬 피해 +10% · 받는 피해 +3%'],['수호자의 길','받는 피해 -8% · 스킬 피해 -5%'],['숙련자의 길','MP 소모 -20% · 스킬 피해 -3%']],
   [['관통 참격','공격력 205% 피해 · 방어 관통 15%',30,4],['수호의 벽','최대 HP 30% 보호막 · 2턴',30,4],['흡혈 베기','공격력 155% 피해 · 피해의 20% 회복',30,4]],
   [['급소 포착','치명타 확률 +5%p'],['재생 체질','매 턴 최대 HP 2% 회복'],['강철 육체','방어력 +12%']],
   [['폭풍 연격','공격력 80% 피해 × 3회',45,5],['대지 강타','공격력 205% 피해 · 적 공격력 감소 15%',40,4],['불굴의 포효','최대 HP 15% 회복 · 10% 보호막',40,5]],
   [['파괴의 맹세','공격 피해 +10% · 받는 회복량 -25%'],['불굴의 맹세','받는 피해 -10% · MP 소모 +10%'],['전투의 대가','치명타 피해 +20%p · MP 소모 -10%']],
   [['검술의 완성','공격력 +8%'],['불굴의 육체','방어력 +15%'],['깊은 호흡','턴 시작 시 MP 5 추가 회복']],
   [['종언의 참격','공격력 380% 피해',80,7],['불멸의 방패','최대 HP 45% 보호막 · 2턴',70,7],['피의 심판','공격력 270% 피해 · 피해의 25% 회복',75,7]]
  ]
 },
 mage:{
  name:'마법사',summary:'화염 · 번개 · 마력',description:'화상과 기절을 유발하는 강력한 마법을 사용하며, MP 관리로 전투를 조율합니다.',art:'assets/characters/jobs/soulcaster.webp',
  choices:[
   [['라이트닝 볼트','공격력 165% 피해 · 기절 확률 10%',18,3],['파이어볼','공격력 135% 피해 · 화상 2턴',18,3],['어둠장벽','최대 HP 18% 보호막 · 2턴',18,4]],
   [['힐','최대 HP 20% 회복',25,4],['메테오','공격력 205% 피해 · 화상 2턴',30,4],['생명 흡수','공격력 145% 피해 · 15% 흡혈',25,3]],
   [['마나 순환','턴 시작 시 MP 6 회복'],['정신 집중','기본 공격 시 MP 15 회복'],['마력 반사','피격 시 MP 10 회복']],
   [['파괴의 비전','공격 피해 +10% · 회복/보호막 -10%'],['수호의 비전','회복/보호막 +20% · 공격 피해 -8%'],['절제의 비전','MP 소모 -15% · 효과량 -4%']],
   [['체인 라이트닝','공격력 195% 2연타 · 기절 확률 10%',40,4],['심연의 저주','공격력 160% 피해 · 방어력 감소 12%',35,4],['빙결창','공격력 210% 피해 · 공격력 감소 12%',40,4]],
   [['원소 숙련','공격 스킬 피해 +8%'],['생명의 마력','회복/보호막 효과 +15%'],['강인한 정신','최대 HP +12%']],
   [['아케인 폭발','공격력 260% 피해',55,5],['시간 왜곡','공격 스킬 피해 +25% · 2턴',40,5],['침묵의 구체','공격력 180% 피해 · 침묵 확률 20%',45,4]],
   [['빠른 주문','스킬 쿨타임 -1턴 · 최소 2턴'],['고효율 주문','MP 소모 -20%'],['심화 마법','스킬 효과량 +12% · MP 소모 +15%']],
   [['대마법 숙련','공격 스킬 피해 +8%'],['불굴의 정신','받는 피해 -8%'],['마나의 그릇','최대 MP +50']],
   [['종말의 메테오','공격력 365% 피해 · 화상 2턴',90,7],['절대 결계','최대 HP 50% 보호막 · 2턴',75,7],['천둥 심판','공격력 290% 피해 · 기절 확률 20%',80,7]]
  ]
 },
 archer:{
  name:'궁수',summary:'정밀 사격 · 연타 · 중독',description:'치명타와 빠른 연속 사격으로 적을 제압하며, 중독과 방어 관통에 특화됩니다.',art:'assets/characters/jobs/hunter.webp',
  choices:[
   [['관통 화살','공격력 150% 피해 · 방어 관통 15%',15,3],['연속 사격','공격력 85% 피해 × 2회',18,3],['독화살','공격력 115% 피해 · 중독 3턴',18,3]],
   [['약점 사격','공격력 180% 피해 · 치명타 확률 +15%p',25,4],['제압 사격','공격력 140% 피해 · 공격력 감소 12%',25,4],['엄폐 사격','공격력 100% 피해 · HP 15% 보호막',25,4]],
   [['고른 호흡','턴 시작 시 MP 6 회복'],['화살 회수','기본 공격 시 MP 16 회복'],['전투 집중','치명타 적중 시 MP 12 회복']],
   [['명사수의 길','치명타 확률 +6%p'],['속사의 길','액티브 MP 소모 -15%'],['생존 사냥꾼','받는 피해 -8% · 최대 HP +5%']],
   [['집중 연사','공격력 90% 피해 × 3회',40,4],['저격','공격력 230% 피해 · 치명타 확률 +15%p',40,5],['맹독 사격','공격력 155% 피해 · 중독 3턴',35,4]],
   [['급소 간파','치명타 피해 +20%p'],['매의 눈','방어 관통 +8%p'],['사냥꾼의 체력','최대 HP +12%']],
   [['폭풍 연사','공격력 80% 피해 × 4회',55,6],['갑옷 파쇄','공격력 220% 피해 · 방어력 감소 15%',45,5],['마비 독화살','공격력 180% 피해 · 기절 확률 20%',45,5]],
   [['치명적인 조준','치명타 피해 +20%p'],['숙련된 궁수','액티브 MP 소모 -20%'],['불굴의 사수','받는 피해 -10%']],
   [['궁술의 완성','공격력 +8%'],['깊은 호흡','턴 시작 시 MP 5 추가 회복'],['강인한 육체','최대 HP +15%']],
   [['천공의 일격','공격력 400% 피해 · 방어 관통 20%',85,7],['백발의 폭풍','공격력 105% 피해 × 4회',90,7],['죽음의 맹독','공격력 280% 피해 · 중독 3턴',80,7]]
  ]
 }
};
export const CLASS_CATALOG:Record<ClassId,ClassDefinition>=Object.fromEntries((Object.entries(RAW) as [ClassId,RawJob][]).map(([id,raw])=>[id,{
 id,name:raw.name,summary:raw.summary,description:raw.description,art:raw.art,
 stages:raw.choices.map((options,i)=>({
  level:CLASS_LEVELS[i],type:CLASS_STAGE_TYPES[i],
  options:options.map(choice=>({name:choice[0],description:choice[1],mp:choice[2],cooldown:choice[3]})) as [ClassChoice,ClassChoice,ClassChoice]
 }))
}])) as Record<ClassId,ClassDefinition>;

export interface ClassProgress {classId:ClassId|null;picks:(number|null)[];order:number[]}
export const initialClassProgress=():ClassProgress=>({classId:null,picks:Array(10).fill(null),order:[]});
const isClassId=(id:unknown):id is ClassId=>id==='warrior'||id==='mage'||id==='archer';
export function normalizeClassProgress(value:unknown):ClassProgress{
 if(!value||typeof value!=='object')return initialClassProgress();
 const data=value as Partial<ClassProgress>;
 if(!isClassId(data.classId))return initialClassProgress();
 const picks=CLASS_LEVELS.map((_,i)=>{const n=data.picks?.[i];return n===0||n===1||n===2?n:null;});
 const eligible=[0,1,4,6,9].filter(i=>picks[i]!==null);
 const order=Array.isArray(data.order)?data.order.filter((id,i,a)=>eligible.includes(id)&&a.indexOf(id)===i):[];
 return {classId:data.classId,picks,order:[...order,...eligible.filter(id=>!order.includes(id))]};
}
/** Permanent: calling a second time never changes the chosen class. */
export function chooseInitialClass(value:ClassProgress,id:ClassId):ClassProgress{
 if(value.classId||!isClassId(id))return value;
 return {classId:id,picks:Array(10).fill(null),order:[]};
}
/** A stage is acquired once, at or above its level requirement. */
export function chooseClassGrowth(value:ClassProgress,stage:number,option:number,level:number):ClassProgress{
 if(!value.classId||!Number.isInteger(stage)||stage<0||stage>=10||!Number.isInteger(option)||option<0||option>2||
   !Number.isFinite(level)||level<CLASS_LEVELS[stage]||value.picks[stage]!==null)return value;
 const picks=[...value.picks];picks[stage]=option;
 const order=CLASS_STAGE_TYPES[stage]==='active'?[...value.order,stage].sort((a,b)=>a-b):[...value.order];
 return {...value,picks,order};
}
export function getActiveSkills(value:ClassProgress):{stage:number;skill:ClassChoice}[]{
 if(!value.classId)return [];
 return value.order.flatMap(stage=>{
  const option=value.picks[stage];
  return option===null||CLASS_STAGE_TYPES[stage]!=='active'?[]:[{stage,skill:CLASS_CATALOG[value.classId!].stages[stage].options[option]}];
 });
}
export function moveClassSkill(value:ClassProgress,index:number,delta:number):ClassProgress{
 const dest=index+delta;if(!Number.isInteger(index)||!Number.isInteger(delta)||index<0||dest<0||dest>=value.order.length)return value;
 const order=[...value.order];[order[index],order[dest]]=[order[dest],order[index]];
 return {...value,order};
}
export function defaultClassSkillOrder(value:ClassProgress):ClassProgress{
 const order=[...value.order].sort((a,b)=>a-b);
 return order.every((n,i)=>n===value.order[i])?value:{...value,order};
}
