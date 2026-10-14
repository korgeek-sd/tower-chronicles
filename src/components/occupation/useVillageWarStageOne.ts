import {useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {getVillageWarState,attackVillageWarFront,placeVillageWarDefender,removeVillageWarDefender,claimEmptyVillageWarFront,WarDeclarationRejected,type VillageWarStageOneState,type VillageWarStageRequest,type VillageWarStageAction,type VillageWarFront,type VillageWarCombatResult} from '../../online/villageWar';
import {validVillageWarPending,villageWarPendingKey,retainVillageWarPending} from './villageWarPending';
export function useVillageWarStageOne(lease:GameplayLease|null,userId:string|null,townId:string){
 const [battle,setBattle]=useState<VillageWarCombatResult|null>(null);
 const [state,setState]=useState<VillageWarStageOneState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[pending,setPending]=useState<VillageWarStageRequest|null>(null),[clock,setClock]=useState(Date.now());
 const scope=userId+':'+lease?.leaseId+':'+lease?.generation+':'+townId;
 const active=useRef(scope),lock=useRef<string|null>(null),pendingRef=useRef<VillageWarStageRequest|null>(null),version=useRef(0),offset=useRef(0),alive=useRef(true);active.current=scope;
 const refresh=async()=>{if(!lease||!userId||lock.current===scope)return;const rev=++version.current;try{const s=await getVillageWarState(lease,townId);if(alive.current&&active.current===scope&&rev===version.current){offset.current=s.serverNow-Date.now();setState(s);setClock(s.serverNow);}}catch(e){if(alive.current&&active.current===scope&&rev===version.current)setError(e instanceof Error?e.message:'전장 조회 실패');}};
 useEffect(()=>{alive.current=true;setBattle(null);setState(null);setError('');setBusy(false);lock.current=null;pendingRef.current=null;setPending(null);version.current++;if(userId)try{const r=JSON.parse(localStorage.getItem(villageWarPendingKey(userId))??'null');if(validVillageWarPending(r,userId)){pendingRef.current=r;setPending(r);}}catch{}void refresh();const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},5000);const tick=window.setInterval(()=>setClock(Date.now()+offset.current),1000);const focus=()=>void refresh();window.addEventListener('focus',focus);return()=>{alive.current=false;version.current++;window.clearInterval(timer);window.clearInterval(tick);window.removeEventListener('focus',focus);};},[scope]);
 const execute=async(r:VillageWarStageRequest,retry=false)=>{
  if(!lease||!userId||active.current!==scope||!alive.current||lock.current===scope||!validVillageWarPending(r,userId)||!retry&&pendingRef.current)return;
  lock.current=scope;version.current++;setBusy(true);setError('');
  try{
   localStorage.setItem(villageWarPendingKey(userId),JSON.stringify(r));pendingRef.current=r;setPending(r);
   const fn=r.action==='PLACE'?placeVillageWarDefender:r.action==='REMOVE'?removeVillageWarDefender:r.action==='ATTACK'?attackVillageWarFront:claimEmptyVillageWarFront;
   const result=await fn(lease,r);
   if(active.current!==scope||!alive.current)return;
   localStorage.removeItem(villageWarPendingKey(userId));pendingRef.current=null;setPending(null);
   if(r.townId===townId){offset.current=result.state.serverNow-Date.now();setState(result.state);setClock(result.state.serverNow);if(result.result.battle)setBattle(result.result.battle);}
  }catch(e){if(active.current===scope&&alive.current){setError(e instanceof Error?e.message:'요청 결과를 다시 확인해 주세요.');if(e instanceof WarDeclarationRejected&&!retainVillageWarPending(e.code)){localStorage.removeItem(villageWarPendingKey(userId));pendingRef.current=null;setPending(null);}}}
  finally{if(active.current===scope&&alive.current){lock.current=null;setBusy(false);void refresh();}}
 };
 const request=(action:VillageWarStageAction,front:VillageWarFront)=>{if(!userId||!state?.eventId)return;void execute({id:crypto.randomUUID(),eventId:state.eventId,userId,townId,frontId:front.frontId,expectedEpoch:front.defenderEpoch,action});};
 return {state,error,busy,battle,closeBattle:()=>setBattle(null),attack:(f:VillageWarFront)=>request('ATTACK',f),pending,now:clock,refresh,place:(f:VillageWarFront)=>request('PLACE',f),remove:(f:VillageWarFront)=>request('REMOVE',f),claim:(f:VillageWarFront)=>request('CLAIM_EMPTY',f),retry:()=>{if(pendingRef.current)void execute(pendingRef.current,true);}};
}
