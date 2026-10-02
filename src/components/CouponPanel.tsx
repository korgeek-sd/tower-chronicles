import React,{useEffect,useRef,useState} from 'react';
import {couponAdminStatus,createAdminCoupon,listAdminCoupons,redeemCoupon,setCouponEnabled,type AdminCoupon,type CouponReward} from '../online/coupons';
import {getStoredSession} from '../online/auth';
const localDate=(d:Date)=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
export function CouponPanel({userId,onBusy,onRewardMail}:{userId:string|null;onBusy:(busy:boolean)=>void;onRewardMail:()=>void}){
 const [code,setCode]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[admin,setAdmin]=useState(false),[coupons,setCoupons]=useState<AdminCoupon[]>([]),[checking,setChecking]=useState(!!userId);
 const active=useRef(true),guard=useRef(false);
 const [name,setName]=useState(''),[adminCode,setAdminCode]=useState(''),[starts,setStarts]=useState(()=>localDate(new Date())),[expires,setExpires]=useState(()=>localDate(new Date(Date.now()+30*86400000))),[limit,setLimit]=useState(''),[silver,setSilver]=useState('0'),[gold,setGold]=useState('0'),[stones,setStones]=useState('0'),[tickets,setTickets]=useState('0');
 const valid=()=>active.current&&userId===getStoredSession()?.userId;
 useEffect(()=>{active.current=true;let cancelled=false;if(userId)void couponAdminStatus(userId).then(async allowed=>{if(cancelled||!valid())return;setAdmin(allowed);if(allowed){const rows=await listAdminCoupons(userId);if(!cancelled&&valid())setCoupons(rows);}}).catch(()=>{if(!cancelled&&valid())setMessage('관리자 권한을 확인하지 못했습니다. 쿠폰 입력은 이용할 수 있습니다.');}).finally(()=>{if(!cancelled&&valid())setChecking(false);});return()=>{cancelled=true;active.current=false;};},[userId]);
 async function run(task:()=>Promise<void>){if(!userId||guard.current)return;guard.current=true;setBusy(true);onBusy(true);setMessage('');try{await task();}catch(e){if(valid())setMessage(e instanceof Error?e.message:'처리하지 못했습니다.');}finally{guard.current=false;if(active.current){setBusy(false);onBusy(false);}}}
 async function redeem(){if(!userId)return;await run(async()=>{const result=await redeemCoupon(userId,code);if(valid()){setMessage(`${result.name} 보상이 우편함에 도착했습니다. 거점에서 수령해 주세요.`);setCode('');onRewardMail();}});}
 async function create(){if(!userId)return;await run(async()=>{
 const amounts=[silver,gold,stones,tickets];if(amounts.some(n=>!/^\d+$/.test(n)||!Number.isSafeInteger(Number(n))))throw Error('보상 수량은 0 이상의 정수로 입력해 주세요.');
 if(limit&&(!/^\d+$/.test(limit)||Number(limit)<1||Number(limit)>2147483647))throw Error('최대 사용 횟수는 양의 정수로 입력해 주세요.');
 const reward:CouponReward={silver:Number(silver),gold:Number(gold),items:[{id:'other:enhancement_stone',quantity:Number(stones)},{id:'other:job_draw_ticket',quantity:Number(tickets)}].filter(i=>i.quantity>0)};
 await createAdminCoupon(userId,{code:adminCode,name,reward,startsAt:new Date(starts).toISOString(),expiresAt:new Date(expires).toISOString(),maxUses:limit?Number(limit):undefined});
 const rows=await listAdminCoupons(userId);if(valid()){setCoupons(rows);setAdminCode('');setName('');setMessage('쿠폰을 생성했습니다.');}
 });}
 if(!userId)return <p>Google 로그인 후 쿠폰을 사용할 수 있습니다.</p>;
 return <div className="tc-coupon-panel"><h3>쿠폰 입력</h3><p>쿠폰은 계정당 한 번 사용할 수 있습니다. 보상은 우편으로 도착하며 도착 후 30일 안에 수령해 주세요.</p>
 <form onSubmit={e=>{e.preventDefault();void redeem();}}><label>쿠폰 코드<input value={code} maxLength={40} autoComplete="off" autoCapitalize="characters" onChange={e=>setCode(e.target.value)} disabled={busy} required/></label><button disabled={busy||!code.trim()}>{busy?'처리 중…':'쿠폰 사용'}</button></form>
 <p role="status">{message}</p>{checking&&<p>관리자 권한 확인 중…</p>}
 {admin&&<><h3>관리자 · 쿠폰 생성</h3><form onSubmit={e=>{e.preventDefault();void create();}}><fieldset disabled={busy}>
 <label>코드 (영문·숫자·밑줄·하이픈)<input value={adminCode} onChange={e=>setAdminCode(e.target.value)} pattern="[A-Za-z0-9_-]{3,40}" maxLength={40} required/></label>
 <label>쿠폰명<input value={name} onChange={e=>setName(e.target.value)} maxLength={80} required/></label>
 <label>시작일 · 이 기기의 시간<input type="datetime-local" value={starts} onChange={e=>setStarts(e.target.value)} required/></label><label>종료일 · 이 기기의 시간<input type="datetime-local" value={expires} onChange={e=>setExpires(e.target.value)} required/></label>
 <label>전체 최대 사용 횟수 · 비우면 무제한<input type="number" min="1" max="2147483647" step="1" value={limit} onChange={e=>setLimit(e.target.value)}/></label>
 {[[silver,setSilver,'실버',1000000000],[gold,setGold,'골드',1000000000],[stones,setStones,'강화석',1000000],[tickets,setTickets,'직능 등록권',1000000]].map(([value,setter,title,max])=><label key={String(title)}>{String(title)}<input type="number" min="0" max={Number(max)} step="1" value={String(value)} onChange={e=>(setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)} required/></label>)}
 <button>쿠폰 생성</button></fieldset></form><h3>최근 쿠폰</h3>{coupons.length===0?<p>등록된 쿠폰이 없습니다.</p>:coupons.map(c=><article key={c.couponId}><b>{c.name} · {c.code}</b><p>{c.usedCount} / {c.maxUses??'무제한'} 사용 · {c.enabled?'활성':'중지'}<br/>{new Date(c.startsAt).toLocaleString()} ~ {new Date(c.expiresAt).toLocaleString()}</p><button disabled={busy} onClick={()=>void run(async()=>{await setCouponEnabled(userId,c.couponId,!c.enabled);const rows=await listAdminCoupons(userId);if(valid()){setCoupons(rows);setMessage('쿠폰 상태를 변경했습니다.');}})}>{c.enabled?'사용 중지':'다시 활성화'}</button></article>)}</>}
 </div>;
}

