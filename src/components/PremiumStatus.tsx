import React,{useEffect,useState} from 'react';
import {getFreshSession} from '../online/auth';
import {supabaseConfig} from '../online/config';
export function premiumRemaining(expiresAt:number|null,now:number):string|null{
 if(expiresAt===null||!Number.isFinite(expiresAt)||expiresAt<=now)return null;
 return Math.ceil((expiresAt-now)/86400000)+'일 남음';
}
type Snapshot={expiresAt:number|null;serverNow:number;receivedAt:number};
export function PremiumStatus({userId,now,onOpen,guestExpiresAt}:{userId:string|null;now:number;onOpen:()=>void;guestExpiresAt?:number|null}){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState(false);
 useEffect(()=>{
  let disposed=false,sequence=0,controller:AbortController|null=null;
  const refresh=async()=>{
   if(!userId)return;const current=++sequence;controller?.abort();const abort=new AbortController();controller=abort;
   const timer=setTimeout(()=>abort.abort(),15000);
   try{
    const session=await getFreshSession();if(!session||session.userId!==userId||!supabaseConfig)throw Error('ACCOUNT_CHANGED');
    const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/get_premium_status',{method:'POST',signal:abort.signal,headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},body:'{}'});
    if(!response.ok)throw Error('PREMIUM_STATUS_FAILED');const data=await response.json();
    if(!Number.isFinite(data.serverNow)||data.expiresAt!==null&&!Number.isFinite(data.expiresAt))throw Error('INVALID_STATUS');
    const latest=await getFreshSession();
    if(!disposed&&current===sequence&&latest?.userId===userId){setSnapshot({expiresAt:data.expiresAt,serverNow:data.serverNow,receivedAt:Date.now()});setError(false);}
   }catch{if(!disposed&&current===sequence)setError(true);}finally{clearTimeout(timer);}
  };
  const visible=()=>{if(!document.hidden)void refresh();};
  void refresh();document.addEventListener('visibilitychange',visible);window.addEventListener('tc-premium-updated',visible);
  return()=>{disposed=true;sequence++;controller?.abort();document.removeEventListener('visibilitychange',visible);window.removeEventListener('tc-premium-updated',visible);};
 },[userId]);
 const guestRemaining=guestExpiresAt?premiumRemaining(guestExpiresAt,now):null;
 const remaining=userId?(snapshot?premiumRemaining(snapshot.expiresAt,snapshot.serverNow+Math.max(0,now-snapshot.receivedAt)):null):guestRemaining;
 const pending=!!userId&&!snapshot&&!error,active=userId?(!!userId&&!error&&!!remaining):!!guestRemaining;
 const title=error?'상태 확인 필요':pending?'계정 확인 중':active?'프리미엄':'일반 계정';
 const detail=active?remaining:'혜택 보기 ›';
 return <button type="button" className={'tc-premium-status'+(active?' is-active':'')} aria-label={title+' · '+detail} onClick={onOpen}><strong>{title}</strong><small>{detail}</small></button>;
}
