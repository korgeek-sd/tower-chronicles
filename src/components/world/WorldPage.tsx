import {validLifeAction,PRODUCT_NAMES,type LifeActionRequest,type ProductId,type FoodId} from '../../game/life/crafting';
import React,{useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {getVillageLife,travelVillage,gatherVillage,villageLifeAction,validGatherRequest,VillageLifeRejected,LIFE_MATERIAL_NAMES,type VillageLifeState,type GatherRequest,type LifeResource,type LifeMaterial} from '../../online/villageLife';
import {WorldMapScreen} from './WorldMapScreen';
import {getVillageWarDeclarations,declareVillageWar,validWarDeclarationRequest,WarDeclarationRejected,type VillageWarState} from '../../online/villageWar';
import {LifeScreen} from './LifeScreen';
import {CraftScreen,type ConfirmedCraftResult} from './CraftScreen';
type Props={userId:string|null;lease:GameplayLease|null;now:number;onInventory?:()=>void;onHome?:()=>void;initialView?:'map'|'life'|'craft'};
export function VillageLifeNotice({error,pending,busy,canRetry,onRetry}:{error:string;pending:boolean;busy:boolean;canRetry:boolean;onRetry:()=>void}){
 if(!error&&(!pending||busy))return null;
 return <div className="tc-life-error" role="alert"><span>{error||'이전 생활 결과 확인이 필요합니다.'}</span><button disabled={busy||!canRetry} onClick={onRetry}>{pending?'생활 결과 다시 확인':'상태 다시 확인'}</button></div>;
}
export function WorldPage({userId,lease,now,onInventory,onHome,initialView='map'}:Props){
 const [state,setState]=useState<VillageLifeState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[view,setView]=useState<'map'|'life'|'craft'>(initialView),[count,setCount]=useState(1),[recipe,setRecipe]=useState<ProductId>('potion'),[pending,setPending]=useState<GatherRequest|LifeActionRequest|null>(null),[offset,setOffset]=useState(0);
 const [craftResult,setCraftResult]=useState<ConfirmedCraftResult|null>(null);
 const [war,setWar]=useState<VillageWarState|null>(null),[warBusy,setWarBusy]=useState(false),[warError,setWarError]=useState(''),[warPending,setWarPending]=useState<{id:string;townId:string}|null>(null);
 const alive=useRef(true),lock=useRef(false),warLock=useRef(false),warRevision=useRef(0),resetRetryAt=useRef(0),key=userId?'tower-life-pending:'+userId:null,warKey=userId?'tower-war-declaration-pending:'+userId:null;
 const accept=(s:VillageLifeState)=>{if(alive.current){setState(s);setOffset(s.serverNow-Date.now());}};
 async function refreshWar(){if(!lease||!userId||warLock.current)return;const revision=warRevision.current;try{const s=await getVillageWarDeclarations(lease);if(alive.current&&!warLock.current&&revision===warRevision.current){setWar(s);if(!warPending)setWarError('');}}catch(e){if(alive.current&&!warLock.current&&revision===warRevision.current)setWarError(e instanceof Error?e.message:'선전포고 현황을 불러오지 못했습니다.');}}
 async function declareWar(townId:string,retry?:{id:string;townId:string}){
  if(!lease||!userId||warLock.current||warPending&&!retry||pending)return;
  const request=retry??{id:crypto.randomUUID(),townId};
  warLock.current=true;warRevision.current++;setWarBusy(true);setWarError('');
  if(!retry){if(warKey)localStorage.setItem(warKey,JSON.stringify(request));setWarPending(request);}
  try{
   const result=await declareVillageWar(lease,request);
   if(!alive.current)return;
   setWar(result.state);if(warKey)localStorage.removeItem(warKey);setWarPending(null);
   void getVillageLife(lease).then(accept).catch(()=>{});
   setWarError('');
  }catch(e){
   if(!alive.current)return;
   if(e instanceof WarDeclarationRejected){if(warKey)localStorage.removeItem(warKey);setWarPending(null);}
   setWarError(e instanceof Error?e.message:'선전포고 결과를 확인하지 못했습니다. 재확인이 필요합니다.');
  }finally{warLock.current=false;if(alive.current)setWarBusy(false);}
 }
 async function refresh(){if(lock.current||!lease||!userId)return;lock.current=true;setBusy(true);try{accept(await getVillageLife(lease));if(alive.current)setError('');}catch(e){if(alive.current)setError(e instanceof Error?e.message:'생활 상태를 불러오지 못했습니다.');}finally{lock.current=false;if(alive.current)setBusy(false);}}
 useEffect(()=>{alive.current=true;if(key)try{const raw=localStorage.getItem(key);if(raw){const r=JSON.parse(raw);if(validGatherRequest(r)||validLifeAction(r)){setPending(r);setMessage('이전 생활 결과를 다시 확인해 주세요.');}else localStorage.removeItem(key);}}catch{}
  if(warKey)try{const raw=localStorage.getItem(warKey);if(raw){const r=JSON.parse(raw);if(validWarDeclarationRequest(r)){setWarPending(r);setWarError('이전 선전포고 결과를 재확인해 주세요.');}else localStorage.removeItem(warKey);}}catch{}
  void refresh();void refreshWar();return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(state&&now+offset>=state.nextResetAt&&now>=resetRetryAt.current&&!lock.current){resetRetryAt.current=now+15000;void refresh();}},[now,state?.nextResetAt,offset]);
 useEffect(()=>{if(lease&&userId)void refreshWar();},[lease?.leaseId,userId]);
 useEffect(()=>{const focus=()=>{void refresh();void refreshWar();};window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus);},[]);
 async function travel(town:string){if(lock.current||pending||!lease)return;lock.current=true;setBusy(true);setError('');try{accept(await travelVillage(lease,town));if(alive.current)setMessage('마을 이동을 저장했습니다.');}catch(e){if(alive.current)setError(e instanceof Error?e.message:'이동 결과를 다시 확인해 주세요.');}finally{lock.current=false;if(alive.current)setBusy(false);}}
 async function gather(resource:LifeResource,retry?:GatherRequest){if(lock.current||!lease||!state||pending&&!retry)return;const r=retry??{id:crypto.randomUUID(),town:state.location,resource,count};lock.current=true;setBusy(true);setError('');try{
  if(!retry){if(key)localStorage.setItem(key,JSON.stringify(r));setPending(r);}
  const result=await gatherVillage(lease,r);if(!alive.current)return;accept(result.state);if(key)localStorage.removeItem(key);setPending(null);
  setMessage(Object.entries(result.result.gains).map(([id,n])=>`${LIFE_MATERIAL_NAMES[id as LifeMaterial]} +${n}`).join(' · ')+` · 행동력 −${result.result.actionPointsSpent}`+(Object.keys(result.result.tax??{}).length?' · 세금 '+Object.entries(result.result.tax??{}).map(([id,n])=>`${LIFE_MATERIAL_NAMES[id as LifeMaterial]} ${n}개`).join(', '):'')+(result.replayed?' (이전 결과 확인)':''));
 }catch(e){if(alive.current){if(e instanceof VillageLifeRejected){if(key)localStorage.removeItem(key);setPending(null);}setError(e instanceof Error?e.message:'채집 결과를 다시 확인해 주세요.');}}
 finally{lock.current=false;if(alive.current)setBusy(false);}}
 async function action(kind:LifeActionRequest['action'],item:ProductId|'well',retry?:LifeActionRequest){
  if(lock.current||!lease||!state||pending&&!retry)return;
  const r=retry??{id:crypto.randomUUID(),town:state.location,action:kind,item,count:kind==='craft'?count:1};
  lock.current=true;setBusy(true);setError('');
  try{if(!retry){if(key)localStorage.setItem(key,JSON.stringify(r));setPending(r);}
   const response=await villageLifeAction(lease,r);if(!alive.current)return;accept(response.state);if(key)localStorage.removeItem(key);setPending(null);
   if(r.action==='craft'){setCraftResult({requestId:r.id,product:r.item as ProductId,quantity:response.result.quantity});if(r.item==='challenge_ticket')void refreshWar();}
   setMessage(r.action==='well'?'우물에서 HP를 완전히 회복했습니다.':r.action==='food'?`${PRODUCT_NAMES[r.item as FoodId]} 사용 · 지속 +30회`:`${PRODUCT_NAMES[r.item as ProductId]} +${response.result.quantity.toLocaleString()} · 행동력 −${response.result.actionPointsSpent}`);
  }catch(e){if(alive.current){if(e instanceof VillageLifeRejected){if(key)localStorage.removeItem(key);setPending(null);}setError(e instanceof Error?e.message:'생활 결과를 다시 확인해 주세요.');}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 function retryPending(){if(pending){if('action' in pending)void action(pending.action,pending.item,pending);else void gather(pending.resource,pending);}else void refresh();}
 if(!userId)return <div className="tc-life-access"><h1>{initialView==='craft'?'제작 공방':'마을 생활'}</h1><p>Google 로그인 후 마을 이동·채집·제작을 이용할 수 있습니다.</p><p>거점의 설정에서 계정을 연결하세요.</p></div>;
 if(!state)return <div className="tc-life-access"><h1>{initialView==='craft'?'제작 공방':'마을 생활'}</h1><p role="status">{error||(!lease?'플레이 권한 확인 중…':'마을 정보를 불러오는 중…')}</p><button className="tc-action" disabled={busy||!lease} onClick={()=>void refresh()}>다시 확인</button></div>;
 const disabled=busy||!lease||!!pending;
 return <div className="tc-world-page">
  <VillageLifeNotice error={error} pending={!!pending} busy={busy} canRetry={!!lease} onRetry={retryPending}/>
  {warPending&&view==='map'&&<div className="tc-life-error" role="alert"><span>이전 선전포고 결과를 확인해야 합니다.</span><button disabled={warBusy||!lease} onClick={()=>void declareWar(warPending.townId,warPending)}>선전포고 결과 재확인</button></div>}
  {view==='craft'?<section className={'tc-life tc-craft-page'+((error||pending&&!busy)?' tc-craft-notice':'')} aria-label="아이템 제작"><header className="tc-life-header"><div><small>{state.towns.find(t=>t.id===state.location)?.name} · 행동력 {state.actionPoints}/100</small><h1>제작 공방</h1></div><div className="tc-life-navigation"><button className="tc-action secondary" disabled={busy} onClick={()=>void refresh()} aria-label="재고 새로고침">↻</button><button className="tc-action secondary" onClick={onInventory}>가방</button><button className="tc-action secondary" onClick={onHome}>거점</button></div></header><CraftScreen state={state} confirmedResult={craftResult} busy={disabled} count={count} recipe={recipe} onRecipe={setRecipe} onCount={setCount} onCraft={id=>void action('craft',id)} onTravel={id=>void travel(id)} onMap={()=>{setMessage('');setView('map');}}/></section>:view==='map'?<WorldMapScreen currentId={state.location} towns={state.towns} busy={disabled||warBusy} actionPoints={state.actionPoints} war={war} warError={warError} warBusy={warBusy} warPending={!!warPending} onDeclareWar={id=>void declareWar(id)} onTravel={id=>void travel(id)} onLife={()=>{setMessage('');setView(initialView==='craft'?'craft':'life');}}/>:<LifeScreen state={state} busy={disabled} count={count} now={now+offset} message={message} onCount={setCount} onGather={r=>void gather(r)} onBack={()=>setView('map')} onRefresh={()=>void refresh()} onInventory={onInventory} onWell={()=>void action('well','well')}/>}
 </div>;
}
