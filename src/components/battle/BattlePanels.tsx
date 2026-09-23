import React,{useEffect,useId,useRef} from 'react';
import type {ActiveEffect} from '../../game/types';
import {EFFECTS} from '../../game/engine/effects';

export function BattleDialog({title,onClose,children}:{title:string;onClose?:()=>void;children:React.ReactNode}){
  const ref=useRef<HTMLDialogElement>(null),id=useId();
  useEffect(()=>{
    const dialog=ref.current!,previous=document.activeElement;
    dialog.showModal();
    return()=>{dialog.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};
  },[]);
  return <dialog ref={ref} className="combat-dialog" aria-labelledby={id} onCancel={event=>{event.preventDefault();onClose?.();}}>
    <div className="combat-dialog-heading"><div><small>탑의 기록 · 원정 수첩</small><h2 id={id}>{title}</h2></div>{onClose&&<button autoFocus onClick={onClose} aria-label="닫기">×</button>}</div>
    <div className="combat-dialog-body">{children}</div>
  </dialog>;
}

export function BattleVitals({name,current,max,enemy=false,shield,title,children}:{name:string;current:number;max:number;enemy?:boolean;shield?:ActiveEffect;title?:string;children?:React.ReactNode}){
  const percent=Math.max(0,Math.min(100,current/max*100));
  return <section className={'combat-vitals '+(enemy?'is-enemy':'is-player')+(percent<30?' is-low':'')} aria-label={enemy?'적 상태':'내 상태'}>
    <div className="vitals-heading"><div>{title&&<small>{title}</small>}<h2>{name}</h2></div><span className="vitals-number"><b>{Math.ceil(Math.max(0,current))}</b><span> / {Math.ceil(max)}</span></span></div>
    <div className="vitals-meter" role="progressbar" aria-label={enemy?name+' HP':'플레이어 HP'} aria-valuenow={Math.max(0,current)} aria-valuemin={0} aria-valuemax={max}><i style={{width:percent+'%'}}/></div>
    {shield&&<div className="vitals-shield"><span>보호막 <b>{shield.currentShield}</b></span><span>{shield.remainingDuration}턴</span></div>}
    {children}
  </section>;
}

export function BattleEffects({effects,onInspect}:{effects:ActiveEffect[];onInspect:(effect:ActiveEffect)=>void}){
  return <div className="combat-effects">{effects.filter(effect=>EFFECTS[effect.effectId]?.behavior!=='SHIELD').map(effect=>{
    const definition=EFFECTS[effect.effectId];
    return <button key={effect.instanceId} className={definition?.category==='DEBUFF'?'is-debuff':''} onClick={()=>onInspect(effect)} aria-label={`${definition?.name??effect.effectId}, ${effect.stackCount}중첩, ${effect.remainingDuration}턴, 상세 보기`}>
      {definition?.name??effect.effectId}{effect.stackCount>1&&<b> ×{effect.stackCount}</b>}<span>{effect.remainingDuration}턴</span>
    </button>;
  })}</div>;
}
