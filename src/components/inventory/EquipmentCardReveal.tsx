import React,{useEffect,useRef,useState} from 'react';
import type {EquipmentItem} from '../../game/types';
import {EQUIPMENT_DEFINITIONS,EQUIPMENT_GRADE_NAMES,equipmentItemName} from '../../game/data/equipment';
import {playGameEffect} from '../../audio/gameEffects';
import {EquipmentArt} from './EquipmentArt';
import {boxStatRows} from './boxPresentation';
import {cardRows,cardSize,remainingCards} from './equipmentCardLayout';
export function CardSeal(){return <svg viewBox="0 0 100 144" fill="none" aria-hidden="true"><path d="M50 12 86 72 50 132 14 72Z" stroke="currentColor" opacity=".25"/><path d="M26 110h48l-5-12V67H57V42H54V23h-8v19h-3v25H31v31Zm14-7V83h20v20M43 55h14M35 75h30" stroke="currentColor" strokeWidth="3"/><path d="M9 10h13M9 10v13M91 10H78M91 10v13M9 134h13M9 134v-13M91 134H78M91 134v-13" stroke="currentColor"/></svg>;}
export function EquipmentCardReveal({rewards,onClose}:{rewards:EquipmentItem[];onClose:()=>void}){
 const area=useRef<HTMLDivElement>(null),buttons=useRef<(HTMLButtonElement|null)[]>([]);
 const openedRef=useRef(new Set<number>()),timers=useRef<number[]>([]),batchRef=useRef(false);
 const [opened,setOpened]=useState<Set<number>>(new Set()),[settled,setSettled]=useState<Set<number>>(new Set()),[batch,setBatch]=useState(false),[selected,setSelected]=useState<number|null>(null),[size,setSize]=useState(70);
 const total=rewards.length,rows=cardRows(total),all=settled.size===total;
 useEffect(()=>{const el=area.current!;const observer=new ResizeObserver(([entry])=>setSize(cardSize(total,entry.contentRect.width,entry.contentRect.height)));observer.observe(el);return()=>{observer.disconnect();timers.current.forEach(window.clearTimeout);};},[total]);
 const later=(fn:()=>void,delay:number)=>{timers.current.push(window.setTimeout(fn,delay));};
 const reveal=(index:number)=>{
  if(openedRef.current.has(index))return;
  openedRef.current.add(index);setOpened(new Set(openedRef.current));
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  later(()=>{setSettled(old=>new Set([...old,index]));try{playGameEffect(rewards[index].grade==='legendary'?'seal.step-3':['heroic','rare'].includes(rewards[index].grade)?'loot.rare':'loot.common');}catch{}},reduced?0:480);
 };
 const revealAll=()=>{
  if(batchRef.current)return;batchRef.current=true;setBatch(true);
  const indices=remainingCards(total,openedRef.current),reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  indices.forEach((index,i)=>later(()=>reveal(index),reduced?0:i*110));
  later(()=>{batchRef.current=false;setBatch(false);},reduced?0:indices.length*110+480);
 };
 const dismissDetails=()=>{const index=selected;setSelected(null);if(index!==null)later(()=>buttons.current[index]?.focus(),0);};
 let offset=0;
 return <section className="tc-card-stage" onKeyDown={e=>{if(e.key==='Escape'&&selected!==null){e.preventDefault();e.stopPropagation();dismissDetails();}}}>
  <p className="tc-card-instruction">{all?'공개한 카드를 눌러 상세 정보를 확인하세요':'카드를 눌러 장비를 확인하세요'}</p>
  <div ref={area} inert={selected!==null} className="tc-card-area"><div className="tc-card-rows" style={{'--card-width':`${size}px`} as React.CSSProperties}>
   {rows.map((length,row)=>{const start=offset;offset+=length;return <div className="tc-card-row" key={row}>{rewards.slice(start,start+length).map((reward,j)=>{
    const index=start+j,visible=opened.has(index),ready=settled.has(index);
    return <button ref={el=>{buttons.current[index]=el;}} key={reward.id} type="button" className={'tc-card-tile'+(visible?' is-revealed':'')+(ready?' is-settled grade-'+reward.grade:'')} aria-label={ready?`${equipmentItemName(reward)} 상세 보기`:`장비 카드 ${index+1} ${visible?'공개 중':'공개'}`} aria-disabled={visible&&!ready} onClick={()=>{if(ready)setSelected(index);else reveal(index);}}>
     <span className="tc-card-turn" aria-hidden="true"><span className="tc-card-face tc-card-back"><CardSeal/></span><span className={'tc-card-face tc-card-front grade-'+reward.grade}><span className="tc-card-rank">{EQUIPMENT_GRADE_NAMES[reward.grade]}</span><span className="tc-card-art"><EquipmentArt kind={reward.kind} grade={reward.grade}/></span><span className="tc-card-name">{EQUIPMENT_DEFINITIONS[reward.kind].name}</span></span></span>
    </button>;
   })}</div>;})}
  </div></div>
  <p className="tc-card-progress" role="status" aria-live="polite">{settled.size} / {total} 공개</p>
  <div className="tc-card-actions" inert={selected!==null}><button className="primary" disabled={batch&&!all} onClick={all?onClose:revealAll}>{all?'확인':batch?'공개 중…':'모두 공개'}</button></div>
  {selected!==null&&<div className="tc-card-detail-cover"><section className="tc-card-detail" role="region" aria-label="획득 장비 상세"><h3>{EQUIPMENT_DEFINITIONS[rewards[selected].kind].name}</h3><p>{EQUIPMENT_GRADE_NAMES[rewards[selected].grade]}</p><EquipmentArt kind={rewards[selected].kind} grade={rewards[selected].grade}/><dl>{boxStatRows(rewards[selected]).map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl><button autoFocus onClick={dismissDetails}>카드로 돌아가기</button></section></div>}
 </section>;
}
