import React,{useEffect,useRef} from 'react';
export function MarketOrderSheet({title,name,art,balance,onClose,children}:{title:string;name:string;art:React.ReactNode;balance:string;onClose:()=>void;children:React.ReactNode}){
 const root=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,dialog=root.current;
  if(!dialog)return;
  dialog.showModal();dialog.querySelector<HTMLButtonElement>('button')?.focus();
  return()=>{dialog.close();if(previous?.isConnected)previous.focus({preventScroll:true});};
 },[]);
 return <dialog ref={root} className="tc-market-order-sheet" aria-modal="true" aria-labelledby="market-order-title" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <header className="tc-order-sheet-header"><span className="tc-order-sheet-art">{art}</span><div><h2 id="market-order-title">{title}</h2><small>{name}</small></div><button aria-label="주문창 닫기" onClick={onClose}>×</button></header>
  <div className="tc-order-sheet-balance">{balance}</div>
  <div className="tc-order-sheet-body">{children}</div>
 </dialog>;
}
