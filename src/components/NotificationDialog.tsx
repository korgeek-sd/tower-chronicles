import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {enableNativePush,isAndroidPushAvailable} from '../online/nativePush';
import {getGameNotifications,readGameNotifications,type GameNotification,type GameNotificationTarget} from '../online/notifications';
import './notification-dialog.css';

type Props={userId:string|null;onClose:()=>void;onNavigate:(target:GameNotificationTarget)=>void;onUnread:(n:number)=>void};
const labels:Record<GameNotification['category'],string>={trade:'거래',mail:'우편',bank:'은행',auction:'경매',war:'전쟁'};
const validTarget=(s:string):s is GameNotificationTarget=>['home','mail','gold-exchange','bank','association','occupation'].includes(s);

export function NotificationDialog({userId,onClose,onNavigate,onUnread}:Props){
 const dialog=useRef<HTMLDialogElement>(null);
 const [items,setItems]=useState<GameNotification[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [status,setStatus]=useState('');
 const [filter,setFilter]=useState('all');
 const mounted=useRef(true);
 useEffect(()=>{
  mounted.current=true;dialog.current?.showModal();
  return()=>{mounted.current=false;dialog.current?.close();};
 },[]);
 const refresh=async()=>{
  if(!userId)return;
  setBusy(true);setError('');
  try{
   const result=await getGameNotifications(userId);
   if(mounted.current){setItems(result.items);onUnread(result.unread);}
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'알림 확인 실패');}
  finally{if(mounted.current)setBusy(false);}
 };
 useEffect(()=>{void refresh();},[userId]);
 const mark=async(ids:string[]|null)=>{
  if(!userId||busy)return;
  setBusy(true);setError('');
  try{
   const result=await readGameNotifications(userId,ids);
   if(mounted.current){setItems(result.items);onUnread(result.unread);}
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'알림 처리 실패');}
  finally{if(mounted.current)setBusy(false);}
 };
 const open=async(item:GameNotification)=>{
  if(!item.read)await mark([item.id]);
  onClose();
  onNavigate(validTarget(item.target)?item.target:'home');
 };
 const visible=filter==='all'?items:items.filter(n=>n.category===filter);
 return createPortal(<dialog ref={dialog} className="tc-notif-dialog" aria-labelledby="tc-notif-title" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <header><div><small>RECORD / NOTICE</small><h2 id="tc-notif-title">알림</h2></div><button type="button" onClick={onClose} aria-label="알림 닫기">×</button></header>
  <nav aria-label="알림 종류">{[['all','전체'],['trade','거래'],['mail','우편'],['bank','은행'],['auction','경매'],['war','전쟁']].map(([key,value])=><button key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{value}</button>)}</nav>
  <section className="tc-notif-list" aria-label="알림 내역">
  {!userId?<p className="empty">Google 로그인 후 이용할 수 있습니다.</p>:!visible.length?<p className="empty">{busy?'알림을 불러오는 중입니다.':'새로운 알림이 없습니다.'}</p>:visible.map(item=><button type="button" key={item.id} className={item.read?'':'unread'} onClick={()=>void open(item)}>
   <span className="category">{labels[item.category]??'알림'}</span><span className="info"><strong>{item.title}</strong><span>{item.body}</span><time>{new Date(item.createdAt).toLocaleString('ko-KR')}</time></span><span className="arrow">›</span>
  </button>)}
  </section>
  <footer><div className="tc-notif-actions"><button type="button" disabled={busy} onClick={()=>void refresh()}>새로고침</button><button type="button" disabled={busy||!userId||!items.some(n=>!n.read)} onClick={()=>void mark(null)}>모두 읽음</button></div>
   {isAndroidPushAvailable()&&userId&&<button type="button" className="tc-notif-push" onClick={()=>void enableNativePush(userId).then(setStatus).catch(e=>setError(e instanceof Error?e.message:'푸시 등록 실패'))}>휴대전화 알림 허용</button>}
   <p role="status">{error||status}</p>
  </footer>
 </dialog>,document.body);
}
