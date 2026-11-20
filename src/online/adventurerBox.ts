import type {EquipmentItem} from '../game/types';
import type {VillageLifeState} from './villageLife';
import type {GameplayLease} from './gameSession';
import {getFreshSession} from './auth';
import {getDeviceId,rememberCloudRecord,type CloudSaveRecord} from './cloudSave';
import {supabaseConfig} from './config';

export type AdventurerBoxRequest={id:string;quantity:number};
export type AdventurerBoxResult={replayed:boolean;rewards:EquipmentItem[];record:CloudSaveRecord;state:VillageLifeState};
export const validAdventurerBoxRequest=(value:unknown):value is AdventurerBoxRequest=>{
 if(!value||typeof value!=='object')return false;
 const r=value as AdventurerBoxRequest;
 return typeof r.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.id)&&Number.isInteger(r.quantity)&&r.quantity>=1&&r.quantity<=10;
};
export class BoxRejected extends Error{}
const errors:Record<string,string>={
 BOX_RATE_LIMITED:'상자 개봉 요청이 많습니다. 최대 1분 후 다시 시도해 주세요.',
 BOX_COUNT_INVALID:'상자는 1~10개까지 개봉할 수 있습니다.',
 BOX_REQUEST_CONFLICT:'이전 개봉 요청과 수량이 다릅니다.',
 BOX_EXPEDITION_BLOCKED:'안전 귀환 후 상자를 개봉할 수 있습니다.',
 BOX_INSUFFICIENT:'보유한 모험가 장비 상자가 부족합니다.'
};
export async function openAdventurerBoxes(lease:GameplayLease,userId:string,request:AdventurerBoxRequest):Promise<AdventurerBoxResult>{
 if(!supabaseConfig)throw Error('온라인 서버 설정이 필요합니다.');
 if(!validAdventurerBoxRequest(request))throw new BoxRejected('상자 개봉 요청을 확인해 주세요.');
 const session=await getFreshSession();
 if(!session||session.userId!==userId)throw Error('로그인 상태를 확인해 주세요.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/open_adventurer_boxes',{
  method:'POST',cache:'no-store',headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},
  body:JSON.stringify({p_lease_id:lease.leaseId,p_generation:lease.generation,p_client_instance_id:lease.clientInstanceId,p_device_id:getDeviceId(),p_request_id:request.id,p_quantity:request.quantity})
 });
 const raw=await response.text();
 if(!response.ok){
  for(const [code,message] of Object.entries(errors))if(raw.includes(code))throw new BoxRejected(message);
  throw Error('개봉 결과를 확인하지 못했습니다. 이전 요청을 다시 확인해 주세요.');
 }
 if((await getFreshSession())?.userId!==userId)throw Error('접속 계정이 변경되었습니다.');
 const result=JSON.parse(raw) as AdventurerBoxResult;
 if(!Array.isArray(result.rewards)||result.rewards.length!==request.quantity||!result.record?.payload)throw Error('개봉 기록 확인이 필요합니다.');
 rememberCloudRecord(result.record,userId);
 return result;
}
