import React,{useEffect,useRef,useState} from 'react';
import type {EquipmentItem} from '../../game/types';
import {EQUIPMENT_DEFINITIONS,EQUIPMENT_GRADE_NAMES,equipmentItemName} from '../../game/data/equipment';
import {stopEffectScope,unlockGameEffectAudio} from '../../audio/gameEffects';
import {setCardMusicDucking} from '../../audio/backgroundMusic';
import {useGameFeel} from '../../gameFeel/react/useGameFeel';
import {readGameFeelPreferences} from '../../gameFeel/preferences';
import {cardTimeline,runCardTimeline} from '../../gameFeel/cardSequence';
import {assetUrl} from '../../game/data/graphics';
import {EquipmentArt} from './EquipmentArt';
import {boxStatRows} from './boxPresentation';
import {cardRows,cardSize,remainingCards} from './equipmentCardLayout';
const cardBack=assetUrl('assets/ui/cards/card-back-bronze-seal-v1.webp');
export function CardSeal(){return <img className="tc-card-back-art" src={cardBack} alt="" aria-hidden="true" draggable={false} width={420} height={600}/>;}
function CardLightning(){return <svg className="tc-card-lightning" viewBox="0 0 140 200" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="2" strokeLinejoin="miter"><path d="M17 96 6 80 15 67 8 52 20 42 12 25 28 14 51 19 62 5 76 14 96 8 109 20 128 16 122 38 135 52 125 68 136 83 124 100"/><path d="m17 104-9 18 10 11-11 18 15 11-6 22 23-6 18 15 14-10 19 11 12-14 25 5-5-21 13-14-10-18 8-13-10-12"/><path d="m16 65-9-4-4-15m126 91 8 4 2 16M52 18 2 2m90 180 22 17"/></g></svg>;}
export function EquipmentCardReveal({rewards,onClose}:{rewards:EquipmentItem[];onClose:()=>void}){
 const feel=useGameFeel();
 const sequence=useRef<(()=>void)|null>(null);
 const [charging,setCharging]=useState<Set<number>>(new Set()),[spotlight,setSpotlight]=useState<number|null>(null),[reduced,setReduced]=useState(false);
 const area=useRef<HTMLDivElement>(null),buttons=useRef<(HTMLButtonElement|null)[]>([]);
 const openedRef=useRef(new Set<number>()),timers=useRef<number[]>([]),batchRef=useRef(false);
 const [opened,setOpened]=useState<Set<number>>(new Set()),[settled,setSettled]=useState<Set<number>>(new Set()),[batch,setBatch]=useState(false),[selected,setSelected]=useState<number|null>(null),[size,setSize]=useState(70);
 const total=rewards.length,rows=cardRows(total),all=settled.size===total;
 useEffect(()=>{const el=area.current!;const observer=new ResizeObserver(([entry])=>setSize(cardSize(total,entry.contentRect.width,entry.contentRect.height)));observer.observe(el);feel.play('card.deal');return()=>{observer.disconnect();timers.current.forEach(window.clearTimeout);sequence.current?.();stopEffectScope('equipment-cards');setCardMusicDucking(false);};},[total]);
 const later=(fn:()=>void,delay:number)=>{timers.current.push(window.setTimeout(fn,delay));};
 const start=(indices:number[])=>{
  if(batchRef.current||!indices.length)return;
  const reduce=readGameFeelPreferences();setReduced(reduce);unlockGameEffectAudio();
  batchRef.current=true;setBatch(true);indices.forEach(i=>openedRef.current.add(i));
  sequence.current=runCardTimeline(cardTimeline(rewards.map(r=>r.grade),indices,reduce),event=>{
   const {index,phase}=event,legend=rewards[index].grade==='legendary';
   if(phase==='charge'){
    setCharging(old=>new Set([...old,index]));
    if(!reduce){feel.play('card.charge');if(legend)setCardMusicDucking(true);}
   }else if(phase==='flip'){
    setCharging(old=>{const next=new Set(old);next.delete(index);return next;});
    setOpened(old=>new Set([...old,index]));if(!reduce)feel.play('card.flip');
   }else if(phase==='impact'){
    setSettled(old=>new Set([...old,index]));feel.play('card.result',{grade:rewards[index].grade});
    if(legend&&!reduce)setSpotlight(index);
   }else if(legend){setSpotlight(null);setCardMusicDucking(false);}
  },()=>{batchRef.current=false;setBatch(false);setCharging(new Set());setSpotlight(null);setCardMusicDucking(false);},(fn,ms)=>window.setTimeout(fn,ms),id=>window.clearTimeout(id));
 };
 const reveal=(index:number)=>{if(!openedRef.current.has(index))start([index]);};
 const revealAll=()=>start(remainingCards(total,openedRef.current));
 const skip=()=>{
  setReduced(true);
  sequence.current?.();stopEffectScope('equipment-cards');setCardMusicDucking(false);
  const every=new Set(rewards.map((_,i)=>i));openedRef.current=every;
  setOpened(every);setSettled(every);setCharging(new Set());setSpotlight(null);batchRef.current=false;setBatch(false);
 };
 useEffect(()=>{const hide=()=>{if(document.hidden&&batchRef.current)skip();};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[total]);
 const dismissDetails=()=>{const index=selected;setSelected(null);if(index!==null)later(()=>buttons.current[index]?.focus(),0);};
 let offset=0;
 return <section className={'tc-card-stage'+(batch?' is-playing':'')+(reduced?' is-reduced':'')} onKeyDown={e=>{if(e.key==='Escape'&&selected!==null){e.preventDefault();e.stopPropagation();dismissDetails();}}}>
  <p className="tc-card-instruction">{all?'공개한 카드를 눌러 상세 정보를 확인하세요':'카드를 눌러 장비를 확인하세요'}</p>
  <div ref={area} inert={selected!==null||spotlight!==null} className="tc-card-area"><div className="tc-card-rows" style={{'--card-width':`${size}px`} as React.CSSProperties}>
   {rows.map((length,row)=>{const start=offset;offset+=length;return <div className="tc-card-row" key={row}>{rewards.slice(start,start+length).map((reward,j)=>{
    const index=start+j,visible=opened.has(index),ready=settled.has(index);
    return <button ref={el=>{buttons.current[index]=el;}} key={reward.id} type="button" className={'tc-card-tile'+(visible?' is-revealed':'')+(ready?' is-settled grade-'+reward.grade:'')+(charging.has(index)?' is-charging grade-'+reward.grade:'')} aria-label={ready?`${equipmentItemName(reward)} 상세 보기`:`장비 카드 ${index+1} ${visible?'공개 중':'공개'}`} aria-disabled={batch} onClick={()=>{if(batchRef.current)return;if(ready)setSelected(index);else reveal(index);}}>
     <span className="tc-card-turn" aria-hidden="true"><span className="tc-card-face tc-card-back"><CardSeal/></span><span className={'tc-card-face tc-card-front grade-'+reward.grade}><span className="tc-card-rank">{EQUIPMENT_GRADE_NAMES[reward.grade]}</span><span className="tc-card-art"><EquipmentArt kind={reward.kind} grade={reward.grade}/></span><span className="tc-card-name">{EQUIPMENT_DEFINITIONS[reward.kind].name}</span></span></span>
     {(charging.has(index)||ready)&&['rare','heroic','legendary'].includes(reward.grade)&&<CardLightning/>}
    </button>;
   })}</div>;})}
  </div></div>
  {spotlight!==null&&<div className="tc-card-spotlight" role="status" aria-label={'전설 '+equipmentItemName(rewards[spotlight])}><div className="tc-card-shockwave"/><div className="tc-card-legend-card"><CardLightning/><span className="tc-card-legend-rank">전설</span><EquipmentArt kind={rewards[spotlight].kind} grade="legendary"/><span className="tc-card-legend-name">{EQUIPMENT_DEFINITIONS[rewards[spotlight].kind].name}</span></div><div className="tc-card-sparks" aria-hidden="true">{Array.from({length:12},(_,i)=><i key={i} style={{'--a':`${i*30}deg`,'--d':`${80+(i%3)*24}px`} as React.CSSProperties}/>)}</div></div>}
  <p className="tc-card-progress" role="status" aria-live="polite">{settled.size} / {total} 공개</p>
  <div className="tc-card-actions" inert={selected!==null}><button className="primary" onClick={batch?skip:all?onClose:revealAll}>{batch?'연출 건너뛰기':all?'확인':'모두 공개'}</button></div>
  {selected!==null&&<div className="tc-card-detail-cover"><section className="tc-card-detail" role="region" aria-label="획득 장비 상세"><h3>{EQUIPMENT_DEFINITIONS[rewards[selected].kind].name}</h3><p>{EQUIPMENT_GRADE_NAMES[rewards[selected].grade]}</p><EquipmentArt kind={rewards[selected].kind} grade={rewards[selected].grade}/><dl>{boxStatRows(rewards[selected]).map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl><button autoFocus onClick={dismissDetails}>카드로 돌아가기</button></section></div>}
 </section>;
}
