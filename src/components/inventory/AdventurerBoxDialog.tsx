import React,{useEffect,useRef,useState} from 'react';
import type {EquipmentItem} from '../../game/types';
import {EQUIPMENT_DEFINITIONS} from '../../game/data/equipment';
import {assetUrl} from '../../game/data/graphics';
import {EquipmentCardReveal} from './EquipmentCardReveal';
import './adventurer-box.css';
import './equipment-card-reveal.css';
const chest=assetUrl('assets/ui/shop/adventurer_equipment_box.png');
export interface AdventurerBoxDialogProps {
 quantity:number;count:number;onCount:(count:number)=>void;busy:boolean;pending:boolean;error:string;
 disabled:boolean;rewards:EquipmentItem[]|null;onOpen:()=>void;onRepeat:()=>void;onRetry:()=>void;onClose:()=>void;
 marketAction?:()=>void;marketDisabled?:boolean;
}

export function AdventurerBoxDialog(p:AdventurerBoxDialogProps){
 const root=useRef<HTMLDialogElement>(null),close=useRef(p.onClose);close.current=p.onClose;
 const [details,setDetails]=useState(false);
 const result=!!p.rewards?.length;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement,dialog=root.current!;
  const fallback=document.querySelector<HTMLButtonElement>('button[aria-label="필터"]');
  dialog.showModal();dialog.querySelector<HTMLButtonElement>('button')?.focus();
  return()=>{dialog.close();if(previous?.isConnected)previous.focus({preventScroll:true});else fallback?.focus({preventScroll:true});};
 },[]);
 const dismiss=()=>{if(!p.busy)close.current();};
 return <dialog ref={root} className={'tc-box-dialog'+(result?' is-card-result':'')} aria-labelledby="tc-box-title" aria-modal="true" onCancel={e=>{e.preventDefault();dismiss();}} onKeyDown={e=>{
  if(e.key!=='Tab')return;
  const detail=e.currentTarget.querySelector('.tc-card-detail');
  const nodes=Array.from((detail??e.currentTarget).querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  const first=nodes[0],last=nodes[nodes.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
 }}>
 <header><h2 id="tc-box-title">{result?'장비 획득':'모험가 장비 상자'}</h2><button className="tc-box-close" aria-label="상자 창 닫기" disabled={p.busy} onClick={dismiss}>×</button></header>
 {result?<EquipmentCardReveal key={p.rewards!.map(r=>r.id).join(':')} rewards={p.rewards!} onClose={dismiss}/>:p.busy?<p className="tc-card-pending" role="status">장비 획득 결과를 확인하고 있습니다…</p>:<>
   <div className="tc-box-use-art"><img src={chest} alt="모험가 장비 상자"/></div>
   <p className="tc-box-description">무작위 장비 1개 획득</p>
   <p className="tc-box-stock">보유 수량 <b>{p.quantity.toLocaleString()}개</b></p>
   <div className="tc-box-stepper"><button aria-label="개봉 수량 감소" disabled={p.disabled||p.count<=1} onClick={()=>p.onCount(p.count-1)}>−</button><output aria-live="polite">{p.count}</output><button aria-label="개봉 수량 증가" disabled={p.disabled||p.count>=Math.min(10,p.quantity)} onClick={()=>p.onCount(p.count+1)}>+</button><button disabled={p.disabled} onClick={()=>p.onCount(Math.min(10,p.quantity))}>최대 {Math.min(10,p.quantity)}개</button></div>
   <button className="tc-box-details-toggle" aria-expanded={details} onClick={()=>setDetails(!details)}>획득 장비 · 확률 보기 {details?'⌃':'›'}</button>
   {details&&<section className="tc-box-details" aria-label="획득 장비와 확률"><p>일반 50% · 고급 35% · 희귀 13%<br/>영웅 1.9% · 전설 0.1%</p><p>{Object.values(EQUIPMENT_DEFINITIONS).map(def=>def.name).join(' · ')}</p><small>장비 종류별 확률 각 1/9 · 1회 최대 10개</small>{p.marketAction&&<button disabled={p.marketDisabled} onClick={p.marketAction}>시세 · 거래</button>}</section>}
   {(p.error||p.pending)&&<p role="status" className="tc-box-error">{p.error||'이전 개봉 요청의 결과를 확인해 주세요.'}</p>}
   {p.pending&&<button disabled={p.busy} onClick={p.onRetry}>이전 결과 다시 확인</button>}
   <footer><button onClick={dismiss}>취소</button><button className="primary" disabled={p.disabled||p.quantity<1} onClick={p.onOpen}>{p.count>1?`${p.count}개 사용하기`:'사용하기'}</button></footer>
 </>}
 </dialog>;
}
