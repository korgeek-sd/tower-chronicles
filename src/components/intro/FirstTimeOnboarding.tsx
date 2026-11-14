import React,{useEffect,useState,type FormEvent} from 'react';
import {CLASS_CATALOG,type ClassId} from '../../game/classes/progression';
import {assetUrl} from '../../game/data/graphics';

import {validateNickname,type PlayerProfile} from '../../online/playerProfiles';
import {loadPermanentClass,lockPermanentClass} from '../../online/permanentClass';
import {hasSeenWorldIntro} from './worldIntroState';
import {hasOnboardingStorySeen,markOnboardingStorySeen,readOnboardingClass,adoptPermanentClass} from './firstTimeOnboardingState';
import './first-time-onboarding.css';

type Props={
 userId:string;
 onRegister:(nickname:string)=>Promise<PlayerProfile>;
 onReady:(profile:PlayerProfile)=>void;
 onLogout:()=>void;
};
const IDS:ClassId[]=['warrior','mage','archer'];
const ROLES:Record<ClassId,string>={
 warrior:'근접 공격 · 생존',mage:'마법 · 광역 공격',archer:'원거리 · 치명타'
};
const ONBOARDING_CLASS_ART:Record<ClassId,string>={
 warrior:'assets/classes/onboarding/warrior-card-v1.webp',
 mage:'assets/classes/onboarding/mage-card-v1.webp',
 archer:'assets/classes/onboarding/archer-card-v1.webp'
};

export function FirstTimeOnboarding({userId,onRegister,onReady,onLogout}:Props){
 const [lockedClass,setLockedClass]=useState<ClassId|null>(null);
 const [selected,setSelected]=useState<ClassId|null>(()=>typeof localStorage==='undefined'?null:readOnboardingClass(userId,localStorage));
 const [classChecked,setClassChecked]=useState(false);
 const [step,setStep]=useState<'class'|'name'>('class');
 const [value,setValue]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const validation=validateNickname(value);

 // Never allow a class confirmation before the account's immutable server record is checked.
 useEffect(()=>{
  let active=true;setClassChecked(false);
  void loadPermanentClass(userId).then(saved=>{
   if(!active)return;
   if(saved){setLockedClass(saved);setSelected(saved);adoptPermanentClass(userId,saved,localStorage);}
   else{const local=readOnboardingClass(userId,localStorage);if(local){setLockedClass(local);setSelected(local);}}
   setError('');setClassChecked(true);
  }).catch(err=>{if(active){setError(err instanceof Error?err.message:'서버 직업 기록을 확인하지 못했습니다.');setClassChecked(false);}});
  return()=>{active=false;};
 },[userId]);

 // Keep the original eight-chapter story untouched; replay it only for a new
 // account whose story has not been seen on this shared device.
 useEffect(()=>{
  const onFinished=()=>markOnboardingStorySeen(localStorage,userId);
  window.addEventListener('tower:world-intro-finished',onFinished);
  let frame=0;
  try{
   if(!hasOnboardingStorySeen(localStorage,userId)&&hasSeenWorldIntro(localStorage)){
    frame=window.requestAnimationFrame(()=>window.dispatchEvent(new Event('tower:replay-world-intro')));
   }
  }catch{/* A blocked presentation marker must not stop account creation. */}
  return()=>{window.removeEventListener('tower:world-intro-finished',onFinished);if(frame)window.cancelAnimationFrame(frame);};
 },[userId]);

 async function next(){
  if(!selected||busy||!classChecked)return;
  setBusy(true);setError('');
  try{
   // The explicit "선택 완료" action is the irrevocable server commit.
   const committed=await lockPermanentClass(userId,selected);
   adoptPermanentClass(userId,committed,localStorage);
   setLockedClass(committed);setSelected(committed);setStep('name');
  }catch(err){setError(err instanceof Error?err.message:'직업 확정에 실패했습니다. 다시 시도해 주세요.');}
  finally{setBusy(false);}
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy||!selected||!classChecked||validation.error)return;
  if(lockedClass!==selected){setError('직업을 먼저 서버에 확정해 주세요.');return;}
  setBusy(true);setError('');
  try{
   const profile=await onRegister(validation.nickname);
   if(profile.userId!==userId)throw new Error('로그인 계정이 변경됐습니다. 다시 확인해 주세요.');
   onReady(profile);
  }catch(err){
   // The initial profession is permanent once the server accepts it, even if
   // nickname registration fails. Retrying cannot change the server choice.
   setError(err instanceof Error?err.message:'기록을 저장하지 못했습니다. 다시 시도해 주세요.');
  }finally{setBusy(false);}
 }
 return <main className="tc-first" aria-label="새 귀환자 등록">
  <section className="tc-first__frame">
   <header className="tc-first__header">
    <span className="tc-first__eyebrow">TOWER CHRONICLES</span>
    <h1>탑의 기록</h1>
    <div className="tc-first__subtitle">— 새로운 기록 —</div>
    <button type="button" className="tc-first__logout" onClick={onLogout} disabled={busy}>로그아웃</button>
   </header>
   <nav className="tc-first__steps" aria-label="가입 단계">
    <span className="is-done"><b>1</b>스토리 ✓</span>
    <span className={step==='class'?'is-current':'is-done'} aria-current={step==='class'?'step':undefined}><b>2</b>직업{step==='name'?' ✓':''}</span>
    <span className={step==='name'?'is-current':''} aria-current={step==='name'?'step':undefined}><b>3</b>이름</span>
   </nav>
   {step==='class'?<>
    <div className="tc-first__lead">
     <h2>새로운 길을 선택하십시오.</h2>
     <p>선택 완료를 누르면 직업이 서버에 확정되며 변경할 수 없습니다.</p>
    </div>
    <div className="tc-first__class-grid" role="group" aria-label="시작 직업 선택">
     {IDS.map(id=>{
      const job=CLASS_CATALOG[id];
      const isSelected=selected===id;
      return <button key={id} type="button" className={'tc-first__class-card tc-feel-press'+(isSelected?' is-selected':'')} data-game-feel="press" aria-label={job.name+' · '+ROLES[id]} aria-pressed={isSelected} disabled={busy||!classChecked||(lockedClass!==null&&lockedClass!==id)} onClick={()=>{setSelected(id);setError('');}}>
       <span className="tc-first__portrait"><img src={assetUrl(ONBOARDING_CLASS_ART[id])} alt="" loading="eager"/></span>
      </button>;
     })}
    </div>
    <div className="tc-first__selection">
     <span className="tc-first__selection-icon" aria-hidden="true">✧</span>
     {selected?<div><strong>{CLASS_CATALOG[selected].name}</strong><p>{CLASS_CATALOG[selected].description}</p></div>:<div><strong>당신의 길은 아직 정해지지 않았습니다.</strong><p>위의 세 직업 중 하나를 선택하십시오.</p></div>}
    </div>
    {lockedClass&&<p className="tc-first__notice">이 직업은 서버에 고정됩니다. 변경할 수 없습니다.</p>}
    {error&&<p className="tc-first__notice" role="alert">{error}</p>}
    <footer className="tc-first__actions">
     <button type="button" className="tc-first__primary tc-feel-press" data-game-feel="press" disabled={!selected||busy||!classChecked} onClick={next}>선택 완료 <span aria-hidden="true">›</span></button>
    </footer>
   </>:<>
    <div className="tc-first__lead">
     <h2>기록에 남길 이름을 정하십시오.</h2>
     <p>잃어버린 과거를 대신할 새로운 이름입니다.</p>
    </div>
    <div className="tc-first__book">
     <div className="tc-first__book-ornament" aria-hidden="true">✦ ❖ ✦</div>
     <h2>새 이름</h2>
     <form id="tc-first-nickname" onSubmit={submit}>
      <label htmlFor="tc-first-name">귀환자의 이름</label>
      <input id="tc-first-name" value={value} onChange={e=>{setValue(e.target.value);setError('');}} autoComplete="off" spellCheck={false} maxLength={24} disabled={busy} placeholder="닉네임을 입력하세요" aria-describedby="tc-first-name-rule tc-first-name-error"/>
      <small id="tc-first-name-rule">한글·영문·숫자 2~12자 · 중복 불가 · 등록 후 변경 불가</small>
     </form>
     <div className="tc-first__book-divider" aria-hidden="true"/>
     <div className="tc-first__book-label">기록될 정보</div>
     <div className="tc-first__book-class">
      <span className="tc-first__book-sigil" aria-hidden="true">✧</span>
      <div><small>선택한 직업</small><strong>{selected?CLASS_CATALOG[selected].name:'—'}</strong><span>{selected?ROLES[selected]:'직업 미선택'}</span></div>
     </div>
     <p className="tc-first__warning">확정하면 직업이 계정에 영구 저장되며 변경할 수 없습니다.</p>
    </div>
    <p className="tc-first__form-error" id="tc-first-name-error" role="status">{error||(value?validation.error:'')||'\u00a0'}</p>
    <footer className="tc-first__actions is-name">
     <button type="button" className="tc-first__secondary" onClick={()=>{setStep('class');setError('');}} disabled={busy}>이전</button>
     <button type="submit" form="tc-first-nickname" className="tc-first__primary tc-feel-press" data-game-feel="press" disabled={!selected||busy||!classChecked||!!validation.error}>{busy?'기록 중…':'이 이름을 기록한다'} <span aria-hidden="true">›</span></button>
    </footer>
   </>}
  </section>
 </main>;
}
