export type JobRarity='C'|'B'|'A'|'SR'|'SSR';
export type JobCombatKit={passiveIds:[string,string];activeSkillIds:[string,string,string]};
export type JobResourceDefinition={id:string;initialValue:number;maxValue?:number};
export type JobDefinition={id:string;displayName:string;rarity:JobRarity;description?:string;combatKit?:JobCombatKit;jobResource?:JobResourceDefinition;implementationStatus:'CATALOG_ONLY'|'COMBAT_READY';visualAssetKey?:string};
const rows:[JobRarity,string,string][]=[['C','contract_mercenary','계약용병'],['C','hunter','사냥꾼'],['C','excavator','굴착인부'],['C','field_medic','야전구호원'],['C','reclaimer','회수업자'],['B','vanguard_explorer','선봉 탐사자'],['B','tracker','추적자'],['B','survivor','생환가'],['B','duelist','결투가'],['B','expedition_medic','탐사 의무관'],['A','executor','집행인'],['A','inquisitor','심문관'],['A','deep_delver','심층 도굴꾼'],['A','bloodfighter','혈전가'],['A','expedition_tactician','원정 전술가'],['SR','berserker','광전사'],['SR','mutagen_doctor','변질의사'],['SR','soulcaster','잔혼술사'],['SR','ascetic_fighter','고행투사'],['SR','field_engineer','현장기술자'],['SSR','dragonblood_knight','용혈기사'],['SSR','sealed_archivist','봉인기록관'],['SSR','corpse_tuner','시체조율사'],['SSR','self_alchemist','자가연성가'],['SSR','black_carriage_gambler','검은수레 승부사']];
export const JOB_CATALOG:JobDefinition[]=rows.map(([rarity,id,displayName])=>({id,displayName,rarity,implementationStatus:'CATALOG_ONLY'}));
export const jobById=(id:string|null)=>id?JOB_CATALOG.find(job=>job.id===id)??null:null;
export const JOB_RARITIES:JobRarity[]=['C','B','A','SR','SSR'];
export const jobsByRarity=(rarity:JobRarity)=>JOB_CATALOG.filter(job=>job.rarity===rarity);
export const isValidJobId=(id:unknown):id is string=>typeof id==='string'&&JOB_CATALOG.some(job=>job.id===id);
export function validateCombatKit(kit:JobCombatKit,passiveDefinitions:ReadonlySet<string>,skillDefinitions:ReadonlySet<string>){return new Set(kit.passiveIds).size===2&&new Set(kit.activeSkillIds).size===3&&kit.passiveIds.every(id=>passiveDefinitions.has(id))&&kit.activeSkillIds.every(id=>skillDefinitions.has(id));}
export function validateJobCatalog(catalog:JobDefinition[]=JOB_CATALOG){const ids=new Set(catalog.map(job=>job.id)),names=new Set(catalog.map(job=>job.displayName));if(catalog.length!==25||ids.size!==25||names.size!==25||JOB_RARITIES.some(rarity=>catalog.filter(job=>job.rarity===rarity).length!==5))throw Error('직업 카탈로그 정합성 오류');return true;}
validateJobCatalog();
