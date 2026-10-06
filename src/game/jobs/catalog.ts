import {B_JOB_DEFINITIONS} from './bDefinitions';
import {A_JOB_DEFINITIONS} from './aDefinitions';
import {SR_JOB_DEFINITIONS} from './srDefinitions';
import {JOB_VISUAL_ASSETS} from './visualAssets';
export type JobRarity='C'|'B'|'A'|'SR'|'SSR';
export type JobCombatKit={passiveIds:[]|[string,string];activeSkillIds:[string,string,string]};
export type JobResourceDefinition={id:string;initialValue:number;maxValue?:number};
export type JobDefinition={id:string;displayName:string;rarity:JobRarity;description?:string;combatKit?:JobCombatKit;jobResource?:JobResourceDefinition;implementationStatus:'CATALOG_ONLY'|'COMBAT_READY';visualAssetKey?:string};
const rows:[JobRarity,string,string][]=[
 ['C','contract_mercenary','계약용병'],['C','hunter','사냥꾼'],['C','excavator','굴착인부'],['C','field_medic','야전구호원'],['C','reclaimer','회수업자'],['C','green_crown_pilgrim','녹관 순례자'],['C','porter','짐꾼'],['C','guide','길잡이'],
 ['B','vanguard_explorer','선봉 탐사자'],['B','tracker','추적자'],['B','survivor','생환가'],['B','duelist','결투가'],['B','expedition_medic','탐사 의무관'],['B','redeemer','대속자'],['B','lantern_keeper','등불지기'],['B','relic_collector','유품회수인'],['B','monster_dismantler','몬스터 해체꾼'],['B','expedition_archivist','탐사기록원'],
 ['A','executor','집행인'],['A','inquisitor','심문관'],['A','deep_delver','심층 도굴꾼'],['A','bloodfighter','혈전가'],['A','expedition_tactician','원정 전술가'],['A','ascetic_priest','고행사제'],['A','life_stitcher','생명봉합사'],['A','subjugation_officer','토벌관'],['A','rescuer','구조대원'],['A','quartermaster','보급관'],['A','coroner','검시관'],['A','stair_scout','층계척후'],
 ['SR','berserker','광전사'],['SR','mutagen_doctor','변질의사'],['SR','soulcaster','잔혼술사'],['SR','ascetic_fighter','고행투사'],['SR','field_engineer','현장기술자'],['SR','green_crown_martyr','녹관의 수난자'],['SR','unity_apostle','귀일사도'],['SR','deep_rescue_officer','심층구조관'],['SR','boss_tracker','보스추적자'],['SR','return_guardian','귀환수호자'],['SR','green_crown_inquisitor','녹관 이단심문관'],
 ['SSR','dragonblood_knight','용혈기사'],['SSR','sealed_archivist','봉인기록관'],['SSR','corpse_tuner','시체조율사'],['SSR','self_alchemist','자가연성가'],['SSR','black_carriage_gambler','검은수레 승부사'],['SSR','false_saint_proxy','거짓 성자의 대리인'],['SSR','hundred_battle_returnee','백전귀환자'],
];

const EXPECTED_JOB_COUNTS:Record<JobRarity,number>={C:8,B:10,A:12,SR:11,SSR:7};
const EXPECTED_JOB_TOTAL=Object.values(EXPECTED_JOB_COUNTS).reduce((sum,count)=>sum+count,0);

const COMBAT_READY_JOBS: Record<string, { combatKit: JobCombatKit; jobResource?: JobResourceDefinition }> = {
  contract_mercenary: {
    combatKit: {
      passiveIds: ['mercenary_passive_1', 'mercenary_passive_2'],
      activeSkillIds: ['mercenary_skill_1', 'mercenary_skill_2', 'mercenary_skill_3'],
    },
  },
  hunter: {
    combatKit: {
      passiveIds: ['hunter_passive_1', 'hunter_passive_2'],
      activeSkillIds: ['hunter_skill_1', 'hunter_skill_2', 'hunter_skill_3'],
    },
  },
  field_medic: {
    combatKit: {
      passiveIds: ['field_medic_passive_1', 'field_medic_passive_2'],
      activeSkillIds: ['field_medic_skill_1', 'field_medic_skill_2', 'field_medic_skill_3'],
    },
  },
  duelist: {
    combatKit: {
      passiveIds: ['duelist_passive_1', 'duelist_passive_2'],
      activeSkillIds: ['duelist_skill_1', 'duelist_skill_2', 'duelist_skill_3'],
    },
  },
  berserker: {
    combatKit: {
      passiveIds: ['berserker_passive_1', 'berserker_passive_2'],
      activeSkillIds: ['berserker_skill_1', 'berserker_skill_2', 'berserker_skill_3'],
    },
    jobResource: { id: 'combat', initialValue: 0, maxValue: 4 },
  },
};

for(const def of B_JOB_DEFINITIONS){COMBAT_READY_JOBS[def.jobId]={combatKit:{passiveIds:[],activeSkillIds:def.skills.map(s=>s.id) as [string,string,string]},jobResource:def.resource};}
for(const def of [...A_JOB_DEFINITIONS,...SR_JOB_DEFINITIONS]){COMBAT_READY_JOBS[def.jobId]={combatKit:{passiveIds:[],activeSkillIds:def.skills.map(s=>s.id) as [string,string,string]},jobResource:def.resource};}

export const JOB_CATALOG:JobDefinition[]=rows.map(([rarity,id,displayName])=>{
  const ready = COMBAT_READY_JOBS[id];
  return {
    id,
    displayName,
    rarity,
    implementationStatus: ready ? 'COMBAT_READY' : 'CATALOG_ONLY',
    ...(JOB_VISUAL_ASSETS[id]?{visualAssetKey:JOB_VISUAL_ASSETS[id]}:{}),
    ...(ready ? { combatKit: ready.combatKit, jobResource: ready.jobResource } : {}),
  };
});
export const jobById=(id:string|null)=>id?JOB_CATALOG.find(job=>job.id===id)??null:null;
export const JOB_RARITIES:JobRarity[]=['C','B','A','SR','SSR'];
export const jobsByRarity=(rarity:JobRarity)=>JOB_CATALOG.filter(job=>job.rarity===rarity);
export const isValidJobId=(id:unknown):id is string=>typeof id==='string'&&JOB_CATALOG.some(job=>job.id===id);
export function validateCombatKit(kit:JobCombatKit,passiveDefinitions:ReadonlySet<string>,skillDefinitions:ReadonlySet<string>){return (kit.passiveIds.length===0||new Set(kit.passiveIds).size===2)&&new Set(kit.activeSkillIds).size===3&&kit.passiveIds.every(id=>passiveDefinitions.has(id))&&kit.activeSkillIds.every(id=>skillDefinitions.has(id));}
export function validateJobCatalog(catalog:JobDefinition[]=JOB_CATALOG){const ids=new Set(catalog.map(job=>job.id)),names=new Set(catalog.map(job=>job.displayName));if(catalog.length!==EXPECTED_JOB_TOTAL||ids.size!==EXPECTED_JOB_TOTAL||names.size!==EXPECTED_JOB_TOTAL||JOB_RARITIES.some(rarity=>catalog.filter(job=>job.rarity===rarity).length!==EXPECTED_JOB_COUNTS[rarity]))throw Error('직업 카탈로그 정합성 오류');return true;}
validateJobCatalog();
