import type {CharacterGrowthSnapshot} from '../../online/characterGrowth';
import {RECORD_COLLECTION_SETS,recordCollectionProgress,type RecordCollectionSet} from '../../game/data/recordCollections';
import {huntingProgress,normalizeStatAllocation,statPointsForLevel,usedStatPoints} from '../../game/hunting/model';
export type GrowthStat='hp'|'attack'|'defense'|'critChance'|'critDamage'|'armorPenetration'|'mp';
export const GROWTH_STAT_LABELS:Record<GrowthStat,string>={hp:'최대 체력',attack:'공격력',defense:'방어력',critChance:'치명타 확률',critDamage:'치명타 피해',armorPenetration:'방어 관통',mp:'최대 MP'};
export const growthValue=(stat:GrowthStat,value:number)=>['critChance','critDamage','armorPenetration'].includes(stat)?Number((value*100).toFixed(2)).toLocaleString('ko-KR')+'%':value.toLocaleString('ko-KR',{maximumFractionDigits:2});
export function characterGrowthSummary(data:CharacterGrowthSnapshot,sets:readonly RecordCollectionSet[]=RECORD_COLLECTION_SETS){
 const progress=huntingProgress(data.experience),allocation=normalizeStatAllocation(data.allocation);
 const completed=sets.filter(set=>recordCollectionProgress(set,data.collection.unlockedAppearanceIds,new Set(data.collection.registeredSetIds)).complete);
 const collection={hp:0,attack:0,defense:0};for(const set of completed)collection[set.reward.stat]+=set.reward.value;
 return {progress,allocation,points:Math.max(0,statPointsForLevel(progress.level)-usedStatPoints(allocation)),
  xpPercent:progress.nextExp===0?100:Math.floor(progress.exp/progress.nextExp*100),
  collection:{completed:completed.length,total:sets.length,planned:collection,applied:data.collection.applied},
  weapon:data.equipment.find(entry=>entry.slot==='weapon')??null};
}
export interface GrowthContribution {id:string;label:string;value:number;note?:string}
/** Presentation decomposition only. The final displayed value always comes from the server. */
export function growthBreakdown(data:CharacterGrowthSnapshot,stat:GrowthStat){
 const allocation=normalizeStatAllocation(data.allocation),base=stat==='mp'?100:data.baseStats[stat];
 const equipment=stat==='mp'?0:data.equipment.reduce((sum,entry)=>sum+(entry.stats[stat]??0),0);
 const invested=stat==='hp'?allocation.hp*12:stat==='attack'?allocation.attack:stat==='defense'?allocation.defense*2:stat==='critChance'?allocation.crit*.02:stat==='mp'?(allocation.mp??0)*10:0;
 const rows:GrowthContribution[]=[{id:'base',label:'기본',value:base},{id:'equipment',label:'장비',value:equipment},{id:'allocation',label:'스탯',value:invested}];
 let running=base+equipment+invested;
 if(stat==='critChance'&&running>.6){rows.push({id:'cap',label:'치명타 상한',value:.6-running,note:'최대 60%'});running=.6;}
 const bonusKey=stat==='hp'?'hpPercent':stat==='attack'?'attackPercent':stat==='defense'?'defensePercent':null;
 for(const id of ['association','guardian'] as const){
  const rate=bonusKey?data.seals[id].bonus[bonusKey]:0,delta=running*rate/100;
  rows.push({id,label:id==='association'?'전투 인장':'수호 인장',value:delta,note:rate?`+${rate}%`:undefined});running+=delta;
 }
 const ap=data.stats.appearanceEffect;
 const matching={hp:'max_hp',attack:'attack',defense:'defense',critChance:'crit_chance',critDamage:'crit_damage',armorPenetration:'armor_penetration',mp:'max_mp'}[stat];
 const effect=ap?.id===matching?(ap.value??0):0;
 const appearance=['hp','attack','defense'].includes(stat)?running*effect/100:stat==='mp'?effect:effect/100;
 rows.push({id:'appearance',label:'착용 외형',value:appearance,note:effect?`+${effect}${stat==='mp'?' MP':'%'}`:undefined});running+=appearance;
 const collection=data.collection.applied?(data.collection.bonuses?.[stat as 'hp'|'attack'|'defense']??0):0;
 rows.push({id:'collection',label:'컬렉션',value:collection,note:data.collection.applied?'영구 적용':'서버 미적용'});running+=collection;
 const final=stat==='mp'?data.maxMp:data.stats[stat];
 const adjustment=final-running;
 if(Math.abs(adjustment)>.000001)rows.push({id:'adjustment',label:stat==='hp'?'반올림':'상한·서버 보정',value:adjustment});
 return {rows,final};
}
