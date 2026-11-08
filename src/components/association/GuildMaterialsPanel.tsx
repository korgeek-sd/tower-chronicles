import React,{useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {assetUrl} from '../../game/data/graphics';
import {GameScrollSelect} from '../../ui/GameScrollSelect';
import {
 getGuildMaterials,transferGuildMaterial,
 GUILD_MATERIAL_IDS,GUILD_MATERIAL_NAMES,
 type GuildMaterial,type GuildMaterialLedger,type GuildMaterialsState,
} from '../../online/guildMaterials';
import './guildMaterials.css';
import './guildMaterialsConcept.css';

const format=(n:number)=>Math.max(0,Math.trunc(n)).toLocaleString('ko-KR');
const pendingKey=(associationId:string)=>'tc-guild-material-transfer:'+associationId;
type Transfer={requestId:string;direction:'DEPOSIT'|'WITHDRAW';material:GuildMaterial;amount:number};
const actionLabel=(entry:GuildMaterialLedger)=>{
 if(entry.operation==='GATHER_TAX')return '채집 세금 입고';
 if(entry.operation==='DEPOSIT')return '재료 입고';
 if(entry.operation==='WITHDRAW')return '재료 출고';
 if(entry.operation==='AUCTION_LIST')return '경매 등록';
 return '경매 물품 반환';
};
const when=(iso:string)=>new Date(iso).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
export function GuildMaterialsPanel({lease,associationId,expedition=false,onBack}:{
 lease:GameplayLease;associationId:string;expedition?:boolean;onBack?:()=>void;
}){
 const [state,setState]=useState<GuildMaterialsState|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [direction,setDirection]=useState<'DEPOSIT'|'WITHDRAW'>('WITHDRAW');
 const [material,setMaterial]=useState<GuildMaterial>('herb'),[amount,setAmount]=useState('100');
 const [pending,setPending]=useState<Transfer|null>(null);
 const mounted=useRef(true),locked=useRef(false);
 const transferDialog=useRef<HTMLDialogElement>(null),ledgerDialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const refresh=async()=>{
  try{const next=await getGuildMaterials(lease);if(mounted.current){setState(next);setError('');}}
  catch(e){if(mounted.current)setError(e instanceof Error?e.message:'원정단 재료 창고를 불러오지 못했습니다.');}
 };
 useEffect(()=>{
  try{const raw=window.sessionStorage.getItem(pendingKey(associationId));setPending(raw?JSON.parse(raw) as Transfer:null);}catch{setPending(null);}
  void refresh();
  const timer=window.setInterval(()=>{if(!document.hidden&&!locked.current)void refresh();},30000);
  const focus=()=>{if(!locked.current)void refresh();};
  window.addEventListener('focus',focus);
  return()=>{window.clearInterval(timer);window.removeEventListener('focus',focus);};
 },[lease.leaseId,lease.generation,associationId]);
 const mutate=async(action:()=>Promise<void>)=>{
  if(locked.current)return;locked.current=true;setBusy(true);setError('');setNotice('');
  try{await action();}catch(e){if(mounted.current)setError(e instanceof Error?e.message:'재료 요청을 처리하지 못했습니다.');}
  finally{locked.current=false;if(mounted.current)setBusy(false);}
 };
 const send=(retry=false)=>void mutate(async()=>{
  if(!state?.isLeader||expedition)return;
  const n=Number(amount);
  const request=retry?pending:pending??{requestId:crypto.randomUUID(),direction,material,amount:n};
  if(!request||!Number.isSafeInteger(request.amount)||request.amount<1||request.amount>1000000000)throw Error('수량은 1~10억 개 사이로 입력해 주세요.');
  if(!pending){window.sessionStorage.setItem(pendingKey(associationId),JSON.stringify(request));setPending(request);}
  const result=await transferGuildMaterial(lease,request.requestId,request.direction,request.material,request.amount);
  window.sessionStorage.removeItem(pendingKey(associationId));setPending(null);
  if(mounted.current){
   setState(result.state);
   setNotice(GUILD_MATERIAL_NAMES[request.material]+' '+format(request.amount)+'개 '+(request.direction==='DEPOSIT'?'입고':'출고')+' 완료 · 거래 기록에 반영됐습니다.');
   transferDialog.current?.close();
  }
 });
 const openTransfer=(mode:'DEPOSIT'|'WITHDRAW',id?:GuildMaterial)=>{
  if(!state?.isLeader||expedition)return;
  setDirection(mode);if(id)setMaterial(id);
  setError('');transferDialog.current?.showModal();
 };
 const selectedAvailable=state?(direction==='WITHDRAW'?state.materials[material]:state.personal[material]):0;
 const amountNum=Number(amount);
 const validAmount=Number.isSafeInteger(amountNum)&&amountNum>=1&&amountNum<=Math.min(1000000000,selectedAvailable??0);
 const total=state?GUILD_MATERIAL_IDS.reduce((sum,id)=>sum+(state.materials[id]??0),0):0;
 const ledger=state?.ledger??[];
 const recentEntries=ledger.slice(0,3);
 const recentIn=ledger.reduce((sum,entry)=>sum+(entry.amount>0?entry.amount:0),0);
 const recentOut=ledger.reduce((sum,entry)=>sum+(entry.amount<0?-entry.amount:0),0);
 const ledgerRow=(entry:GuildMaterialLedger)=><article className="tc-gmc-record" key={entry.entryId}>
  <time dateTime={entry.createdAt}>{when(entry.createdAt)}</time>
  <span className="tc-gmc-record-name"><img src={assetUrl('assets/ui/crafting/'+entry.material+'.png')} alt="" loading="lazy"/><span><b>{GUILD_MATERIAL_NAMES[entry.material]}</b><small>{actionLabel(entry)} · {entry.actorName}</small></span></span>
  <strong className={entry.amount<0?'out':'in'}>{entry.amount<0?'−':'+'}{format(Math.abs(entry.amount))}개</strong>
  <span className={'tc-gmc-record-badge '+(entry.amount<0?'out':'in')}>{entry.amount<0?'출고':'입고'}</span>
 </article>;
 return <section className="tc-guild-materials tc-gmc" aria-label="원정단 재료 창고">
  <header className="tc-gmc-hero">
   <div className="tc-gmc-headrow"><button type="button" className="tc-gmc-back" onClick={onBack} aria-label="원정단 금고로 돌아가기">‹ <span>뒤로</span></button><strong>재료 창고</strong><button type="button" className="tc-gmc-info" onClick={()=>ledgerDialog.current?.showModal()} aria-label="재료 거래 내역 안내">ⓘ</button></div>
   <div className="tc-gmc-hero-text"><h2>재료 창고</h2><p>원정단 공동 보관품</p></div>
  </header>
  {!state?<div className="tc-gmc-loading" role="status">{error||'원정단 재료 창고 정보를 불러오는 중입니다.'}<button type="button" onClick={()=>void refresh()}>새로고침</button></div>:<>
   <div className="tc-gmc-summary" aria-label="재료 보관 현황">
    <div className="tc-gmc-summary-total"><span aria-hidden="true">▤</span><div><small>총 보관 재료</small><strong>{format(total)} <em>개</em></strong></div></div>
    <div className="tc-gmc-summary-movement"><span aria-hidden="true">⇄</span><div><small>최근 {ledger.length}건의 입출고</small><p><b className="in">↑ {format(recentIn)}개</b><b className="out">↓ {format(recentOut)}개</b></p></div></div>
   </div>
   <section className="tc-gmc-inventory" aria-label="보관 중인 재료">
    <h3><span>◈</span> 보관 중인 재료 <span>◈</span></h3>
    <div className="tc-gmc-material-grid">
     {GUILD_MATERIAL_IDS.map(id=><button key={id} type="button" className="tc-gmc-material" onClick={()=>openTransfer('WITHDRAW',id)} disabled={!state.isLeader||expedition} aria-label={GUILD_MATERIAL_NAMES[id]+' 보관 '+format(state.materials[id]??0)+'개'+(state.isLeader?' · 출고 관리':'')}>
      <img src={assetUrl('assets/ui/crafting/'+id+'.png')} alt="" loading="lazy"/>
      <span className="tc-gmc-material-copy"><b>{GUILD_MATERIAL_NAMES[id]}</b><strong>{format(state.materials[id]??0)} <small>개</small></strong></span>
     </button>)}
    </div>
   </section>
   <section className="tc-gmc-transfers" aria-label="재료 입출고">
    <h3><span>⇄</span> 재료 입출고</h3>
    <p>원정단 재료를 보관하거나 출고할 수 있습니다.</p>
    <div className="tc-gmc-transfer-actions">
     <button type="button" className="tc-gmc-deposit" onClick={()=>openTransfer('DEPOSIT')} disabled={!state.isLeader||expedition}><span aria-hidden="true">↧</span><span><b>입고</b><small>재료를 창고에 보관</small></span></button>
     <button type="button" className="tc-gmc-withdraw" onClick={()=>openTransfer('WITHDRAW')} disabled={!state.isLeader||expedition}><span aria-hidden="true">↥</span><span><b>출고</b><small>재료를 창고에서 인출</small></span></button>
    </div>
    {!state.isLeader&&<small className="tc-gmc-role">재료 입출고는 원정단장 전용입니다.</small>}
    {expedition&&<small className="tc-gmc-role">원정 중에는 재료를 입출고할 수 없습니다.</small>}
   </section>
   <section className="tc-gmc-records" aria-label="최근 재료 거래 기록">
    <div className="tc-gmc-records-heading"><h3>▤ 재료 거래 기록</h3><button type="button" onClick={()=>ledgerDialog.current?.showModal()}>전체 기록 보기 ›</button></div>
    <div className="tc-gmc-record-list">
     {recentEntries.length?recentEntries.map(ledgerRow):<p className="tc-gmc-empty">등록된 거래 기록이 없습니다.</p>}
    </div>
   </section>
  </>}
  {notice&&<p className="tc-gm-notice" role="status">{notice}</p>}
  {error&&<p className="tc-gm-error" role="alert">{error}</p>}
  <dialog ref={transferDialog} className="tc-gmc-dialog" aria-label="재료 입출고">
   <header><b>재료 입출고</b><button type="button" onClick={()=>transferDialog.current?.close()} aria-label="재료 입출고 창 닫기">닫기</button></header>
   {state?.isLeader&&<div className="tc-gmc-editor">
    <div className="tc-gm-tabs"><button type="button" className={direction==='DEPOSIT'?'active':''} disabled={busy||!!pending} onClick={()=>setDirection('DEPOSIT')}>입고</button><button type="button" className={direction==='WITHDRAW'?'active':''} disabled={busy||!!pending} onClick={()=>setDirection('WITHDRAW')}>출고</button></div>
    <GameScrollSelect ariaLabel="재료 선택" options={GUILD_MATERIAL_IDS.map(id=>({value:id,label:GUILD_MATERIAL_NAMES[id],detail:'창고 '+format(state.materials[id]??0)+'개 · 개인 '+format(state.personal[id]??0)+'개'}))} value={material} onChange={value=>setMaterial(value as GuildMaterial)} disabled={busy||!!pending}/>
    <label>수량 · 사용 가능 {format(selectedAvailable??0)}개
     <input type="number" min="1" max="1000000000" inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value)} disabled={busy||!!pending}/>
    </label>
    <div className="tc-gmc-presets">{[.25,.5,1].map(ratio=><button key={ratio} type="button" onClick={()=>setAmount(String(Math.floor(Math.min(1000000000,selectedAvailable??0)*ratio)))} disabled={busy||!!pending||selectedAvailable<1}>{ratio===1?'전액':ratio*100+'%'}</button>)}</div>
    <button type="button" className="tc-gmc-confirm" disabled={busy||expedition||!validAmount||!!pending} onClick={()=>send()}>{busy?'처리 중…':direction==='DEPOSIT'?'재료 입고하기':'재료 출고하기'}</button>
    {pending&&<div className="tc-gmc-retry"><p>이전 입출고 요청의 처리 상태를 확인해야 합니다.</p><button type="button" disabled={busy} onClick={()=>send(true)}>이전 요청 재확인</button></div>}
    {notice&&<p className="tc-gm-notice" role="status">{notice}</p>}
    {error&&<p className="tc-gm-error" role="alert">{error}</p>}
   </div>}
  </dialog>
  <dialog ref={ledgerDialog} className="tc-gmc-dialog tc-gmc-ledger-dialog" aria-label="원정단 재료 거래 내역">
   <header><b>재료 거래 기록</b><button type="button" onClick={()=>ledgerDialog.current?.close()} aria-label="재료 거래 내역 창 닫기">닫기</button></header>
   <div className="tc-gmc-ledger-body"><p>마을 채집 세금과 원정단장 입출고, 경매에 따른 재료 변동 기록입니다. 서버에서 제공하는 최근 기록을 표시합니다.</p>
    {ledger.length?ledger.map(ledgerRow):<p className="tc-gmc-empty">등록된 거래 기록이 없습니다.</p>}
   </div>
  </dialog>
 </section>;
}
