import type {GameplayLease} from './gameSession';
import type {CloudSaveRecord} from './cloudSave';
import {getFreshSession} from './auth';
import {getDeviceId,rememberCloudRecord} from './cloudSave';
import {supabaseConfig} from './config';

export interface EquipmentCollectionRegistration {setId:string;itemId:string;kind:string;grade:string}
const errors:Record<string,string>={
 COLLECTION_REQUIREMENT_INVALID:'등록할 컬렉션이 올바르지 않습니다.',
 COLLECTION_STARTER_PROTECTED:'기본 지급 장비는 등록할 수 없습니다.',
 COLLECTION_ALREADY_REGISTERED:'이미 이 컬렉션에 장비를 등록했습니다.',
 COLLECTION_EXPEDITION_BLOCKED:'원정 중에는 장비를 등록할 수 없습니다.',
 COLLECTION_EQUIPPED:'장비를 해제한 뒤 등록해 주세요.',
 COLLECTION_ITEM_NOT_FOUND:'서버 인벤토리에 장비가 없습니다. 새로고침 후 확인해 주세요.',
 COLLECTION_ITEM_MISMATCH:'컬렉션에 필요한 장비 종류나 등급이 다릅니다.',
 GAME_SESSION_LOST:'다른 기기에서 로그인했거나 플레이 세션이 만료되었습니다.'
};
async function rpc<T>(name:string,lease:GameplayLease,extra:Record<string,unknown>={}):Promise<T>{
 if(!supabaseConfig)throw Error('온라인 연결 정보가 없습니다.');
 const session=await getFreshSession();if(!session)throw Error('로그인이 필요합니다.');
 const result=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+name,{
  method:'POST',
  headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},
  body:JSON.stringify({p_lease_id:lease.leaseId,p_generation:lease.generation,p_client_instance_id:lease.clientInstanceId,p_device_id:getDeviceId(),...extra})
 });
 const body=await result.text();
 if(!result.ok){
  for(const [key,message] of Object.entries(errors))if(body.includes(key))throw Error(message);
  throw Error('컬렉션 서버 요청에 실패했습니다. 다시 확인해 주세요.');
 }
 const current=await getFreshSession();
 if(current?.userId!==session.userId)throw Error('계정이 변경되었습니다. 다시 로그인해 주세요.');
 return JSON.parse(body) as T;
}
export async function getCollectionEquipmentRegistrations(lease:GameplayLease):Promise<EquipmentCollectionRegistration[]>{
 return rpc<EquipmentCollectionRegistration[]>('get_collection_equipment_registrations',lease);
}
export async function registerOnlineCollectionEquipment(lease:GameplayLease,setId:string,itemId:string){
 const result=await rpc<{setId:string;itemId:string;alreadyApplied:boolean;record:CloudSaveRecord}>('register_collection_equipment',lease,{p_set_id:setId,p_item_id:itemId});
 const session=await getFreshSession();
 if(session)rememberCloudRecord(result.record,session.userId);
 return result;
}
