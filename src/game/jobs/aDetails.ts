import {A_JOB_DEFINITIONS} from './aDefinitions';
import type {JobDetailDefinition,JobSkillPreview} from './details';

const A_JOB_DESCRIPTIONS:Record<string,string>={
 executor:'체력이 낮아진 적을 강한 마무리 공격으로 처단하는 집행인.',
 inquisitor:'약화된 적의 빈틈을 파고들어 방어를 관통하는 심문관.',
 deep_delver:'높은 방어 관통과 다단 공격으로 깊게 파고드는 심층 도굴꾼.',
 bloodfighter:'자신의 체력을 대가로 강한 피해를 밀어붙이는 혈전가.',
 expedition_tactician:'공격 강화와 피해 감소를 함께 운용하는 원정 전술가.',
 ascetic_priest:'자신의 체력을 대가로 공격력을 끌어올리고 고통을 되갚는 고행사제.',
 life_stitcher:'회복과 재생, 출혈·중독 제거로 전투를 이어가는 생명봉합사.',
 subjugation_officer:'약화와 방어 관통으로 단일 목표를 제압하는 토벌관.',
 rescuer:'피해 감소와 회복, 상태이상 제거로 생존을 지원하는 구조대원.',
 quartermaster:'공격 강화와 회복·방어·재생을 보급하는 보급관.',
 coroner:'출혈과 약화로 적을 분석하고 빈사 상태를 끝내는 검시관.',
 stair_scout:'빠른 연격과 다단 공격으로 층계를 돌파하는 층계척후.',
};

function toPreview(skill:(typeof A_JOB_DEFINITIONS)[number]['skills'][number]):JobSkillPreview{
 const resource=skill.resource!;
 return {
  name:skill.name,
  kind:resource.kind,
  cooldown:skill.cooldown,
  resourceLabel:resource.kind==='GENERATOR'
   ?`자원 +${resource.gain}`
   :resource.kind==='SPENDER'
    ?`자원 -${resource.cost.mode==='FIXED'?resource.cost.amount:resource.cost.min}`
    :'자원 변화 없음',
  description:skill.description,
  facts:[],
 };
}

export const A_JOB_DETAILS:Record<string,JobDetailDefinition>=Object.fromEntries(
 A_JOB_DEFINITIONS.map(def=>[
  def.jobId,
  {
   description:A_JOB_DESCRIPTIONS[def.jobId]??'확정된 A등급 전투 정의를 사용하는 직능입니다.',
   resourceSummary:'전투 자원 · 시작 0 · 최대 4칸',
   skills:def.skills.map(toPreview) as JobDetailDefinition['skills'],
  },
 ])
);
