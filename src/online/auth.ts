import {supabaseConfig,type SupabasePublicConfig} from './config';

export const AUTH_SESSION_KEY='tower-auth-v1';

export interface OnlineSession {
 accessToken:string;
 refreshToken:string;
 expiresAt:number;
 userId:string;
 email:string|null;
}

type JwtPayload={sub?:string;email?:string;exp?:number};

const decodeBase64Url=(value:string)=>{
 const normalized=value.replace(/-/g,'+').replace(/_/g,'/');
 const pad='='.repeat((4-normalized.length%4)%4);
 return decodeURIComponent(Array.from(atob(normalized+pad),c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join(''));
};

export function decodeJwtPayload(token:string):JwtPayload|null {
 try{
  const part=token.split('.')[1];
  if(!part)return null;
  const parsed=JSON.parse(decodeBase64Url(part));
  return parsed&&typeof parsed==='object'?parsed:null;
 }catch{return null;}
}

export function getStoredSession(storage:Storage=localStorage):OnlineSession|null {
 try{
  const raw=storage.getItem(AUTH_SESSION_KEY);
  if(!raw)return null;
  const value=JSON.parse(raw) as Partial<OnlineSession>;
  if(typeof value.accessToken!=='string'||typeof value.refreshToken!=='string'||typeof value.expiresAt!=='number'||typeof value.userId!=='string')return null;
  return {accessToken:value.accessToken,refreshToken:value.refreshToken,expiresAt:value.expiresAt,userId:value.userId,email:typeof value.email==='string'?value.email:null};
 }catch{return null;}
}

const storeSession=(session:OnlineSession,storage:Storage=localStorage)=>{storage.setItem(AUTH_SESSION_KEY,JSON.stringify(session));return session;};

export const OAUTH_TRANSACTION_KEY='tower-oauth-pkce-v1';
const OAUTH_STATE_PARAM='tc_auth_state';
const OAUTH_TTL_MS=10*60_000;
type OAuthTransaction={state:string;verifier:string;createdAt:number;redirectBase:string};
const base64url=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const randomSecret=()=>base64url(crypto.getRandomValues(new Uint8Array(32)));

/** Supabase Auth uses lowercase s256 for its PKCE authorize API. */
export async function createGoogleOAuthUrl(config:SupabasePublicConfig,redirectTo:string,transactions:Storage=sessionStorage):Promise<string>{
 const redirect=new URL(redirectTo);
 redirect.hash='';redirect.searchParams.delete('code');redirect.searchParams.delete(OAUTH_STATE_PARAM);
 const state=randomSecret(),verifier=randomSecret();
 const challenge=base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 transactions.setItem(OAUTH_TRANSACTION_KEY,JSON.stringify({state,verifier,createdAt:Date.now(),redirectBase:redirect.origin+redirect.pathname} satisfies OAuthTransaction));
 redirect.searchParams.set(OAUTH_STATE_PARAM,state);
 const url=new URL('/auth/v1/authorize',config.url);
 url.searchParams.set('provider','google');url.searchParams.set('redirect_to',redirect.toString());
 url.searchParams.set('code_challenge',challenge);url.searchParams.set('code_challenge_method','s256');
 return url.toString();
}

async function verifiedTokenSession(config:SupabasePublicConfig,data:any,request:typeof fetch):Promise<OnlineSession>{
 if(typeof data.access_token!=='string'||!data.access_token||typeof data.refresh_token!=='string'||!data.refresh_token)throw Error('AUTH_RESPONSE_INVALID');
 const expiresAt=typeof data.expires_at==='number'?data.expires_at*1000:Date.now()+data.expires_in*1000;
 if(!Number.isFinite(expiresAt)||expiresAt<=Date.now())throw Error('AUTH_RESPONSE_INVALID');
 const response=await request(config.url+'/auth/v1/user',{headers:{apikey:config.publishableKey,Authorization:'Bearer '+data.access_token},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('AUTH_USER_UNVERIFIED');
 const user=await response.json();
 if(typeof user.id!=='string'||!user.id)throw Error('AUTH_USER_UNVERIFIED');
 return {accessToken:data.access_token,refreshToken:data.refresh_token,expiresAt,userId:user.id,email:typeof user.email==='string'?user.email:null};
}

export async function completeGoogleOAuth(config:SupabasePublicConfig|null,url:string,storage:Storage,transactions:Storage,request:typeof fetch=fetch):Promise<OnlineSession|null>{
 const current=new URL(url),fragment=new URLSearchParams(current.hash.slice(1));
 const hasLegacyTokens=fragment.has('access_token')||fragment.has('refresh_token');
 const isCallback=hasLegacyTokens||current.searchParams.has('code')||current.searchParams.has(OAUTH_STATE_PARAM)||current.searchParams.has('error')||fragment.has('error');
 if(!isCallback)return getStoredSession(storage);
 const raw=transactions.getItem(OAUTH_TRANSACTION_KEY);
 // Consume before any asynchronous work: codes and transactions cannot be replayed.
 transactions.removeItem(OAUTH_TRANSACTION_KEY);
 if(hasLegacyTokens)throw Error('AUTH_IMPLICIT_REJECTED');
 let transaction:OAuthTransaction;
 try{transaction=JSON.parse(raw??'null');}catch{throw Error('AUTH_REQUEST_MISSING');}
 const code=current.searchParams.get('code'),state=current.searchParams.get(OAUTH_STATE_PARAM);
 if(!transaction||typeof transaction.state!=='string'||typeof transaction.verifier!=='string'||!/^[-_A-Za-z0-9]{43}$/.test(transaction.verifier)||
  !Number.isFinite(transaction.createdAt)||transaction.createdAt>Date.now()||Date.now()-transaction.createdAt>OAUTH_TTL_MS||
  transaction.redirectBase!==current.origin+current.pathname||state!==transaction.state||current.searchParams.getAll(OAUTH_STATE_PARAM).length!==1)throw Error('AUTH_REQUEST_MISMATCH');
 if(current.searchParams.has('error')||fragment.has('error'))throw Error('AUTH_PROVIDER_REJECTED');
 if(!config||!code||code.length>2048||current.searchParams.getAll('code').length!==1)throw Error('AUTH_RESPONSE_INVALID');
 const previous=storage.getItem(AUTH_SESSION_KEY);
 const response=await request(config.url+'/auth/v1/token?grant_type=pkce',{
  method:'POST',headers:{'Content-Type':'application/json',apikey:config.publishableKey},
  body:JSON.stringify({auth_code:code,code_verifier:transaction.verifier}),signal:AbortSignal.timeout(15000),
 });
 if(!response.ok)throw Error('AUTH_CODE_EXCHANGE_FAILED');
 const session=await verifiedTokenSession(config,await response.json(),request);
 if(storage.getItem(AUTH_SESSION_KEY)!==previous)throw Error('AUTH_ACCOUNT_CHANGED');
 return storeSession(session,storage);
}

export async function consumeOAuthRedirect(url=window.location.href,storage:Storage=localStorage):Promise<OnlineSession|null>{
 const current=new URL(url),fragment=new URLSearchParams(current.hash.slice(1));
 const callback=['code',OAUTH_STATE_PARAM,'error','error_description','error_code'].some(key=>current.searchParams.has(key))||['access_token','refresh_token','error'].some(key=>fragment.has(key));
 if(!callback)return getStoredSession(storage);
 // Remove credentials before exchanging them or loading the game.
 const clean=new URL(current);
 for(const key of ['code',OAUTH_STATE_PARAM,'error','error_description','error_code'])clean.searchParams.delete(key);
 clean.hash='';history.replaceState(null,'',clean.pathname+clean.search);
 return completeGoogleOAuth(supabaseConfig,url,storage,sessionStorage);
}

export async function signInWithGoogle(redirectTo=window.location.origin+window.location.pathname){
 if(!supabaseConfig)throw Error('Supabase 공개 설정이 필요합니다.');
 if(new URL(redirectTo).origin!==window.location.origin)throw Error('로그인 복귀 주소를 확인해 주세요.');
 window.location.assign(await createGoogleOAuthUrl(supabaseConfig,redirectTo));
}

const refreshes=new WeakMap<Storage,Promise<OnlineSession|null>>();
export async function refreshSessionForConfig(config:SupabasePublicConfig,storage:Storage,request:typeof fetch=fetch):Promise<OnlineSession|null>{
 const pending=refreshes.get(storage);if(pending)return pending;
 const run=(async()=>{
  const previous=storage.getItem(AUTH_SESSION_KEY),current=getStoredSession(storage);
  if(!current)return null;
  const response=await request(config.url+'/auth/v1/token?grant_type=refresh_token',{
   method:'POST',headers:{'Content-Type':'application/json',apikey:config.publishableKey},
   body:JSON.stringify({refresh_token:current.refreshToken}),signal:AbortSignal.timeout(15000),
  });
  if(!response.ok){
   if((response.status===400||response.status===401||response.status===403)&&storage.getItem(AUTH_SESSION_KEY)===previous)storage.removeItem(AUTH_SESSION_KEY);
   return null;
  }
  const session=await verifiedTokenSession(config,await response.json(),request);
  if(session.userId!==current.userId)throw Error('AUTH_ACCOUNT_CHANGED');
  if(storage.getItem(AUTH_SESSION_KEY)!==previous)return getStoredSession(storage);
  return storeSession(session,storage);
 })();
 refreshes.set(storage,run);
 try{return await run;}finally{if(refreshes.get(storage)===run)refreshes.delete(storage);}
}
export async function refreshOnlineSession(storage:Storage=localStorage):Promise<OnlineSession|null>{
 return supabaseConfig?refreshSessionForConfig(supabaseConfig,storage):null;
}

export async function getFreshSession(storage:Storage=localStorage):Promise<OnlineSession|null>{
 const current=getStoredSession(storage);
 if(!current)return null;
 if(current.expiresAt>Date.now()+60_000)return current;
 return refreshOnlineSession(storage);
}

export async function signOutOnline(storage:Storage=localStorage):Promise<void>{
 const session=getStoredSession(storage);
 // Clear immediately so an in-flight refresh cannot restore the signed-out account.
 storage.removeItem(AUTH_SESSION_KEY);
 try{sessionStorage.removeItem(OAUTH_TRANSACTION_KEY);}catch{}
 if(session&&supabaseConfig)await fetch(supabaseConfig.url+'/auth/v1/logout',{
  method:'POST',headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken},signal:AbortSignal.timeout(15000),
 });
}
