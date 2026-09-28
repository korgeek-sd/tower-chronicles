import type {Tower} from '../game/types';
import {getFreshSession} from './auth';
import {getDeviceId} from './cloudSave';
import {supabaseConfig} from './config';
import type {GameplayLease} from './gameSession';

export type ResourceStrongholdRole='NONE'|'OWNER'|'CHALLENGER'|'OBSERVER'|'QUEUED';
export interface ResourceStrongholdServerState {
 role:ResourceStrongholdRole;
 serverNow?:string;
 stronghold:null|{
  strongholdId:string;instanceId:string;status:'ACTIVE'|'CONTESTED'|'COMPLETED'|'ABANDONED';
  ownerUserId:string;tower:Tower;floor:number;version:number;captureStartedAt:string;captureEndsAt:string;
  activeContestId?:string|null;reward:{tower:Tower;tier:number;materialAmount:number;silver:number};
 };
 contest:null|{
  contest_id:string;status:'PENDING'|'FIGHTING'|'RESOLVED'|'CANCELLED';owner_user_id:string;challenger_user_id:string;
  decision_ends_at:string;turn_ends_at?:string|null;current_actor:string;action_nonce:number;owner_hp:number;challenger_hp:number;
  winner_user_id?:string|null;
 };
 loot?:{material:number;equipment:unknown;destroyed:boolean};
}

const leaseArgs=(lease:GameplayLease)=>({
 p_lease_id:lease.leaseId,p_generation:lease.generation,
 p_client_instance_id:lease.clientInstanceId,p_device_id:getDeviceId(),
});
const headers=(token:string)=>({
 apikey:supabaseConfig!.publishableKey,Authorization:'Bearer '+token,'Content-Type':'application/json',
});
const messages:Record<string,string>={
 RESOURCE_STRONGHOLD_REQUEST_REQUIRED:'쟁탈 요청 식별자를 만들지 못했습니다.',
 RESOURCE_STRONGHOLD_REQUEST_CONFLICT:'이미 사용된 쟁탈 요청입니다.',
 RESOURCE_STRONGHOLD_SLOT_INVALID:'현재 원정 위치에서는 이 거점을 점령할 수 없습니다.',
 RESOURCE_STRONGHOLD_CONTEST_MISSING:'진행 중인 자원거점 개입전이 없습니다.',
 RESOURCE_STRONGHOLD_OWNER_REQUIRED:'현재 점령자만 선택할 수 있습니다.',
 RESOURCE_STRONGHOLD_DECISION_PENDING:'점령자의 30초 선택을 기다리고 있습니다.',
 RESOURCE_STRONGHOLD_NOT_YOUR_TURN:'상대 행동을 기다리고 있습니다.',
 RESOURCE_STRONGHOLD_ACTION_SEQUENCE:'개입전 상태가 변경되어 다시 불러옵니다.',
};
async function rpc<T>(name:string,body:Record<string,unknown>):Promise<T>{
 if(!supabaseConfig)throw Error('Supabase 공개 설정이 필요합니다.');
 const session=await getFreshSession();if(!session)throw Error('Google 로그인이 필요합니다.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+name,{method:'POST',headers:headers(session.accessToken),body:JSON.stringify(body)});
 const raw=await response.text();
 if(!response.ok){for(const [key,value] of Object.entries(messages))if(raw.includes(key))throw Error(value);throw Error('자원거점 서버 요청을 처리하지 못했습니다.');}
 return (raw?JSON.parse(raw):null) as T;
}

export const getResourceStrongholdState=(lease:GameplayLease,tower:Tower,floor:number)=>
 rpc<ResourceStrongholdServerState>('get_resource_stronghold_state',{...leaseArgs(lease),p_tower:tower,p_floor:floor});

export const advanceResourceStrongholdState=(lease:GameplayLease,tower:Tower,floor:number)=>
 rpc<ResourceStrongholdServerState>('advance_resource_stronghold_state',{...leaseArgs(lease),p_tower:tower,p_floor:floor});

export const requestResourceStronghold=(lease:GameplayLease,tower:Tower,floor:number,requestId=crypto.randomUUID())=>
 rpc<ResourceStrongholdServerState>('request_resource_stronghold',{...leaseArgs(lease),p_tower:tower,p_floor:floor,p_request_id:requestId});

export const respondResourceStrongholdContest=(lease:GameplayLease,contestId:string,response:'DEFEND'|'ABANDON')=>
 rpc<ResourceStrongholdServerState>('respond_resource_stronghold_contest',{...leaseArgs(lease),p_contest_id:contestId,p_response:response});

export const applyResourceStrongholdContestAction=(lease:GameplayLease,contestId:string,actionNonce:number,action:'BASIC'|'GUARD')=>
 rpc<ResourceStrongholdServerState>('apply_resource_stronghold_contest_action',{...leaseArgs(lease),p_contest_id:contestId,p_action_nonce:actionNonce,p_action:action});

export const abandonResourceStronghold=(lease:GameplayLease,strongholdId:string)=>
 rpc<ResourceStrongholdServerState>('abandon_resource_stronghold',{...leaseArgs(lease),p_stronghold_id:strongholdId});

export function subscribeResourceStrongholdRealtime(onChange:()=>void):()=>void{
 const config=supabaseConfig;if(!config||typeof WebSocket==='undefined')return()=>{};
 let disposed=false,socket:WebSocket|null=null,heartbeat:number|null=null,reconnect:number|null=null,ref=0,joinRef='';
 const topic='realtime:resource_stronghold',nextRef=()=>String(++ref);
 const send=(join:string|null,messageRef:string|null,eventTopic:string,event:string,payload:unknown)=>{
  if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify([join,messageRef,eventTopic,event,payload]));
 };
 const connect=async()=>{
  if(disposed)return;const session=await getFreshSession();if(!session||disposed)return;
  const url=new URL(config.url);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname='/realtime/v1/websocket';url.search='';
  url.searchParams.set('apikey',config.publishableKey);url.searchParams.set('vsn','2.0.0');
  socket=new WebSocket(url.toString());joinRef=nextRef();
  socket.addEventListener('open',()=>{send(joinRef,joinRef,topic,'phx_join',{config:{broadcast:{ack:false,self:false},presence:{enabled:false},postgres_changes:[],private:true},access_token:session.accessToken});heartbeat=window.setInterval(()=>send(null,nextRef(),'phoenix','heartbeat',{}),20_000);});
  socket.addEventListener('message',event=>{try{const message=JSON.parse(String(event.data));if(Array.isArray(message)&&message[3]==='broadcast'&&message[4]?.event==='resource_stronghold_changed')onChange();}catch{}});
  socket.addEventListener('close',()=>{socket=null;if(heartbeat!==null){clearInterval(heartbeat);heartbeat=null;}if(!disposed&&reconnect===null)reconnect=window.setTimeout(()=>{reconnect=null;void connect();},1500);});
 };
 void connect();
 return()=>{disposed=true;if(heartbeat!==null)clearInterval(heartbeat);if(reconnect!==null)clearTimeout(reconnect);socket?.close();};
}
