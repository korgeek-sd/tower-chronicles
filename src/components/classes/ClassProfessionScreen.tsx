import React,{useEffect,useMemo,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {getHuntingState} from '../../online/hunting';
import {huntingLevel} from '../../game/hunting/model';
import {assetUrl} from '../../game/data/graphics';
import {Glyph} from '../../ui/mobile';
import {
 CLASS_CATALOG,CLASS_LEVELS,CLASS_STAGE_TYPES,
 initialClassProgress,normalizeClassProgress,chooseInitialClass,chooseClassGrowth,
 moveClassSkill,defaultClassSkillOrder,getActiveSkills,
 type ClassId,type ClassProgress
} from '../../game/classes/progression';
import './class-profession.css';

type Props={userId:string|null;lease:GameplayLease|null;onHome:()=>void};
const IDS:ClassId[]=['warrior','mage','archer'];
const STAGE_LABELS:Record<'active'|'passive'|'trait',string>={active:'스킬',passive:'패시브',trait:'특성'};
const KEY=(id:string|null)=>'tower-class-progression-v1:'+(id??'guest');
function readProgress(id:string|null):ClassProgress{
 try{return normalizeClassProgress(JSON.parse(localStorage.getItem(KEY(id))??'null'));}
 catch{return initialClassProgress();}
}
export function ClassProfessionScreen({userId,lease,onHome}:Props){
 const [progress,setProgress]=useState<ClassProgress>(initialClassProgress);
 const [preview,setPreview]=useState<ClassId>('warrior');
 const [ready,setReady]=useState(false);
 const [level,setLevel]=useState<number|null>(null);
 const [stageOpen,setStageOpen]=useState<number|null>(null);
 const [confirmClass,setConfirmClass]=useState(false);
 const [confirmGrowth,setConfirmGrowth]=useState<number|null>(null);
 const [dirty,setDirty]=useState(false);
 const [notice,setNotice]=useState('');
 const [saveFailed,setSaveFailed]=useState(false);
 useEffect(()=>{
  const saved=readProgress(userId);
  setProgress(saved);setPreview(saved.classId??'warrior');setReady(true);
  setDirty(false);setNotice('');setStageOpen(null);setConfirmClass(false);
 },[userId]);
 useEffect(()=>{
  let active=true;
  setLevel(userId?null:1);
  if(userId&&lease){
   void getHuntingState(lease).then(value=>{if(active)setLevel(huntingLevel(value.experience));}).catch(()=>{if(active)setLevel(null);});
  }else if(!userId){
   try{const saved=JSON.parse(localStorage.getItem('tower-instant-hunting-guest-v1')??'null');
    setLevel(huntingLevel(Number(saved?.experience)||0));
   }catch{setLevel(1);}
  }
  return()=>{active=false;};
 },[userId,lease?.leaseId,lease?.generation]);
 const visibleId=progress.classId??preview;
 const job=CLASS_CATALOG[visibleId];
 const activeSkills=useMemo(()=>getActiveSkills(progress),[progress]);
 const chosenCount=progress.picks.filter(x=>x!==null).length;
 const hasPersisted=progress.classId!==null;
 function commitClass(){
  if(!ready||hasPersisted)return;
  const next=chooseInitialClass(progress,preview);
  try{localStorage.setItem(KEY(userId),JSON.stringify(next));setProgress(next);setNotice('직업이 선택되었습니다. 이 화면에서는 직업을 다시 선택할 수 없습니다.');setSaveFailed(false);}
  catch{setSaveFailed(true);setNotice('직업을 저장할 수 없습니다. 기기 저장공간을 확인해 주세요.');}
  setConfirmClass(false);
 }
 function saveDraft(){
  if(!ready)return;
  try{localStorage.setItem(KEY(userId),JSON.stringify(progress));setDirty(false);setNotice('이 기기에 성장 선택과 스킬 순서를 저장했습니다.');setSaveFailed(false);}
  catch{setSaveFailed(true);setNotice('저장에 실패했습니다. 기기 저장공간을 확인해 주세요.');}
 }
 function chooseGrowth(option:number){
  if(stageOpen===null||level===null)return;
  const next=chooseClassGrowth(progress,stageOpen,option,level);
  if(next!==progress){setProgress(next);setDirty(true);setNotice('성장 선택이 확정되지 않았습니다. 저장 버튼을 눌러주세요.');}
  setConfirmGrowth(null);setStageOpen(null);
 }
 const displaySlots=Array.from({length:5},(_,i)=>activeSkills[i]??null);
 return <section className="tc-class-page" aria-label="직업 화면" data-selected-job={visibleId}>
  <div className="tc-class-ambience" aria-hidden="true" style={{backgroundImage:'linear-gradient(180deg,rgba(8,7,13,.6),rgba(12,8,16,.94)),url('+assetUrl('assets/backgrounds/hub/novar-moonlit-v3.webp')+')'}}/>
  <header className="tc-class-header">
   <button type="button" className="tc-class-back tc-feel-press" data-game-feel="press" onClick={onHome} aria-label="거점으로 돌아가기">‹</button>
   <div className="tc-class-brand"><small>탑의 기록</small><h1>직업</h1></div>
   <button type="button" className="tc-class-home tc-feel-press" data-game-feel="press" onClick={onHome} aria-label="거점으로 이동"><Glyph name="home"/></button>
  </header>
  <section className="tc-class-arch-gallery" aria-label="직업 선택">
   {IDS.map(id=>{
    const item=CLASS_CATALOG[id],active=visibleId===id,disabled=hasPersisted&&progress.classId!==id;
    return <button key={id} type="button" className={'tc-class-portrait'+(active?' selected':'')} aria-pressed={active} disabled={disabled} onClick={()=>{if(!hasPersisted)setPreview(id);}}>
     <span className="tc-class-portrait-halo" aria-hidden="true"/>
     <img src={assetUrl(item.art)} alt={item.name+' 직업 캐릭터'}/>
     <span className="tc-class-portrait-name"><Glyph name={id==='warrior'?'sword':id==='mage'?'staff':'bow'}/>{item.name}</span>
     {hasPersisted&&progress.classId===id&&<span className="tc-class-check" aria-label="선택된 직업">✓</span>}
    </button>;
   })}
  </section>
  <section className="tc-class-featured" aria-label="직업 정보">
   <div className="tc-class-feature-art">
    <img src={assetUrl(job.art)} alt="" aria-hidden="true"/>
    <span className="tc-class-feature-medallion" aria-hidden="true"><Glyph name={visibleId==='warrior'?'sword':visibleId==='mage'?'staff':'bow'}/></span>
   </div>
   <div className="tc-class-feature-copy">
    <span className="tc-class-feature-overline">직업 정보</span>
    <div className="tc-class-feature-title"><Glyph name={visibleId==='warrior'?'sword':visibleId==='mage'?'staff':'bow'}/><h2>{job.name}</h2></div>
    <div className="tc-class-traits" aria-label="직업 특성">{job.summary.split(' · ').map(trait=><span key={trait}>{trait}</span>)}</div>
    <p>{job.description}</p>
    {!hasPersisted?<button className="tc-class-choose tc-feel-press" data-game-feel="press" onClick={()=>setConfirmClass(true)}>이 직업으로 시작</button>:<small className="tc-class-fixed-status"><Glyph name="defense"/> 직업 확정</small>}
   </div>
  </section>
  <section className="tc-class-growth tc-class-path" aria-label="직업 성장 경로">
   <div className="tc-class-section-heading"><strong><Glyph name="skills"/> 직업 성장 경로</strong><small>{chosenCount}/10 습득 · {level===null?'레벨 조회 중':'Lv.'+level}</small></div>
   <div className="tc-class-milestones" role="group" aria-label="10레벨부터 100레벨까지 성장 단계">
    {CLASS_LEVELS.map((required,i)=>{
     const chosen=progress.picks[i],kind=CLASS_STAGE_TYPES[i],unlocked=level!==null&&level>=required;
     return <button type="button" key={required} aria-label={'Lv.'+required+' '+STAGE_LABELS[kind]+' 선택지 확인'}
      className={'tc-class-milestone'+(chosen!==null?' chosen':unlocked?' available':'')} title={'Lv.'+required+' · '+(chosen!==null?job.stages[i].options[chosen].name:STAGE_LABELS[kind]+' 선택지')}
      onClick={()=>{setConfirmGrowth(null);setStageOpen(i);}}>
      <span className="tc-class-level">Lv.{required}</span>
      <span className="tc-class-milestone-icon"><Glyph name={kind==='active'?(visibleId==='mage'?'staff':visibleId==='archer'?'bow':'sword'):kind==='passive'?'defense':'skills'}/>{chosen!==null&&<b aria-hidden="true">✓</b>}</span>
      <small>{i===9?'궁극기':STAGE_LABELS[kind]}</small>
      <span className="tc-class-node-name">{chosen!==null?job.stages[i].options[chosen].name:'선택지 보기'}</span>
     </button>;
    })}
   </div>
  </section>
  <section className="tc-class-order" aria-label="전투 배치">
   <div className="tc-class-section-heading"><strong><Glyph name="sword"/> 전투 배치 <span>(자동 전투 스킬 순서)</span></strong><small>{activeSkills.length}/5개 습득</small></div>
   <p className="tc-class-rule"><span aria-hidden="true">!</span> 스킬은 위에서부터 확인하며, 사용 불가 시 다음 스킬을 시전합니다.</p>
   <div className="tc-class-skill-list">
    {displaySlots.map((item,index)=><div className={'tc-class-skill-row'+(!item?' vacant':'')} key={item?.stage??'empty-'+index}>
     <span className="tc-class-rank-seal"><b>{index+1}</b></span>
     <div className="tc-class-skill-icon"><Glyph name={item?.stage===9?'skills':visibleId==='mage'?'staff':visibleId==='archer'?'bow':'sword'}/></div>
     <div className="tc-class-skill-text"><strong>{item?.skill.name??'미습득 스킬'}</strong><small>{item?.skill.description??'레벨 달성 후 습득'}</small></div>
     <div className="tc-class-cost"><span>MP {item?.skill.mp??'—'}</span><small>대기 {item?.skill.cooldown??'—'}턴</small></div>
     <div className="tc-class-move">
      <button type="button" aria-label={'스킬 '+(index+1)+'번 위로 이동'} disabled={!item||index===0} onClick={()=>{setProgress(v=>moveClassSkill(v,index,-1));setDirty(true);}}>▲</button>
      <button type="button" aria-label={'스킬 '+(index+1)+'번 아래로 이동'} disabled={!item||index>=activeSkills.length-1} onClick={()=>{setProgress(v=>moveClassSkill(v,index,1));setDirty(true);}}>▼</button>
     </div>
    </div>)}
   </div>
  </section>
  <div className="tc-class-footer">
   <p className="tc-class-permanent"><span aria-hidden="true">◇</span> 선택한 직업은 변경할 수 없습니다.</p>
   <div className="tc-class-actions">
    <button type="button" className="tc-class-reset tc-feel-press" data-game-feel="press" onClick={()=>{setProgress(v=>defaultClassSkillOrder(v));setDirty(true);}} disabled={!hasPersisted||activeSkills.length<2}><span aria-hidden="true">↻</span> 기본 순서</button>
    <button type="button" className="tc-class-save tc-feel-press" data-game-feel="press" onClick={saveDraft} disabled={!ready||!hasPersisted}><span aria-hidden="true">▣</span> 저장</button>
   </div>
  </div>
  <p className={'tc-class-status'+(saveFailed?' error':'')} role="status">{notice||'직업·성장 설정은 이 기기에 저장됩니다. 서버 전투 미연동.'}</p>
  {confirmClass&&<div className="tc-class-modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="tc-class-confirm-title" className="tc-class-modal">
   <h2 id="tc-class-confirm-title">{job.name} 직업을 선택하시겠습니까?</h2>
   <p>이 직업 화면에서는 최초 선택 이후 다른 직업으로 변경할 수 없습니다. 현재 설정은 이 기기에만 저장됩니다.</p>
   <div className="tc-class-modal-actions"><button onClick={()=>setConfirmClass(false)}>취소</button><button className="primary" onClick={commitClass}>직업 확정</button></div>
  </section></div>}
  {stageOpen!==null&&<div className="tc-class-modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="tc-class-stage-title" className="tc-class-modal tc-class-stage-modal">
   <header><div><small>{STAGE_LABELS[CLASS_STAGE_TYPES[stageOpen]]} · 3개 중 1개</small><h2 id="tc-class-stage-title">Lv.{CLASS_LEVELS[stageOpen]} 성장 선택</h2></div><button aria-label="닫기" onClick={()=>setStageOpen(null)}>×</button></header>
   <div className="tc-class-stage-options">{job.stages[stageOpen].options.map((option,i)=><button type="button" className={'tc-class-stage-option'+(progress.picks[stageOpen]===i?' picked':'')} key={option.name} onClick={()=>setConfirmGrowth(i)} disabled={!hasPersisted||level===null||level<CLASS_LEVELS[stageOpen]||progress.picks[stageOpen]!==null}>
    <span className="tc-class-option-index">{i+1}</span><span><strong>{option.name}</strong><small>{option.description}</small>{option.mp!==undefined&&<em>MP {option.mp} · 재사용 {option.cooldown}턴</em>}</span><span>{progress.picks[stageOpen]===i?'✓':'○'}</span>
   </button>)}</div>
   <p>{!hasPersisted?'먼저 직업을 선택해야 합니다.':level===null?'레벨을 조회하지 못했습니다.':level<CLASS_LEVELS[stageOpen]?'레벨 '+CLASS_LEVELS[stageOpen]+' 달성 후 선택할 수 있습니다.':progress.picks[stageOpen]!==null?'이 단계의 성장 선택이 완료되었습니다.':'한 가지 능력만 선택할 수 있습니다.'}</p>
   <div className="tc-class-modal-actions"><button onClick={()=>setStageOpen(null)}>닫기</button></div>
   {confirmGrowth!==null&&<div className="tc-class-growth-confirm"><strong>{job.stages[stageOpen].options[confirmGrowth].name}</strong><p>이 성장 선택을 확정하시겠습니까? 이 화면에서는 선택한 능력을 다시 바꿀 수 없습니다.</p><div className="tc-class-modal-actions"><button onClick={()=>setConfirmGrowth(null)}>취소</button><button className="primary" onClick={()=>chooseGrowth(confirmGrowth)}>선택 확정</button></div></div>}
  </section></div>}
 </section>;
}
