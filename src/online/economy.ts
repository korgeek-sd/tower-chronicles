import type {GameState,Tower} from '../game/types';
import {getFreshSession} from './auth';
import {getDeviceId,rememberCloudRecord,type CloudSaveRecord} from './cloudSave';
import {supabaseConfig} from './config';
import type {GameplayLease} from './gameSession';

export function applyServerEconomyRecord(local:GameState,record:CloudSaveRecord):GameState{
 const next=structuredClone(local),server=record.payload;
 next.silver=server.silver;
 next.market.gold=server.market.gold;
 next.materials=structuredClone(server.materials);
 next.tickets=structuredClone(server.tickets);
 next.skillBooks=structuredClone(server.skillBooks);
 next.lootItems=structuredClone(server.lootItems);
 next.items=structuredClone(server.items);
 return next;
}

type RpcErrorMap=Record<string,string>;
const errors:RpcErrorMap={
 GAME_SESSION_LOST:'다른 기기에서 플레이가 시작되어 서버 경제 작업 권한이 종료되었습니다.',
 EXPEDITION_TICKET_REQUIRED:'서버에 확인된 입장권이 부족합니다.',
 EXPEDITION_ALREADY_ACTIVE:'이미 진행 중인 서버 원정이 있습니다.',
 EXPEDITION_SERVER_RUN_MISSING:'서버 원정 기록을 찾지 못했습니다.',
 EXPEDITION_LOOT_EXCEEDS_SERVER_CAP:'원정 보상 검증에 실패했습니다.',
 CRAFT_MATERIAL_SHORTAGE:'서버에 확인된 제작 재료가 부족합니다.',
 CRAFT_BUSY:'현재 다른 제작이 진행 중입니다.',
 CRAFT_QUEUE_FULL:'제작 대기열이 가득 찼습니다.',
 CRAFT_NOT_CANCELLABLE:'취소할 수 없는 제작 작업입니다.',
 CRAFT_NOT_READY:'아직 서버 제작 시간이 끝나지 않았습니다.',
 CRAFT_NOT_CLAIMABLE:'수령할 수 없는 제작 작업입니다.',
 ENHANCE_SILVER_SHORTAGE:'서버 지갑의 Silver가 부족합니다.',
 ENHANCE_MATERIAL_SHORTAGE:'서버에 확인된 강화 재료가 부족합니다.',
 ENHANCE_ITEM_NOT_FOUND:'서버에 등록된 강화 장비를 찾지 못했습니다.',
 ASSOCIATION_SILVER_SHORTAGE:'서버 지갑의 조합 등록금이 부족합니다.',
};

const headers=(token:string)=>({
 apikey:supabaseConfig!.publishableKey,
 Authorization:'Bearer '+token,
 'Content-Type':'application/json',
});

async function rpc<T>(name:string,body:Record<string,unknown>):Promise<T>{
 if(!supabaseConfig)throw Error('Supabase 공개 설정이 필요합니다.');
 const session=await getFreshSession();
 if(!session)throw Error('Google 로그인이 필요합니다.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+name,{
  method:'POST',headers:headers(session.accessToken),body:JSON.stringify(body),
 });
 const text=await response.text();
 if(!response.ok){
  for(const [key,message] of Object.entries(errors))if(text.includes(key))throw Error(message);
  try{const parsed=JSON.parse(text) as {message?:string};if(parsed.message)throw Error(parsed.message);}catch(error){if(error instanceof Error&&error.message!==text)throw error;}
  throw Error('서버 경제 요청을 처리하지 못했습니다.');
 }
 return (text?JSON.parse(text):null) as T;
}

const leaseArgs=(lease:GameplayLease)=>({
 p_lease_id:lease.leaseId,
 p_generation:lease.generation,
 p_client_instance_id:lease.clientInstanceId,
 p_device_id:getDeviceId(),
});

async function remember(record:CloudSaveRecord){
 const session=await getFreshSession();
 if(session)rememberCloudRecord(record,session.userId);
 return record;
}

export async function startOnlineExpedition(lease:GameplayLease,tower:Tower,floor:number,payload:GameState){
 const record=await rpc<CloudSaveRecord>('start_online_expedition',{...leaseArgs(lease),p_tower:tower,p_floor:floor,p_client_payload:payload});
 return remember(record);
}

export async function settleOnlineExpedition(lease:GameplayLease,payload:GameState){
 const record=await rpc<CloudSaveRecord>('settle_online_expedition',{...leaseArgs(lease),p_client_payload:payload});
 return remember(record);
}

export async function startOnlineCraft(lease:GameplayLease,input:{jobId:string;kind:string;tier:number;quantity:number}){
 const result=await rpc<{jobId:string;materialCost:number;readyAt:number;record:CloudSaveRecord}>('start_online_craft',{
  ...leaseArgs(lease),p_job_id:input.jobId,p_kind:input.kind,p_tier:input.tier,p_quantity:input.quantity,
 });
 await remember(result.record);
 return result;
}

export async function cancelOnlineCraft(lease:GameplayLease,jobId:string){
 const result=await rpc<{record:CloudSaveRecord}>('cancel_online_craft',{...leaseArgs(lease),p_job_id:jobId});
 await remember(result.record);
 return result;
}

export async function claimOnlineCraft(lease:GameplayLease,jobId:string,itemId:string|null){
 const result=await rpc<{record:CloudSaveRecord;itemId:string|null}>('claim_online_craft',{
  ...leaseArgs(lease),p_job_id:jobId,p_item_id:itemId,
 });
 await remember(result.record);
 return result;
}

export type ServerEnhancementOutcome='SUCCESS'|'FAIL_KEEP'|'FAIL_DOWNGRADE'|'FAIL_DESTROYED';
export async function enhanceOnlineEquipment(lease:GameplayLease,itemId:string){
 const result=await rpc<{outcome:ServerEnhancementOutcome;record:CloudSaveRecord}>('enhance_online_equipment',{
  ...leaseArgs(lease),p_item_id:itemId,
 });
 await remember(result.record);
 return result;
}

export async function spendOnlineAssociationFee(lease:GameplayLease){
 const result=await rpc<{record:CloudSaveRecord}>('spend_online_association_fee',leaseArgs(lease));
 await remember(result.record);
 return result.record;
}
