import {GuildTask} from './GuildTask';
import React,{useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import type {CloudSaveRecord} from '../../online/cloudSave';
import {
 loadAssociationWarehouse,loadAssociationWarehouseHistory,transferAssociationTreasury,
 type AssociationWarehouse,type WarehouseEntry,type WarehouseCurrency,type WarehouseDirection,type WarehouseTransferInput,
} from '../../online/associationWarehouse';
import './warehouse.css';
import './treasuryLedger.css';
import {Pager} from '../../ui/mobile';
import {GuildMaterialsPanel} from './GuildMaterialsPanel';

const assets=[{id:'SILVER',name:'실버',unit:'S'},{id:'GOLD',name:'골드',unit:'G'},{id:'TICKET',name:'도전권',unit:'장'}] as const;
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
export function AssociationWarehousePanel({lease,associationId,expedition=false,onRecord,onChanged,onBack}:{
 lease:GameplayLease;associationId:string;expedition?:boolean;
 onRecord?:(record:CloudSaveRecord,message:string)=>void;onChanged?:()=>void;onBack?:()=>void;
}){
 const [state,setState]=useState<AssociationWarehouse|null>(null);
 const [history,setHistory]=useState<WarehouseEntry[]>([]);
 const [ledgerPage,setLedgerPage]=useState(0);
 const [view,setView]=useState<'ledger'|'assets'|'materials'>('ledger');
 const [filter,setFilter]=useState<'all'|'deposit'|'withdraw'>('all');
 const withdrawalsOnly=filter==='withdraw';
 const visibleHistory=filter==='deposit'?history.filter(entry=>entry.amount>0):filter==='withdraw'?history.filter(entry=>entry.amount<0):history;
 const ledgerPages=Math.max(1,Math.ceil(visibleHistory.length/6));
 const ledgerIndex=Math.min(ledgerPage,ledgerPages-1);
 const [hasMore,setHasMore]=useState(false);
 
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
 const transferDialog=useRef<HTMLDialogElement>(null),historyDialog=useRef<HTMLDialogElement>(null);
 const openTransfer=(next:'DEPOSIT'|'WITHDRAW')=>{
  if(!state||state.myRole!=='LEADER'||expedition)return;
  setDirection(next);transferDialog.current?.showModal();
 };
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
 const topEntries=visibleHistory.slice(ledgerIndex*6,ledgerIndex*6+6);
 const ledgerTotal=history.filter(entry=>entry.currency==='SILVER').reduce((sum,entry)=>sum+entry.amount,0);
 const currencyUnit=(id:WarehouseCurrency)=>id==='SILVER'?'S':id==='GOLD'?'G':'장';
 const historyRow=(entry:WarehouseEntry)=>(
  <article className={'tc-tl-entry '+(entry.amount<0?'outflow':'inflow')} key={entry.entryId}>
   <time dateTime={entry.createdAt}>{at(entry.createdAt)}</time>
   <span className={'tc-tl-kind '+(entry.amount<0?'out':'in')}>{entry.amount<0?'↘ 출금':'↗ 입금'}</span>
   <div className="tc-tl-entry-name"><b>{entryLabel(entry)}</b><small>{entry.detail||entry.actorName}</small></div>
   <div className="tc-tl-entry-actor"><small>처리자</small><span>{entry.actorName}</span></div>
   <strong className={entry.amount<0?'negative':'positive'}>{entry.amount<0?'−':'+'}{fmt(Math.abs(entry.amount))}<small> {currencyUnit(entry.currency)}</small></strong>
  </article>
 );
 return <section className={"tc-warehouse tc-treasury-ledger"+(view==='materials'?" tc-tl-show-materials":"")} aria-label="원정단 금고">
  {view!=='materials'&&<header className="tc-tl-hero">
   <nav className="tc-tl-top-nav" aria-label="금고 화면 상단"><button type="button" className="tc-tl-back" aria-label="원정단 본부로 돌아가기" onClick={()=>onBack?.()}>‹ <span>뒤로</span></button><span>탑의 기록</span><GuildTask title="금고 운영 안내" trigger="ⓘ">
    <div className="tc-warehouse-source">
     <p>원정단 공용 실버·골드·도전권을 보관하고 거래 내역을 공개합니다.</p>
     <p>본부 기부와 사냥·원정 수익 분담은 서버에서 자동 적립됩니다.</p>
     <p>금고 재화의 입출금은 원정단장만 가능하며, 모든 원정단원은 공개 장부를 열람할 수 있습니다.</p>
     <p>금고로 입금하거나 금고에서 인출해도 공헌도가 지급되지 않습니다.</p>
    </div>
   </GuildTask></nav>
   <div className="tc-tl-hero-caption"><h2>원정단 금고</h2><p>원정단의 자산을 관리하는 공동 금고입니다.</p></div>
  </header>}
  {!state?<div className="tc-tl-loading" role="status">{error||'원정단 금고 정보를 불러오는 중입니다.'}</div>:<>
   {view!=='materials'&&<div className="tc-tl-balances" aria-label="원정단 보유 재화">
    {assets.map(item=><div key={item.id} className={'tc-tl-balance tc-tl-'+item.id.toLowerCase()}>
     <span aria-hidden="true" className="tc-tl-coin"/>
     <div><small>{item.name}</small><strong>{fmt(balance(item.id,'treasury'))}</strong></div>
    </div>)}
   </div>}
   {view!=='materials'&&<div className="tc-tl-highlights" aria-label="금고 현황">
    <div><span className="tc-tl-highlight-icon" aria-hidden="true">▥</span><div><small>최근 기록 · 실버 순변동</small><strong className={ledgerTotal>=0?'positive':'negative'}>{ledgerTotal>=0?'+':'−'}{fmt(Math.abs(ledgerTotal))} <em>S</em></strong></div></div>
    <div><span className="tc-tl-highlight-icon tc-tl-highlight-silver" aria-hidden="true"/><div><small>현재 공용 실버 잔액</small><strong>{fmt(state.silver)} <em>S</em></strong></div></div>
   </div>}
   {view==='ledger'&&<section className="tc-tl-board" aria-label="원정단 거래 장부">
    <header className="tc-tl-board-head"><span aria-hidden="true">▤</span><h3>거래 장부</h3><small>공개 기록 · 최신순</small></header>
    <div className="tc-tl-toolbar">
     <div className="tc-tl-filters" role="group" aria-label="거래 내역 구분">
      {([['all','전체'],['deposit','↑ 입금'],['withdraw','↓ 출금']] as const).map(([id,label])=><button type="button" key={id} className={filter===id?'active':''} aria-pressed={filter===id} onClick={()=>{setFilter(id);setLedgerPage(0);}}>{label}</button>)}
      <button type="button" onClick={()=>setView('materials')}>◇ 재료</button>
     </div>
     <button type="button" className="tc-tl-filter-more" onClick={()=>historyDialog.current?.showModal()}>☷ 전체 내역</button>
    </div>
    <div className="tc-tl-ledger-header" aria-hidden="true"><span>시간</span><span>구분</span><span>거래 내역</span><span>처리자</span><span>변동 금액</span></div>
    <div className="tc-tl-ledger-list" aria-label="원정단 최근 거래">
     {topEntries.length?topEntries.map(historyRow):<p className="tc-tl-empty">{historyBusy?'거래 내역을 불러오는 중입니다.':'해당 거래 내역이 없습니다.'}</p>}
    </div>
    <div className="tc-tl-page"><Pager page={ledgerIndex} count={ledgerPages} onChange={setLedgerPage}/>{hasMore&&<button type="button" onClick={()=>void more()} disabled={historyBusy}>{historyBusy?'불러오는 중':'이전 기록 더 보기'}</button>}</div>
   </section>}
   {view==='assets'&&<section className="tc-tl-board tc-tl-assets-view" aria-label="원정단 자산 상세">
    <header className="tc-tl-board-head"><span>◈</span><h3>공용 자산 현황</h3></header>
    <div className="tc-tl-asset-list">{assets.map(item=><article key={item.id}><span aria-hidden="true" className={"tc-tl-asset-emblem tc-tl-"+item.id.toLowerCase()}/><div><b>{item.name}</b><small>원정단 공동 보관 재화</small></div><strong>{fmt(balance(item.id,'treasury'))} <small>{item.unit}</small></strong></article>)}</div>
    <p>사냥·원정 수익 분담과 본부 기부가 이 금고에 적립됩니다. 입출금 거래는 원정단 전체에 공개됩니다.</p>
    <button className="tc-tl-open-materials" type="button" onClick={()=>setView('materials')}>재료 창고 열기</button>
   </section>}
   {view==='materials'&&<GuildMaterialsPanel lease={lease} associationId={associationId} expedition={expedition} onBack={()=>setView('ledger')}/>} 
   {view!=='materials'&&<div className="tc-tl-actions" role="group" aria-label="금고 관리">
    <button type="button" className="tc-tl-deposit" onClick={()=>openTransfer('DEPOSIT')} disabled={state.myRole!=='LEADER'||expedition||busy}>◉ 입금</button>
    <button type="button" className="tc-tl-withdraw" onClick={()=>openTransfer('WITHDRAW')} disabled={state.myRole!=='LEADER'||expedition||busy}>↘ 출금</button>
    <button type="button" onClick={()=>historyDialog.current?.showModal()}>▤ 세부 내역</button>
   </div>}
   {view!=='materials'&&state.myRole!=='LEADER'&&<p className="tc-tl-role-note">입출금은 원정단장 전용입니다. 모든 단원은 장부를 열람할 수 있습니다.</p>}
   <nav className="tc-tl-bottom" aria-label="금고 메뉴">
    {([['ledger','▤','장부'],['assets','◉','자산'],['materials','▣','보관품']] as const).map(([id,icon,label])=><button type="button" key={id} aria-current={view===id?'page':undefined} className={view===id?'active':''} onClick={()=>setView(id)}><span aria-hidden="true">{icon}</span>{label}</button>)}
   </nav>
  </>}
  {notice&&<p role="status" className="tc-warehouse-success">{notice}</p>}
  {error&&<p role="alert" className="tc-warehouse-error">{error}</p>}
  <dialog ref={transferDialog} className="tc-tl-dialog" aria-label="원정단 금고 입출금">
   <header><b>{direction==='DEPOSIT'?'금고에 입금':'금고에서 출금'}</b><button type="button" aria-label="입출금 창 닫기" onClick={()=>transferDialog.current?.close()}>✕</button></header>
   {state?.myRole==='LEADER'&&<div className="tc-warehouse-transfer" aria-label="길드장 금고 입출금">
    <div className="tc-warehouse-panel-title"><b>금고 입출금</b><small>원정단장 전용 · 공헌도 미지급</small></div>
    <div className="tc-warehouse-direction" role="group" aria-label="거래 유형">
     <button type="button" className={direction==='WITHDRAW'?'active':''} onClick={()=>setDirection('WITHDRAW')} disabled={busy}>출금</button>
     <button type="button" className={direction==='DEPOSIT'?'active':''} onClick={()=>setDirection('DEPOSIT')} disabled={busy}>입금</button>
    </div>
    <div className="tc-warehouse-currency-picker" role="group" aria-label="재화 선택">
     {assets.map(item=><button type="button" key={item.id} className={currency===item.id?'active':''} onClick={()=>setCurrency(item.id)} disabled={busy}>{item.name}</button>)}
    </div>
    <div className="tc-warehouse-available"><span>{direction==='WITHDRAW'?'금고 보유량':'내 보유량'}</span><strong>{fmt(available)} {currencyUnit(currency)}</strong></div>
    <label className="tc-warehouse-amount">금액
     <input type="number" inputMode="numeric" min={1} max={1000000000} step={1} value={amount} onChange={e=>setAmount(e.target.value)} disabled={busy}/>
    </label>
    <div className="tc-warehouse-amount-presets">{[.25,.5,1].map(fraction=><button type="button" key={fraction} onClick={()=>setAmount(String(Math.min(1000000000,Math.floor(available*fraction))))} disabled={busy||available<1}>{fraction===1?'전액':(fraction*100)+'%'}</button>)}</div>
    <label className="tc-warehouse-amount">거래 메모 (선택)
     <input type="text" maxLength={100} value={note} placeholder="예: 원정단 운영비" onChange={e=>setNote(e.target.value)} disabled={busy}/>
    </label>
    <button type="button" className="tc-warehouse-submit" disabled={busy||expedition||!valid||!!pending} onClick={()=>void send()}>{busy?'처리 중…':expedition?'원정 중 입출금 불가':direction==='WITHDRAW'?'출금 확인':'입금 확인'}</button>
    {pending&&<div className="tc-warehouse-pending"><span>이전 입출금 요청의 처리 여부를 재확인할 수 있습니다.</span><button type="button" disabled={busy} onClick={()=>void send(true)}>이전 요청 재확인</button></div>}
    <p className="tc-warehouse-note">1회 최대 10억 · 서버 잔액 검증 · 거래 즉시 공개 장부 기록</p>
    {notice&&<p role="status" className="tc-warehouse-success">{notice}</p>}
    {error&&<p role="alert" className="tc-warehouse-error">{error}</p>}
   </div>}
  </dialog>
  <dialog ref={historyDialog} className="tc-tl-dialog tc-tl-history-dialog" aria-label="원정단 전체 거래 내역">
   <header><b>공개 거래 장부</b><button type="button" aria-label="거래 내역 창 닫기" onClick={()=>historyDialog.current?.close()}>✕</button></header>
   <div className="tc-tl-dialog-history">
    <div className="tc-tl-filters" role="group" aria-label="전체 거래 내역 구분">
     {([['all','전체'],['deposit','입금'],['withdraw','출금']] as const).map(([id,label])=><button type="button" key={id} className={filter===id?'active':''} onClick={()=>{setFilter(id);setLedgerPage(0);}}>{label}</button>)}
    </div>
    {visibleHistory.length?visibleHistory.map(historyRow):<p className="tc-tl-empty">{historyBusy?'조회 중입니다.':'거래 내역이 없습니다.'}</p>}
    {hasMore&&<button type="button" className="tc-warehouse-more" disabled={historyBusy} onClick={()=>void more()}>{historyBusy?'조회 중…':'이전 거래 내역 더 보기'}</button>}
   </div>
  </dialog>
 </section>;
}
