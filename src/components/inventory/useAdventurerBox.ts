import {useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {BoxRejected,openAdventurerBoxes,validAdventurerBoxRequest,type AdventurerBoxRequest,type AdventurerBoxResult} from '../../online/adventurerBox';
export function useAdventurerBox(userId:string|null,lease:GameplayLease|null,onComplete:(result:AdventurerBoxResult)=>void){
 const key=userId?'tower-adventurer-box-pending:'+userId:null;
 const [pending,setPending]=useState<AdventurerBoxRequest|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const ref=useRef<AdventurerBoxRequest|null>(null),lock=useRef(false);
 const alive=useRef(true),complete=useRef(onComplete);
 complete.current=onComplete;
 useEffect(()=>{
  alive.current=true;ref.current=null;setPending(null);setError('');
  if(key)try{const raw=localStorage.getItem(key);if(raw){const v=JSON.parse(raw);if(validAdventurerBoxRequest(v)){ref.current=v;setPending(v);}else localStorage.removeItem(key);}}catch{}
  return()=>{alive.current=false;};
 },[key]);
 async function execute(request:AdventurerBoxRequest,retry:boolean){
  if(lock.current||!lease||!userId||!key||(!retry&&ref.current))return;
  lock.current=true;setBusy(true);setError('');
  try{
   if(!retry){localStorage.setItem(key,JSON.stringify(request));ref.current=request;setPending(request);}
   const result=await openAdventurerBoxes(lease,userId,request);
   localStorage.removeItem(key);ref.current=null;
   if(alive.current){setPending(null);complete.current(result);}
  }catch(e){
   if(e instanceof BoxRejected){localStorage.removeItem(key);ref.current=null;if(alive.current)setPending(null);}
   if(alive.current)setError(e instanceof Error?e.message:'개봉 결과 확인이 필요합니다.');
  }finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 return {pending,busy,error,open:(quantity:number)=>void execute({id:crypto.randomUUID(),quantity},false),retry:()=>{if(ref.current)void execute(ref.current,true);}};
}
