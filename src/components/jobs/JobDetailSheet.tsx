import React,{useEffect,useRef} from 'react';
import type {JobDefinition} from '../../game/jobs/catalog';
import {assetUrl} from '../../game/data/graphics';
import './job-detail-sheet.css';

export function JobDetailSheet({job,owned,selected,selectDisabled,onClose,onSelect}:{
 job:JobDefinition;
 owned:boolean;
 selected:boolean;
 selectDisabled:boolean;
 onClose:()=>void;
 onSelect?:()=>void;
}){
 const root=useRef<HTMLElement>(null);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  root.current?.focus();
  const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
  document.addEventListener('keydown',onKeyDown);
  return()=>{document.removeEventListener('keydown',onKeyDown);previous?.focus();};
 },[onClose]);
 const selectLabel=selected?'선택 중':owned?'이 직능 선택':'미보유';
 return <div className="tc-job-detail-backdrop" role="presentation" onClick={onClose}>
  <section ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="job-detail-title" className={'tc-job-detail rarity-'+job.rarity.toLowerCase()} onClick={event=>event.stopPropagation()}>
   <header className="tc-job-detail-head">
    <div><small>{job.rarity} · ASSOCIATION JOB RECORD</small><h2 id="job-detail-title">{job.displayName}</h2></div>
    <button type="button" aria-label="직능 상세 닫기" onClick={onClose}>×</button>
   </header>
   <div className="tc-job-detail-body">
    <section className="tc-job-detail-summary">
     <div className="tc-job-detail-art" aria-hidden="true">{job.visualAssetKey?<img src={assetUrl(job.visualAssetKey)} alt=""/>:<span>{job.rarity}</span>}</div>
     <div className="tc-job-detail-copy">
      <div className="tc-job-detail-badges"><b>{job.rarity}</b><span>{owned?'등록 직능':'미등록 직능'}</span></div>
      <p>{job.description??'이 직능의 상세 기록은 아직 정리 중입니다.'}</p>
     </div>
    </section>
   </div>
   <footer className="tc-job-detail-actions">
    <button type="button" className="tc-action secondary" onClick={onClose}>닫기</button>
    <button type="button" className="tc-action" disabled={selectDisabled} onClick={onSelect}>{selectLabel}</button>
   </footer>
  </section>
 </div>;
}
