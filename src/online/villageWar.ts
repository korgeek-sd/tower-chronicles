import {getFreshSession} from './auth';
import {getDeviceId} from './cloudSave';
import {supabaseConfig} from './config';
import type {GameplayLease} from './gameSession';

export interface VillageWarDeclaration{
 townId:string;
 associationId:string;
 associationName:string;
}
export interface VillageWarState{
 cycleKey:string;
 phase:'BIDDING'|'LOCKED'|'BATTLE'|'SETTLED';
 bidClosesAt:string;
 battleStartsAt:string;
 myAssociationId:string|null;
 myRole:'LEADER'|'MEMBER'|null;
 tickets:number;
 declarations:VillageWarDeclaration[];
}
export interface VillageWarResult{state:VillageWarState;replayed:boolean}
const messages:Record<string,string>={
 GAME_SESSION_LOST:'플레이 권한이 만료되었습니다. 다시 로그인해 주세요.',
 WAR_GUILD_REQUIRED:'원정단에 가입해야 선전포고할 수 있습니다.',
 WAR_LEADER_REQUIRED:'원정단장만 선전포고할 수 있습니다.',
 WAR_REQUEST_INVALID:'선전포고 요청을 다시 확인해 주세요.',
 WAR_REQUEST_CONFLICT:'이미 다른 마을에 사용된 요청입니다.',
 WAR_DECLARATION_CLOSED:'지금은 선전포고 등록 기간이 아닙니다.',
 WAR_TOWN_INVALID:'선택한 마을을 다시 확인해 주세요.',
 WAR_ALREADY_DECLARED:'이번 주 이 마을에 이미 선전포고했습니다.',
 WAR_TICKETS_SHORT:'도전권 100장이 부족합니다.',
};
export class WarDeclarationRejected extends Error{}
async function rpc<T>(name:string,lease:GameplayLease,extra:Record<string,unknown>={}):Promise<T>{
 if(!supabaseConfig)throw Error('온라인 설정을 불러오지 못했습니다.');
 const session=await getFreshSession();if(!session)throw Error('Google 로그인이 필요합니다.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+name,{
  method:'POST',
  headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},
  body:JSON.stringify({p_lease_id:lease.leaseId,p_generation:lease.generation,p_client_instance_id:lease.clientInstanceId,p_device_id:getDeviceId(),...extra}),
 });
 const text=await response.text();
 if(!response.ok){
  for(const [code,message] of Object.entries(messages))if(text.includes(code))throw new WarDeclarationRejected(message);
  throw Error('선전포고 요청 결과를 확인하지 못했습니다. 다시 확인해 주세요.');
 }
 const current=await getFreshSession();
 if(current?.userId!==session.userId)throw Error('접속 계정이 변경되었습니다.');
 return JSON.parse(text) as T;
}
export const getVillageWarDeclarations=(lease:GameplayLease)=>rpc<VillageWarState>('get_village_war_declarations',lease);
export const declareVillageWar=(lease:GameplayLease,request:{id:string;townId:string})=>rpc<VillageWarResult>('declare_village_war',lease,{p_request_id:request.id,p_town_id:request.townId});
export function validWarDeclarationRequest(value:unknown):value is {id:string;townId:string}{
 if(!value||typeof value!=='object')return false;
 const v=value as {id:string;townId:string};
 return typeof v.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.id)&&
 typeof v.townId==='string'&&/^(city|herb-[1-5]|farm-[1-5])$/.test(v.townId);
}
