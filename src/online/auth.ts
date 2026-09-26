import {supabaseConfig} from './config';

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

export function consumeOAuthRedirect(url=window.location.href,storage:Storage=localStorage):OnlineSession|null {
 const current=new URL(url),fragment=new URLSearchParams(current.hash.replace(/^#/,''));
 const accessToken=fragment.get('access_token'),refreshToken=fragment.get('refresh_token');
 if(!accessToken||!refreshToken)return getStoredSession(storage);
 const payload=decodeJwtPayload(accessToken);
 if(!payload?.sub)return null;
 const expiresIn=Number(fragment.get('expires_in')??0);
 const expiresAt=typeof payload.exp==='number'?payload.exp*1000:Date.now()+Math.max(60,expiresIn)*1000;
 const session=storeSession({accessToken,refreshToken,expiresAt,userId:payload.sub,email:typeof payload.email==='string'?payload.email:null},storage);
 current.hash='';
 history.replaceState(null,'',current.pathname+current.search);
 return session;
}

export function signInWithGoogle(redirectTo=window.location.origin+window.location.pathname){
 if(!supabaseConfig)throw Error('Supabase 공개 설정이 필요합니다.');
 const url=new URL('/auth/v1/authorize',supabaseConfig.url);
 url.searchParams.set('provider','google');
 url.searchParams.set('redirect_to',redirectTo);
 window.location.assign(url.toString());
}

export async function refreshOnlineSession(storage:Storage=localStorage):Promise<OnlineSession|null>{
 if(!supabaseConfig)return null;
 const current=getStoredSession(storage);
 if(!current)return null;
 const response=await fetch(supabaseConfig.url+'/auth/v1/token?grant_type=refresh_token',{
  method:'POST',
  headers:{'Content-Type':'application/json',apikey:supabaseConfig.publishableKey},
  body:JSON.stringify({refresh_token:current.refreshToken}),
 });
 if(!response.ok){storage.removeItem(AUTH_SESSION_KEY);return null;}
 const data=await response.json() as {access_token?:string;refresh_token?:string;expires_in?:number};
 if(!data.access_token)return null;
 const payload=decodeJwtPayload(data.access_token);
 if(!payload?.sub)return null;
 return storeSession({
  accessToken:data.access_token,
  refreshToken:data.refresh_token??current.refreshToken,
  expiresAt:typeof payload.exp==='number'?payload.exp*1000:Date.now()+Number(data.expires_in??3600)*1000,
  userId:payload.sub,
  email:typeof payload.email==='string'?payload.email:current.email,
 },storage);
}

export async function getFreshSession(storage:Storage=localStorage):Promise<OnlineSession|null>{
 const current=getStoredSession(storage);
 if(!current)return null;
 if(current.expiresAt>Date.now()+60_000)return current;
 return refreshOnlineSession(storage);
}

export async function signOutOnline(storage:Storage=localStorage):Promise<void>{
 const session=getStoredSession(storage);
 try{
  if(session&&supabaseConfig)await fetch(supabaseConfig.url+'/auth/v1/logout',{
   method:'POST',
   headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken},
  });
 }finally{storage.removeItem(AUTH_SESSION_KEY);}
}
