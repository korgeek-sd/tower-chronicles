import type {GameState} from '../game/types';
import {supabaseConfig} from './config';
import {getFreshSession} from './auth';
import {getDeviceId} from './cloudSave';
import {getClientInstanceId,platformLabel,type GameplayLease} from './gameSession';
import {setWebsocketPresence} from './monitoring';

export type GoldExchangeSide='BUY_GOLD'|'SELL_GOLD';

export interface OnlineGoldExchangeWallet{
 silver:number;
 gold:number;
 revision:number;
}
export interface OnlineGoldExchangeOrder{
 orderId:string;
 side:GoldExchangeSide;
 priceSilverPerGold:number;
 originalGoldQuantity:number;
 remainingGoldQuantity:number;
 status:'OPEN'|'PARTIAL'|'FILLED'|'CANCELLED';
 sellerFeeBps:number;
 createdAt:number;
 mine:boolean;
}
export interface OnlineGoldExchangeTrade{
 tradeId:string;
 priceSilverPerGold:number;
 goldQuantity:number;
 grossSilver:number;
 sellerFeeSilver:number;
 sellerNetSilver:number;
 sellerFeeBps:number;
 buyOrderId:string;
 sellOrderId:string;
 executedAt:number;
 buyerMine:boolean;
 sellerMine:boolean;
}
export interface OnlineGoldExchangeState{
 wallet:OnlineGoldExchangeWallet;
 sellerFeeBps:number;
 registrationFeeBps:number;
 orders:OnlineGoldExchangeOrder[];
 trades:OnlineGoldExchangeTrade[];
}

const headers=(token:string)=>({
 apikey:supabaseConfig!.publishableKey,
 Authorization:'Bearer '+token,
 'Content-Type':'application/json',
});

const messageFor=(raw:string)=>{
 const known:Record<string,string>={
  GAME_SESSION_LOST:'다른 기기에서 플레이가 시작되어 거래 권한이 종료되었습니다.',
  GOLD_EXCHANGE_EXPEDITION_BLOCKED:'원정 중에는 골드 거래소를 이용할 수 없습니다.',
  GOLD_EXCHANGE_REQUEST_REQUIRED:'골드 거래 주문 식별자가 없습니다.',
  GOLD_EXCHANGE_REQUEST_CONFLICT:'같은 요청 식별자가 다른 주문에 재사용되었습니다.',
  GOLD_EXCHANGE_CANCEL_REQUEST_REQUIRED:'주문 취소 식별자가 없습니다.',
  GOLD_EXCHANGE_CANCEL_REQUEST_CONFLICT:'같은 취소 식별자가 다른 주문에 재사용되었습니다.',
  GOLD_EXCHANGE_SIDE_INVALID:'골드 거래 방향이 올바르지 않습니다.',
  GOLD_EXCHANGE_PRICE_INVALID:'Gold 1개당 Silver 가격을 확인하세요.',
  GOLD_EXCHANGE_QUANTITY_INVALID:'거래할 Gold 수량을 확인하세요.',
  GOLD_EXCHANGE_TOTAL_INVALID:'주문 총액이 허용 범위를 벗어났습니다.',
  GOLD_EXCHANGE_ORDER_NOT_CANCELLABLE:'이미 체결되었거나 취소할 수 없는 주문입니다.',
  INSUFFICIENT_SILVER:'서버 지갑의 Silver가 부족합니다.',
  INSUFFICIENT_GOLD:'서버 지갑의 Gold가 부족합니다.',
 };
 for(const [key,value] of Object.entries(known))if(raw.includes(key))return value;
 try{const parsed=JSON.parse(raw) as {message?:string};if(parsed.message)return parsed.message;}catch{}
 return '골드 거래소 요청을 처리하지 못했습니다.';
};

async function rpc<T>(name:string,body:Record<string,unknown>={}):Promise<T>{
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

const leaseArgs=(lease:GameplayLease)=>({
 p_lease_id:lease.leaseId,
 p_generation:lease.generation,
 p_client_instance_id:lease.clientInstanceId,
 p_device_id:getDeviceId(),
});

export const loadOnlineGoldExchangeState=()=>rpc<OnlineGoldExchangeState>('get_online_gold_exchange_state');

export const placeOnlineGoldExchangeOrder=(
 lease:GameplayLease,
 input:{side:GoldExchangeSide;priceSilverPerGold:number;goldQuantity:number},
 requestId:string=crypto.randomUUID(),
)=>rpc<OnlineGoldExchangeState>('place_online_gold_exchange_order',{
 ...leaseArgs(lease),
 p_request_id:requestId,
 p_side:input.side,
 p_price_silver_per_gold:input.priceSilverPerGold,
 p_gold_quantity:input.goldQuantity,
});

export const cancelOnlineGoldExchangeOrder=(
 lease:GameplayLease,
 orderId:string,
 requestId:string=crypto.randomUUID(),
)=>rpc<OnlineGoldExchangeState>('cancel_online_gold_exchange_order',{
 ...leaseArgs(lease),p_request_id:requestId,p_order_id:orderId,
});

export function applyOnlineGoldExchangeWallet(state:GameState,snapshot:OnlineGoldExchangeState):GameState{
 const next=structuredClone(state);
 next.silver=snapshot.wallet.silver;
 next.market.gold=snapshot.wallet.gold;
 return next;
}

type RealtimeStatus='connecting'|'subscribed'|'error';

export function subscribeOnlineGoldExchangeRealtime(onChange:()=>void,onStatus:(status:RealtimeStatus)=>void=()=>{}):()=>void{
 const config=supabaseConfig;
 if(!config||typeof WebSocket==='undefined')return()=>{};
 let disposed=false,socket:WebSocket|null=null,heartbeat:number|null=null,tokenTimer:number|null=null,presenceTimer:number|null=null,reconnectTimer:number|null=null,reconnectAttempt=0,ref=0,currentToken='',presenceOnline=false;
 let joinRef='';
 const topic='realtime:market';
 const nextRef=()=>String(++ref);
 const send=(join:string|null,messageRef:string|null,eventTopic:string,event:string,payload:unknown)=>{
  if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify([join,messageRef,eventTopic,event,payload]));
 };
 const clearTimers=()=>{
  if(heartbeat!==null){window.clearInterval(heartbeat);heartbeat=null;}
  if(tokenTimer!==null){window.clearInterval(tokenTimer);tokenTimer=null;}
  if(presenceTimer!==null){window.clearInterval(presenceTimer);presenceTimer=null;}
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
  joinRef=nextRef();
  const wsUrl=new URL(config.url);wsUrl.protocol=wsUrl.protocol==='https:'?'wss:':'ws:';wsUrl.pathname='/realtime/v1/websocket';wsUrl.search='';
  wsUrl.searchParams.set('apikey',config.publishableKey);wsUrl.searchParams.set('vsn','2.0.0');
  onStatus('connecting');
  socket=new WebSocket(wsUrl.toString());
  socket.addEventListener('open',()=>{
   reconnectAttempt=0;
   presenceOnline=true;
   void setWebsocketPresence('gold-exchange',getClientInstanceId(),platformLabel(),true).catch(()=>{});
   presenceTimer=window.setInterval(()=>{void setWebsocketPresence('gold-exchange',getClientInstanceId(),platformLabel(),true).catch(()=>{});},240_000);
   send(joinRef,joinRef,topic,'phx_join',{config:{broadcast:{ack:false,self:false},presence:{enabled:false},postgres_changes:[],private:true},access_token:session.accessToken});
   heartbeat=window.setInterval(()=>send(null,nextRef(),'phoenix','heartbeat',{}),20_000);
   tokenTimer=window.setInterval(()=>{void(async()=>{
    const fresh=await getFreshSession();if(!fresh){socket?.close();return;}
    if(fresh.accessToken!==currentToken){currentToken=fresh.accessToken;send(joinRef,nextRef(),topic,'access_token',{access_token:currentToken});}
   })();},30_000);
  });
  socket.addEventListener('message',event=>{
   try{
    const message=JSON.parse(String(event.data));
    if(!Array.isArray(message)||message.length<5)return;
    const [,messageRef,,messageEvent,payload]=message as [string|null,string|null,string,string,any];
    if(messageEvent==='phx_reply'&&messageRef===joinRef){
     if(payload?.status==='ok')onStatus('subscribed');else{onStatus('error');socket?.close();}return;
    }
    if(messageEvent==='broadcast'&&payload?.event==='gold_exchange_changed'){onChange();return;}
    if(messageEvent==='phx_error'){onStatus('error');socket?.close();}
   }catch{}
  });
  socket.addEventListener('error',()=>onStatus('error'));
  socket.addEventListener('close',()=>{
   socket=null;
   if(heartbeat!==null){window.clearInterval(heartbeat);heartbeat=null;}
   if(tokenTimer!==null){window.clearInterval(tokenTimer);tokenTimer=null;}
   if(presenceTimer!==null){window.clearInterval(presenceTimer);presenceTimer=null;}
   if(presenceOnline){presenceOnline=false;void setWebsocketPresence('gold-exchange',getClientInstanceId(),platformLabel(),false).catch(()=>{});}
   scheduleReconnect();
  });
 };
 void connect();
 return()=>{
  disposed=true;clearTimers();
  if(presenceOnline){presenceOnline=false;void setWebsocketPresence('gold-exchange',getClientInstanceId(),platformLabel(),false).catch(()=>{});}
  if(socket?.readyState===WebSocket.OPEN)send(joinRef,nextRef(),topic,'phx_leave',{});
  socket?.close();socket=null;
 };
}
