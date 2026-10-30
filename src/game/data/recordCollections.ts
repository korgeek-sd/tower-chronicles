/** Independent, permanent collection records. Data must match the private SQL catalogue. */
import {APPEARANCES,APPEARANCE_BONUS_LABELS,type AppearanceRarity,type AppearanceBonusStat} from './cosmetics';
import {EQUIPMENT_DEFINITIONS,EQUIPMENT_GRADE_NAMES} from './equipment';
import type {EquipmentKind,EquipmentGrade} from '../types';

export type RecordKind='appearance'|'equipment';
export interface RecordReward{stat:AppearanceBonusStat;value:number}
export interface RecordCollectionSet{
 id:string;kind:RecordKind;name:string;description:string;rarity:AppearanceRarity;
 appearanceIds:readonly string[];
 equipment?:{kind:EquipmentKind;grade:EquipmentGrade};
 reward:RecordReward;
}
const people=(id:string,name:string,description:string,appearanceIds:string[],stat:AppearanceBonusStat,value:number):RecordCollectionSet=>{
 const ordered:AppearanceRarity[]=['C','B','A','SR','SSR'];
 const rarity=appearanceIds.reduce<AppearanceRarity>((best,id)=>{
  const level=APPEARANCES.find(a=>a.id===id)?.rarity??'C';
  return ordered.indexOf(level)>ordered.indexOf(best)?level:best;
 },'C' as AppearanceRarity);
 return {id,kind:'appearance',name,description,rarity,appearanceIds,reward:{stat,value}};
};
const relic=(id:string,name:string,description:string,kind:EquipmentKind,grade:EquipmentGrade,stat:AppearanceBonusStat,value:number,rarity:AppearanceRarity):RecordCollectionSet=>({
 id,kind:'equipment',name,description,rarity,appearanceIds:[],equipment:{kind,grade},reward:{stat,value}
});
export const APPEARANCE_RECORD_SETS:readonly RecordCollectionSet[]=[
 people('record_people_knights','끝나지 않은 충성','사라진 왕국에서도 충성을 버리지 못한 이들의 기록.',['skeleton_knight','returning_knight'],'defense',1),
 people('record_people_forge','이름 없는 장인들','쇠와 불에 자신들의 이름을 남긴 이들의 기록.',['mechanic','blacksmith'],'hp',15),
 people('record_people_frontier','경계의 감시자','도시의 경계를 지켰으나 문 안으로 돌아오지 못한 자들.',['novar_outskirts_guard','scout'],'defense',1),
 people('record_people_erased','지워진 얼굴','자신의 이름을 잃고도 끝내 탑을 떠돌던 자들.',['nameless_pilgrim','faceless_one'],'hp',20),
 people('record_people_heresy','뒤틀린 계시','진실을 찾다가 서로 다른 심판에 이른 자들.',['inquisitor','cultist'],'defense',1),
 people('record_people_dead','망자의 속삭임','죽은 자의 침묵을 깨뜨린 자들의 증언.',['grave_robber','necromancer'],'hp',15),
 people('record_people_road','돌아갈 곳 없는 길','어느 곳에도 이름을 남기지 못한 여행자들.',['corsair','teddy'],'hp',20),
 people('record_people_oath','왕의 마지막 명령','왕이 사라진 뒤에도 명령은 끝나지 않았다.',['knight','noble_knight'],'defense',1),
 people('record_people_magic','봉인된 주문','기록 속에 숨겨진 마법을 읽은 두 마법사.',['apprentice_mage','advanced_mage'],'hp',20),
 people('record_people_plague','역병의 시대','치료와 왕관조차 재앙을 막지 못했던 시대.',['plague_doctor','rat_king'],'defense',1)
];
export const EQUIPMENT_RECORD_SETS:readonly RecordCollectionSet[]=[
 relic('ashen_border_1','북쪽 경계의 활','되돌아오지 못한 경비대가 남긴 무기.','outer_guard_longbow','uncommon','attack',1,'B'),
 relic('record_relic_staff','서고의 지팡이','봉인된 문서를 지키던 마도사의 유물.','archive_standard_arcane_staff','common','hp',15,'C'),
 relic('record_relic_helmet','먼지 쌓인 투구','마지막 순찰에서 돌아오지 못한 경비병의 흔적.','expedition_iron_helmet','common','defense',1,'C'),
 relic('record_relic_armor','귀환하지 못한 갑옷','주인보다 오래 살아남은 철제 갑옷.','return_corps_plate_armor','uncommon','defense',1,'B'),
 relic('record_relic_gloves','광부의 손','어둠 아래서 기록을 찾던 노동자들의 장갑.','mining_detail_reinforced_gloves','common','hp',15,'C'),
 relic('record_relic_boots','끝없는 발걸음','아무도 찾지 않는 길을 걸었던 자의 장화.','survey_corps_dust_boots','uncommon','hp',20,'B'),
 relic('record_relic_tag','지워진 협회명부','낡은 인장에 남은 이름 없는 소속의 흔적.','association_registration_tag','common','defense',1,'C'),
 relic('record_relic_ring','원정의 서약','귀환을 약속했으나 끝내 돌아오지 못한 자의 반지.','expedition_merit_ring','uncommon','attack',1,'B'),
 relic('record_relic_bow_rare','잿빛 추적자','먼 전장에서 발견된 낡은 명사수의 활.','outer_guard_longbow','rare','attack',2,'A'),
 relic('record_relic_plate_rare','잊힌 근위대','성문을 지키던 근위대의 마지막 유산.','return_corps_plate_armor','rare','hp',25,'A')
];
export const RECORD_COLLECTION_SETS:readonly RecordCollectionSet[]=[...APPEARANCE_RECORD_SETS,...EQUIPMENT_RECORD_SETS];
export function recordCollectionProgress(set:RecordCollectionSet,unlockedIds:readonly string[],registeredIds:ReadonlySet<string>){
 if(set.kind==='equipment')return {count:registeredIds.has(set.id)?1:0,total:1,complete:registeredIds.has(set.id)};
 const owned=new Set(unlockedIds);
 const count=set.appearanceIds.filter(id=>owned.has(id)).length;
 return {count,total:set.appearanceIds.length,complete:count===set.appearanceIds.length};
}
export function recordCollectionRewardLabel(set:RecordCollectionSet){
 return APPEARANCE_BONUS_LABELS[set.reward.stat]+' +'+set.reward.value;
}
export function recordEquipmentLabel(set:RecordCollectionSet){
 const e=set.equipment;
 return e?EQUIPMENT_GRADE_NAMES[e.grade]+' '+EQUIPMENT_DEFINITIONS[e.kind].name:'';
}
export function recordCollectionBonuses(unlockedIds:readonly string[],registeredIds:ReadonlySet<string>){
 const result={hp:0,attack:0,defense:0};
 for(const set of RECORD_COLLECTION_SETS){
  if(recordCollectionProgress(set,unlockedIds,registeredIds).complete)result[set.reward.stat]+=set.reward.value;
 }
 return result;
}
export function validateRecordCollections(){
 const known=new Set(APPEARANCES.map(a=>a.id)),ids=new Set<string>();
 return RECORD_COLLECTION_SETS.every(set=>{
  if(ids.has(set.id))return false;
  ids.add(set.id);
  return !!set.name&&!!set.description&&set.reward.value>0&&Number.isSafeInteger(set.reward.value)&&
  (set.kind==='appearance'?!set.equipment&&set.appearanceIds.length>=2&&new Set(set.appearanceIds).size===set.appearanceIds.length&&set.appearanceIds.every(id=>id!=='default'&&known.has(id)):
   set.appearanceIds.length===0&&!!set.equipment&&!!EQUIPMENT_DEFINITIONS[set.equipment.kind]);
 });
}
if(!validateRecordCollections())throw Error('기록 컬렉션 데이터 검증 실패');
