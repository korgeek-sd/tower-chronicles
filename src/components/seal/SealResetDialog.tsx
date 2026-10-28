import React,{useEffect,useRef} from 'react';
import {ASSOCIATION_SEAL_RESET_COST} from '../../game/seal';
import './seal-reset-dialog.css';

export function SealResetDialog({sealName,level,rolls,busy,error,canConfirm,onCancel,onConfirm}:{
 sealName:string;level:number;rolls:number;busy:boolean;error:string;canConfirm:boolean;
 onCancel:()=>void;onConfirm:()=>void;
}){
 const dialog=useRef<HTMLDialogElement>(null);
 const cancel=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  const element=dialog.current;
  const previous=document.activeElement as HTMLElement|null;
  if(!element)return;
  element.showModal();cancel.current?.focus();
  return()=>{element.close();if(previous?.isConnected)previous.focus({preventScroll:true});};
 },[]);
 return <dialog ref={dialog} className="tc-seal-reset-dialog" aria-labelledby="seal-reset-title"
  aria-describedby="seal-reset-description" aria-busy={busy}
  onCancel={event=>{event.preventDefault();if(!busy)onCancel();}}
  onClick={event=>{if(event.target===event.currentTarget&&!busy)onCancel();}}
  onKeyDown={event=>{
   if(event.key!=='Tab')return;
   const controls=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
   const first=controls[0],last=controls[controls.length-1];
   if(!first){event.preventDefault();return;}
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }}>
  <div className="tc-seal-reset-panel">
   <header><small>협회 인장</small><h2 id="seal-reset-title">인장 재주조</h2></header>
   <p id="seal-reset-description"><strong>{sealName}</strong>을 다시 주조하시겠습니까?<br/>현재 단계와 사용한 주조 횟수가 초기화됩니다.</p>
   <dl className="tc-seal-reset-summary">
    <div><dt>현재 단계</dt><dd>{level}단계 <span>→ 0단계</span></dd></div>
    <div><dt>사용한 주조 횟수</dt><dd>{rolls}회 <span>→ 0회</span></dd></div>
    <div><dt>재주조 비용</dt><dd>{ASSOCIATION_SEAL_RESET_COST.toLocaleString()} <span>Gold</span></dd></div>
   </dl>
   <p className="tc-seal-reset-note">다른 인장은 유지됩니다.</p>
   {error&&<p className="tc-seal-reset-error" role="alert">{error}</p>}
   <footer>
    <button ref={cancel} type="button" disabled={busy} onClick={onCancel}>취소</button>
    <button type="button" className="tc-seal-reset-confirm tc-feel-press" data-game-feel="press"
     disabled={busy||!canConfirm} onClick={onConfirm}>{busy?'재주조 중…':'재주조 확인'}</button>
   </footer>
  </div>
 </dialog>;
}
