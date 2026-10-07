import {useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {getVillageLife,gatherVillage,villageLifeAction,validGatherRequest,VillageLifeRejected,type VillageLifeState,type GatherRequest} from '../../online/villageLife';
import {validLifeAction,PRODUCT_NAMES,type LifeActionRequest,type FoodId} from '../../game/life/crafting';
type Pending=GatherRequest|LifeActionRequest;
/** Uses the same pending receipt as village life so navigation cannot lose a transaction. */
export function useInventoryLife(userId:string|null,lease:GameplayLease|null){
 const [state,setState]=useState<VillageLifeState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[pending,setPending]=useState<Pending|null>(null);
 const alive=useRef(true),lock=useRef(false),pendingRef=useRef<Pending|null>(null),key=userId?'tower-life-pending:'+userId:null;
 async function refresh(){if(lock.current||!lease||!userId)return;lock.current=true;setBusy(true);try{const next=await getVillageLife(lease);if(alive.current){setState(next);setError('');}}catch(e){if(alive.current)setError(e instanceof Error?e.message:'아이템 수량을 불러오지 못했습니다.');}finally{lock.current=false;if(alive.current)setBusy(false);}}
 useEffect(()=>{alive.current=true;if(key)try{const raw=localStorage.getItem(key);if(raw){const value=JSON.parse(raw);if(validGatherRequest(value)||validLifeAction(value)){pendingRef.current=value;setPending(value);}else localStorage.removeItem(key);}}catch{}void refresh();const focus=()=>void refresh();window.addEventListener('focus',focus);return()=>{alive.current=false;window.removeEventListener('focus',focus);};},[]);
 async function execute(request:Pending,retry=false){if(lock.current||!lease||!userId||pendingRef.current&&!retry)return;lock.current=true;setBusy(true);setError('');
  try{if(!retry){if(key)localStorage.setItem(key,JSON.stringify(request));pendingRef.current=request;setPending(request);}
   const response='action' in request?await villageLifeAction(lease,request):await gatherVillage(lease,request);
   if(!alive.current)return;setState(response.state);if(key)localStorage.removeItem(key);pendingRef.current=null;setPending(null);
   setMessage('action' in request&&request.action==='food'?`${PRODUCT_NAMES[request.item as FoodId]} 사용 · 지속 +30회`:'이전 생활 결과를 확인했습니다.');
  }catch(e){if(alive.current){if(e instanceof VillageLifeRejected){if(key)localStorage.removeItem(key);pendingRef.current=null;setPending(null);}setError(e instanceof Error?e.message:'아이템 사용 결과를 다시 확인해 주세요.');}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 const consume=(item:FoodId)=>{if(!state||!lease||!userId||pendingRef.current)return;void execute({id:crypto.randomUUID(),town:state.location,action:'food',item,count:1});};
 const retry=()=>{const r=pendingRef.current;if(r)void execute(r,true);else void refresh();};
 return {state,busy,pending,error,message,consume,retry,refresh,disabled:busy||!!pending||!lease||!userId};
}
