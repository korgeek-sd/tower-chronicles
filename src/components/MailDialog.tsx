import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {GameState} from '../game/types';
import type {GameplayLease} from '../online/gameSession';
import {applyOnlineEconomyToGame} from '../online/market';
import {getStoredSession} from '../online/auth';
import {loadGameMail,manageGameMail,mailBody,type GameMail} from '../online/mail';
import {marketItemName} from '../game/market/marketService';
import {equipmentItemName} from '../game/data/equipment';
import './mail-dialog.css';
type Props={userId:string|null;lease:GameplayLease|null;game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;onClose:()=>void;onUnread:(n:number)=>void};
export function MailDialog({userId,lease,game,setGame,onClose,onUnread}:Props){
 const dialog=useRef<HTMLDialogElement>(null),active=useRef(true),guard=useRef(false);
 const [mails,setMails]=useState<GameMail[]>([]),[selected,setSelected]=useState<string|null>(null),[filter,setFilter]=useState('all'),[busy,setBusy]=useState(false),[loading,setLoading]=useState(!!userId),[error,setError]=useState(''),[now,setNow]=useState(Date.now);
 const valid=()=>active.current&&userId===getStoredSession()?.userId;
 const accept=(rows:GameMail[])=>{setMails(rows);onUnread(rows.filter(m=>!m.read||!!m.attachment&&!m.claimed).length);};
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();active.current=true;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>{active.current=false;clearInterval(timer);dialog.current?.close();if(previous?.isConnected)previous.focus();};},[]);
 async function refresh(){if(!userId)return;setLoading(true);try{const result=await loadGameMail(userId);if(valid()){accept(result.mails);setError('');}}catch(e){if(valid())setError(e instanceof Error?e.message:'우편을 불러오지 못했습니다.');}finally{if(valid())setLoading(false);}}
 useEffect(()=>{void refresh();},[userId]);
 async function action(kind:'read'|'claim'|'claim_all'|'delete'|'delete_read',id?:string){
 if(!userId||!lease||guard.current)return;guard.current=true;setBusy(true);setError('');
 try{const result=await manageGameMail(userId,lease,kind,id);
 // Confirmed rewards must reach app state even if the dialog was closed meanwhile.
 if(userId===getStoredSession()?.userId&&result.economy)setGame(s=>applyOnlineEconomyToGame(s,result.economy!));
 if(valid()){accept(result.mails);if(kind==='delete')setSelected(null);}
 }catch(e){if(valid())setError(e instanceof Error?e.message:'우편 처리에 실패했습니다.');}finally{guard.current=false;if(active.current)setBusy(false);}
 }
 const visible=mails.filter(m=>m.expiresAt>now),mail=visible.find(m=>m.mailId===selected),canClaim=!!lease&&!game.expedition;
 const name=(m:GameMail)=>{const gear=m.details.gear??m.attachment?.gear;if(gear&&'grade' in gear)return equipmentItemName(gear);return marketItemName(game,m.details.itemId??m.attachment?.itemId??'');};
 const remaining=(m:GameMail)=>{const seconds=Math.max(0,Math.ceil((m.expiresAt-now)/1000));return seconds>=86400?`${Math.ceil(seconds/86400)}일 남음`:seconds>=3600?`${Math.ceil(seconds/3600)}시간 남음`:`${Math.ceil(seconds/60)}분 남음`;};
 return createPortal(<dialog ref={dialog} className="tc-mail-dialog" aria-labelledby="mail-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
 <header><div><small>ASSOCIATION POST</small><h2 id="mail-title">우편함</h2></div><button disabled={busy} aria-label="우편함 닫기" onClick={onClose}>×</button></header>
 {!userId?<p>Google 로그인 후 우편함을 이용할 수 있습니다.</p>:<>
 <nav aria-label="우편 분류">{[['all','전체'],['trade','거래'],['reward','보상'],['notice','공지']].map(([key,label])=><button key={key} disabled={busy} aria-pressed={filter===key} onClick={()=>{setFilter(key);setSelected(null);}}>{label}</button>)}</nav>
 {mail?<article><button disabled={busy} onClick={()=>setSelected(null)}>‹ 목록</button><h3>{mail.title}</h3><small>{new Date(mail.createdAt).toLocaleString('ko-KR')} · {remaining(mail)}</small><p className="tc-mail-body">{mailBody({...mail,details:{...mail.details,itemName:name(mail)}})}</p>
 {mail.attachment&&<div className="tc-mail-attachment"><b>{name(mail)} × {mail.attachment.quantity}</b><button disabled={busy||mail.claimed||!canClaim} onClick={()=>void action('claim',mail.mailId)}>{mail.claimed?'수령 완료':'받기'}</button></div>}
 <p className="tc-mail-expiry">도착 후 30일이 지나면 자동 삭제됩니다. 미수령 첨부 아이템도 함께 소멸하므로 기간 내 수령해 주세요.</p>
 {mail.attachment&&!mail.claimed&&!canClaim&&<p>첨부 아이템은 플레이 권한이 있는 기기의 거점에서 수령할 수 있습니다.</p>}
 <button disabled={busy||!lease||!!mail.attachment&&!mail.claimed} onClick={()=>void action('delete',mail.mailId)}>우편 삭제</button></article>:<section className="tc-mail-list" aria-label="우편 목록">
 {loading?<p>우편을 불러오는 중…</p>:visible.filter(m=>filter==='all'||m.category===filter).map(m=><button key={m.mailId} disabled={busy} className={m.read?'':'unread'} onClick={()=>{setSelected(m.mailId);if(!m.read)void action('read',m.mailId);}}><span><b>{!m.read&&<i aria-label="읽지 않음"/>}{m.title}</b><small>{m.attachment&&!m.claimed?'첨부 아이템 · ':''}{remaining(m)}</small></span><span>›</span></button>)}
 {!loading&&!visible.some(m=>filter==='all'||m.category===filter)&&<p>도착한 우편이 없습니다.</p>}
 </section>}
 <div role="status" className="tc-mail-status">{error}</div><footer><button disabled={busy||loading} onClick={()=>void refresh()}>새로고침</button><button disabled={busy||!lease} onClick={()=>void action('delete_read')}>읽은 우편 삭제</button><button disabled={busy||!canClaim||!visible.some(m=>m.attachment&&!m.claimed)} onClick={()=>void action('claim_all')}>모두 받기</button></footer>
 </>}
 </dialog>,document.body);
}
