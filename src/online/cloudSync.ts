import type {GameState} from '../game/types';
import {supabaseConfig} from './config';
import {getFreshSession} from './auth';
import {CloudConflictError,hashPayload,loadCloudSave,readCloudMeta,rememberCloudRecord,saveCloudState,type CloudMeta,type CloudSaveRecord} from './cloudSave';

export type CloudSyncStatus='local'|'syncing'|'synced'|'error';
export type CloudSyncAction='pushed'|'pulled'|'noop'|'signed-out';

export interface CloudSyncResult {
 action:CloudSyncAction;
 state:GameState;
 record:CloudSaveRecord|null;
}

export function decideCloudSync(localHash:string,remote:CloudSaveRecord|null,meta:CloudMeta|null,userId:string):'push'|'pull'|'noop' {
 if(!remote)return 'push';
 if(remote.payloadHash===localHash)return 'noop';
 if(!meta||meta.userId!==userId)return 'pull';
 if(remote.revision!==meta.revision)return 'pull';
 if(meta.payloadHash!==remote.payloadHash)return 'pull';
 return 'push';
}

export async function reconcileCloudState(local:GameState):Promise<CloudSyncResult>{
 const session=await getFreshSession();
 if(!session)return {action:'signed-out',state:local,record:null};
 const localHash=await hashPayload(local);
 let remote=await loadCloudSave();
 const meta=readCloudMeta();
 const decision=decideCloudSync(localHash,remote,meta,session.userId);

 if(decision==='noop'){
  if(remote)rememberCloudRecord(remote,session.userId);
  return {action:'noop',state:local,record:remote};
 }
 if(decision==='pull'){
  if(!remote)throw Error('클라우드 저장을 확인하지 못했습니다.');
  rememberCloudRecord(remote,session.userId);
  return {action:'pulled',state:remote.payload,record:remote};
 }

 try{
  const saved=await saveCloudState(local,remote?.revision??0);
  return {action:'pushed',state:local,record:saved};
 }catch(error){
  if(!(error instanceof CloudConflictError))throw error;
  remote=await loadCloudSave();
  if(!remote)throw error;
  rememberCloudRecord(remote,session.userId);
  const same=remote.payloadHash===localHash;
  return {action:same?'noop':'pulled',state:same?local:remote.payload,record:remote};
 }
}

type RealtimeConnectionStatus='connecting'|'subscribed'|'error';

export function subscribeCloudSaveRealtime(onRemoteChange:()=>void,onStatus:(status:RealtimeConnectionStatus)=>void=()=>{}):()=>void {
 const config=supabaseConfig;
 if(!config||typeof WebSocket==='undefined')return()=>{};
 let disposed=false,socket:WebSocket|null=null,heartbeat:number|null=null,tokenTimer:number|null=null,reconnectTimer:number|null=null,reconnectAttempt=0,ref=0,currentToken='';
 let topic='',joinRef='';

 const nextRef=()=>String(++ref);
 const clearTimers=()=>{
  if(heartbeat!==null){window.clearInterval(heartbeat);heartbeat=null;}
  if(tokenTimer!==null){window.clearInterval(tokenTimer);tokenTimer=null;}
  if(reconnectTimer!==null){window.clearTimeout(reconnectTimer);reconnectTimer=null;}
 };
 const send=(join:string|null,messageRef:string|null,eventTopic:string,event:string,payload:unknown)=>{
  if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify([join,messageRef,eventTopic,event,payload]));
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
  topic='realtime:cloud-save-'+session.userId;
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
    config:{
     broadcast:{ack:false,self:false},
     presence:{enabled:false},
     postgres_changes:[{event:'*',schema:'public',table:'game_saves',filter:'user_id=eq.'+session.userId,select:['user_id','revision','updated_at']}],
     private:false,
    },
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
   try{
    const message=JSON.parse(String(event.data));
    if(!Array.isArray(message)||message.length<5)return;
    const [,messageRef,,messageEvent,payload]=message as [string|null,string|null,string,string,any];
    if(messageEvent==='phx_reply'&&messageRef===joinRef){
     if(payload?.status==='ok')onStatus('subscribed');
     else{onStatus('error');socket?.close();}
     return;
    }
    if(messageEvent==='postgres_changes'){onRemoteChange();return;}
    if(messageEvent==='system'&&payload?.status==='error'){onStatus('error');return;}
    if(messageEvent==='phx_error'){onStatus('error');socket?.close();}
   }catch{}
  });
  socket.addEventListener('error',()=>onStatus('error'));
  socket.addEventListener('close',()=>{socket=null;if(heartbeat!==null){window.clearInterval(heartbeat);heartbeat=null;}if(tokenTimer!==null){window.clearInterval(tokenTimer);tokenTimer=null;}scheduleReconnect();});
 };

 void connect();
 return()=>{
  disposed=true;
  clearTimers();
  if(socket?.readyState===WebSocket.OPEN)send(joinRef,nextRef(),topic,'phx_leave',{});
  socket?.close();
  socket=null;
 };
}
