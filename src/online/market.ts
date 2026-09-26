import type {GameState,Item,MarketOrder,MarketStorageEntry,MarketTrade,Tower} from '../game/types';
import {supabaseConfig} from './config';
import {getFreshSession} from './auth';
import {getDeviceId} from './cloudSave';
import type {GameplayLease} from './gameSession';

export interface OnlineMarketWallet {silver:number;gold:number;revision:number}
export interface OnlineMarketAsset {itemId:string;quantity:number;gear:Item|null}
export interface OnlineMarketOrder {
 orderId:string;itemId:string;side:'BUY'|'SELL';limitPrice:number;originalQuantity:number;remainingQuantity:number;
 status:'OPEN'|'PARTIAL'|'FILLED'|'CANCELLED';gear:Item|null;createdAt:number;mine:boolean;
}
export interface OnlineMarketTrade {
 tradeId:string;itemId:string;price:number;quantity:number;buyOrderId:string;sellOrderId:string;
 executedAt:number;buyerMine:boolean;sellerMine:boolean;
}
export interface OnlineMarketStorage {
 storageId:string;tradeId:string;side:'BUY'|'SELL';itemId:string;quantity:number;silver:number;gear:Item|null;createdAt:number;
}
export interface OnlineMarketState {
 wallet:OnlineMarketWallet;
 assets:OnlineMarketAsset[];
 orders:OnlineMarketOrder[];
 trades:OnlineMarketTrade[];
 storage:OnlineMarketStorage[];
}

const headers=(token:string)=>({
 apikey:supabaseConfig!.publishableKey,
 Authorization:'Bearer '+token,
 'Content-Type':'application/json',
});

const messageFor=(raw:string)=>{
 const known:Record<string,string>={
  GAME_SESSION_LOST:'다른 기기에서 플레이가 시작되어 거래 권한이 종료되었습니다.',
  MARKET_EXPEDITION_BLOCKED:'원정 중에는 거래소를 이용할 수 없습니다.',
  INSUFFICIENT_SILVER:'서버 지갑의 Silver가 부족합니다.',
  INSUFFICIENT_MARKET_ASSET:'서버에 확인된 판매 가능 수량이 부족합니다.',
  ORDER_NOT_CANCELLABLE:'이미 체결되었거나 취소할 수 없는 주문입니다.',
  MARKET_STORAGE_NOT_FOUND:'이미 수령했거나 존재하지 않는 거래 보관함 항목입니다.',
  MARKET_PRICE_INVALID:'거래 가격이 올바르지 않습니다.',
  MARKET_QUANTITY_INVALID:'거래 수량이 올바르지 않습니다.',
  GEAR_QUANTITY_INVALID:'개별 장비는 한 번에 1개만 거래할 수 있습니다.',
 };
 for(const [key,value] of Object.entries(known))if(raw.includes(key))return value;
 try{const parsed=JSON.parse(raw) as {message?:string};if(parsed.message)return parsed.message;}catch{}
 return '온라인 거래소 요청을 처리하지 못했습니다.';
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

export const loadOnlineMarketState=()=>rpc<OnlineMarketState>('get_online_market_state');

export const placeOnlineMarketOrder=(lease:GameplayLease,input:{itemId:string;side:'BUY'|'SELL';limitPrice:number;quantity:number})=>
 rpc<OnlineMarketState>('place_online_market_order',{
  ...leaseArgs(lease),
  p_item_id:input.itemId,
  p_side:input.side,
  p_limit_price:input.limitPrice,
  p_quantity:input.quantity,
 });

export const cancelOnlineMarketOrder=(lease:GameplayLease,orderId:string)=>
 rpc<OnlineMarketState>('cancel_online_market_order',{...leaseArgs(lease),p_order_id:orderId});

export const claimOnlineMarketStorage=(lease:GameplayLease,storageId:string)=>
 rpc<OnlineMarketState>('claim_online_market_storage',{...leaseArgs(lease),p_storage_id:storageId});

export const claimAllOnlineMarketStorage=(lease:GameplayLease)=>
 rpc<OnlineMarketState>('claim_all_online_market_storage',leaseArgs(lease));

const towerIds:Tower[]=['ore','crystal','fang','green'];

export function applyOnlineMarketSnapshotToGame(state:GameState,snapshot:OnlineMarketState):GameState{
 const s=structuredClone(state);
 s.silver=snapshot.wallet.silver;
 s.market.gold=snapshot.wallet.gold;

 towerIds.forEach(t=>{s.materials[t]=s.materials[t].map(()=>0);s.tickets[t]=s.tickets[t].map(()=>0);});
 s.skillBooks={};
 s.lootItems={};
 s.items=[];

 for(const asset of snapshot.assets){
  if(asset.itemId.startsWith('gear:')){if(asset.gear)s.items.push(structuredClone(asset.gear));continue;}
  const [kind,a,b]=asset.itemId.split(':');
  if(kind==='material'&&towerIds.includes(a as Tower)){const i=Number(b)-1;if(Number.isInteger(i)&&i>=0&&i<s.materials[a as Tower].length)s.materials[a as Tower][i]=asset.quantity;continue;}
  if(kind==='ticket'&&towerIds.includes(a as Tower)){const i=Number(b)-1;if(Number.isInteger(i)&&i>=0&&i<s.tickets[a as Tower].length)s.tickets[a as Tower][i]=asset.quantity;continue;}
  if(kind==='skillbook'&&a)s.skillBooks[a]=asset.quantity;
  if(kind==='other'&&a)s.lootItems[a]=asset.quantity;
 }

 const owner=s.market.ownerId;
 s.market.orders=snapshot.orders.map((o,index):MarketOrder=>({
  orderId:o.orderId,itemId:o.itemId,side:o.side,limitPrice:o.limitPrice,
  originalQuantity:o.originalQuantity,remainingQuantity:o.remainingQuantity,
  ownerId:o.mine?owner:'online:'+o.orderId,createdAt:o.createdAt,sequence:index+1,status:o.status,
  gear:o.gear??undefined,
 }));
 const orderedTrades=snapshot.trades.slice().sort((a,b)=>a.executedAt-b.executedAt||a.tradeId.localeCompare(b.tradeId));
 s.market.trades=orderedTrades.map((t,index):MarketTrade=>({
  tradeId:t.tradeId,itemId:t.itemId,price:t.price,quantity:t.quantity,buyOrderId:t.buyOrderId,sellOrderId:t.sellOrderId,
  buyerId:t.buyerMine?owner:'online-buyer',sellerId:t.sellerMine?owner:'online-seller',executedAt:t.executedAt,sequence:index+1,
 }));
 s.market.storage=snapshot.storage.map((e):MarketStorageEntry=>({
  storageId:e.storageId,tradeId:e.tradeId,side:e.side,itemId:e.itemId,quantity:e.quantity,silver:e.silver,
  createdAt:e.createdAt,gear:e.gear??undefined,
 }));
 s.market.nextOrderId=s.market.orders.length+1;
 s.market.nextTradeId=s.market.trades.length+1;
 s.market.nextStorageId=s.market.storage.length+1;
 s.market.nextSequence=Math.max(s.market.orders.length,s.market.trades.length)+1;
 return s;
}

type RealtimeStatus='connecting'|'subscribed'|'error';

export function subscribeOnlineMarketRealtime(onChange:(itemId:string|null)=>void,onStatus:(status:RealtimeStatus)=>void=()=>{}):()=>void{
 const config=supabaseConfig;
 if(!config||typeof WebSocket==='undefined')return()=>{};
 let disposed=false,socket:WebSocket|null=null,heartbeat:number|null=null,tokenTimer:number|null=null,reconnectTimer:number|null=null,reconnectAttempt=0,ref=0,currentToken='';
 let joinRef='';
 const topic='realtime:market';
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
  joinRef=nextRef();
  const wsUrl=new URL(config.url);wsUrl.protocol=wsUrl.protocol==='https:'?'wss:':'ws:';wsUrl.pathname='/realtime/v1/websocket';wsUrl.search='';
  wsUrl.searchParams.set('apikey',config.publishableKey);wsUrl.searchParams.set('vsn','2.0.0');
  onStatus('connecting');
  socket=new WebSocket(wsUrl.toString());
  socket.addEventListener('open',()=>{
   reconnectAttempt=0;
   send(joinRef,joinRef,topic,'phx_join',{
    config:{broadcast:{ack:false,self:false},presence:{enabled:false},postgres_changes:[],private:true},
    access_token:session.accessToken,
   });
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
    if(messageEvent==='broadcast'&&payload?.event==='market_changed'){
     const itemId=typeof payload?.payload?.itemId==='string'?payload.payload.itemId:null;
     onChange(itemId);return;
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
