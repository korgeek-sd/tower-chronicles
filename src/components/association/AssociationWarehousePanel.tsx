import React,{useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import type {CloudSaveRecord} from '../../online/cloudSave';
import {depositAssociationWarehouse,loadAssociationWarehouse,type AssociationWarehouse,type WarehouseCurrency} from '../../online/associationWarehouse';
import {pendingGrowthRequest,completeGrowthRequest} from '../../online/associationPendingRequests';
import './warehouse.css';

const ITEMS=[
 {id:'SILVER' as const,label:'실버',unit:'S',glyph:'◉'},
 {id:'GOLD' as const,label:'골드',unit:'G',glyph:'◆'},
 {id:'TICKET' as const,label:'도전권',unit:'장',glyph:'⚔'},
];
const quantity=(n:number)=>Number.isFinite(n)?Math.max(0,Math.trunc(n)).toLocaleString('ko-KR'):'0';
const formatTime=(iso:string)=>Number.isFinite(Date.parse(iso))?
 new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(iso)):'—';
export function AssociationWarehousePanel({lease,associationId,expedition,onRecord,onChanged}:{
 lease:GameplayLease;associationId:string;expedition:boolean;
 onRecord:(record:CloudSaveRecord,message:string)=>void;onChanged:()=>void;
}){
 const [state,setState]=useState<AssociationWarehouse|null>(null);
 const [currency,setCurrency]=useState<WarehouseCurrency>('SILVER');
 const [amount,setAmount]=useState('10000');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const running=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const refresh=async()=>{
  try{const next=await loadAssociationWarehouse(lease);if(mounted.current&&next.associationId===associationId){setState(next);setError('');}}
  catch(e){if(mounted.current)setError(e instanceof Error?e.message:'길드 창고를 불러오지 못했습니다.');}
 };
 useEffect(()=>{
  let stopped=false;
  const update=async()=>{try{const next=await loadAssociationWarehouse(lease);if(!stopped&&next.associationId===associationId){setState(next);setError('');}}catch(e){if(!stopped)setError(e instanceof Error?e.message:'길드 창고를 불러오지 못했습니다.');}};
  void update();
  const timer=window.setInterval(()=>{if(!document.hidden)void update();},15000);
  const focus=()=>void update();
  window.addEventListener('focus',focus);
  return()=>{stopped=true;window.clearInterval(timer);window.removeEventListener('focus',focus);};
 },[lease.leaseId,lease.generation,associationId]);
 const current=ITEMS.find(item=>item.id===currency)!;
 const personal=state?(currency==='SILVER'?state.personalSilver:currency==='GOLD'?state.personalGold:state.personalTickets):0;
 const parsed=Number(amount);
 const valid=Number.isSafeInteger(parsed)&&parsed>0&&parsed<=1000000000&&parsed<=personal;
 const donate=async()=>{
  if(running.current||!state||!valid||expedition)return;
  running.current=true;setBusy(true);setError('');setMessage('');
  const key='warehouse:'+associationId+':'+currency+':'+parsed;
  const id=pendingGrowthRequest(key);
  try{
   const result=await depositAssociationWarehouse(lease,{id,currency,amount:parsed});
   if(!mounted.current)return;
   setState(result.warehouse);
   completeGrowthRequest(key);
   onRecord(result.record,'원정단 창고에 기부했습니다.');
   onChanged();
   setMessage(current.label+' '+quantity(parsed)+(current.unit==='장'?'장':' '+current.unit)+' 기부 완료');
  }catch(e){
   if(mounted.current)setError(e instanceof Error?e.message:'기부 상태를 확인해 주세요. 같은 기부를 다시 눌러 결과를 재확인할 수 있습니다.');
  }finally{running.current=false;if(mounted.current)setBusy(false);}
 };
 if(!state)return <section className="tc-warehouse tc-warehouse-loading" aria-label="원정단 금고">
  <p role="status">{error||'길드 창고 정보를 불러오는 중입니다.'}</p>
  <button onClick={()=>void refresh()} disabled={busy}>다시 불러오기</button>
 </section>;
 return <section className="tc-warehouse" aria-label="원정단 금고">
  <header className="tc-warehouse-head">
   <div><small>GUILD TREASURY</small><h2>원정단 금고</h2><p>단원 모두가 채우는 공동 자산</p></div>
   <button type="button" onClick={()=>void refresh()} disabled={busy}>새로고침</button>
  </header>
  <div className="tc-warehouse-balances" aria-label="원정단 공동 보유 재화">
   {ITEMS.map(item=><div key={item.id} className={'tc-warehouse-balance '+(item.id===currency?'selected':'')}>
    <span className="tc-warehouse-currency-symbol" aria-hidden="true">{item.glyph}</span><small>공용 {item.label}</small>
    <strong>{quantity(item.id==='SILVER'?state.silver:item.id==='GOLD'?state.gold:state.tickets)}</strong>
    <em>{item.unit}</em>
   </div>)}
  </div>
  <div className="tc-warehouse-deposit">
   <div className="tc-warehouse-panel-title"><b>창고에 기부하기</b><small>출금 불가 · 성장 기부와 별도</small></div>
   <div className="tc-warehouse-currency-picker" role="group" aria-label="기부 재화">
    {ITEMS.map(item=><button key={item.id} type="button" className={currency===item.id?'active':''} aria-pressed={currency===item.id} onClick={()=>{setCurrency(item.id);setAmount(item.id==='SILVER'?'10000':item.id==='GOLD'?'100':'10');setMessage('');setError('');}}>{item.label}</button>)}
   </div>
   <div className="tc-warehouse-available">
    <span>개인 보유 {current.label}</span><strong>{quantity(personal)} {current.unit}</strong>
   </div>
   <label className="tc-warehouse-amount"><span>기부 수량</span><input type="number" min="1" max={Math.min(personal,1000000000)} step="1" inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value)} disabled={busy||expedition} aria-label="창고에 기부할 수량"/></label>
   <div className="tc-warehouse-amount-presets">
    {[currency==='SILVER'?1000:1,currency==='SILVER'?10000:currency==='GOLD'?100:10].map(n=><button type="button" key={n} disabled={busy||expedition} onClick={()=>setAmount(String(n))}>+{quantity(n)}</button>)}
    <button type="button" disabled={busy||expedition||personal<=0} onClick={()=>setAmount(String(Math.min(personal,1000000000)))}>최대</button>
   </div>
   <button type="button" className="tc-warehouse-submit" disabled={busy||expedition||!valid} onClick={()=>void donate()}>{busy?'기부 처리 중…':current.label+' 기부하기'}</button>
   {expedition&&<p className="tc-warehouse-note">안전 귀환 후 기부할 수 있습니다.</p>}
   <p className="tc-warehouse-note">기부된 재화는 개인에게 반환되지 않습니다. 공용 도전권 100장은 길드장의 선전포고에 사용됩니다.</p>
   {message&&<p role="status" className="tc-warehouse-success">{message}</p>}
   {error&&<p role="alert" className="tc-warehouse-error">{error}</p>}
  </div>
  <div className="tc-warehouse-ledger">
   <div className="tc-warehouse-panel-title"><b>금고 기록</b><small>최근 {state.ledger.length}건</small></div>
   <div className="tc-warehouse-ledger-rows" aria-label="원정단 금고 입출금 내역">
    {state.ledger.length?state.ledger.map(entry=><article key={entry.entryId}>
     <div><b>{entry.operation==='WAR_DECLARATION'?'선전포고':entry.actorName+' · 기부'}</b><small>{formatTime(entry.createdAt)} · {entry.detail}</small></div>
     <strong className={entry.amount>0?'positive':'negative'}>{entry.amount>0?'+':''}{quantity(Math.abs(entry.amount)).replace(/^/,(entry.amount<0?'-':''))} {entry.currency==='SILVER'?'S':entry.currency==='GOLD'?'G':'장'}</strong>
    </article>):<p className="tc-warehouse-empty">아직 창고 기록이 없습니다. 첫 기부를 해보세요.</p>}
   </div>
  </div>
 </section>;
}
