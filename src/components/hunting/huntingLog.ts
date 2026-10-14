import type {HuntResult} from '../../game/hunting/model';
import {equipmentItemName} from '../../game/data/equipment';

export const HUNT_HISTORY_LIMIT=10;
export const huntHistoryKey=(r:HuntResult)=>r.requestId??`${r.createdAt}:${r.mapId}:${r.monster?.id??''}`;
export function appendHuntHistory(history:readonly HuntResult[],result:HuntResult):readonly HuntResult[]{
 if(history.some(r=>huntHistoryKey(r)===huntHistoryKey(result)))return history;
 return [...history,result].slice(-HUNT_HISTORY_LIMIT);
}
export type HuntLogEntry={text:string;kind:'action'|'damage'|'heal'|'reward'|'victory'|'defeat';turn?:number};
/** Presentation of confirmed snapshots only; no combat calculations or reward rolls. */
export function huntLogEntries(result:HuntResult,nickname='탐사자'):HuntLogEntry[]{
 const entries:HuntLogEntry[]=[];
 for(const turn of result.turns)for(const line of turn.lines){
  const text=line.replace(/^탐사자/,nickname);
  entries.push({text,turn:turn.turn,kind:/회복|(?:HP|MP)\s*\+/.test(line)?'heal':/\d+ 피해/.test(line)?'damage':'action'});
 }
 entries.push({kind:result.outcome==='victory'?'victory':'defeat',text:result.outcome==='victory'?'승리! · 사냥 성공':'사냥 실패 · 획득 보상 없음'});
 if(result.outcome==='victory'){
  entries.push({kind:'reward',text:`경험치 +${result.exp.toLocaleString()} · 실버 +${result.silver.toLocaleString()} · 숙련도 +${result.mastery.toLocaleString()}`});
  if((result.guildTax??0)>0)entries.push({kind:'reward',text:`원정단 세금 ${result.guildTax!.toLocaleString()} 실버 → 공용 금고 자동 적립`});
  if(result.equipment)entries.push({kind:'reward',text:'장비 획득 · '+equipmentItemName(result.equipment)});
 }
 if(result.recoveredHp!==undefined&&result.recoveredHp>result.playerHp)entries.push({kind:'heal',text:`전투 후 HP ${(result.recoveredHp-result.playerHp).toLocaleString()} 회복`});
 entries.push({kind:'action',text:result.potionsUsed===undefined?'HP 물약 사용량 · 기록 없음':`HP 물약 ${result.potionsUsed.toLocaleString()}개 사용`});
 return entries;
}
