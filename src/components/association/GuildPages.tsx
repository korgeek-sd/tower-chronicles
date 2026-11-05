import React,{useLayoutEffect,useRef,useState} from 'react';
import {guildPageOffsets} from './guildPageOffsets';
import {PagedSelectContext} from '../../ui/GameScrollSelect';
import './guild-pages.css';

export function GuildPages({children,label}:{children:React.ReactNode;label:string}){
 const host=useRef<HTMLDivElement>(null),flow=useRef<HTMLDivElement>(null);
 const [offsets,setOffsets]=useState([0]),[page,setPage]=useState(0);
 const current=Math.min(page,offsets.length-1);
 useLayoutEffect(()=>{
  const root=host.current,body=flow.current;
  if(!root||!body)return;
  let frame=0;
  function measure(){
   if(!root||!body)return;
   const height=Math.ceil(body.getBoundingClientRect().height);
   const available=root.clientHeight;
   // Reserve the same fixed-height pager used by the stylesheet, only on overflow.
   const pageHeight=height>available?available-44:available;
   const top=body.getBoundingClientRect().top;
   const items=Array.from(body.querySelectorAll('button,label,input,select,textarea,summary,p,h2,h3,article,li,.tc-member,.tc-boss-arena,.tc-boss-ranking-row')).map(item=>{
    const box=item.getBoundingClientRect();
    return {top:box.top-top,bottom:box.bottom-top};
   });
   const next=guildPageOffsets(height,pageHeight,items);
   setOffsets(old=>old.length===next.length&&old.every((n,i)=>n===next[i])?old:next);
   setPage(old=>Math.min(old,next.length-1));
  }
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);}
  const resize=new ResizeObserver(schedule);
  resize.observe(root);resize.observe(body);
  const changes=new MutationObserver(schedule);
  changes.observe(body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['open','hidden','class']});
  measure();
  return ()=>{cancelAnimationFrame(frame);resize.disconnect();changes.disconnect();};
 },[]);
 function revealFocusedControl(event:React.FocusEvent){
  const body=flow.current,root=host.current;
  if(!body||!root||!body.contains(event.target))return;
  const target=event.target.getBoundingClientRect();
  const panel=body.getBoundingClientRect();
  const top=target.top-panel.top,bottom=target.bottom-panel.top;
  const height=root.clientHeight-(offsets.length>1?44:0);
  if(top>=offsets[current]-1&&bottom<=(offsets[current+1]??offsets[current]+height)+1)return;
  const next=offsets.findIndex((start,i)=>top>=start-1&&bottom<=(offsets[i+1]??start+height)+1);
  if(next>=0)setPage(next);
 }
 const nextOffset=offsets[current+1];
 const clip=nextOffset===undefined?undefined:`inset(0 0 max(0px, calc(100% - ${nextOffset-offsets[current]}px)) 0)`;
 return <div className="tc-guild-pages" ref={host} aria-label={label}>
  <div className="tc-guild-page-window" style={{clipPath:clip}}><div ref={flow} className="tc-guild-page-flow" style={{top:-offsets[current]}} onFocusCapture={revealFocusedControl}><PagedSelectContext.Provider value={true}>{children}</PagedSelectContext.Provider></div></div>
  {offsets.length>1&&<nav className="tc-guild-page-nav" aria-label={label+' 페이지 이동'}>
   <button type="button" disabled={!current} onClick={()=>setPage(current-1)}>‹ 이전</button>
   <span aria-live="polite">{current+1} / {offsets.length}</span>
   <button type="button" disabled={current===offsets.length-1} onClick={()=>setPage(current+1)}>다음 ›</button>
  </nav>}
 </div>;
}
