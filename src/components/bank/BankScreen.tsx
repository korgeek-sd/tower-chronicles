import React,{useEffect,useRef,useState} from 'react';
import {Screen} from '../../ui/mobile';
import {serverBankApi,type ServerBankState,type BankAction,type BankResponse} from '../../online/bank';
import type {GameplayLease} from '../../online/gameSession';
import type {CloudSaveRecord} from '../../online/cloudSave';
import {TOWERS} from '../../game/data/config';
import type {Tower} from '../../game/types';
import './bank.css';
interface Props{userId?:string|null;lease?:GameplayLease|null;onPrepare?:()=>Promise<void>;onPending?:(busy:boolean)=>void;onRecord?:(record:CloudSaveRecord)=>void}
const noop=()=>{};
const ticketName=(id:string)=>`${TOWERS[id.split(':')[1] as Tower]?.name??id} 1층 도전권`;
const money=(n:number)=>n.toLocaleString()+' S';
const date=(n:number)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(n);
const labels:Record<string,string>={CREATE:'은행 설립',DEPOSIT:'추가 예치',WITHDRAW:'금고 출금',BORROW:'대출 실행',REPAID:'상환',AUTO_REPAID:'자동 상환',DEFAULTED:'담보 귀속',CLAIM_COLLATERAL:'귀속 도전권 수령'};
export function parseBankAmount(text:string):number|null{
 const digits=text.replace(/,/g,'');
 if(!/^\d*$/.test(digits))return null;
 const value=Number(digits);return Number.isSafeInteger(value)&&value<=1000000000000?value:null;
}
export function BankAmountInput({value,onChange}:{value:number;onChange:(value:number)=>void}){
 return <input type="text" inputMode="numeric" autoComplete="off" value={value===0?'':value.toLocaleString('en-US')} onChange={e=>{
  const input=e.currentTarget,next=parseBankAmount(input.value);if(next===null)return;
  const digitsBefore=input.value.slice(0,input.selectionStart??input.value.length).replace(/,/g,'').length;
  onChange(next);
  requestAnimationFrame(()=>{if(document.activeElement!==input)return;let digits=0,position=0;while(position<input.value.length&&digits<digitsBefore){if(/\d/.test(input.value[position]))digits++;position++;}input.setSelectionRange(position,position);});
 }}/>;
}
export function BankDirectory({banks,selectedId,onSelect,principal,sort,availableOnly}:{banks:ServerBankState['directory'];selectedId:string;onSelect:(id:string)=>void;principal:number;sort:'rate'|'vault';availableOnly:boolean}){
 const visible=[...banks].filter(b=>!availableOnly||(!b.isMine&&b.vault>=principal)).sort((a,b)=>sort==='rate'?a.rate-b.rate||a.name.localeCompare(b.name):b.vault-a.vault||a.name.localeCompare(b.name));
 return <div className="tc-bank-directory" aria-label="은행 목록">{visible.length?visible.map(b=><button type="button" key={b.id} className="tc-bank-choice tc-feel-press" aria-pressed={b.id===selectedId} disabled={b.isMine} onClick={()=>onSelect(b.id)}><span className="tc-bank-choice-info"><strong>{b.name}</strong><small>{b.durations.join(' · ')}일 · 금고 {money(b.vault)}</small><em>{b.isMine?'내 은행':b.vault>=principal?'대출 가능':'금고 부족'}</em></span><span className="tc-bank-choice-rate"><small>약정 이율</small><b>{b.rate}%</b></span></button>):<p className="tc-bank-empty">조건에 맞는 은행이 없습니다.</p>}</div>;
}
export function BankScreen({userId=null,lease=null,onPrepare=async()=>{},onPending=noop,onRecord=noop}:Props={}){
 const [state,setState]=useState<ServerBankState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[pending,setPending]=useState(false),[tick,setTick]=useState(0);
 const [name,setName]=useState(''),[amount,setAmount]=useState(1000000),[rate,setRate]=useState(10),[durations,setDurations]=useState<number[]>([5,10,15,30]);
 const [bankId,setBankId]=useState(''),[ticketId,setTicketId]=useState('ticket:ore:1'),[tickets,setTickets]=useState(1),[duration,setDuration]=useState(5);
 const [tab,setTab]=useState<'borrow'|'loans'|'manage'>('borrow'),[sort,setSort]=useState<'rate'|'vault'>('rate'),[availableOnly,setAvailableOnly]=useState(false);
 const [confirmation,setConfirmation]=useState<{action:BankAction;params:Record<string,unknown>;text:string}|null>(null);
 const confirmationDialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(confirmation&&!confirmationDialog.current?.open)confirmationDialog.current?.showModal();},[confirmation]);
 const alive=useRef(true),locked=useRef(false),received=useRef(performance.now()),sequence=useRef(0);
 useEffect(()=>{alive.current=true;const timer=setInterval(()=>setTick(x=>x+1),1000);return()=>{alive.current=false;sequence.current++;clearInterval(timer);};},[]);
 const serverNow=state?state.serverNow+Math.max(0,performance.now()-received.current):0;
 void tick;
 const api=()=>serverBankApi();
 function accept(result:BankResponse){setState(result.state);received.current=performance.now();onRecord(result.record);setPending(!!api().pending(userId!));}
 async function run(action?:BankAction,params:Record<string,unknown>={},retry=false){
  if(!userId||!lease||locked.current)return;
  const current=++sequence.current;locked.current=true;setBusy(true);setError('');setNotice('');
  try{
   await onPrepare();if(!alive.current||current!==sequence.current)return;onPending(true);
   const bank=api(),result=retry?await bank.retry(userId,lease):action?await bank.mutate(userId,lease,action,params):await bank.load(userId,lease);
   if(alive.current&&current===sequence.current){accept(result);if(action||retry){setConfirmation(null);setNotice(result.result?.status==='DEFAULTED'?'유예기간이 종료되어 담보가 귀속됐습니다.':'서버에서 거래 결과를 확인했습니다.');}}
  }catch(e){if(alive.current&&current===sequence.current)setError(e instanceof Error?e.message:'은행 요청을 확인하지 못했습니다.');}
  finally{onPending(false);locked.current=false;if(alive.current&&current===sequence.current){setBusy(false);try{setPending(!!api().pending(userId));}catch{}}}
 }
 useEffect(()=>{setState(null);setConfirmation(null);if(userId&&lease)void run();},[userId,lease?.leaseId,lease?.generation]);
 // Refresh only idle state; pending financial requests are always explicitly reconciled.
 useEffect(()=>{if(!userId||!lease)return;const timer=setInterval(()=>{if(!document.hidden&&!locked.current&&!confirmation&&!pending)void run();},60000);return()=>clearInterval(timer);},[userId,lease?.leaseId,lease?.generation,confirmation,pending]);
 if(!userId||!lease)return <Screen title="은행 · 담보 대출"><div className="tc-bank-card" role="status">Google 로그인 후 이 기기의 플레이 권한을 확인하면 은행을 이용할 수 있습니다.</div></Screen>;
 const selected=state?.directory.find(b=>b.id===bankId),penalized=!!state?.penaltyUntil&&state.penaltyUntil>serverNow;
 const confirm=(action:BankAction,params:Record<string,unknown>,text:string)=>setConfirmation({action,params,text});
 return <Screen title="은행·대출" className="tc-bank-compare-screen"><div className="tc-server-bank">

  <button type="button" disabled={busy} onClick={()=>void run()} className="tc-bank-refresh">새로고침</button>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {pending&&<div className="tc-bank-card" role="status"><b>결과 확인이 필요한 거래가 있습니다.</b><button disabled={busy} onClick={()=>void run(undefined,{},true)}>같은 요청으로 결과 확인</button></div>}
  {!state?<p role="status">은행 장부 확인 중…</p>:<>
   <div className="tc-bank-overview"><div><small>보유 실버</small><strong>{money(state.silver)}</strong></div><button type="button" onClick={()=>setTab('loans')}>내 대출 <b>{state.loans.filter(l=>l.status==='ACTIVE'||l.status==='GRACE_PERIOD').length}건</b> ›</button></div>
   <nav className="tc-bank-tabs" aria-label="은행 메뉴">{([['borrow','대출 이용'],['loans','내 대출'],['manage','은행 운영']] as const).map(([id,label])=><button type="button" key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</nav>
   {tab!=='borrow'&&<details><summary>대출 규칙</summary><p>1층 도전권 1장당 50,000 S · 약정 단리 · 만기 일시상환(중도상환 불가)</p><p>만기에 잔액이 충분하면 자동 상환합니다. 부족하면 24시간 유예하며, 종료 시 담보 귀속·채무 소멸 및 15일 신규 대출 제한이 적용됩니다.</p><p>서버가 매분 만기를 확인합니다. 담보는 맡긴 종류 그대로 반환합니다.</p></details>}
   {penalized&&<p role="status">미상환 제재: {date(state.penaltyUntil!)}까지 신규 대출 제한</p>}
   {tab==='borrow'&&<fieldset className="tc-bank-borrow" disabled={busy||pending||!!confirmation}>
    <legend>은행 선택</legend>
    {state.directory.length===0?<p>운영 중인 은행이 없습니다.</p>:<>
     {!selected&&<><div className="tc-bank-filters"><select aria-label="은행 정렬" value={sort} onChange={e=>setSort(e.target.value as 'rate'|'vault')}><option value="rate">낮은 이율순</option><option value="vault">금고 잔액순</option></select><label><input type="checkbox" checked={availableOnly} onChange={e=>setAvailableOnly(e.target.checked)}/>대출 가능</label></div>
     <BankDirectory banks={state.directory} selectedId={bankId} onSelect={id=>{setBankId(id);setDuration(state.directory.find(b=>b.id===id)!.durations[0]);}} principal={tickets*50000} sort={sort} availableOnly={availableOnly}/></>}
     {selected&&<><div className="tc-bank-selected"><button type="button" onClick={()=>setBankId('')}>‹ 은행 다시 선택</button><h2>선택한 조건</h2><p>{selected?`${selected.name} · 약정 이율 ${selected.rate}%`:'목록에서 은행을 선택하세요.'}</p></div><div className="tc-bank-fields">

     <label>담보 종류<select value={ticketId} onChange={e=>setTicketId(e.target.value)}>{Object.keys(TOWERS).map(t=>{const id=`ticket:${t}:1`;return <option key={id} value={id}>{ticketName(id)} · 보유 {state.tickets[id]??0}장</option>;})}</select></label>
     <label>담보 수량<input type="number" min={1} max={1000000} step={1} value={tickets} onChange={e=>setTickets(Number(e.target.value))}/></label>
     <label>기간<select value={duration} onChange={e=>setDuration(Number(e.target.value))}>{(selected?.durations??[5,10,15,30]).map(d=><option key={d} value={d}>{d}일</option>)}</select></label>
     </div><div className="tc-bank-totals"><span>대출금 <b>{money(tickets*50000)}</b></span><span>만기 상환액 <strong>{money(tickets*50000+Math.floor(tickets*50000*(selected?.rate??0)/100))}</strong></span></div>
     <button disabled={!selected||selected.isMine||penalized||!Number.isInteger(tickets)||tickets<1||tickets>(state.tickets[ticketId]??0)} onClick={()=>confirm('BORROW',{bankId,ticketId,tickets,duration},`${selected?.name}에 ${ticketName(ticketId)} ${tickets}장을 맡기고 ${money(tickets*50000)}를 대출합니다. 약정 이율 ${selected?.rate}% · ${duration}일 후 상환합니다.`)} className="tc-bank-apply">대출 조건 확인</button><p className="tc-bank-help">중도상환 불가 · 만기 일시상환</p></>}
    </>}
   </fieldset>}
   {tab==='loans'&&<section className="tc-bank-card"><h2>내 대출 현황</h2>{state.loans.length===0?<p>대출 계약이 없습니다.</p>:state.loans.map(l=><article className="tc-bank-card" key={l.id}><b>{l.bankName} · {({ACTIVE:'정상 이용',GRACE_PERIOD:'유예기간',REPAID:'상환 완료',DEFAULTED:'담보 귀속'} as const)[l.status]}</b><span>원금 {money(l.principal)} · 이자 {money(l.interest)}</span><span>담보: {ticketName(l.ticketId)} {l.tickets}장</span><span>만기 {date(l.maturityAt)} · 유예 종료 {date(l.graceAt)}</span>{l.status==='GRACE_PERIOD'&&<span>독촉 안내 {l.reminders}/4회</span>}{(l.status==='ACTIVE'||l.status==='GRACE_PERIOD')&&<button disabled={busy||pending||!!confirmation||serverNow<l.maturityAt||serverNow>=l.graceAt||state.silver<l.principal+l.interest} onClick={()=>confirm('REPAY',{loanId:l.id},`${money(l.principal+l.interest)}를 상환하고 담보 ${l.tickets}장을 반환받습니다.`)}>만기 상환</button>}</article>)}</section>}
   {tab==='manage'&&<fieldset disabled={busy||pending||!!confirmation}><legend>은행 운영</legend>
    {state.myBank?<><b>{state.myBank.name} · 금고 {money(state.myBank.vault)}</b><p>약정 이율 {state.myBank.rate}% · 지원 기간 {state.myBank.durations.join(', ')}일</p><label>입출금 금액<BankAmountInput value={amount} onChange={setAmount}/></label><div className="tc-bank-actions"><button disabled={!Number.isSafeInteger(amount)||amount<1} onClick={()=>confirm('DEPOSIT',{amount},`내 실버 ${money(amount)}를 은행 금고에 예치합니다.`)}>추가 예치</button><button disabled={!Number.isSafeInteger(amount)||amount<1||amount>state.myBank.vault} onClick={()=>confirm('WITHDRAW',{amount},`사용 가능한 금고 자금 ${money(amount)}를 내 지갑으로 출금합니다.`)}>금고 출금</button></div>{Object.entries(state.myBank.collateral).filter(([,n])=>n>0).map(([id,n])=><button key={id} onClick={()=>confirm('CLAIM_COLLATERAL',{ticketId:id},`귀속된 ${ticketName(id)} ${n}장을 수령합니다.`)}>{ticketName(id)} {n}장 수령</button>)}</>:state.premium?<><label>은행 이름<input value={name} maxLength={30} onChange={e=>setName(e.target.value)}/></label><label>초기 자본금<BankAmountInput value={amount} onChange={setAmount}/></label><label>약정 이율 (%)<input type="number" min={1} max={50} step={1} value={rate} onChange={e=>setRate(Number(e.target.value))}/></label><div className="tc-bank-duration-options">{[5,10,15,30].map(d=><label key={d}><input type="checkbox" checked={durations.includes(d)} onChange={e=>setDurations(e.target.checked?[...durations,d].sort((a,b)=>a-b):durations.filter(x=>x!==d))}/>{d}일</label>)}</div><button disabled={name.trim().length<2||!Number.isSafeInteger(amount)||amount<1000000||amount>state.silver||!Number.isInteger(rate)||rate<1||rate>50||!durations.length} onClick={()=>confirm('CREATE',{name:name.trim(),amount,rate,durations},`${money(amount)}를 자본금으로 예치해 ${name.trim()}을 설립합니다.`)}>은행 설립</button></>:<p>은행 설립은 프리미엄 계정 전용입니다.</p>}
   </fieldset>}
   {tab!=='borrow'&&<details><summary>최근 내 거래 내역 (최대 50건)</summary>{state.ledger.map(e=><p key={e.id}>{date(e.createdAt)} · {labels[e.kind]??e.kind} · 지갑 {e.walletDelta>=0?'+':''}{money(e.walletDelta)}{e.ticketDelta?` · 도전권 ${e.ticketDelta>0?'+':''}${e.ticketDelta}장`:''}</p>)}</details>}
  </>}
  {confirmation&&<dialog ref={confirmationDialog} className="tc-bank-confirm-dialog" aria-label="은행 거래 확인" onCancel={e=>{e.preventDefault();if(!busy&&!pending)setConfirmation(null);}}><h2>거래 확인</h2><p>{confirmation.text}</p><div className="tc-bank-actions"><button disabled={busy||pending} onClick={()=>void run(confirmation.action,confirmation.params)}>거래 확정</button><button disabled={busy} onClick={()=>setConfirmation(null)}>취소</button></div></dialog>}
 </div></Screen>;
}
