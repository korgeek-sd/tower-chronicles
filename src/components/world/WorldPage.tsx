import {validLifeAction,PRODUCT_NAMES,type LifeActionRequest,type ProductId,type FoodId} from '../../game/life/crafting';
import React,{useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {getVillageLife,travelVillage,gatherVillage,villageLifeAction,validGatherRequest,VillageLifeRejected,LIFE_MATERIAL_NAMES,type VillageLifeState,type GatherRequest,type LifeResource,type LifeMaterial} from '../../online/villageLife';
import {WorldMapScreen} from './WorldMapScreen';
import {LifeScreen} from './LifeScreen';
import {CraftScreen} from './CraftScreen';
type Props={userId:string|null;lease:GameplayLease|null;now:number;onInventory?:()=>void;onHome?:()=>void;initialView?:'map'|'craft'};
export function WorldPage({userId,lease,now,onInventory,onHome,initialView='map'}:Props){
 const [state,setState]=useState<VillageLifeState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[view,setView]=useState<'map'|'life'|'craft'>(initialView),[count,setCount]=useState(1),[recipe,setRecipe]=useState<ProductId>('potion'),[pending,setPending]=useState<GatherRequest|LifeActionRequest|null>(null),[offset,setOffset]=useState(0);
 const alive=useRef(true),lock=useRef(false),resetRetryAt=useRef(0),key=userId?'tower-life-pending:'+userId:null;
 const accept=(s:VillageLifeState)=>{if(alive.current){setState(s);setOffset(s.serverNow-Date.now());}};
 async function refresh(){if(lock.current||!lease||!userId)return;lock.current=true;setBusy(true);try{accept(await getVillageLife(lease));if(alive.current)setError('');}catch(e){if(alive.current)setError(e instanceof Error?e.message:'생활 상태를 불러오지 못했습니다.');}finally{lock.current=false;if(alive.current)setBusy(false);}}
 useEffect(()=>{alive.current=true;if(key)try{const raw=localStorage.getItem(key);if(raw){const r=JSON.parse(raw);if(validGatherRequest(r)||validLifeAction(r)){setPending(r);setMessage('이전 생활 결과를 다시 확인해 주세요.');}else localStorage.removeItem(key);}}catch{}void refresh();return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(state&&now+offset>=state.nextResetAt&&now>=resetRetryAt.current&&!lock.current){resetRetryAt.current=now+15000;void refresh();}},[now,state?.nextResetAt,offset]);
 useEffect(()=>{const focus=()=>void refresh();window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus);},[]);
 async function travel(town:string){if(lock.current||pending||!lease)return;lock.current=true;setBusy(true);setError('');try{accept(await travelVillage(lease,town));if(alive.current)setMessage('마을 이동을 저장했습니다.');}catch(e){if(alive.current)setError(e instanceof Error?e.message:'이동 결과를 다시 확인해 주세요.');}finally{lock.current=false;if(alive.current)setBusy(false);}}
 async function gather(resource:LifeResource,retry?:GatherRequest){if(lock.current||!lease||!state||pending&&!retry)return;const r=retry??{id:crypto.randomUUID(),town:state.location,resource,count};lock.current=true;setBusy(true);setError('');try{
  if(!retry){if(key)localStorage.setItem(key,JSON.stringify(r));setPending(r);}
  const result=await gatherVillage(lease,r);if(!alive.current)return;accept(result.state);if(key)localStorage.removeItem(key);setPending(null);
  setMessage(Object.entries(result.result.gains).map(([id,n])=>`${LIFE_MATERIAL_NAMES[id as LifeMaterial]} +${n}`).join(' · ')+` · 행동력 −${result.result.actionPointsSpent}${result.replayed?' (이전 결과 확인)':''}`);
 }catch(e){if(alive.current){if(e instanceof VillageLifeRejected){if(key)localStorage.removeItem(key);setPending(null);}setError(e instanceof Error?e.message:'채집 결과를 다시 확인해 주세요.');}}
 finally{lock.current=false;if(alive.current)setBusy(false);}}
 async function action(kind:LifeActionRequest['action'],item:ProductId|'well',retry?:LifeActionRequest){
  if(lock.current||!lease||!state||pending&&!retry)return;
  const r=retry??{id:crypto.randomUUID(),town:state.location,action:kind,item,count:kind==='craft'?count:1};
  lock.current=true;setBusy(true);setError('');
  try{if(!retry){if(key)localStorage.setItem(key,JSON.stringify(r));setPending(r);}
   const response=await villageLifeAction(lease,r);if(!alive.current)return;accept(response.state);if(key)localStorage.removeItem(key);setPending(null);
   setMessage(r.action==='well'?'우물에서 HP를 완전히 회복했습니다.':r.action==='food'?`${PRODUCT_NAMES[r.item as FoodId]} 사용 · 지속 +30회`:`${PRODUCT_NAMES[r.item as ProductId]} +${response.result.quantity.toLocaleString()} · 행동력 −${response.result.actionPointsSpent}`);
  }catch(e){if(alive.current){if(e instanceof VillageLifeRejected){if(key)localStorage.removeItem(key);setPending(null);}setError(e instanceof Error?e.message:'생활 결과를 다시 확인해 주세요.');}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 function retryPending(){if(pending){if('action' in pending)void action(pending.action,pending.item,pending);else void gather(pending.resource,pending);}else void refresh();}
 if(!userId)return <div className="tc-life-access"><h1>{initialView==='craft'?'제작 공방':'마을 생활'}</h1><p>Google 로그인 후 마을 이동·채집·제작을 이용할 수 있습니다.</p><p>상단 설정에서 계정을 연결하세요.</p></div>;
 if(!state)return <div className="tc-life-access"><h1>{initialView==='craft'?'제작 공방':'마을 생활'}</h1><p role="status">{error||(!lease?'플레이 권한 확인 중…':'마을 정보를 불러오는 중…')}</p><button className="tc-action" disabled={busy||!lease} onClick={()=>void refresh()}>다시 확인</button></div>;
 const disabled=busy||!lease||!!pending;
 return <div className="tc-world-page">
  {(error||pending)&&<div className="tc-life-error" role="alert"><span>{error||'이전 생활 결과 확인이 필요합니다.'}</span><button disabled={busy||!lease} onClick={retryPending}>{pending?'생활 결과 다시 확인':'상태 다시 확인'}</button></div>}
  {view==='craft'?<section className="tc-life tc-craft-page" aria-label="아이템 제작"><header className="tc-life-header"><div><small>{state.towns.find(t=>t.id===state.location)?.name} · 행동력 {state.actionPoints}/100</small><h1>제작 공방</h1></div><div className="tc-life-navigation"><button className="tc-action secondary" onClick={onInventory}>가방</button><button className="tc-action secondary" onClick={onHome}>거점</button></div></header><div className="tc-craft-location"><span>{state.towns.find(t=>t.id===state.location)?.name}</span><b>행동력 {state.actionPoints}/100</b></div><CraftScreen state={state} busy={disabled} count={count} recipe={recipe} onRecipe={setRecipe} onCount={setCount} onCraft={id=>void action('craft',id)}/><p className="tc-life-result" role="status">{message||'현재 마을에서 가능한 제작품입니다.'}</p><footer><button disabled={disabled} onClick={()=>{setMessage('');setView('map');}}>마을 이동</button><button disabled={busy} onClick={()=>void refresh()}>재고 새로고침</button></footer></section>:view==='map'?<WorldMapScreen currentId={state.location} towns={state.towns} busy={disabled} actionPoints={state.actionPoints} onTravel={id=>void travel(id)} onLife={()=>{setMessage('');setView(initialView==='craft'?'craft':'life');}}/>:<LifeScreen state={state} busy={disabled} count={count} now={now+offset} message={message} onCount={setCount} onGather={r=>void gather(r)} onBack={()=>setView('map')} onRefresh={()=>void refresh()} onInventory={onInventory} onWell={()=>void action('well','well')}/>}
 </div>;
}
