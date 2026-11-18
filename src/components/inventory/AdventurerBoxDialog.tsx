import React,{useCallback,useEffect,useRef,useState} from 'react';
import type {EquipmentItem} from '../../game/types';
import {EQUIPMENT_DEFINITIONS,EQUIPMENT_GRADE_NAMES,equipmentItemName} from '../../game/data/equipment';
import {assetUrl} from '../../game/data/graphics';
import {playGameEffect} from '../../audio/gameEffects';
import {useGameFeel} from '../../gameFeel/react/useGameFeel';
import {EquipmentArt} from './EquipmentArt';
import {boxReveal,boxStatRows} from './boxPresentation';
import {PixiBoxStage,preloadBoxEffects,disposePreloadedBoxEffects,type BoxRendererStatus} from './PixiBoxStage';
import './adventurer-box.css';
const chest=assetUrl('assets/ui/shop/adventurer_equipment_box.png');
export interface AdventurerBoxDialogProps {
 quantity:number;count:number;onCount:(count:number)=>void;busy:boolean;pending:boolean;error:string;
 disabled:boolean;rewards:EquipmentItem[]|null;onOpen:()=>void;onRepeat:()=>void;onRetry:()=>void;onClose:()=>void;
 marketAction?:()=>void;marketDisabled?:boolean;
}
export function AdventurerBoxDialog(p:AdventurerBoxDialogProps){
 const root=useRef<HTMLDialogElement>(null),close=useRef(p.onClose);close.current=p.onClose;
 const [details,setDetails]=useState(false),[revealed,setRevealed]=useState(false),[selected,setSelected]=useState(0);
 const feel=useGameFeel();
 const [renderReport,setRenderReport]=useState<{id:string;status:BoxRendererStatus}|null>(null);
 const startedReceipt=useRef<EquipmentItem[]|null>(null);
 const [phase,setPhase]=useState<'rattle'|'charge'|'hold'|'burst'>('rattle');
 const timers=useRef<number[]>([]);
 const clearRevealTimers=useCallback(()=>{timers.current.forEach(window.clearTimeout);timers.current=[];},[]);
 const skip=()=>{clearRevealTimers();setRevealed(true);};
 const reveal=p.rewards?boxReveal(p.rewards):null;
 const topReward=p.rewards?.find(reward=>reward.grade===reveal?.grade);
 const receiptKey=topReward?.id??'';
 const renderer=renderReport?.id===receiptKey?renderReport.status:'loading';
 const reportRenderer=useCallback((status:BoxRendererStatus)=>{setRenderReport({id:receiptKey,status});},[receiptKey]);
 const opening=p.busy||!!p.rewards&&!revealed;
 const result=!!p.rewards&&revealed;
 const item=p.rewards?.[Math.min(selected,p.rewards.length-1)];
 useEffect(()=>{
  preloadBoxEffects();
  const previous=document.activeElement as HTMLElement,dialog=root.current!;
  const fallback=document.querySelector<HTMLButtonElement>('button[aria-label="필터"]');
  dialog.showModal();dialog.querySelector<HTMLButtonElement>('button')?.focus();
  return()=>{disposePreloadedBoxEffects();dialog.close();if(previous?.isConnected)previous.focus({preventScroll:true});else fallback?.focus({preventScroll:true});};
 },[]);
 useEffect(()=>{
  clearRevealTimers();setSelected(p.rewards?Math.max(0,p.rewards.findIndex(reward=>reward.grade===boxReveal(p.rewards!)?.grade)):0);setRevealed(false);setDetails(false);setPhase('rattle');
  startedReceipt.current=null;
  if(!p.rewards){setRenderReport(null);return clearRevealTimers;}
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){setRevealed(true);return clearRevealTimers;}
  return clearRevealTimers;
 },[p.rewards,clearRevealTimers]);
 useEffect(()=>{
  if(!p.rewards||renderer==='loading'||startedReceipt.current===p.rewards||revealed)return;
  startedReceipt.current=p.rewards;
  const feedback=boxReveal(p.rewards,window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if(!feedback)return;
  if(!feedback.duration){setRevealed(true);return;}
  const sound=(name:Parameters<typeof playGameEffect>[0])=>{try{playGameEffect(name);}catch{}};
  const after=(delay:number,callback:()=>void)=>{timers.current.push(window.setTimeout(callback,delay));};
  after(380,()=>sound('box.land'));
  after(feedback.chargeAt,()=>{setPhase('charge');sound('box.charge');});
  after(feedback.holdAt,()=>{setPhase('hold');sound('box.unlock');});
  after(feedback.burstAt,()=>{setPhase('burst');sound('box.hinge');});
  after(feedback.burstAt+780,()=>sound(feedback.grade==='legendary'?'seal.step-3':feedback.grade==='heroic'||feedback.grade==='rare'?'loot.rare':'loot.common'));
  after(feedback.duration,()=>setRevealed(true));
 },[p.rewards,renderer,revealed]);
 useEffect(()=>{if(result){clearRevealTimers();if(p.quantity>0)preloadBoxEffects();feel.play('ui.confirm');root.current?.querySelector<HTMLButtonElement>('[data-result-confirm]')?.focus({preventScroll:true});}},[result,feel,clearRevealTimers]);
 const dismiss=()=>{if(p.busy)return;if(opening){skip();return;}close.current();};
 return <dialog ref={root} className={'tc-box-dialog'+(opening?' is-opening':'')+(result?' is-result':'')} style={{'--box-tone':reveal?({common:'#d5c7a9',uncommon:'#82b86b',rare:'#60bfff',heroic:'#bc7ce0',legendary:'#ffcc66'}[reveal.grade]):'#c1ab7e'} as React.CSSProperties} aria-labelledby="tc-box-title" aria-modal="true" onCancel={e=>{e.preventDefault();dismiss();}} onKeyDown={e=>{
  if(e.key!=='Tab')return;const nodes=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));const first=nodes[0],last=nodes[nodes.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
 }}>
  <header><h2 id="tc-box-title">{opening?'모험가 장비 상자 개봉':result?'장비 획득':'모험가 장비 상자'}</h2>{!opening&&<button className="tc-box-close" aria-label="상자 창 닫기" onClick={dismiss}>×</button>}</header>
  {opening?<div className={'tc-box-stage phase-'+phase+(reveal?' has-receipt':'')+(reveal?.grade==='legendary'?' is-legendary':'')} style={{backgroundImage:`linear-gradient(#08080877,#080808aa),url(${assetUrl('assets/backgrounds/summon/summon-altar-v1.webp')})`}}>
   <button className="tc-box-skip" disabled={!p.rewards} onClick={skip}>{p.rewards?'건너뛰기 »':'결과 확인 중…'}</button>
   <div className="tc-box-altar" data-box-renderer={renderer}><div className="tc-box-chest" role="img" aria-label="개봉 중인 모험가 장비 상자"><div className="tc-box-frame-art" aria-hidden="true"/></div>{reveal&&topReward&&<PixiBoxStage key={topReward.id} feedback={reveal} onStatus={reportRenderer}/>}</div>
   {p.rewards&&<small className="tc-box-renderer" aria-label="그래픽 연출 상태">{renderer==='gpu'?'PixiJS · Mesh':renderer==='fallback'?'정적 이미지 · 호환 모드':'그래픽 준비 중'}</small>}
   <p role="status">{p.rewards?(phase==='burst'?EQUIPMENT_GRADE_NAMES[reveal!.grade]+' 장비 획득':phase==='hold'?'…':'상자가 반응하고 있습니다'): '서버에서 개봉 결과를 확인하고 있습니다.'}</p>
  </div>:result&&item?<>
   {p.rewards!.length>1&&<div className="tc-box-rewards" aria-label="획득 장비 목록">{p.rewards!.map((reward,index)=><button key={reward.id} aria-label={equipmentItemName(reward)} aria-pressed={selected===index} className={'grade-'+reward.grade} onClick={()=>setSelected(index)}><EquipmentArt kind={reward.kind} grade={reward.grade}/><small>{EQUIPMENT_GRADE_NAMES[reward.grade]}</small></button>)}</div>}
   <div className={'tc-box-prize grade-'+item.grade}>
    <span className="tc-box-grade">{EQUIPMENT_GRADE_NAMES[item.grade]}</span>
    <div className="tc-box-prize-art"><EquipmentArt kind={item.kind} grade={item.grade}/></div>
    <h3>{EQUIPMENT_DEFINITIONS[item.kind].name}</h3>
    <dl>{boxStatRows(item).map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
   </div>
   <p className="tc-box-stock">{p.rewards!.length>1&&`${p.rewards!.length}개 획득 · `}남은 상자 <b>{p.quantity.toLocaleString()}개</b></p>
   <footer><button data-result-confirm onClick={dismiss}>확인</button><button className="primary" disabled={p.disabled||p.quantity<1} onClick={p.onRepeat}>{p.quantity?'1개 더 개봉':'상자 소진'}</button></footer>
  </>:<>
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
