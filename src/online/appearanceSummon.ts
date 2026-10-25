import {getFreshSession} from './auth';
import {getDeviceId,type CloudSaveRecord} from './cloudSave';
import {supabaseConfig} from './config';
import type {GameplayLease} from './gameSession';
export type AppearanceSummonCurrency='gold'|'ticket';
export type AppearanceSummonRarity='C'|'B'|'A'|'SR'|'SSR';
export interface AppearanceSummonDraw{id:string;rarity:AppearanceSummonRarity;duplicate:boolean}
export interface AppearanceSummonResult{draws:AppearanceSummonDraw[];cost:number;currency:AppearanceSummonCurrency;replayed:boolean;record:CloudSaveRecord}
export interface AppearanceSummonHistoryEntry{draws:AppearanceSummonDraw[];cost:number;currency:AppearanceSummonCurrency;at:string}
export interface AppearanceSummonHistory{history:AppearanceSummonHistoryEntry[]}

const errors:Record<string,string>={
 SUMMON_INVALID:'소환 횟수나 재화를 확인해 주세요.',
 SUMMON_GOLD_INSUFFICIENT:'골드가 부족합니다.',
 SUMMON_TICKET_INSUFFICIENT:'외형 소환권이 부족합니다.',
 SUMMON_REQUEST_CONFLICT:'이전 소환 요청이 다른 조건으로 접수되었습니다.',
 SUMMON_POOL_EMPTY:'현재 소환 가능한 외형 목록이 없습니다.',
 GAME_SESSION_LOST:'플레이 권한이 변경되었습니다. 다시 로그인해 주세요.',
 CLOUD_SAVE_REQUIRED:'클라우드 저장을 먼저 완료해 주세요.',
};
export class AppearanceSummonRejected extends Error{}
async function rpc<T>(name:string,lease:GameplayLease,userId:string,extra:Record<string,unknown>={}):Promise<T>{
 if(!supabaseConfig)throw Error('온라인 접속 설정이 필요합니다.');
 const session=await getFreshSession();
 if(!session||session.userId!==userId)throw new AppearanceSummonRejected('접속 계정을 다시 확인해 주세요.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+name,{
  method:'POST',
  headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},
  body:JSON.stringify({p_lease_id:lease.leaseId,p_generation:lease.generation,p_client_instance_id:lease.clientInstanceId,p_device_id:getDeviceId(),...extra}),
 });
 const responseText=await response.text();
 if(!response.ok){
  for(const [code,message] of Object.entries(errors))if(responseText.includes(code))throw new AppearanceSummonRejected(message);
  throw Error('소환 서버 응답을 확인하지 못했습니다. 동일한 요청으로 다시 시도해 주세요.');
 }
 if((await getFreshSession())?.userId!==userId)throw new AppearanceSummonRejected('접속 계정이 변경되었습니다.');
 return JSON.parse(responseText) as T;
}
export function summonAppearances(lease:GameplayLease,userId:string,requestId:string,currency:AppearanceSummonCurrency,rolls:1|10){
 return rpc<AppearanceSummonResult>('summon_appearances',lease,userId,{p_request_id:requestId,p_currency:currency,p_rolls:rolls});
}
export function getAppearanceSummonHistory(lease:GameplayLease,userId:string){
 return rpc<AppearanceSummonHistory>('get_appearance_summon_history',lease,userId);
}
