import {supabaseConfig,type SupabasePublicConfig} from './config';
import {getFreshSession,type OnlineSession} from './auth';
import {setWebsocketPresence} from './monitoring';
import {getClientInstanceId,platformLabel} from './gameSession';
export interface ChatMessage {id:string;userId:string;nickname:string;body:string;createdAt:string;clientId:string}
export type ChatStatus='connecting'|'subscribed'|'error';
export function validateChatBody(value:string){
 const body=value.normalize('NFC').trim();
 return {body,error:[...body].length<1||[...body].length>200||/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u.test(body)?'메시지는 1~200자이며 줄바꿈·숨김 문자는 사용할 수 없습니다.':null};
}
export function parseChatMessage(value:unknown):ChatMessage|null{
 if(!value||typeof value!=='object')return null;
 const r=value as Record<string,unknown>;
 if(['id','user_id','nickname','body','created_at','client_id'].some(k=>typeof r[k]!=='string'))return null;
 if(!Number.isFinite(Date.parse(r.created_at as string))||validateChatBody(r.body as string).error)return null;
 return {id:r.id as string,userId:r.user_id as string,nickname:r.nickname as string,body:r.body as string,createdAt:r.created_at as string,clientId:r.client_id as string};
}
export function mergeChatMessages(previous:ChatMessage[],incoming:ChatMessage[]){
 return [...new Map([...previous,...incoming].map(m=>[m.id,m])).values()].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id.localeCompare(b.id)).slice(-50);
}
export function createChatApi(config:SupabasePublicConfig,getSession:()=>Promise<OnlineSession|null>,request:typeof fetch=fetch){
 const call=async(path:string,init:RequestInit={})=>{
  const s=await getSession();if(!s)throw Error('Google 로그인이 필요합니다.');
  const response=await request(config.url+'/rest/v1/'+path,{...init,headers:{apikey:config.publishableKey,Authorization:'Bearer '+s.accessToken,'Content-Type':'application/json',...init.headers},signal:AbortSignal.timeout(10000)});
  const data=await response.json();return {response,data,s};
 };
 const rows=(data:unknown)=>{if(!Array.isArray(data))throw Error('채팅을 불러오지 못했습니다.');return data.map(parseChatMessage).filter((m):m is ChatMessage=>m!==null);};
 return {
  load:async()=>{const {response,data}=await call('game_chat_messages?select=*&order=created_at.desc,id.desc&limit=50');if(!response.ok)throw Error('채팅을 불러오지 못했습니다. 다시 시도해 주세요.');return rows(data).reverse();},
  send:async(value:string,clientId:string)=>{
   const {body,error}=validateChatBody(value);if(error)throw Error(error);
   const {response,data,s}=await call('game_chat_messages?select=*',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({body,client_id:clientId})});
   if(!response.ok){
    if(data?.code==='23505'){
     const existing=await call('game_chat_messages?select=*&user_id=eq.'+encodeURIComponent(s.userId)+'&client_id=eq.'+encodeURIComponent(clientId)+'&limit=1');
     const original=existing.response.ok?rows(existing.data)[0]:null;if(original?.userId===s.userId)return original;
    }
    if(data?.message?.includes('CHAT_RATE_LIMIT'))throw Error('도배 방지를 위해 2초 후 전송해 주세요.');
    if(data?.message?.includes('CHAT_BODY_INVALID'))throw Error('메시지는 1~200자로 입력해 주세요.');
    throw Error('전송하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');
   }
   const message=rows(data)[0];if(!message||message.userId!==s.userId||message.clientId!==clientId)throw Error('전송 결과를 확인하지 못했습니다.');return message;
  },
 };
}
const api=()=>{if(!supabaseConfig)throw Error('온라인 설정이 필요합니다.');return createChatApi(supabaseConfig,getFreshSession);};
export const loadChatMessages=()=>api().load();
export const sendChatMessage=(body:string,clientId:string)=>api().send(body,clientId);

// Only confirmed Postgres INSERT events are accepted; arbitrary client broadcasts are ignored.
export function createChatSubscription(config:SupabasePublicConfig|null,getSession:()=>Promise<OnlineSession|null>,track:(connected:boolean)=>void,userId:string,onMessage:(message:ChatMessage)=>void,onStatus:(status:ChatStatus)=>void){
 if(!config||typeof WebSocket==='undefined'){onStatus('error');return()=>{};}
 let disposed=false,socket:WebSocket|null=null,retry:ReturnType<typeof setTimeout>|null=null;
 let heartbeat:ReturnType<typeof setInterval>|null=null,refresh:ReturnType<typeof setInterval>|null=null,joinTimeout:ReturnType<typeof setTimeout>|null=null;
 let attempt=0,ref=0,connecting=false;
 let presence:ReturnType<typeof setInterval>|null=null;
 const clearConnection=()=>{if(heartbeat)clearInterval(heartbeat);if(refresh)clearInterval(refresh);if(joinTimeout)clearTimeout(joinTimeout);heartbeat=refresh=joinTimeout=null;if(presence)clearInterval(presence);presence=null;track(false);};
 const reconnect=()=>{if(disposed||retry)return;onStatus('connecting');retry=setTimeout(()=>{retry=null;void connect();},[1000,2000,5000,10000][Math.min(attempt++,3)]);};
 const connect=async()=>{
  if(disposed||connecting)return;connecting=true;
  try{
   const session=await getSession();if(disposed)return;
   if(!session||session.userId!==userId){onStatus('error');return;}
   const url=new URL(config.url);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname='/realtime/v1/websocket';url.search='';url.searchParams.set('apikey',config.publishableKey);url.searchParams.set('vsn','2.0.0');
   const ws=new WebSocket(url.toString());socket=ws;
   const topic='realtime:tower-world-chat',join=String(++ref);
   let token=session.accessToken,pendingHeartbeat:string|null=null;
   const send=(event:string,payload:unknown,messageRef=String(++ref),eventTopic=topic)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify([eventTopic==='phoenix'?null:join,messageRef,eventTopic,event,payload]));};
   joinTimeout=setTimeout(()=>ws.close(),15000);
   ws.addEventListener('open',()=>{
    if(disposed){ws.close();return;}
    send('phx_join',{access_token:token,config:{broadcast:{ack:false,self:false},presence:{enabled:false},private:false,postgres_changes:[{event:'INSERT',schema:'public',table:'game_chat_messages'}]}},join);
    heartbeat=setInterval(()=>{if(pendingHeartbeat){ws.close();return;}pendingHeartbeat=String(++ref);send('heartbeat',{},pendingHeartbeat,'phoenix');},20000);
    refresh=setInterval(()=>{void getSession().then(fresh=>{if(disposed||socket!==ws)return;if(!fresh||fresh.userId!==userId){ws.close();return;}if(fresh.accessToken!==token){token=fresh.accessToken;send('access_token',{access_token:token});}}).catch(()=>ws.close());},30000);
   });
   ws.addEventListener('message',event=>{
    if(disposed||socket!==ws||typeof event.data!=='string')return;
    try{
     const frame=JSON.parse(event.data);if(!Array.isArray(frame)||frame.length!==5)return;
     const [,,eventTopic,eventName,payload]=frame;
     if(eventName==='phx_reply'&&frame[1]===pendingHeartbeat){pendingHeartbeat=null;return;}
     if(eventTopic!==topic)return;
     if(eventName==='phx_reply'&&frame[1]===join){
      if(payload?.status!=='ok'){onStatus('error');ws.close();return;}
      // A successful channel join alone does not mean WAL replication is ready.
     }
     if(eventName==='system'&&payload?.extension==='postgres_changes'){
      if(payload.status==='ok'){if(joinTimeout)clearTimeout(joinTimeout);joinTimeout=null;attempt=0;track(true);if(presence)clearInterval(presence);presence=setInterval(()=>track(true),240000);onStatus('subscribed');}else{onStatus('error');ws.close();}
     }
     if(eventName==='postgres_changes'&&payload?.data?.type==='INSERT'&&payload.data.table==='game_chat_messages'){
      const message=parseChatMessage(payload.data.record);if(message)onMessage(message);
     }
     if(eventName==='phx_error'||eventName==='phx_close')ws.close();
    }catch{}
   });
   ws.addEventListener('error',()=>ws.close());
   ws.addEventListener('close',()=>{if(socket!==ws)return;socket=null;clearConnection();reconnect();});
  }catch{reconnect();}finally{connecting=false;}
 };
 onStatus('connecting');void connect();
 const resume=()=>{if(!disposed&&document.visibilityState==='visible'&&(!socket||socket.readyState===WebSocket.CLOSED)){if(retry)clearTimeout(retry);retry=null;void connect();}};
 window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
 return()=>{disposed=true;if(retry)clearTimeout(retry);clearConnection();socket?.close();socket=null;window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);};
}

export function subscribeChatMessages(userId:string,onMessage:(message:ChatMessage)=>void,onStatus:(status:ChatStatus)=>void){
 return createChatSubscription(supabaseConfig,getFreshSession,connected=>{void setWebsocketPresence('chat',getClientInstanceId(),platformLabel(),connected).catch(()=>{});},userId,onMessage,onStatus);
}
