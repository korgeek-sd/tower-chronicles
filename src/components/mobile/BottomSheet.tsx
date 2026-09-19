import React,{useEffect,useRef} from 'react';

export function BottomSheet({open,title,onClose,children}:{
  open:boolean;
  title:string;
  onClose:()=>void;
  children:React.ReactNode;
}){
  const closeRef=useRef<HTMLButtonElement>(null);

  useEffect(()=>{
    if(!open)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape')onClose();
    };
    document.addEventListener('keydown',onKey);
    closeRef.current?.focus();
    return()=>{
      document.removeEventListener('keydown',onKey);
      previous?.focus();
    };
  },[open,onClose]);

  if(!open)return null;
  return <div className="bottom-sheet-backdrop" onMouseDown={event=>{if(event.currentTarget===event.target)onClose();}}>
    <section className="bottom-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="bottom-sheet-header">
        <h2>{title}</h2>
        <button ref={closeRef} type="button" className="bottom-sheet-close" onClick={onClose} aria-label="닫기">×</button>
      </div>
      <div className="bottom-sheet-body">{children}</div>
    </section>
  </div>;
}
