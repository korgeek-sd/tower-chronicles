import {useEffect,useRef,useState} from 'react';
import {loadChatMessages,sendChatMessage,subscribeChatMessages,mergeChatMessages,validateChatBody,type ChatMessage,type ChatStatus} from '../online/chat';
import './world-chat.css';
export function WorldChat({userId,nickname,enabled}:{userId:string|null;nickname?:string;enabled:boolean}){
 const [open,setOpen]=useState(false),[messages,setMessages]=useState<ChatMessage[]>([]),[status,setStatus]=useState<ChatStatus>('connecting');
 const [draft,setDraft]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[unread,setUnread]=useState(0),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0),[cooldown,setCooldown]=useState(false);
 const [viewport,setViewport]=useState<{height:number;top:number}|null>(null);
 const openRef=useRef(open),busyRef=useRef(false),scroller=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),entry=useRef<HTMLButtonElement>(null);
 const request=useRef<{body:string;id:string}|null>(null),cooldownTimer=useRef<ReturnType<typeof setTimeout>|null>(null),nearBottom=useRef(true),loadGeneration=useRef(0);
 openRef.current=open;
 useEffect(()=>{
  if(!enabled||!userId)return;
  let disposed=false;
  const load=async()=>{
   const generation=++loadGeneration.current;setLoading(true);
   try{const history=await loadChatMessages();if(!disposed&&generation===loadGeneration.current){setMessages(old=>mergeChatMessages(old,history));setError('');}}
   catch(e){if(!disposed&&generation===loadGeneration.current)setError(e instanceof Error?e.message:'채팅을 불러오지 못했습니다.');}
   finally{if(!disposed&&generation===loadGeneration.current)setLoading(false);}
  };
  void load();
  const stop=subscribeChatMessages(userId,message=>{
   if(disposed)return;
   setMessages(old=>mergeChatMessages(old,[message]));
   if(!openRef.current&&message.userId!==userId)setUnread(n=>Math.min(99,n+1));
  },next=>{if(disposed)return;setStatus(next);if(next==='subscribed')void load();});
  const resume=()=>{if(document.visibilityState==='visible')void load();};
  document.addEventListener('visibilitychange',resume);
  return()=>{disposed=true;++loadGeneration.current;stop();document.removeEventListener('visibilitychange',resume);};
 },[userId,enabled,retry]);
 useEffect(()=>{if(!open||!window.visualViewport)return;const v=window.visualViewport;const update=()=>setViewport({height:v.height,top:v.offsetTop});update();v.addEventListener('resize',update);v.addEventListener('scroll',update);return()=>{v.removeEventListener('resize',update);v.removeEventListener('scroll',update);setViewport(null);};},[open]);
 useEffect(()=>()=>{if(cooldownTimer.current)clearTimeout(cooldownTimer.current);},[]);
 useEffect(()=>{if(open){nearBottom.current=true;setUnread(0);input.current?.focus();scroller.current?.scrollTo({top:scroller.current.scrollHeight});}},[open]);
 useEffect(()=>{if(open&&nearBottom.current)scroller.current?.scrollTo({top:scroller.current.scrollHeight});},[messages,open]);
 const close=()=>{setOpen(false);entry.current?.focus();};
 async function send(){
  if(!enabled||!userId||busyRef.current||cooldown)return;
  const {body,error:invalid}=validateChatBody(draft);if(invalid){setError(invalid);return;}
  if(request.current?.body!==body)request.current={body,id:crypto.randomUUID()};
  busyRef.current=true;setBusy(true);setError('');
  try{
   const message=await sendChatMessage(body,request.current.id);
   nearBottom.current=true;setMessages(old=>mergeChatMessages(old,[message]));setDraft('');request.current=null;setCooldown(true);
   cooldownTimer.current=setTimeout(()=>{setCooldown(false);cooldownTimer.current=null;},2000);
  }catch(e){setError(e instanceof Error?e.message:'전송하지 못했습니다.');}
  finally{busyRef.current=false;setBusy(false);input.current?.focus();}
 }
 return <>
  <button ref={entry} className="tc-chat-entry" aria-label={unread?`전체 채팅, 새 메시지 ${unread}개`:'전체 채팅'} aria-expanded={open} onClick={()=>setOpen(true)}>채팅{unread>0&&<b>{unread}</b>}</button>
  {open&&<div className="tc-chat-backdrop" style={viewport?{top:viewport.top,height:viewport.height,bottom:'auto'}:undefined} onClick={close}><section className="tc-chat-panel" style={viewport?{maxHeight:viewport.height}:undefined} role="dialog" aria-modal="true" aria-labelledby="tc-chat-title" onClick={e=>e.stopPropagation()} onKeyDown={e=>{
   if(e.key==='Escape')close();
   if(e.key==='Tab'){const items=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)'));const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
  }}>
   <header><div><small>NOVAR</small><h2 id="tc-chat-title">전체 채팅</h2></div><span className={'tc-chat-status '+status}>{!userId?'게스트':!enabled?'접속 대기':status==='subscribed'?'연결됨':status==='error'?'연결 오류':'재연결 중'}</span><button autoFocus={!enabled} aria-label="채팅 닫기" onClick={close}>×</button></header>
   {!enabled?<div className="tc-chat-empty">{userId?'플레이 세션이 연결되면 채팅을 이용할 수 있습니다.':'Google 로그인 후 닉네임을 정하면 채팅에 참여할 수 있습니다.'}</div>:<>
    <div className="tc-chat-log" ref={scroller} role="log" aria-label="전체 채팅 메시지" aria-live="polite" aria-relevant="additions" onScroll={()=>{const el=scroller.current;if(el)nearBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<60;}}>
     {loading&&messages.length===0?<p className="tc-chat-empty">기록을 불러오는 중…</p>:messages.length===0?<p className="tc-chat-empty">노바르의 탐험가들에게 첫 인사를 남겨보세요.</p>:messages.map(m=><article key={m.id} className={m.userId===userId?'mine':''}><div><b>{m.nickname}</b>{m.userId===userId&&<small>나</small>}<time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</time></div><p>{m.body}</p></article>)}
    </div>
    {error&&<div className="tc-chat-error" role="alert">{error}<button disabled={loading} onClick={()=>setRetry(n=>n+1)}>다시 연결</button></div>}
    <form onSubmit={e=>{e.preventDefault();void send();}}><label className="tc-chat-label" htmlFor="tc-chat-input">{nickname} · {[...draft.normalize('NFC')].length}/200</label><div><input id="tc-chat-input" ref={input} value={draft} disabled={busy} autoComplete="off" placeholder="메시지 입력" onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&e.nativeEvent.isComposing)e.preventDefault();}}/><button disabled={busy||cooldown||!!validateChatBody(draft).error}>{busy?'전송 중':cooldown?'잠시 대기':'전송'}</button></div><small>최근 50개 기록 · 200자 · 전송 간격 2초</small></form>
   </>}
  </section></div>}
 </>;
}
