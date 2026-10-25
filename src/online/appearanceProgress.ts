import {getFreshSession} from './auth';
import {getDeviceId,type CloudSaveRecord} from './cloudSave';
import {supabaseConfig} from './config';
import type {GameplayLease} from './gameSession';
export interface AppearanceAdvanceResult{appearanceId:string;level:number;shardsSpent:number;replayed:boolean;record:CloudSaveRecord}
const errors:Record<string,string>={
 APPEARANCE_INVALID:'외형을 확인할 수 없습니다.',
 APPEARANCE_REQUEST_CONFLICT:'이전 강화 요청을 확인할 수 없습니다.',
 APPEARANCE_SHARDS_INSUFFICIENT:'외형 전용 조각이 부족합니다.',
 APPEARANCE_MAX_LEVEL:'최대 강화 단계에 도달했습니다.',
 GAME_SESSION_LOST:'게임 플레이 세션이 변경되었습니다.',
 CLOUD_SAVE_REQUIRED:'클라우드 저장을 먼저 완료해 주세요.'
};
export async function advanceAppearance(lease:GameplayLease,userId:string,appearanceId:string,requestId:string):Promise<AppearanceAdvanceResult>{
 if(!supabaseConfig)throw Error('온라인 접속 설정이 필요합니다.');
 const session=await getFreshSession();
 if(!session||session.userId!==userId)throw Error('접속 계정을 다시 확인해 주세요.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/advance_appearance',{
  method:'POST',
  headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},
  body:JSON.stringify({p_lease_id:lease.leaseId,p_generation:lease.generation,p_client_instance_id:lease.clientInstanceId,p_device_id:getDeviceId(),p_request_id:requestId,p_appearance_id:appearanceId})
 });
 const body=await response.text();
 if(!response.ok){
  for(const [code,message] of Object.entries(errors))if(body.includes(code))throw Error(message);
  throw Error('외형 해금 또는 강화 결과를 확인할 수 없습니다.');
 }
 if((await getFreshSession())?.userId!==userId)throw Error('접속 계정이 변경되었습니다.');
 return JSON.parse(body) as AppearanceAdvanceResult;
}
