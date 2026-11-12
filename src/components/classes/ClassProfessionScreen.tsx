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
const ART_ROOT='assets/classes/skilltree-20261111/';
const CREST=ART_ROOT+'warrior-lion-crest-v1.webp';
const GROWTH_ICONS=ART_ROOT+'warrior-growth-icons-aligned-v2.svg';
// One optimized 3-column rune atlas is shared by every profession and ability type.
const RUNE_ART=ART_ROOT+'choice-runes-gold-violet-crimson-v1.webp';
const TYPE_NAME={active:'액티브',passive:'패시브',trait:'특성'} as const;
const KEY=(id:string|null)=>'tower-class-progression-v1:'+(id??'guest');
/** Display-only recommendation. Prefer a claimable, unchosen stage; otherwise show the next future stage. */
export function recommendedClassStage(picks:readonly (number|null)[],level:number):number{
 const claimable=CLASS_LEVELS.findIndex((required,i)=>required<=level&&picks[i]===null);
 if(claimable!==-1)return claimable;
 const future=CLASS_LEVELS.findIndex((required,i)=>required>level&&picks[i]===null);
 return future!==-1?future:9;
}
function readProgress(id:string|null):ClassProgress{
 try{return normalizeClassProgress(JSON.parse(localStorage.getItem(KEY(id))??'null'));}
 catch{return initialClassProgress();}
}
const glyphFor=(id:ClassId)=>id==='warrior'?'sword':id==='mage'?'staff':'bow';
const skillGlyph=(type:string,i:number)=>type==='trait'?'skills':type==='passive'?'defense':i===9?'skills':'sword';
function stageSpriteStyle(i:number):React.CSSProperties{
 // Normalized 5×2 atlas contains only the centered icon artwork. Each tile has
 // the same bounds, so there is no per-level zoom or positional drift.
 return {backgroundImage:'url('+assetUrl(GROWTH_ICONS)+')',
  backgroundSize:'500% 200%',backgroundPosition:(i%5*25)+'% '+(i<5?'0%':'100%')};
}

export function ClassProfessionScreen({userId,lease}:Props){
 const [progress,setProgress]=useState<ClassProgress>(initialClassProgress);
 const [preview,setPreview]=useState<ClassId>('warrior');
 const [ready,setReady]=useState(false);
 const [level,setLevel]=useState<number|null>(null);
 const [selectedStage,setSelectedStage]=useState(0);
 const [previewChoice,setPreviewChoice]=useState<number|null>(null);
 const [confirmClass,setConfirmClass]=useState(false);
 const [confirmGrowth,setConfirmGrowth]=useState(false);
 const [battleOpen,setBattleOpen]=useState(false);
 const [dirty,setDirty]=useState(false);
 const [notice,setNotice]=useState('');
 const [saveFailed,setSaveFailed]=useState(false);
 useEffect(()=>{
  const saved=readProgress(userId);
  setProgress(saved);setPreview(saved.classId??'warrior');setReady(true);
  setDirty(false);setNotice('');setConfirmClass(false);
  setConfirmGrowth(false);setBattleOpen(false);setPreviewChoice(null);
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
 useEffect(()=>{
  if(ready&&level!==null){setSelectedStage(recommendedClassStage(readProgress(userId).picks,level));setPreviewChoice(null);}
 },[ready,level,userId]);
 const visibleId=progress.classId??preview;
 const job=CLASS_CATALOG[visibleId];
 const hasPersisted=progress.classId!==null;
 const activeSkills=useMemo(()=>getActiveSkills(progress),[progress]);
 const displaySlots=Array.from({length:5},(_,i)=>activeSkills[i]??null);
 const chosenCount=progress.picks.filter(x=>x!==null).length;
 const stage=job.stages[selectedStage];
 const learnedChoice=progress.picks[selectedStage];
 const selectedChoice=learnedChoice??previewChoice;
 const detailChoice=stage.options[selectedChoice??0];
 const isDetailPreview=selectedChoice===null;
 const unlocked=level!==null&&level>=stage.level;
 const canLearn=ready&&hasPersisted&&unlocked&&learnedChoice===null&&previewChoice!==null;
 function commitClass(){
  if(!ready||hasPersisted)return;
  const next=chooseInitialClass(progress,preview);
  try{
   localStorage.setItem(KEY(userId),JSON.stringify(next));
   setProgress(next);setSaveFailed(false);
   setNotice('직업이 확정되었습니다. 이후 직업은 변경할 수 없습니다.');
  }catch{
   setSaveFailed(true);setNotice('직업 저장에 실패했습니다. 저장 공간을 확인해 주세요.');
  }
  setConfirmClass(false);
 }
 function chooseGrowth(){
  if(!canLearn||previewChoice===null)return;
  const next=chooseClassGrowth(progress,selectedStage,previewChoice,level!);
  if(next===progress)return;
  try{
   localStorage.setItem(KEY(userId),JSON.stringify(next));
   setProgress(next);setDirty(false);setSaveFailed(false);
   setNotice('Lv.'+stage.level+' '+stage.options[previewChoice].name+' 능력을 확정했습니다.');
  }catch{
   setSaveFailed(true);setNotice('능력 저장에 실패했습니다. 다시 시도해 주세요.');
  }
  setConfirmGrowth(false);
 }
 function saveDraft(){
  if(!ready||!hasPersisted)return;
  try{
   localStorage.setItem(KEY(userId),JSON.stringify(progress));
   setDirty(false);setSaveFailed(false);
   setNotice('전투 스킬 순서를 이 기기에 저장했습니다.');
   setBattleOpen(false);
  }catch{
   setSaveFailed(true);setNotice('스킬 순서 저장에 실패했습니다.');
  }
 }
 function selectStage(i:number){setSelectedStage(i);setPreviewChoice(null);setConfirmGrowth(false);}
 const status=learnedChoice!==null?'습득 완료':!hasPersisted?'직업 선택 필요':!unlocked?'Lv.'+stage.level+' 달성 필요':'3개 중 하나를 선택하세요';
 return <section className="tc-class-page" aria-label="직업 화면" data-selected-job={visibleId} style={{
  '--tc-class-frame':'url('+assetUrl('assets/backgrounds/classes/class-ornament-frame-v1.svg')+')'
 } as React.CSSProperties}>
  <div className="tc-class-ambience" aria-hidden="true" style={{
   backgroundImage:'linear-gradient(180deg,rgba(8,6,14,.68),rgba(13,7,14,.8)),url('+assetUrl('assets/backgrounds/classes/class-library-redmoon-approved-v2.webp')+')'
  }}/>
  <nav className="tc-class-tabs" aria-label="직업 선택">
   {IDS.map(id=>{
    const item=CLASS_CATALOG[id];
    return <button key={id} type="button" aria-pressed={visibleId===id}
      className={'tc-class-tab tc-feel-press'+(visibleId===id?' active':'')} data-game-feel="press"
      disabled={hasPersisted&&progress.classId!==id}
      onClick={()=>{if(!hasPersisted){setPreview(id);setPreviewChoice(null);}}}>
      <span>{item.name}</span>
    </button>;
   })}
  </nav>
  <section className="tc-class-featured" aria-label="직업 소개">
   <div className="tc-class-crest" aria-hidden="true">
    {visibleId==='warrior'?<img src={assetUrl(CREST)} alt=""/>:<Glyph name={glyphFor(visibleId)}/>}
   </div>
   <h2>{job.name+' 스킬트리'}</h2>
   <p>10레벨마다 3가지 중 1개를 선택해 성장합니다.</p>
   <span className="tc-class-feature-progress">{chosenCount}/10 습득 · {level===null?'레벨 조회 중':'Lv.'+level}</span>
   <div className="tc-class-feature-tools">
    {!hasPersisted?<button type="button" className="tc-class-pickjob tc-feel-press" onClick={()=>setConfirmClass(true)} disabled={!ready}>이 직업으로 시작</button>
    :<button type="button" className="tc-class-battle-open tc-feel-press" onClick={()=>setBattleOpen(true)}>전투 배치 <Glyph name="sword"/></button>}
   </div>
  </section>
  <section className="tc-class-growth tc-class-path" aria-label="전체 성장 단계">
   <div className="tc-class-milestones" role="group" aria-label="10레벨부터 100레벨까지 성장 단계">
    {CLASS_LEVELS.map((required,i)=>{
     const kind=CLASS_STAGE_TYPES[i],learned=progress.picks[i]!==null;
     const stageState=learned?'learned':level===null?'pending':level>=required?'available':'locked';
     const stageStateLabel=stageState==='learned'?'완료':stageState==='available'?'선택 가능':stageState==='locked'?'잠김':'조회 중';
     return <button type="button" key={required}
      aria-label={'Lv.'+required+' '+(kind==='active'?'스킬':TYPE_NAME[kind])+' 선택지 확인'}
      aria-pressed={selectedStage===i}
      data-stage-state={stageState} title={'Lv.'+required+' · '+stageStateLabel}
      className={'tc-class-milestone'+(selectedStage===i?' selected':'')+(learned?' learned':'')+(stageState==='available'?' available':'')+(stageState==='locked'?' locked':'')}
      onClick={()=>selectStage(i)}>
      <span className="tc-class-level">Lv.{required}</span>
      <span className="tc-class-milestone-icon">
       {visibleId==='warrior'?<span className="tc-class-node-sprite" aria-hidden="true" style={stageSpriteStyle(i)}/>
       :<Glyph name={skillGlyph(kind,i)}/>}
       {learned&&<span className="tc-class-acquired">✓</span>}
      </span>
      <span className="tc-class-node-kind">{i===9?'궁극기':TYPE_NAME[kind]}</span>
      <span className="tc-class-node-state" aria-hidden="true">{stageStateLabel}</span>
     </button>;
    })}
   </div>
  </section>
  <section className="tc-class-choices" aria-label="선택한 성장 단계">
   <div className="tc-class-choices-heading"><strong>Lv.{stage.level} · {selectedStage===9?'궁극기':TYPE_NAME[stage.type]} 선택</strong><span>3개 중 1개</span></div>
   <div className="tc-class-choice-grid" role="group" aria-label="스킬 선택지">
    {stage.options.map((choice,i)=>{
     const selected=selectedChoice===i;
     const blocked=learnedChoice!==null&&learnedChoice!==i;
     return <button key={i} type="button" aria-pressed={selected}
      className={'tc-class-choice-card tc-feel-press'+(selected?' chosen':'')+(blocked?' rejected':'')}
      title={choice.name+' · '+choice.description+(choice.mp!==undefined?' · MP '+choice.mp+' · 대기 '+choice.cooldown+'턴':'')}
      onClick={()=>{if(learnedChoice===null)setPreviewChoice(i);}}
      disabled={learnedChoice!==null}>
      {selected&&<span className="tc-class-choice-mark">{learnedChoice===i?'습득 완료':'선택 중'} <span aria-hidden="true">✓</span></span>}
      <span className="tc-class-choice-art" aria-hidden="true" style={{
       backgroundImage:'url('+assetUrl(RUNE_ART)+')',
       backgroundSize:'300% 100%',backgroundPosition:(i*50)+'% 50%',
      }}/>
      <strong>{choice.name}</strong>
      <small className="tc-class-choice-description">{choice.description}</small>
      {choice.mp!==undefined&&<em>MP {choice.mp} · 대기 {choice.cooldown}턴</em>}
     </button>;
    })}
   </div>
   <div className="tc-class-choice-detail" aria-live="polite">
    <strong>{isDetailPreview?'미리보기 · ':''}{detailChoice.name}</strong>
    <span>{detailChoice.description}</span>
    <em>{detailChoice.mp!==undefined?'MP '+detailChoice.mp+' · 대기 '+detailChoice.cooldown+'턴':'상시 적용'}</em>
   </div>
   <div className="tc-class-choices-warning" role="note">
    <Glyph name={learnedChoice!==null?'defense':'other'}/>
    <span>{learnedChoice!==null?'선택이 완료된 단계입니다. 변경할 수 없습니다.':unlocked?'선택하지 않은 두 능력은 습득하지 않습니다.':status}</span>
   </div>
  </section>
  <footer className="tc-class-footer">
   <button type="button" className="tc-class-confirm tc-feel-press" data-game-feel="press" disabled={!canLearn}
    onClick={()=>setConfirmGrowth(true)}>
    <span aria-hidden="true">✦</span> {learnedChoice!==null?'습득 완료':'이 능력으로 확정'}
   </button>
   <p>선택한 직업은 변경할 수 없습니다.</p>
  </footer>
  <p className={'tc-class-status'+(saveFailed?' error':'')} role="status">{notice||'직업·성장은 이 기기에 저장되며 서버 전투에는 아직 연결되지 않습니다.'}</p>
  {confirmClass&&<div className="tc-class-modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="tc-class-choose-title" className="tc-class-modal">
   <h3 id="tc-class-choose-title">{job.name} 직업으로 시작하시겠습니까?</h3>
   <p>직업 선택 후 다른 직업으로 변경할 수 없습니다. 이 선택은 현재 기기에 저장됩니다.</p>
   <div className="tc-class-modal-actions"><button type="button" onClick={()=>setConfirmClass(false)}>취소</button><button className="primary" type="button" onClick={commitClass}>직업 확정</button></div>
  </section></div>}
  {confirmGrowth&&<div className="tc-class-modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="tc-class-growth-title" className="tc-class-modal">
   <h3 id="tc-class-growth-title">Lv.{stage.level} · {previewChoice===null?'능력':stage.options[previewChoice].name}</h3>
   <p>이 능력으로 확정하면 같은 단계의 다른 두 능력은 습득할 수 없습니다. 확정 후 변경할 수 없습니다.</p>
   <div className="tc-class-modal-actions"><button type="button" onClick={()=>setConfirmGrowth(false)}>취소</button><button type="button" className="primary" onClick={chooseGrowth}>영구 확정</button></div>
  </section></div>}
  {battleOpen&&<div className="tc-class-modal-backdrop"><section role="dialog" aria-modal="true" aria-label="전투 배치" className="tc-class-modal tc-class-battle-modal">
   <header><h3>전투 배치 <small>자동 전투 스킬 순서</small></h3><button type="button" aria-label="전투 배치 닫기" className="tc-class-modal-close" onClick={()=>setBattleOpen(false)}>×</button></header>
   <p className="tc-class-battle-help">위에서부터 사용 가능한 스킬을 시전합니다. 모두 불가능하면 기본 공격합니다.</p>
   <div className="tc-class-skill-list">
    {displaySlots.map((item,i)=><div key={item?.stage??'empty-'+i} className={'tc-class-skill-row'+(!item?' vacant':'')}>
     <span className="tc-class-rank-seal">{i+1}</span>
     <span className="tc-class-skill-symbol"><Glyph name={glyphFor(visibleId)}/></span>
     <span className="tc-class-skill-text"><strong>{item?.skill.name??'미습득 스킬'}</strong><small>{item?'MP '+(item.skill.mp??'—')+' · 대기 '+(item.skill.cooldown??'—')+'턴':'레벨 달성 후 습득'}</small></span>
     <div className="tc-class-move">
      <button type="button" aria-label={'스킬 '+(i+1)+'번 위로 이동'} disabled={!item||i===0} onClick={()=>{setProgress(v=>moveClassSkill(v,i,-1));setDirty(true);}}>▲</button>
      <button type="button" aria-label={'스킬 '+(i+1)+'번 아래로 이동'} disabled={!item||i>=activeSkills.length-1} onClick={()=>{setProgress(v=>moveClassSkill(v,i,1));setDirty(true);}}>▼</button>
     </div>
    </div>)}
   </div>
   <div className="tc-class-modal-actions tc-class-battle-actions">
    <button type="button" disabled={!hasPersisted||activeSkills.length<2} onClick={()=>{setProgress(v=>defaultClassSkillOrder(v));setDirty(true);}}>기본 순서</button>
    <button type="button" className="primary" disabled={!ready||!hasPersisted} onClick={saveDraft}>{dirty?'순서 저장':'저장'}</button>
   </div>
  </section></div>}
 </section>;
}