// Lucian UX/UI Prompt #070 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#070
// Lucian UX/UI Prompt #083 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#083
import React,{useEffect,useRef,useState} from 'react';
import {PRODUCT_NAMES} from '../../game/life/crafting';
import type {ConfirmedCraftResult} from './CraftScreen';
import './craft-feedback.css';
export function CraftPendingIndicator(){return <div className="ux u083 tc-craft-pending"><div className="u083-trk" role="progressbar" aria-label="제작 요청 처리 중" aria-valuemin={0} aria-valuemax={100}><span className="u083-seg a" aria-hidden="true"/><span className="u083-seg b" aria-hidden="true"/></div></div>;}
type ToastProps={receipt:ConfirmedCraftResult;index:number;open:boolean;offset?:number;onDismiss:(id:string)=>void;onHeight:(id:string,height:number)=>void};
export function CraftReceiptToast({receipt,index,open,offset=0,onDismiss,onHeight}:ToastProps){
 const ref=useRef<HTMLDivElement>(null),pointer=useRef<{id:number;x:number}|null>(null);
 const [enter,setEnter]=useState(true),[left,setLeft]=useState(4500),[drag,setDrag]=useState<number|null>(null),[leaving,setLeaving]=useState(0);
 useEffect(()=>{const raf=requestAnimationFrame(()=>setEnter(false));onHeight(receipt.requestId,ref.current?.offsetHeight??68);return()=>cancelAnimationFrame(raf);},[receipt.requestId,onHeight]);
 useEffect(()=>{if(open||index>0||leaving)return;const timer=setInterval(()=>setLeft(n=>Math.max(0,n-50)),50);return()=>clearInterval(timer);},[open,index,leaving]);
 useEffect(()=>{if(left===0)setLeaving(1);},[left]);
 useEffect(()=>{if(!leaving)return;const timer=setTimeout(()=>onDismiss(receipt.requestId),450);return()=>clearTimeout(timer);},[leaving,onDismiss,receipt.requestId]);
 const end=()=>{if(!pointer.current)return;pointer.current=null;if(Math.abs(drag??0)>90)setLeaving((drag??0)>0?2:-2);setDrag(null);};
 const style={'--c':'var(--ux-mint)','--y':`${open?-offset:-index*14}px`,'--s':open?1:1-index*.06,'--o':drag===null?1:Math.max(.2,1-Math.abs(drag)/260),'--dx':`${drag??0}px`,'--left':left/4500,'--dir':leaving<0?-1:1,zIndex:50-index} as React.CSSProperties;
 return <div ref={ref} className={'u070-t'+(enter?' enter':'')+(!open&&index>0?' back':'')+(drag!==null?' drag':'')+(leaving?' leave'+(Math.abs(leaving)===2?' side':''):'')} style={style} role="status" inert={!open&&index>0} onPointerDown={e=>{if((e.target as HTMLElement).closest('button'))return;pointer.current={id:e.pointerId,x:e.clientX};setDrag(0);e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(pointer.current?.id===e.pointerId)setDrag(e.clientX-pointer.current.x);}} onPointerUp={end} onPointerCancel={()=>{pointer.current=null;setDrag(null);}}>
  <span className="u070-ic" aria-hidden="true"><svg viewBox="0 0 18 18"><path d="M4 9.4l3.2 3.2L14 5.6"/></svg></span><span className="u070-tx"><b>{PRODUCT_NAMES[receipt.product]} {receipt.quantity.toLocaleString()}개 제작 완료</b><small>완성품을 가방에 보관했습니다.</small></span><button className="u070-x" type="button" aria-label="알림 닫기" onClick={e=>{e.stopPropagation();setLeaving(1);}}><svg viewBox="0 0 14 14"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7"/></svg></button><span className="u070-bar" aria-hidden="true"/>
 </div>;
}
export function CraftReceiptNotifications({receipts,onDismiss}:{receipts:ConfirmedCraftResult[];onDismiss:(id:string)=>void}){
 const [open,setOpen]=useState(false),[heights,setHeights]=useState<Record<string,number>>({});
 const onHeight=React.useCallback((id:string,height:number)=>setHeights(v=>v[id]===height?v:{...v,[id]:height}),[]);
 useEffect(()=>{if(!receipts.length)setOpen(false);setHeights(previous=>Object.fromEntries(receipts.map(r=>[r.requestId,previous[r.requestId]??68])));},[receipts]);
 let offset=0;
 return <div className="ux u070 tc-craft-notifications"><div className="u070-zone" role="region" aria-label="제작 완료 알림" onPointerEnter={e=>{if(e.pointerType==='mouse')setOpen(true);}} onPointerLeave={e=>{if(e.pointerType==='mouse'&&!e.currentTarget.contains(document.activeElement))setOpen(false);}} onFocus={()=>setOpen(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}} onClick={e=>{if(!(e.target as HTMLElement).closest('button')&&receipts.length>1)setOpen(v=>!v);}}>
 {receipts.map((receipt,index)=>{const y=offset;offset+=(heights[receipt.requestId]??68)+8;return <CraftReceiptToast key={receipt.requestId} receipt={receipt} index={index} open={open} offset={y} onDismiss={onDismiss} onHeight={onHeight}/>;})}
 </div></div>;
}
