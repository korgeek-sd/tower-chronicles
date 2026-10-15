import React,{useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {GUILD_MATERIAL_IDS,GUILD_MATERIAL_NAMES,setGuildVillageTax} from '../../online/guildMaterials';
import {getGuildTerritoryState,type GuildTerritoryTown,type GuildTerritoryState} from '../../online/guildTerritory';
import './guildTerritory.css';

const number=(n:number)=>Math.max(0,Math.trunc(n)).toLocaleString('ko-KR');
const fmtDate=(at:string|null)=>at?new Date(at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'기록 없음';
const kindLabel=(kind:GuildTerritoryTown['kind'])=>kind==='city'?'중앙 도시':kind==='herb'?'약초 마을':'농경 마을';
const taxDetails=(items:GuildTerritoryTown['todayMaterials'])=>
 GUILD_MATERIAL_IDS.filter(id=>(items[id]??0)>0).map(id=>GUILD_MATERIAL_NAMES[id]+' '+number(items[id]??0)).join(' · ')||'징수 없음';

export function GuildTerritoryPanel({lease,associationId}:{lease:GameplayLease;associationId:string}){
 const [state,setState]=useState<GuildTerritoryState|null>(null);
 const [selected,setSelected]=useState<string|null>(null);
 const [mineOnly,setMineOnly]=useState(false);
 const [rate,setRate]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [now,setNow]=useState(Date.now());
 const offset=useRef(0),active=useRef(true),locked=useRef(false);
 const load=async()=>{
  try{
   const next=await getGuildTerritoryState(lease);
   if(!active.current)return;
   offset.current=next.serverNow-Date.now();
   setState(next);setNow(next.serverNow);setError('');
   setSelected(previous=>previous&&next.towns.some(t=>t.townId===previous)?previous:next.towns.find(t=>t.owned)?.townId??next.towns[0]?.townId??null);
  }catch(e){if(active.current)setError(e instanceof Error?e.message:'영지 현황을 불러오지 못했습니다.');}
 };
 useEffect(()=>{
  active.current=true;setState(null);setSelected(null);setRate('');setMineOnly(false);
  void load();
  const tick=window.setInterval(()=>setNow(Date.now()+offset.current),10000);
  const focus=()=>{if(!document.hidden&&!locked.current)void load();};
  window.addEventListener('focus',focus);
  return()=>{active.current=false;window.clearInterval(tick);window.removeEventListener('focus',focus);};
 },[lease.leaseId,lease.generation,associationId]);
 const town=state?.towns.find(t=>t.townId===selected);
 const chosen=town?.townId??'';
 const changeSelection=(id:string)=>{setSelected(id);setRate('');setNotice('');setError('');};
 const applyTax=async()=>{
  if(!town||!state?.isLeader||!town.owned||locked.current)return;
  const value=Number(rate===''?town.rate:rate);
  if(!Number.isInteger(value)||value<0||value>30){setError('세율은 0~30%의 정수로 입력해 주세요.');return;}
  if(value===town.rate)return;
  locked.current=true;setBusy(true);setNotice('');setError('');
  try{
   await setGuildVillageTax(lease,town.townId,value);
   await load();
   if(active.current){setRate('');setNotice(town.name+' 세율이 '+value+'%로 변경됐습니다. 다음 변경은 24시간 후 가능합니다.');}
  }catch(e){if(active.current)setError(e instanceof Error?e.message:'마을 세율 변경 실패');}
  finally{locked.current=false;if(active.current)setBusy(false);}
 };
 if(!state)return <section className="tc-territory" aria-label="영지 관리"><div className="tc-territory-head"><h2>영지 관리</h2><span>11개 마을</span></div><p role="status">{error||'영지 운영 기록을 불러오는 중입니다.'}</p><button className="tc-territory-refresh" onClick={()=>void load()}>다시 불러오기</button></section>;
 const owned=state.towns.filter(t=>t.owned);
 const visible=mineOnly?owned:state.towns;
 const cooldownEnds=town?.changedAt&&town.owned?Date.parse(town.changedAt)+86400000:0;
 const cooldownLeft=Math.max(0,cooldownEnds-now);
 const next=rate===''?(town?.rate??0):Number(rate);
 const allowed=Number.isInteger(next)&&next>=0&&next<=30&&next!==town?.rate;
 return <section className="tc-territory" aria-label="영지 관리">
  <header className="tc-territory-head">
   <div><small>GUILD TERRITORY</small><h2>영지 관리</h2><p>점령 기록과 실제 채집 세금 수익</p></div>
   <button type="button" className="tc-territory-refresh" disabled={busy} onClick={()=>void load()}>새로고침</button>
  </header>
  <div className="tc-territory-stats">
   <article><small>점령 영지</small><b>{state.ownedCount}<span> / {state.totalCount}</span></b></article>
   <article><small>오늘 징수</small><b>{number(state.todayTax)}<span> 개</span></b></article>
   <article><small>7일 징수</small><b>{number(state.weekTax)}<span> 개</span></b></article>
   <article><small>현재 재료 창고</small><b>{number(state.stockTotal)}<span> 개</span></b></article>
  </div>
  <div className="tc-territory-toolbar">
   <strong>영지 목록 <span>{visible.length}곳</span></strong>
   <div role="group" aria-label="영지 목록 필터">
    <button type="button" className={!mineOnly?'active':''} aria-pressed={!mineOnly} onClick={()=>setMineOnly(false)}>전체 11</button>
    <button type="button" className={mineOnly?'active':''} aria-pressed={mineOnly} onClick={()=>setMineOnly(true)}>우리 영지 {owned.length}</button>
   </div>
  </div>
  <div className="tc-territory-scroll">
   <div className="tc-territory-towns">
    {visible.map(t=><button type="button" key={t.townId}
     onClick={()=>changeSelection(t.townId)} aria-pressed={selected===t.townId}
     className={'tc-territory-town'+(t.owned?' own':'')+(selected===t.townId?' selected':'')}>
     <span className="tc-territory-town-head"><b>{t.name}</b><small>{t.owned?'우리 영지':t.ownerAssociationId?'타 길드':'중립'}</small></span>
     <span>{kindLabel(t.kind)} · 세율 {t.rate}%</span>
     <span>점령: {t.ownerName}</span>
    </button>)}
   </div>
   {visible.length===0&&<p className="tc-territory-empty">점령 중인 마을이 없습니다. 전체 목록에서 각 마을의 소유권을 확인할 수 있습니다.</p>}
   {town&&<section className="tc-territory-detail" aria-label={town.name+' 운영 정보'}>
    <div className="tc-territory-section-title"><h3>{town.name}</h3><span>{kindLabel(town.kind)}</span></div>
    <div className="tc-territory-info">
     <div><small>현재 점령 길드</small><b>{town.ownerName}</b></div>
     <div><small>점령 확정</small><b>{fmtDate(town.occupiedAt)}</b></div>
     <div><small>현재 세율</small><b>{town.rate}%</b></div>
    </div>
    <div className="tc-territory-revenue">
     <div><small>오늘 우리 길드 징수</small><b>{number(town.todayTax)}개</b><p>{taxDetails(town.todayMaterials)}</p></div>
     <div><small>최근 7일 우리 길드 징수</small><b>{number(town.weekTax)}개</b><p>{taxDetails(town.weekMaterials)}</p></div>
    </div>
    <p className="tc-territory-note">이 수익은 현재 소유 여부와 무관하게 해당 마을에서 실제로 우리 길드에 적립된 세금만 계산합니다.</p>
    {state.isLeader&&town.owned&&<div className="tc-territory-tax">
      <div><b>마을 채집 세율 변경</b><small>0~30% · 마지막 변경 이후 24시간 제한</small></div>
      <div className="tc-territory-tax-controls">
       <label><span>세율 (%)</span><input type="number" inputMode="numeric" min="0" max="30"
        value={rate===''?town.rate:rate} disabled={busy||cooldownLeft>0}
        onChange={e=>setRate(e.target.value)}/></label>
       <button type="button" disabled={busy||cooldownLeft>0||!allowed} onClick={()=>void applyTax()}>
        {busy?'적용 중':cooldownLeft>0?'변경 대기':'세율 적용'}
       </button>
      </div>
      {cooldownLeft>0&&<p role="status">다음 세율 변경: {fmtDate(new Date(cooldownEnds).toISOString())} (서버 기준)</p>}
     </div>}
    {!state.isLeader&&town.owned&&<p className="tc-territory-note">세율 변경 권한은 길드장에게 있습니다.</p>}
   </section>}
   <section className="tc-territory-history" aria-label="최근 공성전 정산 기록">
    <div className="tc-territory-section-title"><h3>최근 점령전 기록</h3><span>최대 20건</span></div>
    {state.history.length?state.history.map(h=><article key={h.eventId}>
     <div><b>{h.townName}</b><small>{fmtDate(h.settledAt)}</small></div>
     <p>{h.previousOwner} → {h.outcome==='UNDECIDED'?'승자 없음 · 소유권 유지':h.winner}</p>
     <span>{h.outcome==='CAPTURED'?'점령 변경':h.outcome==='DEFENDED'?'기존 길드 방어':'소유권 유지'}</span>
    </article>):<p className="tc-territory-empty">아직 정산된 마을 공성전 기록이 없습니다.</p>}
   </section>
  </div>
  {notice&&<p role="status" className="tc-territory-notice">{notice}</p>}
  {error&&<p role="alert" className="tc-territory-error">{error}</p>}
 </section>;
}
