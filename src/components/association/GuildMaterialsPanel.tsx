import React,{useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {GameScrollSelect} from '../../ui/GameScrollSelect';
import {
 getGuildMaterials,setGuildVillageTax,transferGuildMaterial,
 GUILD_MATERIAL_IDS,GUILD_MATERIAL_NAMES,
 type GuildMaterial,type GuildMaterialsState,
} from '../../online/guildMaterials';
import './guildMaterials.css';

const format=(n:number)=>Math.max(0,Math.trunc(n)).toLocaleString('ko-KR');
const pendingKey=(associationId:string)=>'tc-guild-material-transfer:'+associationId;
type Transfer={requestId:string;direction:'DEPOSIT'|'WITHDRAW';material:GuildMaterial;amount:number};
export function GuildMaterialsPanel({lease,associationId}:{lease:GameplayLease;associationId:string}){
 const [state,setState]=useState<GuildMaterialsState|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [direction,setDirection]=useState<'DEPOSIT'|'WITHDRAW'>('WITHDRAW');
 const [material,setMaterial]=useState<GuildMaterial>('herb'),[amount,setAmount]=useState('100');
 const [rates,setRates]=useState<Record<string,string>>({});
 const [pending,setPending]=useState<Transfer|null>(null);
 const mounted=useRef(true),locked=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const refresh=async()=>{try{const next=await getGuildMaterials(lease);if(mounted.current){setState(next);setError('');}}
 catch(e){if(mounted.current)setError(e instanceof Error?e.message:'길드 재료 창고를 불러오지 못했습니다.');}};
 useEffect(()=>{
  try{const raw=window.sessionStorage.getItem(pendingKey(associationId));setPending(raw?JSON.parse(raw) as Transfer:null);}catch{setPending(null);}
  void refresh();
 },[lease.leaseId,lease.generation,associationId]);
 const mutate=async(action:()=>Promise<void>)=>{
  if(locked.current)return;locked.current=true;setBusy(true);setError('');setNotice('');
  try{await action();}catch(e){if(mounted.current)setError(e instanceof Error?e.message:'재료 요청을 처리하지 못했습니다.');}
  finally{locked.current=false;if(mounted.current)setBusy(false);}
 };
 const changeTax=(townId:string,current:number)=>void mutate(async()=>{
  const rate=Number(rates[townId]??current);
  if(!Number.isInteger(rate)||rate<0||rate>30)throw Error('세율은 0~30% 사이의 정수로 설정해 주세요.');
  const result=await setGuildVillageTax(lease,townId,rate);
  if(mounted.current){setState(result);setRates(x=>({...x,[townId]:String(rate)}));setNotice('마을 세율을 '+rate+'%로 변경했습니다. 다음 변경은 24시간 뒤 가능합니다.');}
 });
 const send=(retry=false)=>void mutate(async()=>{
  const n=Number(amount);
  const request=retry?pending:pending??{requestId:crypto.randomUUID(),direction,material,amount:n};
  if(!request||!Number.isSafeInteger(request.amount)||request.amount<1||request.amount>1000000000)throw Error('수량은 1~10억 개 사이로 입력해 주세요.');
  if(!pending){window.sessionStorage.setItem(pendingKey(associationId),JSON.stringify(request));setPending(request);}
  const result=await transferGuildMaterial(lease,request.requestId,request.direction,request.material,request.amount);
  window.sessionStorage.removeItem(pendingKey(associationId));setPending(null);
  if(mounted.current){setState(result.state);setNotice(GUILD_MATERIAL_NAMES[request.material]+' '+format(request.amount)+'개 '+(request.direction==='DEPOSIT'?'입고':'인출')+' 완료 · 장부에 기록됐습니다.');}
 });
 if(!state)return <section className="tc-guild-materials"><b>마을 세금 · 재료 창고</b><p className="tc-gm-error">{error||'길드 재료 상태를 불러오는 중입니다.'}</p><button onClick={()=>void refresh()}>새로고침</button></section>;
 const available=direction==='WITHDRAW'?state.materials[material]:state.personal[material];
 return <section className="tc-guild-materials" aria-label="길드 재료 창고">
  <div className="tc-gm-title"><b>마을 세금 · 재료 창고</b><small>길드장 관리 · 모든 단원 기록 공개</small></div>
  <div className="tc-gm-balances">{GUILD_MATERIAL_IDS.map(id=><article key={id}><small>{GUILD_MATERIAL_NAMES[id]}</small><b>{format(state.materials[id]??0)}</b></article>)}</div>
  {state.isLeader&&<div className="tc-gm-editor">
   <div className="tc-gm-title"><b>재료 입출고</b><small>인출 후 개인 제작·거래 가능</small></div>
   <div className="tc-gm-tabs"><button type="button" className={direction==='WITHDRAW'?'active':''} onClick={()=>setDirection('WITHDRAW')} disabled={busy}>창고에서 인출</button><button type="button" className={direction==='DEPOSIT'?'active':''} onClick={()=>setDirection('DEPOSIT')} disabled={busy}>창고에 입고</button></div>
   <GameScrollSelect ariaLabel="재료 선택" options={GUILD_MATERIAL_IDS.map(id=>({value:id,label:GUILD_MATERIAL_NAMES[id],detail:'창고 '+format(state.materials[id]??0)+'개'}))} value={material} onChange={value=>setMaterial(value as GuildMaterial)} disabled={busy}/>
   <label>수량 · 사용 가능 {format(available??0)}개
    <input type="number" min="1" max="1000000000" inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value)} disabled={busy}/>
   </label>
   <button type="button" disabled={busy||!Number.isSafeInteger(Number(amount))||Number(amount)<1||Number(amount)>Math.min(1000000000,available??0)||!!pending} onClick={()=>send()}>
    {busy?'처리 중…':direction==='WITHDRAW'?'재료 인출':'재료 입고'}
   </button>
   {pending&&<button type="button" disabled={busy} onClick={()=>send(true)}>이전 입출고 결과 재확인</button>}
  </div>}
  <div className="tc-gm-title"><b>점령 마을 세율</b><small>0~30% · 변경 후 24시간 잠금</small></div>
  <div className="tc-gm-towns">
   {state.towns.filter(t=>t.owned).length?state.towns.filter(t=>t.owned).map(t=>{
    const until=t.changedAt?Date.parse(t.changedAt)+86400000:0;
    const cool=Date.now()<until;
    return <article key={t.townId}>
     <span>{t.name} <small>현 {t.rate}%{cool?' · 변경 대기':''}</small></span>
     {state.isLeader?<><input aria-label={t.name+' 세율'} type="number" min="0" max="30" value={rates[t.townId]??String(t.rate)} disabled={busy||cool} onChange={e=>setRates(x=>({...x,[t.townId]:e.target.value}))}/>
     <button type="button" disabled={busy||cool||!Number.isInteger(Number(rates[t.townId]??t.rate))||Number(rates[t.townId]??t.rate)<0||Number(rates[t.townId]??t.rate)>30} onClick={()=>changeTax(t.townId,t.rate)}>{cool?'잠김':'적용'}</button></>:<small>세율 {t.rate}%</small>}
    </article>;
   }):<p>현재 점령한 마을이 없습니다. 점령 후 기본 세율은 10%입니다.</p>}
  </div>
  <div className="tc-gm-title"><b>재료 거래 기록</b><small>최근 {state.ledger.length}건</small></div>
  <div className="tc-gm-ledger">
   {state.ledger.length?state.ledger.map(e=><article key={e.entryId}>
    <div><b>{e.operation==='GATHER_TAX'?'채집 세금':e.operation==='WITHDRAW'?'길드장 인출':e.operation==='DEPOSIT'?'길드장 입고':e.operation==='AUCTION_LIST'?'경매 등록':'경매 반환'}</b>
     <small> · {GUILD_MATERIAL_NAMES[e.material]} · {e.actorName}</small>
     <div><small>{new Date(e.createdAt).toLocaleString('ko-KR')} · {e.detail}</small></div></div>
    <strong>{e.amount>0?'+':''}{format(Math.abs(e.amount))}{e.amount<0?' 출고':' 입고'}</strong>
   </article>):<p>아직 재료 거래 내역이 없습니다.</p>}
  </div>
  {notice&&<p role="status" className="tc-gm-notice">{notice}</p>}
  {error&&<p role="alert" className="tc-gm-error">{error}</p>}
 </section>;
}
