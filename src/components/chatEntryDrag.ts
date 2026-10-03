import {readChatEntryPlacement,resolveChatEntryPlacement,saveChatEntryPlacement,type ChatEntryMode,type ChatEntryPlacement} from './chatEntryPlacement';
const CHAT_ENTRY_LONG_PRESS_MS=500,CHAT_ENTRY_MOVE_CANCEL_PX=10;
const enhanced=new WeakSet<HTMLButtonElement>();
type Gesture={pointerId:number;pointerType:string;startX:number;startY:number;lastX:number;lastY:number;active:boolean;cancelled:boolean;moved:boolean};
const modeOf=(entry:HTMLButtonElement):ChatEntryMode=>entry.parentElement?.classList.contains('tc-battle-mode')||entry.parentElement?.classList.contains('tc-event-mode')?'immersive':'normal';
const positionedTop=(placement:ChatEntryPlacement,mode:ChatEntryMode)=>`clamp(calc(env(safe-area-inset-top) + 8px),calc(${(placement.y*100).toFixed(2)}dvh - 22px),calc(100dvh - ${mode==='immersive'?'56px':'132px'} - env(safe-area-inset-bottom)))`;
function applyStored(entry:HTMLButtonElement){
 const mode=modeOf(entry),placement=readChatEntryPlacement(mode);entry.dataset.side=placement?.side??'';
 if(placement){entry.style.top=positionedTop(placement,mode);entry.style.bottom='auto';}else{entry.style.removeProperty('top');entry.style.removeProperty('bottom');}
}
function enhance(entry:HTMLButtonElement){
 if(enhanced.has(entry))return;enhanced.add(entry);entry.title='짧게 눌러 채팅 열기 · 길게 눌러 위치 이동';
 let timer:ReturnType<typeof setTimeout>|null=null,suppressUntil=0,gesture:Gesture|null=null;
 const clearTimer=()=>{if(timer){clearTimeout(timer);timer=null;}};
 const positionAt=(clientX:number,clientY:number)=>{
  const width=entry.offsetWidth||(modeOf(entry)==='immersive'?44:62),height=entry.offsetHeight||44;
  entry.style.left=`${Math.max(8,Math.min(window.innerWidth-width-8,clientX-width/2))}px`;entry.style.right='auto';
  entry.style.top=`${Math.max(8,Math.min(window.innerHeight-height-8,clientY-height/2))}px`;entry.style.bottom='auto';
 };
 const cleanupWindowListeners=()=>{
  window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',finishPointer,true);window.removeEventListener('pointercancel',cancelPointer,true);
 };
 const beginDrag=()=>{
  timer=null;if(!gesture||gesture.cancelled)return;gesture.active=true;entry.dataset.dragging='true';positionAt(gesture.lastX,gesture.lastY);try{navigator.vibrate?.(10);}catch{}
 };
 const move=(event:PointerEvent)=>{
  if(!gesture||gesture.pointerId!==event.pointerId)return;gesture.lastX=event.clientX;gesture.lastY=event.clientY;
  const distance=Math.hypot(event.clientX-gesture.startX,event.clientY-gesture.startY);if(distance>CHAT_ENTRY_MOVE_CANCEL_PX)gesture.moved=true;
  if(!gesture.active){if(gesture.pointerType!=='mouse'&&distance>CHAT_ENTRY_MOVE_CANCEL_PX){gesture.cancelled=true;clearTimer();suppressUntil=Date.now()+300;}return;}
  event.preventDefault();positionAt(event.clientX,event.clientY);
 };
 const finish=(event:PointerEvent,cancel=false)=>{
  if(!gesture||gesture.pointerId!==event.pointerId)return;clearTimer();const current=gesture;gesture=null;cleanupWindowListeners();entry.removeAttribute('data-dragging');
  if(current.active&&!cancel){const mode=modeOf(entry),next=resolveChatEntryPlacement(event.clientX,event.clientY,window.innerWidth,window.innerHeight);saveChatEntryPlacement(mode,next);suppressUntil=Date.now()+400;entry.style.removeProperty('left');entry.style.removeProperty('right');entry.dataset.side=next.side;entry.style.top=positionedTop(next,mode);entry.style.bottom='auto';}
  else{if(current.cancelled||current.moved)suppressUntil=Date.now()+300;entry.style.removeProperty('left');entry.style.removeProperty('right');applyStored(entry);}
  try{entry.releasePointerCapture(event.pointerId);}catch{}
 };
 function finishPointer(event:PointerEvent){finish(event);}
 function cancelPointer(event:PointerEvent){finish(event,true);}
 const parent=entry.parentElement;const modeObserver=parent?new MutationObserver(()=>applyStored(entry)):null;modeObserver?.observe(parent!,{attributes:true,attributeFilter:['class']});
 applyStored(entry);
 entry.addEventListener('pointerdown',event=>{
  if(event.pointerType==='mouse'&&event.button!==0)return;clearTimer();cleanupWindowListeners();suppressUntil=0;
  gesture={pointerId:event.pointerId,pointerType:event.pointerType,startX:event.clientX,startY:event.clientY,lastX:event.clientX,lastY:event.clientY,active:false,cancelled:false,moved:false};
  try{entry.setPointerCapture(event.pointerId);}catch{}
  window.addEventListener('pointermove',move,{capture:true,passive:false});window.addEventListener('pointerup',finishPointer,true);window.addEventListener('pointercancel',cancelPointer,true);
  timer=setTimeout(beginDrag,CHAT_ENTRY_LONG_PRESS_MS);
 });
 entry.addEventListener('contextmenu',event=>event.preventDefault());entry.addEventListener('dragstart',event=>event.preventDefault());
 entry.addEventListener('click',event=>{if(Date.now()>=suppressUntil)return;event.preventDefault();event.stopPropagation();},false);
}
function scan(){document.querySelectorAll<HTMLButtonElement>('.tc-chat-entry').forEach(enhance);}
scan();new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
