import type {AssociationPolicy} from '../game/types';
import type {CloudSaveRecord} from './cloudSave';
import {getDeviceId} from './cloudSave';
import {getFreshSession} from './auth';
import {supabaseConfig} from './config';
import type {GameplayLease} from './gameSession';

export interface OnlineAssociationMember {
 userId:string;
 playerLabel:string;
 role:'LEADER'|'MEMBER';
 joinedAt:string;
}
export interface OnlineAssociationApplication {
 applicationId:string;
 applicantUserId:string;
 playerLabel:string;
 createdAt:string;
 status:'PENDING'|'ACCEPTED'|'REJECTED';
}
export interface OnlineAssociationActivity {
 activityId:number;
 text:string;
 createdAt:string;
}
export interface OnlineAssociationCurrent {
 associationId:string;
 recordNumber:string;
 name:string;
 description:string;
 leaderUserId:string;
 createdAt:string;
 notice:string;
 noticeUpdatedAt:string|null;
 joinPolicy:AssociationPolicy;
 status:'ACTIVE';
 memberLimit:number;
 revenueShareRatePercent:number;
 treasurySilver:number;
 myRole:'LEADER'|'MEMBER';
 members:OnlineAssociationMember[];
 applications:OnlineAssociationApplication[];
 activity:OnlineAssociationActivity[];
}
export interface OnlineAssociationDirectoryEntry {
 revenueShareRatePercent:number;
 associationId:string;
 recordNumber:string;
 name:string;
 description:string;
 joinPolicy:AssociationPolicy;
 memberCount:number;
 memberLimit:number;
 createdAt:string;
}
export interface OnlineAssociationOwnApplication {
 applicationId:string;
 associationId:string;
 associationName:string;
 createdAt:string;
 status:'PENDING';
}
export interface OnlineAssociationState {
 userId:string;
 qualified:boolean;
 current:OnlineAssociationCurrent|null;
 directory:OnlineAssociationDirectoryEntry[];
 myApplications:OnlineAssociationOwnApplication[];
}
export interface OnlineAssociationMutationResult {
 state:OnlineAssociationState;
 record:CloudSaveRecord;
}

const headers=(token:string)=>({
 apikey:supabaseConfig!.publishableKey,
 Authorization:'Bearer '+token,
 'Content-Type':'application/json',
});
const leaseArgs=(lease:GameplayLease)=>({
 p_lease_id:lease.leaseId,
 p_generation:lease.generation,
 p_client_instance_id:lease.clientInstanceId,
 p_device_id:getDeviceId(),
});
const messageFor=(raw:string)=>{
 const known:Record<string,string>={
  GAME_SESSION_LOST:'다른 기기에서 플레이가 시작되어 원정단 권한이 종료되었습니다.',
  ASSOCIATION_ALREADY_JOINED:'이미 원정단에 소속되어 있습니다.',
  ASSOCIATION_NOT_CERTIFIED:'원정단 창설은 10층 보스 처치 후 안전 귀환 기록이 필요합니다.',
  ASSOCIATION_NAME_INVALID:'사용할 수 없는 원정단명입니다.',
  ASSOCIATION_INPUT_INVALID:'원정단 설정값을 확인해 주세요.',
  ASSOCIATION_NAME_TAKEN:'이미 사용 중인 원정단명입니다.',
  ASSOCIATION_SILVER_SHORTAGE:'원정단 등록금 1,000 Silver가 부족합니다.',
  ASSOCIATION_NOT_FOUND:'원정단을 찾을 수 없습니다.',
  ASSOCIATION_JOIN_CLOSED:'현재 모집을 중지한 원정단입니다.',
  ASSOCIATION_FULL:'원정단 인원이 가득 찼습니다.',
  ASSOCIATION_APPLICATION_EXISTS:'이미 가입 신청한 원정단이 있습니다.',
  ASSOCIATION_APPLICATION_NOT_FOUND:'처리할 가입 신청이 없습니다.',
  ASSOCIATION_APPLICANT_ALREADY_JOINED:'신청자가 이미 다른 원정단에 가입했습니다.',
  ASSOCIATION_LEADER_REQUIRED:'원정단장만 처리할 수 있습니다.',
  ASSOCIATION_NOT_JOINED:'소속 원정단이 없습니다.',
  ASSOCIATION_LEADER_CANNOT_LEAVE:'원정단장은 단장 위임 또는 해산 후 탈퇴할 수 있습니다.',
  ASSOCIATION_MEMBER_NOT_FOUND:'대상 원정단원을 찾을 수 없습니다.',
  ASSOCIATION_OCCUPATION_LOCKED:'점령전 진행 중에는 원정단 구성원을 변경할 수 없습니다.',
 };
 for(const [key,value] of Object.entries(known))if(raw.includes(key))return value;
 try{const parsed=JSON.parse(raw) as {message?:string};if(parsed.message)return parsed.message;}catch{}
 return '원정단 서버 요청을 처리하지 못했습니다.';
};
async function rpc<T>(name:string,body:Record<string,unknown>):Promise<T>{
 if(!supabaseConfig)throw Error('Supabase 공개 설정이 필요합니다.');
 const session=await getFreshSession();
 if(!session)throw Error('Google 로그인이 필요합니다.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+name,{
  method:'POST',headers:headers(session.accessToken),body:JSON.stringify(body),
 });
 const text=await response.text();
 if(!response.ok)throw Error(messageFor(text));
 return (text?JSON.parse(text):null) as T;
}

export const loadOnlineAssociationState=(lease:GameplayLease)=>
 rpc<OnlineAssociationState>('get_online_association_state',leaseArgs(lease));

export const createOnlineAssociation=(lease:GameplayLease,input:{name:string;description:string;joinPolicy:Exclude<AssociationPolicy,'CLOSED'>})=>
 rpc<OnlineAssociationMutationResult>('create_online_association_v2',{
  ...leaseArgs(lease),p_name:input.name,p_description:input.description,p_join_policy:input.joinPolicy,
 });

export const joinOnlineAssociation=(lease:GameplayLease,associationId:string)=>
 rpc<OnlineAssociationMutationResult>('join_online_association',{
  ...leaseArgs(lease),p_association_id:associationId,
 });

export const reviewOnlineAssociationApplication=(lease:GameplayLease,applicationId:string,accept:boolean)=>
 rpc<OnlineAssociationMutationResult>('review_online_association_application',{
  ...leaseArgs(lease),p_application_id:applicationId,p_accept:accept,
 });

export const leaveOnlineAssociation=(lease:GameplayLease)=>
 rpc<OnlineAssociationMutationResult>('leave_online_association',leaseArgs(lease));

export const updateOnlineAssociation=(lease:GameplayLease,input:{description:string;notice:string;joinPolicy:AssociationPolicy;revenueShareRatePercent:number})=>
 rpc<OnlineAssociationMutationResult>('update_online_association',{
  ...leaseArgs(lease),
  p_description:input.description,
  p_notice:input.notice,
  p_join_policy:input.joinPolicy,
  p_revenue_share_rate:input.revenueShareRatePercent,
 });

export const transferOnlineAssociationLeadership=(lease:GameplayLease,userId:string)=>
 rpc<OnlineAssociationMutationResult>('transfer_online_association_leadership',{
  ...leaseArgs(lease),p_member_user_id:userId,
 });

export const kickOnlineAssociationMember=(lease:GameplayLease,userId:string)=>
 rpc<OnlineAssociationMutationResult>('kick_online_association_member',{
  ...leaseArgs(lease),p_member_user_id:userId,
 });

export const disbandOnlineAssociation=(lease:GameplayLease)=>
 rpc<OnlineAssociationMutationResult>('disband_online_association',leaseArgs(lease));

export function subscribeAssociationRealtime(onChange:()=>void):()=>void{
 const config=supabaseConfig;
 if(!config||typeof WebSocket==='undefined')return()=>{};
 let disposed=false,socket:WebSocket|null=null,heartbeat:number|null=null,reconnect:number|null=null,ref=0;
 let joinRef='';
 const topic='realtime:association';
 const nextRef=()=>String(++ref);
 const send=(join:string|null,messageRef:string|null,eventTopic:string,event:string,payload:unknown)=>{
  if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify([join,messageRef,eventTopic,event,payload]));
 };
 const connect=async()=>{
  if(disposed)return;
  const session=await getFreshSession();
  if(!session||disposed)return;
  joinRef=nextRef();
  const url=new URL(config.url);
  url.protocol=url.protocol==='https:'?'wss:':'ws:';
  url.pathname='/realtime/v1/websocket';url.search='';
  url.searchParams.set('apikey',config.publishableKey);url.searchParams.set('vsn','2.0.0');
  socket=new WebSocket(url.toString());
  socket.addEventListener('open',()=>{
   send(joinRef,joinRef,topic,'phx_join',{
    config:{broadcast:{ack:false,self:false},presence:{enabled:false},postgres_changes:[],private:true},
    access_token:session.accessToken,
   });
   heartbeat=window.setInterval(()=>send(null,nextRef(),'phoenix','heartbeat',{}),20_000);
  });
  socket.addEventListener('message',event=>{
   try{
    const message=JSON.parse(String(event.data));
    if(!Array.isArray(message)||message.length<5)return;
    const [,,,kind,payload]=message as [string|null,string|null,string,string,any];
    if(kind==='broadcast'&&payload?.event==='association_changed')onChange();
   }catch{}
  });
  socket.addEventListener('close',()=>{
   socket=null;
   if(heartbeat!==null){window.clearInterval(heartbeat);heartbeat=null;}
   if(!disposed&&reconnect===null)reconnect=window.setTimeout(()=>{reconnect=null;void connect();},1500);
  });
 };
 void connect();
 return()=>{
  disposed=true;
  if(heartbeat!==null)window.clearInterval(heartbeat);
  if(reconnect!==null)window.clearTimeout(reconnect);
  if(socket?.readyState===WebSocket.OPEN)send(joinRef,nextRef(),topic,'phx_leave',{});
  socket?.close();
 };
}
