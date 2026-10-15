/**
 * Lineage-style overlapping appearance collection recipes.
 *
 * Every recipe mixes permanent appearance unlocks with a consumed equipment item.
 * The fixed bonuses are balance proposals, NOT yet applied to combat stats.
 */
import {
 APPEARANCES,APPEARANCE_COLLECTIONS,APPEARANCE_RARITIES,APPEARANCE_BONUS_LABELS,
 type AppearanceRarity,type AppearanceBonusStat
} from './cosmetics';
import {EQUIPMENT_DEFINITIONS,EQUIPMENT_GRADE_NAMES} from './equipment';
import type {EquipmentKind,EquipmentGrade} from '../types';

export interface AppearanceSetReward {stat:AppearanceBonusStat;value:number}
export interface CollectionEquipmentRequirement {kind:EquipmentKind;grade:EquipmentGrade}
export interface AppearanceSet {
 id:string;
 name:string;
 description:string;
 appearanceIds:string[];
 equipment:CollectionEquipmentRequirement;
 rarity:AppearanceRarity;
 reward:AppearanceSetReward;
}
const rarityOrder=(value:AppearanceRarity)=>APPEARANCE_RARITIES.indexOf(value);
export function appearanceSetRarity(appearanceIds:readonly string[]):AppearanceRarity {
 const ranks=appearanceIds.map(id=>APPEARANCES.find(a=>a.id===id)?.rarity??'C');
 return ranks.reduce((best,current)=>rarityOrder(current)>rarityOrder(best)?current:best,'C' as AppearanceRarity);
}
export function collectionSetBonusLabel(set:Pick<AppearanceSet,'reward'>){
 return APPEARANCE_BONUS_LABELS[set.reward.stat]+' +'+set.reward.value;
}
export function collectionSetProgress(set:Pick<AppearanceSet,'appearanceIds'|'equipment'|'id'>,unlockedIds:readonly string[],registeredSetIds:ReadonlySet<string>=new Set()){
 const owned=new Set(unlockedIds),count=set.appearanceIds.filter(id=>owned.has(id)).length+(registeredSetIds.has(set.id)?1:0);
 const total=set.appearanceIds.length+1;
 return {count,total,complete:count===total};
}
export function collectionEquipmentLabel(e:CollectionEquipmentRequirement){return EQUIPMENT_GRADE_NAMES[e.grade]+' '+EQUIPMENT_DEFINITIONS[e.kind].name;}

const themeIds=APPEARANCE_COLLECTIONS.map(theme=>theme.appearanceIds);
const kinds:AppearanceBonusStat[]=['hp','attack','defense'];
const motifs=[
 ['마지막 증표',0],['잊힌 맹세',1],['피 묻은 약속',2],['이름 없는 기록',0],
 ['심연의 속삭임',1],['돌아온 자의 서약',2],['닫힌 문',0],['최후의 증언',1]
] as const;
const bonusFor=(stat:AppearanceBonusStat,size:number,rarity:AppearanceRarity):AppearanceSetReward=>{
 const weight={C:1,B:1,A:2,SR:3,SSR:5}[rarity];
 const index=Math.max(0,Math.min(3,size-2));
 return {stat,value:weight*(stat==='hp'?[40,80,140,220][index]:stat==='attack'?[1,2,3,5][index]:[1,2,3,4][index])};
};
const kindCycle:EquipmentKind[]=['outer_guard_longbow','archive_standard_arcane_staff','expedition_iron_helmet','return_corps_plate_armor','mining_detail_reinforced_gloves','survey_corps_dust_boots','association_registration_tag','expedition_merit_ring'];
const equipmentGradeFor=(rarity:AppearanceRarity):EquipmentGrade=>({C:'common',B:'uncommon',A:'rare',SR:'heroic',SSR:'legendary'})[rarity] as EquipmentGrade;
const themed:AppearanceSet[]=APPEARANCE_COLLECTIONS.flatMap((theme,i)=>{
 const self=themeIds[i],next=themeIds[(i+1)%themeIds.length],previous=themeIds[(i+themeIds.length-1)%themeIds.length];
 const recipes=[
  [self[0],self[1]],
  [self[0],self[2],next[2]],
  [self[1],self[3]],
  [self[0],self[2],self[4]],
  [self[1],next[1],next[3]],
  [self[2],self[3],self[4],next[0]],
  [self[0],previous[3]],
  [self[1],self[2],self[3],next[4]]
 ];
 return recipes.map((appearanceIds,j)=>{
  const [motif,typeOffset]=motifs[j];
  const stat=kinds[(i+typeOffset)%kinds.length];
  const rarity=appearanceSetRarity(appearanceIds);
  return {
   id:theme.id+'_'+(j+1),
   name:theme.name+' · '+motif,
   description:theme.description,
   appearanceIds,
   rarity,
   equipment:{kind:kindCycle[(i*3+j)%kindCycle.length],grade:equipmentGradeFor(rarity)},
   reward:bonusFor(stat,appearanceIds.length,rarity)
  };
 });
});
// All previous combinations required retired, unillustrated appearances.
export const APPEARANCE_SETS:readonly AppearanceSet[]=themed;

export function validateAppearanceSets(sets:readonly AppearanceSet[]=APPEARANCE_SETS){
 const ids=new Set(APPEARANCES.map(x=>x.id));
 if(new Set(sets.map(s=>s.id)).size!==sets.length)return false;
 return sets.every(set=>
  !!set.name&&!!set.description&&set.appearanceIds.length>=2&&set.appearanceIds.length<=5&&
  new Set(set.appearanceIds).size===set.appearanceIds.length&&
  set.appearanceIds.every(id=>id!=='default'&&ids.has(id))&&
  APPEARANCE_RARITIES.includes(set.rarity)&&set.rarity===appearanceSetRarity(set.appearanceIds)&&
  !!EQUIPMENT_DEFINITIONS[set.equipment.kind]&&EQUIPMENT_GRADE_NAMES[set.equipment.grade]!==undefined&&set.equipment.grade===equipmentGradeFor(set.rarity)&&
  ['hp','attack','defense'].includes(set.reward.stat)&&
  Number.isSafeInteger(set.reward.value)&&set.reward.value>0
 );
}
if(!validateAppearanceSets())throw Error('외형 컬렉션 조합 데이터 오류');
