import {getFreshSession} from './auth';
import {getDeviceId} from './cloudSave';
import type {CloudSaveRecord} from './cloudSave';
import {supabaseConfig} from './config';
import {GameSessionLostError,type GameplayLease} from './gameSession';

export type WarehouseCurrency='SILVER'|'GOLD'|'TICKET';
export interface WarehouseEntry {
 entryId:number;
 operation:'DEPOSIT'|'WAR_DECLARATION'|'HUNT_TAX'|'EXPEDITION_TAX';
 currency:WarehouseCurrency;
 amount:number;
 balanceAfter:number;
 detail:string;
 actorName:string;
 createdAt:string;
}
export interface AssociationWarehouse {
 associationId:string;
 associationName:string;
 myRole:'LEADER'|'MEMBER';
 silver:number;
 gold:number;
 tickets:number;
 personalSilver:number;
 personalGold:number;
 personalTickets:number;
 ledger:WarehouseEntry[];
}
const errorMessages:Record<string,string>={
 WAREHOUSE_INPUT_INVALID:'기부 수량은 1부터 10억까지 입력할 수 있습니다.',
 WAREHOUSE_BALANCE_SHORTAGE:'개인 보유 재화가 부족합니다.',
 WAREHOUSE_REQUEST_CONFLICT:'이전 기부 요청과 내용이 다릅니다. 잔액을 확인해 주세요.',
 WAREHOUSE_DURING_EXPEDITION:'안전 귀환 후 길드 창고에 기부할 수 있습니다.',
 ASSOCIATION_NOT_JOINED:'원정단에 가입한 후 이용할 수 있습니다.',
 CLOUD_SAVE_REQUIRED:'저장된 캐릭터 정보가 없습니다.',
 SERVER_WALLET_REQUIRED:'서버 지갑을 찾지 못했습니다.',
};
async function rpc<T>(lease:GameplayLease,name:string,extra:Record<string,unknown>={}):Promise<T>{
 if(!supabaseConfig)throw Error('온라인 서버 설정을 확인해 주세요.');
 const session=await getFreshSession();
 if(!session)throw Error('Google 로그인이 필요합니다.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+name,{
  method:'POST',
  headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},
  body:JSON.stringify({
   p_lease_id:lease.leaseId,p_generation:lease.generation,
   p_client_instance_id:lease.clientInstanceId,p_device_id:getDeviceId(),...extra,
  }),
 });
 const raw=await response.text();
 if(!response.ok){
  if(raw.includes('GAME_SESSION_LOST'))throw new GameSessionLostError();
  for(const [code,message] of Object.entries(errorMessages))if(raw.includes(code))throw Error(message);
  throw Error('길드 창고 요청에 실패했습니다. 다시 확인해 주세요.');
 }
 const current=await getFreshSession();
 if(current?.userId!==session.userId)throw Error('접속 계정이 변경되었습니다. 현재 계정을 다시 확인해 주세요.');
 return JSON.parse(raw) as T;
}
export const loadAssociationWarehouse=(lease:GameplayLease)=>
 rpc<AssociationWarehouse>(lease,'get_association_warehouse');
