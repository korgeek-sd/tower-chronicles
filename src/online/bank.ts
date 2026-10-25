import type {CloudSaveRecord} from './cloudSave';
import {getDeviceId} from './cloudSave';
import {getFreshSession,type OnlineSession} from './auth';
import {supabaseConfig,type SupabasePublicConfig} from './config';
import type {GameplayLease} from './gameSession';
export type BankAction='CREATE'|'DEPOSIT'|'WITHDRAW'|'BORROW'|'REPAY'|'CLAIM_COLLATERAL';
export interface BankEntry{id:string;name:string;rate:number;durations:number[];vault:number;isMine:boolean}
export interface ServerLoan{id:string;bankName:string;ticketId:string;tickets:number;principal:number;interest:number;rate:number;duration:number;status:'ACTIVE'|'GRACE_PERIOD'|'REPAID'|'DEFAULTED';reminders:number;maturityAt:number;graceAt:number}
export interface ServerBankState{userId:string;serverNow:number;premium:boolean;silver:number;tickets:Record<string,number>;penaltyUntil:number|null;directory:BankEntry[];myBank:{id:string;name:string;vault:number;rate:number;durations:number[];collateral:Record<string,number>}|null;loans:ServerLoan[];ledger:{id:number;kind:string;walletDelta:number;vaultDelta:number;ticketId:string|null;ticketDelta:number;createdAt:number}[]}
export interface BankResponse{state:ServerBankState;record:CloudSaveRecord;result?:{bankId?:string;loanId?:string;status?:string}}
export interface PendingBankRequest{id:string;action:BankAction;params:Record<string,unknown>}
const key=(user:string)=>'tc-server-bank-pending-v1:'+user;
const messages:Record<string,string>={BANK_RATE_LIMIT:'은행 요청이 많습니다. 잠시 후 다시 이용해 주세요.',BANK_PREMIUM_REQUIRED:'은행 설립은 프리미엄 계정 전용입니다.',BANK_ALREADY_OWNED:'이미 운영 중인 은행이 있습니다.',BANK_NOT_OWNER:'내 은행에서만 처리할 수 있습니다.',BANK_NOT_FOUND:'은행을 찾을 수 없습니다.',BANK_SELF_LOAN:'자신의 은행에서는 대출할 수 없습니다.',BANK_DURATION_INVALID:'지원하지 않는 대출 기간입니다.',BANK_SILVER_SHORTAGE:'실버가 부족합니다.',BANK_MINIMUM_VAULT:'금고에는 최소 1,000,000 실버를 유지해야 합니다. 출금 가능 금액을 확인해 주세요.',BANK_VAULT_SHORTAGE:'은행의 사용 가능한 자금이 부족합니다.',BANK_TICKET_SHORTAGE:'담보 도전권이 부족합니다.',BANK_LOAN_NOT_FOUND:'본인의 대출 계약을 찾을 수 없습니다.',BANK_LOAN_CLOSED:'이미 정산된 계약입니다. 새로고침해 주세요.',BANK_NOT_MATURE:'만기 이전에는 상환할 수 없습니다.',BANK_PENALIZED:'미상환에 따른 대출 제한 기간입니다.',BANK_INPUT_INVALID:'금액·수량·은행 설정을 확인해 주세요.',BANK_EXPEDITION_ACTIVE:'원정을 마친 뒤 은행을 이용해 주세요.',BANK_REQUEST_CONFLICT:'기존 요청과 내용이 다릅니다. 미확정 요청을 먼저 확인해 주세요.',BANK_LOAN_LIMIT:'진행 중인 대출은 최대 20건입니다.',BANK_COLLATERAL_EMPTY:'수령할 귀속 도전권이 없습니다.',GAME_SESSION_LOST:'플레이 권한이 변경되었습니다. 다시 접속해 주세요.'};
export function createServerBankApi(config:SupabasePublicConfig,getSession:()=>Promise<OnlineSession|null>,storage:Storage,request:typeof fetch=fetch,deviceId=()=>getDeviceId()){
 const pending=(user:string):PendingBankRequest|null=>{const raw=storage.getItem(key(user));if(!raw)return null;try{const p=JSON.parse(raw);if(typeof p.id==='string'&&typeof p.action==='string'&&p.params&&typeof p.params==='object')return p;}catch{}throw Error('미확정 은행 요청을 읽지 못했습니다. 기기 저장소를 확인해 주세요.');};
 const call=async(userId:string,lease:GameplayLease,p?:PendingBankRequest):Promise<BankResponse>=>{
  const session=await getSession();if(!session||session.userId!==userId)throw Error('접속 계정이 변경되었습니다.');
  const response=await request(config.url+'/rest/v1/rpc/'+(p?'server_bank_action':'get_server_bank'),{
   method:'POST',headers:{apikey:config.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},
   body:JSON.stringify({p_lease_id:lease.leaseId,p_generation:lease.generation,p_client_instance_id:lease.clientInstanceId,p_device_id:deviceId(),...(p?{p_request_id:p.id,p_action:p.action,p_params:p.params}:{})}),signal:AbortSignal.timeout(20000),
  });
  const raw=await response.text();
  if(!response.ok){
   if(p&&response.status>=400&&response.status<500&&pending(userId)?.id===p.id)storage.removeItem(key(userId));
   throw Error(Object.entries(messages).find(([code])=>raw.includes(code))?.[1]??'은행 응답을 확인하지 못했습니다. 미확정 요청이 있으면 같은 요청으로 다시 확인해 주세요.');
  }
  let data:BankResponse;try{data=JSON.parse(raw) as BankResponse;}catch{throw Error('은행 응답을 확인하지 못했습니다. 같은 요청으로 다시 확인해 주세요.');}
  if(!data?.state||data.state.userId!==userId||!data.record?.payload||!Number.isFinite(data.state.serverNow)||!Array.isArray(data.state.directory)||!Array.isArray(data.state.loans))throw Error('은행 응답을 확인하지 못했습니다. 같은 요청으로 다시 확인해 주세요.');
  if((await getSession())?.userId!==userId)throw Error('접속 계정이 변경되었습니다.');
  if(p&&pending(userId)?.id===p.id)storage.removeItem(key(userId));
  return data;
 };
 return {pending,load:(user:string,lease:GameplayLease)=>call(user,lease),
  mutate:async(user:string,lease:GameplayLease,action:BankAction,params:Record<string,unknown>)=>{
   let p=pending(user);
   if(p&&(p.action!==action||JSON.stringify(p.params)!==JSON.stringify(params)))throw Error('미확정 은행 요청을 먼저 다시 확인해 주세요.');
   if(!p){p={id:crypto.randomUUID(),action,params};try{storage.setItem(key(user),JSON.stringify(p));}catch{throw Error('거래 요청을 기기에 보관하지 못했습니다. 브라우저 저장소를 확인해 주세요.');}}
   return call(user,lease,p);
  },
  retry:(user:string,lease:GameplayLease)=>{const p=pending(user);if(!p)throw Error('미확정 요청이 없습니다.');return call(user,lease,p);},
 };
}
export const serverBankApi=()=>{if(!supabaseConfig)throw Error('온라인 은행 설정을 확인해 주세요.');return createServerBankApi(supabaseConfig,getFreshSession,sessionStorage);};
