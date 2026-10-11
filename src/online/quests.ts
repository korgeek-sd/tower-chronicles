import {getFreshSession} from './auth';
import {getDeviceId,type CloudSaveRecord} from './cloudSave';
import {supabaseConfig} from './config';
import type {GameplayLease} from './gameSession';
export type QuestPeriod='daily'|'weekly';
export interface QuestReward{item:string;name:string;quantity:number}
export interface QuestEntry{id:string;target:number;progress:number;completed:boolean;claimed:boolean;reward:QuestReward[]|null}
export interface QuestBoard{daily:QuestEntry[];weekly:QuestEntry[];dailyKey:string;weeklyKey:string;serverNow:number;dailyResetAt:number;weeklyResetAt:number}
export interface QuestClaim{period:QuestPeriod;day:string;id:string}
export interface QuestClaimResult{board:QuestBoard;reward:QuestReward[];record:CloudSaveRecord;replayed:boolean}
const errors:Record<string,string>={QUEST_INVALID:'의뢰를 다시 확인해 주세요.',QUEST_PERIOD_INVALID:'의뢰 기간을 다시 확인해 주세요.',QUEST_INCOMPLETE:'아직 완료하지 않은 의뢰입니다.',QUEST_EXPIRED:'의뢰가 초기화되었습니다. 새 의뢰를 확인해 주세요.',GAME_SESSION_LOST:'플레이 권한이 변경되었습니다. 다시 접속해 주세요.'};
export class QuestRejected extends Error{}
async function rpc<T>(name:string,lease:GameplayLease,userId:string,extra:Record<string,unknown>={}):Promise<T>{
 if(!supabaseConfig)throw Error('온라인 설정을 불러오지 못했습니다.');
 const session=await getFreshSession();if(!session||session.userId!==userId)throw new QuestRejected('접속 계정을 다시 확인해 주세요.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},body:JSON.stringify({p_lease_id:lease.leaseId,p_generation:lease.generation,p_client_instance_id:lease.clientInstanceId,p_device_id:getDeviceId(),...extra})});
 const text=await response.text();if(!response.ok){for(const [code,message] of Object.entries(errors))if(text.includes(code))throw new QuestRejected(message);throw Error('의뢰 요청 결과를 확인하지 못했습니다. 다시 확인해 주세요.');}
 if((await getFreshSession())?.userId!==userId)throw new QuestRejected('접속 계정이 변경되었습니다.');
 return JSON.parse(text) as T;
}
export const getQuests=(lease:GameplayLease,userId:string)=>rpc<QuestBoard>('get_quests',lease,userId);
export const claimQuest=(lease:GameplayLease,userId:string,r:QuestClaim)=>rpc<QuestClaimResult>('claim_quest',lease,userId,{p_period:r.period,p_day:r.day,p_quest_id:r.id});
export function validQuestClaim(value:unknown):value is QuestClaim{if(!value||typeof value!=='object')return false;const r=value as QuestClaim;return (r.period==='daily'||r.period==='weekly')&&typeof r.day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.day)&&['hunt','craft','gather','market','donate','daily','all'].includes(r.id);}
export function questRewardSummary(rewards:QuestReward[]){const totals=new Map<string,number>();for(const r of rewards)totals.set(r.name,(totals.get(r.name)??0)+r.quantity);return [...totals].map(([name,quantity])=>`${name} ${quantity}개`).join(' · ');}
