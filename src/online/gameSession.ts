import {APP_VERSION} from '../storage/repository';
import {supabaseConfig} from './config';
import {getFreshSession} from './auth';
import {getDeviceId} from './cloudSave';

export const GAME_SESSION_HEARTBEAT_MS=20_000;
export const GAME_SESSION_TTL_MS=90_000;
export const GAME_SESSION_TAKEOVER_GRACE_MS=3_000;
export const CLIENT_INSTANCE_KEY='tower-client-instance-v1';

export type GameSessionPhase='guest'|'acquiring'|'active'|'locked'|'taking-over'|'handoff'|'error';

export interface GameplayLease {
 leaseId:string;
 generation:number;
 expiresAt:string;
 clientInstanceId:string;
}

export interface GameSessionResult {
 status:'ACTIVE'|'LOCKED'|'PENDING';
 lease:GameplayLease|null;
 generation:number;
 expiresAt:string|null;
 activePlatform:string|null;
 heartbeatAt:string|null;
 takeoverRequestedAt:string|null;
}

export interface GameSessionSignal {
 generation:number;
 platform:string|null;
 heartbeatAt:string|null;
 expiresAt:string|null;
 takeoverRequestedAt:string|null;
}

export class GameSessionLostError extends Error {
 constructor(message='이 기기의 플레이 권한이 만료되었습니다.'){super(message);this.name='GameSessionLostError';}
}

export function getClientInstanceId(storage:Storage=sessionStorage){
 let value=storage.getItem(CLIENT_INSTANCE_KEY);
 if(!value){value=crypto.randomUUID();storage.setItem(CLIENT_INSTANCE_KEY,value);}
 return value;
}

export function platformLabel(userAgent:string=navigator.userAgent){
 if(/android/i.test(userAgent))return 'Android';
 if(/iphone|ipad|ipod/i.test(userAgent))return 'iPhone / iPad';
 if(/windows/i.test(userAgent))return 'Windows';
 if(/macintosh|mac os x/i.test(userAgent))return 'Mac';
 return 'Web';
}

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
  if(text.includes('GAME_SESSION_LOST'))throw new GameSessionLostError();
  let message='';
  try{message=(JSON.parse(text) as {message?:string}).message??'';}catch{}
  throw Error(message||'플레이 세션 요청에 실패했습니다.');
 }
 return (text?JSON.parse(text):null) as T;
}

type SessionRow={
 status:'ACTIVE'|'LOCKED'|'PENDING';
 lease_id:string|null;
 generation:number;
 expires_at:string|null;
 active_platform:string|null;
 heartbeat_at:string|null;
 takeover_requested_at:string|null;
};

const toResult=(row:SessionRow):GameSessionResult=>({
 status:row.status,
 lease:row.status==='ACTIVE'&&row.lease_id&&row.expires_at?{
  leaseId:row.lease_id,generation:row.generation,expiresAt:row.expires_at,clientInstanceId:getClientInstanceId(),
 }:null,
 generation:row.generation,
 expiresAt:row.expires_at,
 activePlatform:row.active_platform,
 heartbeatAt:row.heartbeat_at,
 takeoverRequestedAt:row.takeover_requested_at,
});

const clientArgs=()=>({
 p_device_id:getDeviceId(),
 p_client_instance_id:getClientInstanceId(),
 p_platform:platformLabel(),
 p_app_version:APP_VERSION,
});

export async function acquireGameSession():Promise<GameSessionResult>{
 const rows=await rpc<SessionRow[]>('acquire_game_session',clientArgs());
 const row=rows[0];if(!row)throw Error('플레이 세션 응답을 확인하지 못했습니다.');
 return toResult(row);
}

export async function heartbeatGameSession(lease:GameplayLease):Promise<{expiresAt:string;takeoverRequestedAt:string|null}>{
 const rows=await rpc<Array<{expires_at:string;takeover_requested_at:string|null}>>('heartbeat_game_session',{
  p_lease_id:lease.leaseId,p_generation:lease.generation,p_device_id:getDeviceId(),p_client_instance_id:lease.clientInstanceId,
 });
 const row=rows[0];if(!row)throw new GameSessionLostError();
 return {expiresAt:row.expires_at,takeoverRequestedAt:row.takeover_requested_at};
}

export async function inspectGameSession():Promise<GameSessionSignal&{status:'OWNER'|'LOCKED'|'EXPIRED'}>{
 const rows=await rpc<Array<{status:'OWNER'|'LOCKED'|'EXPIRED';generation:number;expires_at:string|null;active_platform:string|null;heartbeat_at:string|null;takeover_requested_at:string|null}>>('inspect_game_session',{
  p_device_id:getDeviceId(),p_client_instance_id:getClientInstanceId(),
 });
 const row=rows[0];if(!row)throw Error('플레이 세션 상태를 확인하지 못했습니다.');
 return {status:row.status,generation:row.generation,platform:row.active_platform,heartbeatAt:row.heartbeat_at,expiresAt:row.expires_at,takeoverRequestedAt:row.takeover_requested_at};
}

export async function requestGameSessionTakeover():Promise<GameSessionResult>{
 const rows=await rpc<SessionRow[]>('request_game_session_takeover',clientArgs());
 const row=rows[0];if(!row)throw Error('기기 전환 요청을 확인하지 못했습니다.');
 return toResult(row);
}

export async function forceTakeoverGameSession():Promise<GameSessionResult>{
 const rows=await rpc<SessionRow[]>('force_takeover_game_session',clientArgs());
 const row=rows[0];if(!row)throw Error('기기 전환 결과를 확인하지 못했습니다.');
 return toResult(row);
}

export async function releaseGameSession(lease:GameplayLease):Promise<boolean>{
 return rpc<boolean>('release_game_session',{
  p_lease_id:lease.leaseId,p_generation:lease.generation,p_device_id:getDeviceId(),p_client_instance_id:lease.clientInstanceId,
 });
}

type RealtimeStatus='connecting'|'subscribed'|'error';

export function subscribeGameSessionSignals(onSignal:(signal:GameSessionSignal)=>void,onStatus:(status:RealtimeStatus)=>void=()=>{}):()=>void{
 const config=supabaseConfig;
 if(!config||typeof WebSocket==='undefined')return()=>{};
 let disposed=false,socket:WebSocket|null=null,heartbeat:number|null=null,tokenTimer:number|null=null,reconnectTimer:number|null=null,reconnectAttempt=0,ref=0,currentToken='';
 let topic='',joinRef='';
 const nextRef=()=>String(++ref);
 const send=(join:string|null,messageRef:string|null,eventTopic:string,event:string,payload:unknown)=>{
  if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify([join,messageRef,eventTopic,event,payload]));
 };
 const clearTimers=()=>{
  if(heartbeat!==null){window.clearInterval(heartbeat);heartbeat=null;}
  if(tokenTimer!==null){window.clearInterval(tokenTimer);tokenTimer=null;}
  if(reconnectTimer!==null){window.clearTimeout(reconnectTimer);reconnectTimer=null;}
 };
 const scheduleReconnect=()=>{
  if(disposed||reconnectTimer!==null)return;
  onStatus('connecting');
  const delays=[1000,2000,5000,10000],delay=delays[Math.min(reconnectAttempt++,delays.length-1)];
  reconnectTimer=window.setTimeout(()=>{reconnectTimer=null;void connect();},delay);
 };
 const connect=async()=>{
  if(disposed)return;
  const session=await getFreshSession();
  if(disposed)return;
  if(!session){onStatus('error');return;}
  currentToken=session.accessToken;
  topic='realtime:game-session:'+session.userId;
  joinRef=nextRef();
  const wsUrl=new URL(config.url);
  wsUrl.protocol=wsUrl.protocol==='https:'?'wss:':'ws:';
  wsUrl.pathname='/realtime/v1/websocket';
  wsUrl.search='';
  wsUrl.searchParams.set('apikey',config.publishableKey);
  wsUrl.searchParams.set('vsn','2.0.0');
  onStatus('connecting');
  socket=new WebSocket(wsUrl.toString());

  socket.addEventListener('open',()=>{
   reconnectAttempt=0;
   send(joinRef,joinRef,topic,'phx_join',{
    config:{broadcast:{ack:false,self:false},presence:{enabled:false},postgres_changes:[],private:true},
    access_token:session.accessToken,
   });
   heartbeat=window.setInterval(()=>send(null,nextRef(),'phoenix','heartbeat',{}),20_000);
   tokenTimer=window.setInterval(()=>{void (async()=>{
    const fresh=await getFreshSession();
    if(!fresh){socket?.close();return;}
    if(fresh.accessToken!==currentToken){currentToken=fresh.accessToken;send(joinRef,nextRef(),topic,'access_token',{access_token:currentToken});}
   })();},30_000);
  });

  socket.addEventListener('message',event=>{
   if(typeof event.data!=='string')return;
   try{
    const message=JSON.parse(event.data);
    if(!Array.isArray(message)||message.length<5)return;
    const [,messageRef,,messageEvent,payload]=message as [string|null,string|null,string,string,any];
    if(messageEvent==='phx_reply'&&messageRef===joinRef){
     if(payload?.status==='ok')onStatus('subscribed');else{onStatus('error');socket?.close();}
     return;
    }
    if(messageEvent==='broadcast'&&payload?.event==='session_changed'){
     const p=payload.payload??{};
     onSignal({
      generation:Number(p.generation??0),
      platform:typeof p.platform==='string'?p.platform:null,
      heartbeatAt:typeof p.heartbeat_at==='string'?p.heartbeat_at:null,
      expiresAt:typeof p.expires_at==='string'?p.expires_at:null,
      takeoverRequestedAt:typeof p.takeover_requested_at==='string'?p.takeover_requested_at:null,
     });
     return;
    }
    if(messageEvent==='phx_error'){onStatus('error');socket?.close();}
   }catch{}
  });
  socket.addEventListener('error',()=>onStatus('error'));
  socket.addEventListener('close',()=>{socket=null;if(heartbeat!==null){window.clearInterval(heartbeat);heartbeat=null;}if(tokenTimer!==null){window.clearInterval(tokenTimer);tokenTimer=null;}scheduleReconnect();});
 };
 void connect();
 return()=>{disposed=true;clearTimers();if(socket?.readyState===WebSocket.OPEN)send(joinRef,nextRef(),topic,'phx_leave',{});socket?.close();socket=null;};
}
