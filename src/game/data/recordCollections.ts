/** The twenty launch records. Client previews and server catalog use the same stable IDs. */
import type {EquipmentGrade,EquipmentKind} from '../types';
import {APPEARANCES,type AppearanceRarity} from './cosmetics';

export type RecordBonusStat='hp'|'attack'|'defense';
export interface RecordReward {stat:RecordBonusStat;value:number}
interface RecordBase {id:string;name:string;description:string;rarity:AppearanceRarity;reward:RecordReward}
export interface AppearanceRecord extends RecordBase {kind:'appearance';appearanceIds:string[]}
export interface EquipmentRecord extends RecordBase {kind:'equipment';equipment:{kind:EquipmentKind;grade:EquipmentGrade}[]}
export type CollectionRecord=AppearanceRecord|EquipmentRecord;

/** Appearances only require permanent unlock; no separate deposit or equipped state. */
const appearances:AppearanceRecord[]=[
 {id:'rec_people',name:'탑 아래의 사람들',description:'이름 없이 살아가던 이들이 마지막까지 지키려 했던 것은 오늘의 일상이었다.',rarity:'A',appearanceIds:['shepherd','lumberjack','proletaria'],reward:{stat:'hp',value:30}},
 {id:'rec_wanderers',name:'길 위의 방랑자',description:'고향을 떠난 이들은 서로 다른 길을 걸으면서도 같은 탑을 바라보았다.',rarity:'B',appearanceIds:['default','wandering_preacher'],reward:{stat:'hp',value:15}},
 {id:'rec_rotten_court',name:'부패한 권력',description:'왕좌가 지워진 뒤에도 신분과 세금의 기록만은 오래도록 남았다.',rarity:'A',appearanceIds:['noble_knight','bourgeoisie','court_jester'],reward:{stat:'defense',value:2}},
 {id:'rec_dead_knights',name:'죽음의 그림자',description:'죽은 기사가 마지막 맹세를 잊지 않았듯 의사는 끝나지 않은 역병을 기억했다.',rarity:'B',appearanceIds:['skeleton_knight','plague_doctor'],reward:{stat:'attack',value:1}},
 {id:'rec_meaculpa',name:'외경의 신도들',description:'메아쿨파의 진실을 좇던 사람들은 책장을 넘길 때마다 자신을 의심했다.',rarity:'B',appearanceIds:['cultist','inquisitor','nameless_pilgrim'],reward:{stat:'hp',value:20}},
 {id:'rec_frontier',name:'노바르의 개척자',description:'탑으로 향하는 길은 기록관과 경비병, 이름 없는 광부가 닦았다.',rarity:'C',appearanceIds:['association_archivist','mining_crew','scout'],reward:{stat:'defense',value:1}},
 {id:'rec_sinners',name:'죄인의 흔적',description:'최초의 피와 이름 없는 죄는 같은 책의 다른 장에 적혀 있었다.',rarity:'SR',appearanceIds:['cain','nameless_sinner'],reward:{stat:'attack',value:2}},
 {id:'rec_erased',name:'지워진 왕과 첫 사람',description:'왕관을 빼앗긴 자와 최초로 잊힌 자는 서로의 이름조차 알지 못했다.',rarity:'SSR',appearanceIds:['nameless_king','first_forgotten_one'],reward:{stat:'hp',value:30}},
 {id:'rec_false_faith',name:'거짓된 구원의 예언',description:'구원의 약속과 말소의 예언이 하나의 제단에서 울려 퍼졌다.',rarity:'SSR',appearanceIds:['false_savior','antichrist'],reward:{stat:'hp',value:25}},
 {id:'rec_ironhands',name:'쇠와 손의 기억',description:'기계와 골렘을 만든 이들의 손은 끝내 자신들이 낳은 운명을 되돌리지 못했다.',rarity:'B',appearanceIds:['mechanic','golem','blacksmith'],reward:{stat:'defense',value:1}}
];

/** Equipment entries have independent server-authoritative, irreversible deposits. */
const equipment:EquipmentRecord[]=[
 {id:'rec_gear_guard',name:'낡은 경비의 무장',description:'탑의 문 앞을 지키던 경비병이 남긴 방어 장구.',rarity:'C',equipment:[{kind:'expedition_iron_helmet',grade:'common'},{kind:'return_corps_plate_armor',grade:'common'}],reward:{stat:'defense',value:1}},
 {id:'rec_gear_trail',name:'탐사자의 발자취',description:'누군가 지나간 자리에는 먼지 묻은 장화와 작업 장갑이 남았다.',rarity:'C',equipment:[{kind:'survey_corps_dust_boots',grade:'common'},{kind:'mining_detail_reinforced_gloves',grade:'common'}],reward:{stat:'hp',value:10}},
 {id:'rec_gear_lookout',name:'외곽의 감시자',description:'먼 곳에서 불어온 경고는 낡은 활시위를 타고 전해졌다.',rarity:'B',equipment:[{kind:'outer_guard_longbow',grade:'uncommon'},{kind:'survey_corps_dust_boots',grade:'uncommon'}],reward:{stat:'attack',value:1}},
 {id:'rec_gear_archives',name:'기록원 제식 장비',description:'탑에 진입한 기록관들은 같은 마도구와 공적 인장을 지녔다.',rarity:'B',equipment:[{kind:'archive_standard_arcane_staff',grade:'uncommon'},{kind:'expedition_merit_ring',grade:'uncommon'}],reward:{stat:'hp',value:15}},
 {id:'rec_gear_relics',name:'귀환자의 증표',description:'돌아온 이가 누구인지는 목걸이와 반지만이 증언한다.',rarity:'A',equipment:[{kind:'association_registration_tag',grade:'rare'},{kind:'expedition_merit_ring',grade:'rare'}],reward:{stat:'defense',value:1}},
 {id:'rec_gear_mining',name:'광산의 마지막 날',description:'가장 깊은 갱도에서 판금과 장갑이 발견되었다.',rarity:'A',equipment:[{kind:'return_corps_plate_armor',grade:'rare'},{kind:'mining_detail_reinforced_gloves',grade:'rare'}],reward:{stat:'attack',value:1}},
 {id:'rec_gear_vanguard',name:'귀환대 선봉대',description:'선봉대가 가장 먼저 포기한 것은 자신들의 귀환이었다.',rarity:'B',equipment:[{kind:'expedition_iron_helmet',grade:'uncommon'},{kind:'return_corps_plate_armor',grade:'uncommon'}],reward:{stat:'defense',value:2}},
 {id:'rec_gear_script',name:'잉크 묻은 마도구',description:'지워진 문장 위에 남아 있던 마력의 흔적.',rarity:'C',equipment:[{kind:'archive_standard_arcane_staff',grade:'common'},{kind:'association_registration_tag',grade:'common'}],reward:{stat:'hp',value:20}},
 {id:'rec_gear_oath',name:'봉인된 술식',description:'의식이 끝난 뒤에도 인장과 지팡이에는 열기가 남아 있었다.',rarity:'A',equipment:[{kind:'archive_standard_arcane_staff',grade:'rare'},{kind:'expedition_merit_ring',grade:'rare'}],reward:{stat:'attack',value:2}},
 {id:'rec_gear_survivors',name:'살아 돌아온 자들',description:'철갑과 장화만이 그들이 탑의 심부에 다녀왔다는 증거였다.',rarity:'SR',equipment:[{kind:'expedition_iron_helmet',grade:'heroic'},{kind:'survey_corps_dust_boots',grade:'heroic'}],reward:{stat:'hp',value:30}},
];

export const RECORD_COLLECTIONS:readonly CollectionRecord[]=[...appearances,...equipment];
export const APPEARANCE_RECORDS:readonly AppearanceRecord[]=appearances;
export const EQUIPMENT_RECORDS:readonly EquipmentRecord[]=equipment;
export const equipmentRecordEntryId=(record:EquipmentRecord,index:number)=>record.id+'_'+(index+1);
export function collectionRecordProgress(record:CollectionRecord,unlocked:readonly string[],registrations:ReadonlySet<string>){
 const ids=record.kind==='appearance'?record.appearanceIds:record.equipment.map((_,i)=>equipmentRecordEntryId(record,i));
 const owned=new Set(unlocked);
 const count=ids.filter(id=>record.kind==='appearance'?owned.has(id):registrations.has(id)).length;
 return {count,total:ids.length,complete:count===ids.length};
}
export function collectionRecordBonuses(unlocked:readonly string[],registrations:ReadonlySet<string>){
 const bonus={hp:0,attack:0,defense:0,completed:0,total:RECORD_COLLECTIONS.length};
 for(const record of RECORD_COLLECTIONS){
  if(!collectionRecordProgress(record,unlocked,registrations).complete)continue;
  bonus[record.reward.stat]+=record.reward.value;
  bonus.completed++;
 }
 return bonus;
}
if(new Set(RECORD_COLLECTIONS.map(record=>record.id)).size!==RECORD_COLLECTIONS.length)throw Error('컬렉션 ID 중복');
const knownAppearances=new Set(APPEARANCES.map(a=>a.id));
for(const record of appearances)for(const id of record.appearanceIds)if(!knownAppearances.has(id))throw Error('존재하지 않는 컬렉션 외형: '+id);
