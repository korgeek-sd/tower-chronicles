import React,{useEffect,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {loadAssociationWarehouse,type AssociationWarehouse,type WarehouseEntry} from '../../online/associationWarehouse';
import './warehouse.css';

const items=[{id:'SILVER',name:'실버',glyph:'◉',unit:'S'},{id:'GOLD',name:'골드',glyph:'◆',unit:'G'},{id:'TICKET',name:'도전권',glyph:'⚔',unit:'장'}] as const;
const fmt=(v:number)=>v.toLocaleString('ko-KR');
const at=(iso:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));
const label=(e:WarehouseEntry)=>e.operation==='WAR_DECLARATION'?'선전포고 비용':e.operation==='HUNT_TAX'?'사냥 수익 분담':e.operation==='EXPEDITION_TAX'?'원정 수익 분담':e.actorName+' · 기부';

export function AssociationWarehousePanel({lease,associationId}:{lease:GameplayLease;associationId:string}){
 const [state,setState]=useState<AssociationWarehouse|null>(null),[error,setError]=useState('');
 useEffect(()=>{
  let alive=true;
  const refresh=async()=>{try{const s=await loadAssociationWarehouse(lease);if(alive&&s.associationId===associationId){setState(s);setError('');}}catch(e){if(alive)setError(e instanceof Error?e.message:'금고 조회 실패');}};
  void refresh();
  const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},15000);
  window.addEventListener('focus',refresh);
  return()=>{alive=false;window.clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[lease.leaseId,lease.generation,associationId]);
 return <section className="tc-warehouse tc-warehouse-readonly" aria-label="원정단 금고">
  <header className="tc-warehouse-head"><div><small>GUILD TREASURY</small><h2>원정단 금고</h2><p>공용 재화 현황 및 사용 내역</p></div></header>
  {!state?<p role="status">{error||'길드 창고 정보를 불러오는 중입니다.'}</p>:<>
   <div className="tc-warehouse-balances" aria-label="원정단 공동 보유 재화">
    {items.map(item=><div key={item.id} className="tc-warehouse-balance">
     <span className="tc-warehouse-currency-symbol" aria-hidden="true">{item.glyph}</span><small>공용 {item.name}</small>
     <strong>{fmt(item.id==='SILVER'?state.silver:item.id==='GOLD'?state.gold:state.tickets)}</strong><em>{item.unit}</em>
    </div>)}
   </div>
   <div className="tc-warehouse-source">
    <b>재화 적립 안내</b>
    <p>사냥 수익 분담 실버가 자동으로 적립됩니다.</p>
    <p>원정단 본부에서 실버·골드·도전권을 기부하면 금고에 쌓이고 공헌도가 지급됩니다.</p>
    <p>공용 도전권 100장은 선전포고에 사용됩니다. 개인 출금은 불가능합니다.</p>
   </div>
   <div className="tc-warehouse-ledger">
    <div className="tc-warehouse-panel-title"><b>금고 기록</b><small>최근 {state.ledger.length}건</small></div>
    <div className="tc-warehouse-ledger-rows" aria-label="원정단 금고 입출금 내역">
     {state.ledger.length?state.ledger.map(entry=><article key={entry.entryId}>
      <div><b>{label(entry)}</b><small>{at(entry.createdAt)} · {entry.detail}</small></div>
      <strong className={entry.amount>0?'positive':'negative'}>{entry.amount>0?'+':'-'}{fmt(Math.abs(entry.amount))} {entry.currency==='SILVER'?'S':entry.currency==='GOLD'?'G':'장'}</strong>
     </article>):<p className="tc-warehouse-empty">아직 기록이 없습니다. 사냥이나 본부 기부 시 표시됩니다.</p>}
    </div>
   </div>
  </>}
  {error&&state&&<p role="alert" className="tc-warehouse-error">{error}</p>}
 </section>;
}
