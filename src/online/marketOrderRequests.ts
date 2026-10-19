import {getFreshSession,type OnlineSession} from './auth';
import {getDeviceId} from './cloudSave';
import {supabaseConfig,type SupabasePublicConfig} from './config';
import type {GameplayLease} from './gameSession';
import type {OnlineMarketState} from './market';
export interface MarketOrderInput{itemId:string;side:'BUY'|'SELL';limitPrice:number;quantity:number}
export interface PendingMarketOrder{id:string;input:MarketOrderInput}
const key=(u:string)=>'tc-market-order-pending-v1:'+u;
const valid=(p:PendingMarketOrder)=>p&&typeof p.id==='string'&&/^[0-9a-f-]{36}$/i.test(p.id)&&p.input&&typeof p.input.itemId==='string'&&['BUY','SELL'].includes(p.input.side)&&Number.isSafeInteger(p.input.limitPrice)&&p.input.limitPrice>0&&Number.isSafeInteger(p.input.quantity)&&p.input.quantity>0;
export function createMarketOrderApi(config:SupabasePublicConfig,session:()=>Promise<OnlineSession|null>,storage:Storage,request:typeof fetch=fetch,deviceId=()=>getDeviceId()){
 const flights=new Map<string,Promise<OnlineMarketState>>();
 function pending(user:string):PendingMarketOrder|null{
  const raw=storage.getItem(key(user));if(!raw)return null;
  try{const p=JSON.parse(raw);if(valid(p))return p;}catch{}
  throw Error('미확정 주문을 읽지 못했습니다. 브라우저 저장소를 확인해 주세요.');
 }
 async function owner(){const s=await session();if(!s)throw Error('Google 로그인이 필요합니다.');return s.userId;}
 async function call(user:string,lease:GameplayLease,p:PendingMarketOrder){
  const s=await session();if(s?.userId!==user)throw Error('접속 계정이 변경되었습니다.');
  const response=await request(config.url+'/rest/v1/rpc/place_online_market_order_v2',{method:'POST',headers:{apikey:config.publishableKey,Authorization:'Bearer '+s.accessToken,'Content-Type':'application/json'},body:JSON.stringify({p_lease_id:lease.leaseId,p_generation:lease.generation,p_client_instance_id:lease.clientInstanceId,p_device_id:deviceId(),p_request_id:p.id,p_item_id:p.input.itemId,p_side:p.input.side,p_limit_price:p.input.limitPrice,p_quantity:p.input.quantity}),signal:AbortSignal.timeout(20000)});
  const raw=await response.text();
  if(!response.ok){
   if(response.status>=400&&response.status<500&&['INSUFFICIENT_SILVER','INSUFFICIENT_MARKET_ASSET','MARKET_EXPEDITION_BLOCKED','MARKET_PRICE_INVALID','MARKET_QUANTITY_INVALID','MARKET_ITEM_REQUIRED','MARKET_SIDE_INVALID','MARKET_TOTAL_INVALID','EQUIPMENT_MARKET_EQUIPPED','EQUIPMENT_MARKET_STARTER_PROTECTED','EQUIPMENT_ORDER_SELL_INSTANCE_REQUIRED','EQUIPMENT_MARKET_ITEM_NOT_FOUND','EQUIPMENT_MARKET_ITEM_INVALID','MARKET_MATERIAL_RETIRED','EQUIPMENT_RETIRED','GEAR_DATA_MISSING'].some(code=>raw.includes(code))&&pending(user)?.id===p.id)storage.removeItem(key(user));
   const messages:Record<string,string>={INSUFFICIENT_SILVER:'서버 지갑의 실버가 부족합니다.',INSUFFICIENT_MARKET_ASSET:'판매 가능한 수량이 부족합니다.',GAME_SESSION_LOST:'플레이 권한이 변경되었습니다. 다시 접속해 주세요.',MARKET_REQUEST_CONFLICT:'기존 주문과 요청 내용이 다릅니다.',MARKET_EXPEDITION_BLOCKED:'원정 중에는 거래소를 이용할 수 없습니다.',MARKET_PRICE_INVALID:'가격을 다시 확인해 주세요.',MARKET_QUANTITY_INVALID:'수량을 다시 확인해 주세요.'};
   throw Error(Object.entries(messages).find(([code])=>raw.includes(code))?.[1]??'주문 결과를 확인하지 못했습니다. 미확정 주문을 다시 확인해 주세요.');
  }
  let result:OnlineMarketState;try{result=JSON.parse(raw);}catch{throw Error('주문 응답을 확인하지 못했습니다. 미확정 주문을 다시 확인해 주세요.');}
  if(!result?.wallet||!Number.isFinite(result.wallet.silver)||!Number.isFinite(result.wallet.gold)||!Number.isFinite(result.wallet.revision)||!Array.isArray(result.orders)||!Array.isArray(result.assets)||!Array.isArray(result.storage)||!Array.isArray(result.trades))throw Error('주문 응답을 확인하지 못했습니다. 미확정 주문을 다시 확인해 주세요.');
  if((await session())?.userId!==user)throw Error('접속 계정이 변경되었습니다.');
  if(pending(user)?.id===p.id)storage.removeItem(key(user));
  return result;
 }
 function run(user:string,lease:GameplayLease,p:PendingMarketOrder){
  const running=flights.get(user);if(running)return running;
  const promise=call(user,lease,p).finally(()=>{if(flights.get(user)===promise)flights.delete(user);});flights.set(user,promise);return promise;
 }
 return {pending:async()=>pending(await owner()),
  submit:async(lease:GameplayLease,input:MarketOrderInput)=>{
   const user=await owner();let p=pending(user);
   if(!p&&flights.has(user))throw Error('주문이 처리 중입니다. 잠시 후 다시 확인해 주세요.');
   if(p&&(p.input.itemId!==input.itemId||p.input.side!==input.side||p.input.limitPrice!==input.limitPrice||p.input.quantity!==input.quantity))throw Error('미확정 주문을 먼저 다시 확인해 주세요.');
   if(!p){p={id:crypto.randomUUID(),input:{...input}};if(!valid(p))throw Error('주문 가격과 수량을 다시 확인해 주세요.');storage.setItem(key(user),JSON.stringify(p));}
   return run(user,lease,p);
  },
  retry:async(lease:GameplayLease)=>{const user=await owner(),p=pending(user);if(!p)throw Error('미확정 주문이 없습니다.');return run(user,lease,p);},
 };
}
let api:ReturnType<typeof createMarketOrderApi>|undefined;
function currentApi(){if(!supabaseConfig)throw Error('온라인 거래소 설정을 확인해 주세요.');return api??=createMarketOrderApi(supabaseConfig,getFreshSession,sessionStorage);}
export const pendingMarketOrder=async()=>currentApi().pending();
export const retryOnlineMarketOrder=(lease:GameplayLease)=>currentApi().retry(lease);
export const submitMarketOrder=(lease:GameplayLease,input:MarketOrderInput)=>currentApi().submit(lease,input);
