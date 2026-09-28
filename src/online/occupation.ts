import type {Tower} from '../game/types';
import {getFreshSession} from './auth';
import {getDeviceId} from './cloudSave';
import {supabaseConfig} from './config';
import type {GameplayLease} from './gameSession';

export type OccupationPhase='BIDDING'|'LOCKED'|'BATTLE'|'SETTLED';
export type OccupationFront='LEFT'|'CENTER'|'RIGHT';

export interface OnlineOccupationWindow {
 cycleKey:string;
 phase:OccupationPhase;
 bidClosesAt:string;
 battleStartsAt:string;
 battleEndsAt:string;
 nextCycleAt:string;
}
export interface OnlineOccupationIdentity {
 groupKey:string;
 groupName:string;
 role:string;
 associationId:string;
}
export interface OnlineOccupationTower {
 tower:Tower;
 ownerGroupKey:string|null;
 ownerGroupName:string|null;
 occupiedAt:string|null;
}
export interface OnlineOccupationBid {
 tower:Tower;
 groupKey:string;
 groupName:string;
 totalMerit:number;
 firstReachedAt:string;
 lastBidAt:string;
 status:'OPEN'|'WON'|'LOST';
 mine:boolean;
}
export interface OnlineOccupationFrontScore {
 front:OccupationFront;
 attackerWins:number;
 defenderWins:number;
}
export interface OnlineOccupationMatch {
 matchId:string;
 tower:Tower;
 attackerGroupKey:string;
 attackerGroupName:string;
 defenderGroupKey:string|null;
 defenderGroupName:string|null;
 status:'PENDING'|'ACTIVE'|'ATTACKER_WIN'|'DEFENDER_WIN';
 battleStartsAt:string;
 battleEndsAt:string;
 fronts:OnlineOccupationFrontScore[];
}
export interface OnlineOccupationDuel {
 duelId:string;
 matchId:string;
 front:OccupationFront;
 attackerUserId:string;
 defenderUserId:string;
 attackerHp:number;
 defenderHp:number;
 currentActor:string;
 actionNonce:number;
 status:'ACTIVE'|'FINISHED';
 winnerSide:'ATTACKER'|'DEFENDER'|null;
 winnerUserId:string|null;
}
export interface OnlineOccupationState {
 window:OnlineOccupationWindow;
 identity:OnlineOccupationIdentity|null;
 towers:OnlineOccupationTower[];
 merit:Partial<Record<Tower,number>>;
 bids:OnlineOccupationBid[];
 matches:OnlineOccupationMatch[];
 duel:OnlineOccupationDuel|null;
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
  GAME_SESSION_LOST:'다른 기기에서 플레이가 시작되어 점령전 권한이 종료되었습니다.',
  OCCUPATION_ASSOCIATION_REQUIRED:'점령전에는 원정단 가입이 필요합니다.',
  OCCUPATION_ASSOCIATION_MEMBER_REQUIRED:'원정단 소속 정보를 확인할 수 없습니다.',
  OCCUPATION_EXPEDITION_BLOCKED:'원정 중에는 점령전 공적을 기부할 수 없습니다.',
  OCCUPATION_DONATION_INVALID:'기부할 입장권 정보를 확인해 주세요.',
  OCCUPATION_TICKET_SHORTAGE:'기부할 입장권이 부족합니다.',
  OCCUPATION_BID_CLOSED:'현재는 점령전 입찰 시간이 아닙니다.',
  OCCUPATION_BID_INVALID:'입찰은 한 번에 10~100 원정 공적만 사용할 수 있습니다.',
  OCCUPATION_BID_PERMISSION:'원정단장만 점령전 입찰을 진행할 수 있습니다.',
  OCCUPATION_OWNER_CANNOT_BID:'현재 이 탑을 점령 중인 원정단은 입찰할 수 없습니다.',
  OCCUPATION_BID_ONE_TOWER_ONLY:'한 주에는 하나의 탑에만 입찰할 수 있습니다.',
  OCCUPATION_BID_COOLDOWN:'원정단 입찰 후 30분이 지나야 다시 입찰할 수 있습니다.',
  OCCUPATION_MERIT_SHORTAGE:'해당 탑의 원정 공적이 부족합니다.',
  OCCUPATION_BATTLE_CLOSED:'현재는 점령전 전투 시간이 아닙니다.',
  OCCUPATION_FRONT_INVALID:'선택할 수 없는 전선입니다.',
  OCCUPATION_MATCH_MISSING:'이 탑에서 진행 중인 점령전이 없습니다.',
  OCCUPATION_GROUP_NOT_IN_MATCH:'이번 점령전에 참가하는 원정단이 아닙니다.',
  OCCUPATION_DUEL_NOT_ACTIVE:'진행 중인 대결이 없습니다.',
  OCCUPATION_DUEL_NOT_YOUR_TURN:'상대 차례입니다.',
  OCCUPATION_DUEL_ACTION_SEQUENCE:'전투 행동 순서가 맞지 않습니다. 상태를 다시 불러옵니다.',
  OCCUPATION_DUEL_ACTION_INVALID:'사용할 수 없는 점령전 행동입니다.',
 };
 for(const [key,value] of Object.entries(known))if(raw.includes(key))return value;
 try{const parsed=JSON.parse(raw) as {message?:string};if(parsed.message)return parsed.message;}catch{}
 return '점령전 서버 요청을 처리하지 못했습니다.';
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

export const getOccupationState=(lease:GameplayLease)=>
 rpc<OnlineOccupationState>('get_occupation_state',leaseArgs(lease));

export const donateOccupationTickets=(lease:GameplayLease,input:{tower:Tower;floor:number;quantity:number})=>
 rpc<OnlineOccupationState>('donate_occupation_tickets',{
  ...leaseArgs(lease),p_tower:input.tower,p_floor:input.floor,p_quantity:input.quantity,
 });

export const placeOccupationBid=(lease:GameplayLease,tower:Tower,amount:number)=>
 rpc<OnlineOccupationState>('place_occupation_bid',{
  ...leaseArgs(lease),p_tower:tower,p_amount:amount,
 });

export const joinOccupationFront=(lease:GameplayLease,tower:Tower,front:OccupationFront)=>
 rpc<OnlineOccupationState>('join_occupation_front',{
  ...leaseArgs(lease),p_tower:tower,p_front:front,
 });

export const applyOccupationDuelAction=(lease:GameplayLease,duelId:string,actionNonce:number,action:'BASIC'|'GUARD')=>
 rpc<OnlineOccupationState>('apply_occupation_duel_action',{
  ...leaseArgs(lease),p_duel_id:duelId,p_action_nonce:actionNonce,p_action:action,
 });

export function subscribeOccupationRealtime(onChange:()=>void):()=>void{
 const config=supabaseConfig;
 if(!config||typeof WebSocket==='undefined')return()=>{};
 let disposed=false,socket:WebSocket|null=null,heartbeat:number|null=null,reconnect:number|null=null,ref=0;
 let joinRef='';
 const topic='realtime:occupation';
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
    if(kind==='broadcast'&&payload?.event==='occupation_changed')onChange();
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
