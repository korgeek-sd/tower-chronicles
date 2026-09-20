import React,{useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
export function CampBagDialog({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const el=dialog.current;if(!el)return;const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;el.showModal();
  const update=()=>{el.style.setProperty('--dialog-height',`${window.visualViewport?.height??window.innerHeight}px`);el.style.setProperty('--dialog-top',`${window.visualViewport?.offsetTop??0}px`);};
  update();window.visualViewport?.addEventListener('resize',update);window.visualViewport?.addEventListener('scroll',update);
  return()=>{window.visualViewport?.removeEventListener('resize',update);window.visualViewport?.removeEventListener('scroll',update);el.close();if(previous?.isConnected)previous.focus();};
 },[]);
 const content=<dialog ref={dialog} className="camp-dialog" aria-label={title} onCancel={e=>{e.preventDefault();close.current();}} onClick={e=>{if(e.target===e.currentTarget)close.current();}}><section className="camp-dialog-panel"><div className="camp-dialog-heading"><h2>{title}</h2><button type="button" aria-label="닫기" onClick={onClose}>×</button></div><div className="camp-dialog-content">{children}</div></section></dialog>;
 const host=typeof document==='undefined'?null:document.querySelector('.camp-bag-mode');return host?createPortal(content,host):content;
}
