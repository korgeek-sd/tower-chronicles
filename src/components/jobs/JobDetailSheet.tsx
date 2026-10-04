import React,{useEffect,useRef} from 'react';
import type {JobDefinition} from '../../game/jobs/catalog';
import {jobDetailById} from '../../game/jobs/details';
import {assetUrl} from '../../game/data/graphics';
import './job-detail-sheet.css';

const kindLabel={GENERATOR:'GENERATOR',NEUTRAL:'NEUTRAL',SPENDER:'SPENDER'} as const;

export function JobDetailSheet({job,owned,selected,selectDisabled,onClose,onSelect}:{
 job:JobDefinition;
 owned:boolean;
 selected:boolean;
 selectDisabled:boolean;
 onClose:()=>void;
 onSelect?:()=>void;
}){
 const root=useRef<HTMLElement>(null);
 const detail=jobDetailById(job.id);
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
      <div className="tc-job-detail-badges"><b>{job.rarity}</b><span>{owned?'등록 직능':'미등록 직능'}</span><span>{job.combatKit?'전투 반영':'전투 데이터 준비 중'}</span></div>
      <p>{detail?.description??job.description??'이 직능의 상세 기록은 아직 정리 중입니다.'}</p>
      {detail&&<small>{detail.resourceSummary}</small>}
     </div>
    </section>
    <section className="tc-job-detail-section">
     <div className="tc-job-detail-section-title"><h3>액티브 스킬</h3><small>{detail?'3개 기록':'상세 기록 준비 중'}</small></div>
     <div className="tc-job-detail-skills">
      {detail?detail.skills.map((skill,index)=><article className="tc-job-detail-skill" key={skill.name}>
       <div className="tc-job-detail-skill-head"><span>{index+1}</span><div><strong>{skill.name}</strong><small>{kindLabel[skill.kind]}</small></div><em>쿨다운 {skill.cooldown}</em></div>
       <div className="tc-job-detail-skill-resource">자원 · {skill.resourceLabel.replace(/^자원\s*/,'')}</div>
       <p>{skill.description}</p>
       <div className="tc-job-detail-facts">{skill.facts.map(fact=><span key={fact}>{fact}</span>)}</div>
      </article>):<article className="tc-job-detail-empty"><strong>상세 스킬 기록 준비 중</strong><p>이 직능의 스킬 수치와 설명은 확정되는 대로 이 화면에 표시됩니다.</p></article>}
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
