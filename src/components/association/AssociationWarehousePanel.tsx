import React,{useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import type {CloudSaveRecord} from '../../online/cloudSave';
import {
 loadAssociationWarehouse,loadAssociationWarehouseHistory,transferAssociationTreasury,
 type AssociationWarehouse,type WarehouseEntry,type WarehouseCurrency,type WarehouseDirection,type WarehouseTransferInput,
} from '../../online/associationWarehouse';
import './warehouse.css';

const assets=[{id:'SILVER',name:'실버',glyph:'◉',unit:'S'},{id:'GOLD',name:'골드',glyph:'◆',unit:'G'},{id:'TICKET',name:'도전권',glyph:'⚔',unit:'장'}] as const;
const fmt=(v:number)=>v.toLocaleString('ko-KR');
const at=(iso:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));
const entryLabel=(e:WarehouseEntry)=>{
 if(e.operation==='LEADER_WITHDRAW')return '길드장 인출 · '+e.actorName;
 if(e.operation==='LEADER_DEPOSIT')return '길드장 입금 · '+e.actorName;
 if(e.operation==='WAR_DECLARATION')return '선전포고 비용';
 if(e.operation==='HUNT_TAX')return '사냥 수익 분담';
 if(e.operation==='EXPEDITION_TAX')return '원정 수익 분담';
 return e.actorName+' · 본부 기부';
};
const storageKey=(associationId:string)=>'tc-guild-treasury-pending:'+associationId;
export function AssociationWarehousePanel({lease,associationId,expedition=false,onRecord,onChanged}:{
 lease:GameplayLease;associationId:string;expedition?:boolean;
 onRecord?:(record:CloudSaveRecord,message:string)=>void;onChanged?:()=>void;
}){
 const [state,setState]=useState<AssociationWarehouse|null>(null);
 const [history,setHistory]=useState<WarehouseEntry[]>([]);
 const [hasMore,setHasMore]=useState(false);
 const [withdrawalsOnly,setWithdrawalsOnly]=useState(false);
 const [historyBusy,setHistoryBusy]=useState(false);
 const [direction,setDirection]=useState<WarehouseDirection>('WITHDRAW');
 const [currency,setCurrency]=useState<WarehouseCurrency>('SILVER');
 const [amount,setAmount]=useState('1000');
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [pending,setPending]=useState<WarehouseTransferInput|null>(null);
 const active=useRef(true),locked=useRef(false);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 useEffect(()=>{
  try{const raw=window.sessionStorage.getItem(storageKey(associationId));setPending(raw?JSON.parse(raw) as WarehouseTransferInput:null);}catch{setPending(null);}
 },[associationId]);
 useEffect(()=>{
  let alive=true;
  const refresh=async()=>{
   try{const next=await loadAssociationWarehouse(lease);
    if(alive&&next.associationId===associationId){setState(next);setError('');}
   }catch(e){if(alive)setError(e instanceof Error?e.message:'금고 조회 실패');}
  };
  void refresh();
  const timer=window.setInterval(()=>{if(!document.hidden&&!locked.current)void refresh();},15000);
  const focus=()=>{if(!locked.current)void refresh();};
  window.addEventListener('focus',focus);
  return()=>{alive=false;window.clearInterval(timer);window.removeEventListener('focus',focus);};
 },[lease.leaseId,lease.generation,associationId]);
 useEffect(()=>{
  let alive=true;
  setHistoryBusy(true);
  void loadAssociationWarehouseHistory(lease,null,withdrawalsOnly).then(page=>{
   if(alive){setHistory(page.ledger);setHasMore(page.hasMore);}
  }).catch(e=>{if(alive)setError(e instanceof Error?e.message:'거래 기록 조회 실패');})
   .finally(()=>{if(alive)setHistoryBusy(false);});
  return()=>{alive=false;};
 },[lease.leaseId,lease.generation,associationId,withdrawalsOnly]);
 const reloadHistory=async()=>{
  const page=await loadAssociationWarehouseHistory(lease,null,withdrawalsOnly);
  if(active.current){setHistory(page.ledger);setHasMore(page.hasMore);}
 };
 const more=async()=>{
  if(historyBusy||!hasMore||!history.length)return;
  setHistoryBusy(true);
  try{
   const page=await loadAssociationWarehouseHistory(lease,history[history.length-1].entryId,withdrawalsOnly);
   if(active.current){setHistory(old=>[...old,...page.ledger]);setHasMore(page.hasMore);}
  }catch(e){setError(e instanceof Error?e.message:'이전 기록을 불러오지 못했습니다.');}
  finally{if(active.current)setHistoryBusy(false);}
 };
 const balance=(item:WarehouseCurrency,owner:'personal'|'treasury')=>{
  if(!state)return 0;
  if(item==='SILVER')return owner==='personal'?state.personalSilver:state.silver;
  if(item==='GOLD')return owner==='personal'?state.personalGold:state.gold;
  return owner==='personal'?state.personalTickets:state.tickets;
 };
 const available=balance(currency,direction==='WITHDRAW'?'treasury':'personal');
 const value=Number(amount),valid=Number.isSafeInteger(value)&&value>=1&&value<=1000000000&&value<=available;
 const send=async(retry=false)=>{
  if(locked.current||!state||state.myRole!=='LEADER'||expedition)return;
  let request=pending;
  if(!retry&&request){setError('먼저 이전 입출금 요청을 재확인해 주세요.');return;}
  if(!request){
   if(!valid)return;
   request={requestId:crypto.randomUUID(),direction,currency,amount:value,note:note.trim()};
   window.sessionStorage.setItem(storageKey(associationId),JSON.stringify(request));
   setPending(request);
  }
  locked.current=true;setBusy(true);setError('');setNotice('');
  try{
   const result=await transferAssociationTreasury(lease,request);
   if(!active.current)return;
   window.sessionStorage.removeItem(storageKey(associationId));
   setPending(null);
   setState(result.warehouse);
   onRecord?.(result.record,request.direction==='WITHDRAW'?'금고에서 재화를 인출했습니다.':'금고에 재화를 입금했습니다.');
   onChanged?.();
   await reloadHistory();
   if(active.current)setNotice(result.replayed?'이미 완료된 입출금 요청입니다. 내역을 확인하세요.':
    '금고 '+(request.direction==='WITHDRAW'?'인출':'입금')+' 완료 · 전체 길드원에게 기록이 공개됩니다. 공헌도 변화는 없습니다.');
  }catch(e){if(active.current)setError(e instanceof Error?e.message:'금고 입출금에 실패했습니다.');}
  finally{locked.current=false;if(active.current)setBusy(false);}
 };
 return <section className="tc-warehouse" aria-label="원정단 금고">
  <header className="tc-warehouse-head">
   <div><small>GUILD TREASURY</small><h2>원정단 금고</h2><p>공용 재화와 공개 입출금 장부</p></div>
   {state?.myRole==='LEADER'&&<span className="tc-warehouse-owner">길드장 관리</span>}
  </header>
  {!state?<p role="status">{error||'길드 창고 정보를 불러오는 중입니다.'}</p>:<>
   <div className="tc-warehouse-balances" aria-label="원정단 공동 보유 재화">
    {assets.map(item=><div key={item.id} className="tc-warehouse-balance">
     <span className="tc-warehouse-currency-symbol" aria-hidden="true">{item.glyph}</span><small>공용 {item.name}</small>
     <strong>{fmt(balance(item.id,'treasury'))}</strong><em>{item.unit}</em>
    </div>)}
   </div>
   {state.myRole==='LEADER'&&<section className="tc-warehouse-transfer" aria-label="길드장 금고 입출금">
    <div className="tc-warehouse-panel-title"><b>금고 입출금</b><small>길드장 전용 · 공헌도 지급 없음</small></div>
    <div className="tc-warehouse-direction" role="group" aria-label="거래 유형">
     <button type="button" className={direction==='WITHDRAW'?'active':''} onClick={()=>setDirection('WITHDRAW')} disabled={busy}>인출</button>
     <button type="button" className={direction==='DEPOSIT'?'active':''} onClick={()=>setDirection('DEPOSIT')} disabled={busy}>입금</button>
    </div>
    <div className="tc-warehouse-currency-picker" role="group" aria-label="거래 재화">
     {assets.map(item=><button type="button" key={item.id} className={currency===item.id?'active':''} onClick={()=>setCurrency(item.id)} disabled={busy}>{item.name}</button>)}
    </div>
    <div className="tc-warehouse-available">
     <span>{direction==='WITHDRAW'?'금고 잔액':'내 보유량'}</span><strong>{fmt(available)} {currency==='SILVER'?'S':currency==='GOLD'?'G':'장'}</strong>
    </div>
    <label className="tc-warehouse-amount">수량
     <input type="number" inputMode="numeric" min={1} max={1000000000} step={1}
      value={amount} onChange={e=>setAmount(e.target.value)} disabled={busy}/>
    </label>
    <div className="tc-warehouse-amount-presets">
     {[.25,.5,1].map(fraction=><button type="button" key={fraction} onClick={()=>setAmount(String(Math.min(1000000000,Math.floor(available*fraction))))} disabled={busy||available<1}>{fraction===1?'전액':(fraction*100)+'%'}</button>)}
    </div>
    <label className="tc-warehouse-amount">입출금 메모 (선택)
     <input type="text" maxLength={100} value={note} placeholder="예: 길드 운영비" onChange={e=>setNote(e.target.value)} disabled={busy}/>
    </label>
    <button type="button" className="tc-warehouse-submit" disabled={busy||expedition||!valid||!!pending} onClick={()=>void send()}>
     {busy?'처리 중…':expedition?'원정 중 입출금 불가':direction==='WITHDRAW'?'금고에서 인출하기':'금고에 입금하기'}
    </button>
    {pending&&<div className="tc-warehouse-pending">
     <span>처리 결과를 확인하지 못한 입출금 요청이 있습니다. 같은 요청 번호로 다시 확인합니다.</span>
     <button type="button" disabled={busy} onClick={()=>void send(true)}>이전 요청 재확인</button>
    </div>}
    <p className="tc-warehouse-note">일일 입출금 한도 없음 · 보유 잔액 내에서 자유롭게 거래 · 거래 즉시 영구 장부 기록 · 공헌도 미지급</p>
   </section>}
   <div className="tc-warehouse-source">
    <b>금고 운영 안내</b>
    <p>사냥 세금과 본부의 실버·골드·도전권 기부는 기존대로 자동 적립됩니다.</p>
    <p>길드장만 금고에 입출금할 수 있으며, 길드원은 기록을 모두 열람할 수 있습니다.</p>
    <p>인출한 공금은 길드장 캐릭터의 개인 보유 재화로 이동합니다.</p>
   </div>
   <div className="tc-warehouse-ledger">
    <div className="tc-warehouse-panel-title"><b>공개 거래 장부</b><small>인출자 · 시간 · 금액 · 잔액</small></div>
    <div className="tc-warehouse-history-filter">
     <button type="button" aria-pressed={!withdrawalsOnly} className={!withdrawalsOnly?'active':''} onClick={()=>setWithdrawalsOnly(false)}>전체 기록</button>
     <button type="button" aria-pressed={withdrawalsOnly} className={withdrawalsOnly?'active':''} onClick={()=>setWithdrawalsOnly(true)}>인출 내역만</button>
    </div>
    <div className="tc-warehouse-ledger-rows" aria-label="원정단 금고 입출금 내역">
     {history.length?history.map(entry=><article key={entry.entryId} className={entry.operation==='LEADER_WITHDRAW'?'withdrawal':''}>
      <div><b>{entryLabel(entry)}</b><small>{at(entry.createdAt)} · {entry.detail}</small>
       <small>거래 후 잔액 {fmt(entry.balanceAfter)} {entry.currency==='SILVER'?'S':entry.currency==='GOLD'?'G':'장'}</small></div>
      <strong className={entry.amount>0?'positive':'negative'}>{entry.amount>0?'+':'-'}{fmt(Math.abs(entry.amount))} {entry.currency==='SILVER'?'S':entry.currency==='GOLD'?'G':'장'}</strong>
     </article>):<p className="tc-warehouse-empty">{historyBusy?'기록을 불러오는 중입니다.':'등록된 거래 기록이 없습니다.'}</p>}
    </div>
    {hasMore&&<button type="button" className="tc-warehouse-more" disabled={historyBusy} onClick={()=>void more()}>{historyBusy?'불러오는 중…':'이전 거래 기록 더 보기'}</button>}
   </div>
  </>}
  {notice&&<p role="status" className="tc-warehouse-success">{notice}</p>}
  {error&&<p role="alert" className="tc-warehouse-error">{error}</p>}
 </section>;
}
