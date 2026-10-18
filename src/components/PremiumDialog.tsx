import React,{useEffect,useRef,useState} from 'react';
import type {GameState} from '../game/types';
import type {GameplayLease} from '../online/gameSession';
import type {CloudSaveRecord} from '../online/cloudSave';
import {getDeviceId} from '../online/cloudSave';
import {getFreshSession} from '../online/auth';
import {supabaseConfig} from '../online/config';
import './premium.css';
type Premium={active:boolean;expiresAt:number|null;gold:number;serverNow:number;record:CloudSaveRecord};
async function rpc(lease:GameplayLease,request?:string):Promise<Premium>{
 const session=await getFreshSession();if(!session||!supabaseConfig)throw Error('Google 로그인 후 이용할 수 있습니다.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+(request?'buy_premium_account':'get_premium_account'),{method:'POST',headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},body:JSON.stringify({p_lease_id:lease.leaseId,p_generation:lease.generation,p_client_instance_id:lease.clientInstanceId,p_device_id:getDeviceId(),...(request?{p_request_id:request}:{})})});
 const body=await response.text();if(!response.ok)throw Error(body.includes('PREMIUM_GOLD_SHORTAGE')?'골드가 부족합니다.':body.includes('PREMIUM_EXPEDITION_ACTIVE')?'원정을 마친 뒤 구매해 주세요.':body.includes('GAME_SESSION_LOST')?'플레이 권한이 변경되었습니다. 다시 접속해 주세요.':'요청을 확인하지 못했습니다. 같은 구매 요청으로 다시 확인해 주세요.');
 if((await getFreshSession())?.userId!==session.userId)throw Error('접속 계정이 변경되었습니다.');
 return JSON.parse(body);
}
const rows=[['사냥 경험치','기본','+10%'],['거래 수수료','10%','5%'],['매일 뽑기권','—','5장'],['은행 설립 자격','—','가능'],['스킬셋','1개','3개']];
const date=(value:number)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(value);
export function PremiumDialog({game,lease,onClose,onRecord,onPrepare,onPending}:{game:GameState;lease:GameplayLease|null;onClose:()=>void;onRecord:(record:CloudSaveRecord)=>void;onPrepare:()=>Promise<void>;onPending:(value:boolean)=>void}){
 const [state,setState]=useState<Premium|null>(null),[busy,setBusy]=useState(!!lease),[error,setError]=useState(''),[confirmed,setConfirmed]=useState(false),[success,setSuccess]=useState(false);
 const panel=useRef<HTMLElement>(null),request=useRef<string|null>(null),lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;const previous=document.activeElement as HTMLElement;panel.current?.focus();if(lease)void (async()=>{try{await onPrepare();if(!alive.current)return;onPending(true);const s=await rpc(lease);if(alive.current){setState(s);onRecord(s.record);}}catch(e){if(alive.current)setError(e instanceof Error?e.message:'계정을 확인하지 못했습니다.');}finally{onPending(false);if(alive.current)setBusy(false);}})();return()=>{alive.current=false;onPending(false);previous?.focus();};},[lease?.leaseId,lease?.generation]);
 const gold=state?.gold??game.market.gold,active=!!state?.active,expires=state?.expiresAt??0;
 const next=Math.max(expires,state?.serverNow??Date.now())+30*86400000;
 async function buy(){if(!lease||lock.current)return;if(!confirmed){setConfirmed(true);return;}lock.current=true;setBusy(true);setError('');request.current??=crypto.randomUUID();try{await onPrepare();if(!alive.current)return;onPending(true);const s=await rpc(lease,request.current);if(alive.current){setState(s);onRecord(s.record);setSuccess(true);setConfirmed(false);request.current=null;}}catch(e){if(alive.current)setError(e instanceof Error?e.message:'구매 요청을 확인해 주세요.');}finally{onPending(false);lock.current=false;if(alive.current)setBusy(false);}}
 return <div className="tc-premium-backdrop"><section className="tc-premium" ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="premium-title" onKeyDown={e=>{if(e.key==='Escape'&&!busy){e.stopPropagation();onClose();}if(e.key==='Tab'){const buttons=panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');if(buttons?.length){const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}}}>
 <header><div><small>TOWER CHRONICLES</small><h2 id="premium-title">프리미엄 계정</h2></div><button aria-label="프리미엄 닫기" disabled={busy} onClick={onClose}>×</button></header>
 <div className="tc-premium-price"><strong>1,000 <small>골드</small></strong><span>30일</span></div>
 <table><thead><tr><th>혜택</th><th>일반</th><th>프리미엄</th></tr></thead><tbody>{rows.map(row=><tr key={row[0]}>{row.map((cell,i)=>i===0?<th scope="row" key={i}>{cell}</th>:<td key={i}>{cell}</td>)}</tr>)}</tbody></table>
 <div className="tc-premium-info"><p>매일 00:00(KST) 뽑기권 자동 지급</p><p>은행 설립 자격 제공 · 은행 기능은 준비 중</p><p>만료 시 스킬셋 2·3 보존·잠금, 1번 사용</p></div>
 <div className="tc-premium-period">{active?<><b>이용 중</b><span>{date(expires)}까지</span></>:<><b>30일 이용권</b><span>자동 갱신 없음</span></>}<small>{confirmed?'구매 확인 · ':''}{active?'연장 후':'활성화 후'} {date(next)}까지</small></div>
 <div className="tc-premium-wallet"><span>보유 <b>{gold.toLocaleString()} 골드</b></span><span>구매 후 <b>{Math.max(0,gold-1000).toLocaleString()} 골드</b></span></div>
 <footer><p role={error?'alert':'status'}>{error||success?'':!lease?'Google 로그인 후 구매할 수 있습니다.':!state?'계정 확인 중…':game.expedition?'원정을 마친 뒤 구매해 주세요.':gold<1000?'골드가 부족합니다.':confirmed?'1,000골드를 사용합니다. 아래 버튼을 눌러 확정하세요.':'남은 기간에 30일 추가 · 자동 갱신 없음'}</p>{error&&<p role="alert">{error}</p>}{success&&<p role="status">프리미엄이 적용되었습니다.</p>}<button className="tc-feel-press" disabled={busy||!lease||!state||gold<1000||!!game.expedition} onClick={()=>void buy()}>{busy?'처리 중…':confirmed?'1,000골드 사용 확정':`1,000골드로 30일 ${active?'연장':'활성화'}`}</button></footer>
 </section></div>;
}
