import type {GameState} from '../game/types';
import {getFreshSession} from './auth';
import {getDeviceId,rememberCloudRecord,type CloudSaveRecord} from './cloudSave';
import {supabaseConfig} from './config';
import type {GameplayLease} from './gameSession';

export interface OnlineAssociationSealState {
 sealId:'association';
 level:number;
 rollsUsed:number;
 resetCount:number;
 gold:number;
 completed:boolean;
 hpPercent:number;
 attackPercent:number;
 defensePercent:number;
}

export interface OnlineAssociationSealRollResult {
 requestId:string;
 step:1|2|3;
 beforeLevel:number;
 afterLevel:number;
 goldCost:number;
 state:OnlineAssociationSealState;
 record:CloudSaveRecord;
 replayed:boolean;
}

export interface OnlineAssociationSealResetResult {
 requestId:string;
 beforeLevel:number;
 beforeRolls:number;
 goldCost:number;
 state:OnlineAssociationSealState;
 record:CloudSaveRecord;
 replayed:boolean;
}

const errors:Record<string,string>={
 GAME_SESSION_LOST:'다른 기기에서 플레이가 시작되어 인장 주조 권한이 종료되었습니다.',
 CLOUD_SAVE_REQUIRED:'클라우드 저장을 먼저 완료해 주세요.',
 SERVER_WALLET_REQUIRED:'서버 지갑을 불러오지 못했습니다.',
 SEAL_ROLL_DURING_EXPEDITION:'원정 중에는 협회 인장을 주조할 수 없습니다.',
 SEAL_REQUEST_REQUIRED:'인장 주조 요청 식별자가 없습니다.',
 SEAL_RESET_REQUEST_REQUIRED:'인장 재주조 요청 식별자가 없습니다.',
 SEAL_COMPLETED:'이미 협회 인장 30단계를 완성했습니다.',
 SEAL_ROLL_LIMIT:'이번 인장의 주조 20회를 모두 사용했습니다.',
 SEAL_RESET_NOT_READY:'20회 주조를 마친 인장만 재주조할 수 있습니다.',
 SEAL_GOLD_SHORTAGE:'인장 주조에 필요한 Gold가 부족합니다.',
 SEAL_REQUEST_CONFLICT:'같은 인장 요청이 다른 조건으로 다시 전송되었습니다.',
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
  try{
   const parsed=JSON.parse(text) as {message?:string};
   if(parsed.message)throw Error(parsed.message);
  }catch(error){
   if(error instanceof Error&&error.message!==text)throw error;
  }
  throw Error('협회 인장 요청을 처리하지 못했습니다.');
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

export async function getOnlineAssociationSealState(lease:GameplayLease){
 return rpc<OnlineAssociationSealState>('get_association_seal_state',leaseArgs(lease));
}

export async function rollOnlineAssociationSeal(
 lease:GameplayLease,
 requestId:string=crypto.randomUUID(),
){
 const result=await rpc<OnlineAssociationSealRollResult>('roll_association_seal',{
  ...leaseArgs(lease),p_request_id:requestId,
 });
 await remember(result.record);
 return result;
}

export async function resetOnlineAssociationSeal(
 lease:GameplayLease,
 requestId:string=crypto.randomUUID(),
){
 const result=await rpc<OnlineAssociationSealResetResult>('reset_association_seal',{
  ...leaseArgs(lease),p_request_id:requestId,
 });
 await remember(result.record);
 return result;
}

export function applyOnlineAssociationSealWallet(game:GameState,state:OnlineAssociationSealState):GameState{
 return {...game,market:{...game.market,gold:state.gold}};
}
