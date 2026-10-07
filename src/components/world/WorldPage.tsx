import React,{useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {getVillageLife,travelVillage,gatherVillage,validGatherRequest,VillageLifeRejected,LIFE_MATERIAL_NAMES,type VillageLifeState,type GatherRequest,type LifeResource,type LifeMaterial} from '../../online/villageLife';
import {WorldMapScreen} from './WorldMapScreen';
import {LifeScreen} from './LifeScreen';
type Props={userId:string|null;lease:GameplayLease|null;now:number};
export function WorldPage({userId,lease,now}:Props){
 const [state,setState]=useState<VillageLifeState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[view,setView]=useState<'map'|'life'>('map'),[count,setCount]=useState(1),[pending,setPending]=useState<GatherRequest|null>(null),[offset,setOffset]=useState(0);
 const alive=useRef(true),lock=useRef(false),resetRetryAt=useRef(0),key=userId?'tower-life-pending:'+userId:null;
 const accept=(s:VillageLifeState)=>{if(alive.current){setState(s);setOffset(s.serverNow-Date.now());}};
 async function refresh(){if(lock.current||!lease||!userId)return;lock.current=true;setBusy(true);try{accept(await getVillageLife(lease));if(alive.current)setError('');}catch(e){if(alive.current)setError(e instanceof Error?e.message:'생활 상태를 불러오지 못했습니다.');}finally{lock.current=false;if(alive.current)setBusy(false);}}
 useEffect(()=>{alive.current=true;if(key)try{const raw=localStorage.getItem(key);if(raw){const r=JSON.parse(raw);if(validGatherRequest(r)){setPending(r);setMessage('이전 채집 결과를 다시 확인해 주세요.');}else localStorage.removeItem(key);}}catch{}void refresh();return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(state&&now+offset>=state.nextResetAt&&now>=resetRetryAt.current&&!lock.current){resetRetryAt.current=now+15000;void refresh();}},[now,state?.nextResetAt,offset]);
 useEffect(()=>{const focus=()=>void refresh();window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus);},[]);
 async function travel(town:string){if(lock.current||pending||!lease)return;lock.current=true;setBusy(true);setError('');try{accept(await travelVillage(lease,town));if(alive.current)setMessage('마을 이동을 저장했습니다.');}catch(e){if(alive.current)setError(e instanceof Error?e.message:'이동 결과를 다시 확인해 주세요.');}finally{lock.current=false;if(alive.current)setBusy(false);}}
 async function gather(resource:LifeResource,retry?:GatherRequest){if(lock.current||!lease||!state)return;const r=retry??{id:crypto.randomUUID(),town:state.location,resource,count};lock.current=true;setBusy(true);setError('');try{
  if(!retry){if(key)localStorage.setItem(key,JSON.stringify(r));setPending(r);}
  const result=await gatherVillage(lease,r);if(!alive.current)return;accept(result.state);if(key)localStorage.removeItem(key);setPending(null);
  setMessage(Object.entries(result.result.gains).map(([id,n])=>`${LIFE_MATERIAL_NAMES[id as LifeMaterial]} +${n}`).join(' · ')+` · 행동력 −${result.result.actionPointsSpent}${result.replayed?' (이전 결과 확인)':''}`);
 }catch(e){if(alive.current){if(e instanceof VillageLifeRejected){if(key)localStorage.removeItem(key);setPending(null);}setError(e instanceof Error?e.message:'채집 결과를 다시 확인해 주세요.');}}
 finally{lock.current=false;if(alive.current)setBusy(false);}}
 if(!userId)return <div className="tc-life-access"><h1>마을 생활</h1><p>Google 로그인 후 마을 이동과 채집을 이용할 수 있습니다.</p><p>상단 설정에서 계정을 연결하세요.</p></div>;
 if(!state)return <div className="tc-life-access"><h1>마을 생활</h1><p role="status">{error||(!lease?'플레이 권한 확인 중…':'마을 정보를 불러오는 중…')}</p><button className="tc-action" disabled={busy||!lease} onClick={()=>void refresh()}>다시 확인</button></div>;
 const disabled=busy||!lease||!!pending;
 return <div className="tc-world-page">
  {(error||pending)&&<div className="tc-life-error" role="alert"><span>{error||'이전 채집 결과 확인이 필요합니다.'}</span><button disabled={busy||!lease} onClick={()=>pending?void gather(pending.resource,pending):void refresh()}>{pending?'채집 결과 다시 확인':'상태 다시 확인'}</button></div>}
  {view==='map'?<WorldMapScreen currentId={state.location} towns={state.towns} busy={disabled} actionPoints={state.actionPoints} onTravel={id=>void travel(id)} onLife={()=>{setMessage('');setView('life');}}/>:<LifeScreen state={state} busy={disabled} count={count} now={now+offset} message={message} onCount={setCount} onGather={r=>void gather(r)} onBack={()=>setView('map')} onRefresh={()=>void refresh()}/>}
 </div>;
}
