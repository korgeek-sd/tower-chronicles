import React,{useEffect,useMemo,useState} from 'react';
import type {GameState} from '../game/types';
import {JOB_CATALOG,JOB_RARITIES,jobById,type JobRarity} from '../game/jobs/catalog';
import {setCurrentJob} from '../game/jobs/service';
import {getOnlineJobRegistrationState,registerOnlineJob,setOnlineJobRegistrationPickups,type OnlineJobRegistrationResult,type OnlineJobRegistrationState} from '../online/economy';
import type {GameplayLease} from '../online/gameSession';
import type {CloudSaveRecord} from '../online/cloudSave';
import {Pager,Screen,Segments} from '../ui/mobile';

const PAGE_SIZE=5;
export type JobTab='register'|'list';

const RATE_LABELS:[JobRarity,string][]=[
 ['C','51%'],['B','30%'],['A','13%'],['SR','5%'],['SSR','1%'],
];

function jobName(id:string|null){return jobById(id)?.displayName??'미지정';}

export function JobsScreen({
 game,setGame,onSelectJob,onlineLease,onServerRecord,initialTab='register',
}:{
 game:GameState;
 setGame:React.Dispatch<React.SetStateAction<GameState>>;
 onSelectJob?:(jobId:string)=>void;
 onlineLease?:GameplayLease|null;
 onServerRecord?:(record:CloudSaveRecord,message:string)=>void;
 initialTab?:JobTab;
}){
 const [tab,setTab]=useState<JobTab>(initialTab);
 const [rarity,setRarity]=useState<(typeof JOB_RARITIES)[number]>(JOB_RARITIES[0]);
 const [page,setPage]=useState(0);
 const [registration,setRegistration]=useState<OnlineJobRegistrationState|null>(null);
 const [result,setResult]=useState<OnlineJobRegistrationResult|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');

 const current=jobById(game.currentJobId);
 const list=useMemo(()=>JOB_CATALOG.filter(j=>j.rarity===rarity),[rarity]);
 const pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));
 const safe=Math.min(page,pages-1);
 const shown=list.slice(safe*PAGE_SIZE,safe*PAGE_SIZE+PAGE_SIZE);
 const tabs=JOB_RARITIES.map(r=>[r,r] as [(typeof JOB_RARITIES)[number],string]);
 const srJobs=JOB_CATALOG.filter(job=>job.rarity==='SR');
 const ssrJobs=JOB_CATALOG.filter(job=>job.rarity==='SSR');
 const gold=registration?.gold??game.market.gold;
 const canRegister=!!onlineLease&&!game.expedition&&!busy;

 useEffect(()=>{
  if(tab!=='register'||!onlineLease){setRegistration(null);setMessage(onlineLease?'':'온라인 플레이 세션에서 이용할 수 있습니다.');return;}
  let disposed=false;
  setBusy(true);setMessage('');
  void getOnlineJobRegistrationState(onlineLease)
   .then(state=>{if(!disposed)setRegistration(state);})
   .catch(error=>{if(!disposed)setMessage(error instanceof Error?error.message:'직능등록 상태를 불러오지 못했습니다.');})
   .finally(()=>{if(!disposed)setBusy(false);});
  return()=>{disposed=true;};
 },[tab,onlineLease?.leaseId,onlineLease?.generation]);

 async function changePickup(kind:'sr'|'ssr',jobId:string){
  if(!onlineLease||!registration||busy)return;
  setBusy(true);setMessage('');
  try{
   const next={...registration.pickups,[kind]:jobId||null};
   const state=await setOnlineJobRegistrationPickups(onlineLease,next);
   setRegistration(state);
   setMessage((kind==='sr'?'SR':'SSR')+' 집중 열람 기록을 변경했습니다.');
  }catch(error){setMessage(error instanceof Error?error.message:'픽업 직능을 변경하지 못했습니다.');}
  finally{setBusy(false);}
 }

 async function draw(paidRolls:1|10){
  if(!onlineLease||busy)return;
  setBusy(true);setMessage('');
  try{
   const next=await registerOnlineJob(onlineLease,paidRolls);
   setRegistration(next.state);setResult(next);
   if(onServerRecord)onServerRecord(next.record,paidRolls===10?'10+1 직능등록 결과를 서버에 반영했습니다.':'직능등록 결과를 서버에 반영했습니다.');
   else setGame(next.record.payload);
  }catch(error){setMessage(error instanceof Error?error.message:'직능등록 요청을 처리하지 못했습니다.');}
  finally{setBusy(false);}
 }

 return <Screen eyebrow="NOVAR ARCHIVE / JOB RECORD" title="직능" meta={<span>{tab==='register'?'직능등록':current?.displayName??'미선택'}</span>}>
  <div className="tc-job-hub">
   <Segments items={[['register','직능등록'],['list','직능목록']] as const} value={tab} onChange={value=>{setTab(value);setResult(null);setMessage('');}} label="직능 메뉴"/>
   {tab==='list'?<div className="tc-jobs tc-job-list-mode">
    <div className="tc-floor-risk">{game.expedition?'원정 중에는 직능을 변경할 수 없습니다.':'직능은 패시브 2개와 액티브 3개의 고정 전투 키트입니다.'}</div>
    <Segments items={tabs} value={rarity} onChange={v=>{setRarity(v);setPage(0);}} label="직능 등급"/>
    <div className="tc-job-list">{shown.map(job=>{const owned=game.ownedJobIds.includes(job.id),selected=game.currentJobId===job.id;return <article className="tc-job" key={job.id}><div><b>{job.displayName}</b><small>{job.combatKit?'전투 키트 준비됨':'전투 키트 미구현'} · {owned?'등록 직능':'미등록 직능'}</small></div><button disabled={!!game.expedition||!owned||selected} onClick={()=>onSelectJob?onSelectJob(job.id):setGame(s=>setCurrentJob(s,job.id))}>{selected?'선택 중':owned?'선택':'미보유'}</button></article>})}{Array.from({length:Math.max(0,PAGE_SIZE-shown.length)},(_,i)=><div className="tc-job" aria-hidden="true" key={'j'+i}/>)}</div>
    <Pager page={safe} count={pages} onChange={setPage}/>
   </div>:result?<RegistrationResult result={result} onClose={()=>setResult(null)}/>:<div className="tc-registration">
    <section className="tc-reg-pickups" aria-label="집중 열람 직능">
     <label><span><b>SR 집중 열람</b><small>SR 등장 시 지정 직능 50%</small></span><select disabled={!onlineLease||busy} value={registration?.pickups.sr??''} onChange={e=>void changePickup('sr',e.target.value)}><option value="">미지정</option>{srJobs.map(job=><option key={job.id} value={job.id}>{job.displayName}</option>)}</select></label>
     <label><span><b>SSR 집중 열람</b><small>SSR 등장 시 지정 직능 50%</small></span><select disabled={!onlineLease||busy} value={registration?.pickups.ssr??''} onChange={e=>void changePickup('ssr',e.target.value)}><option value="">미지정</option>{ssrJobs.map(job=><option key={job.id} value={job.id}>{job.displayName}</option>)}</select></label>
    </section>

    <section className={'tc-reg-vault'+(busy?' is-working':'')} aria-live="polite">
     <div className="tc-reg-vault-lines" aria-hidden="true"/>
     <div className="tc-reg-vault-icon" aria-hidden="true"><i/><i/><span/></div>
     <small>SEALED JOB RECORD</small>
     <h2>봉인 직능기록함</h2>
     <p>{busy?'기록을 판독하고 있습니다.':'Gold를 지불해 봉인된 직능기록을 열람합니다.'}</p>
     <div className="tc-reg-focus"><span>SR</span><b>{jobName(registration?.pickups.sr??null)}</b><i/><span>SSR</span><b>{jobName(registration?.pickups.ssr??null)}</b></div>
    </section>

    <div className="tc-reg-status">
     <div><small>보유 GOLD</small><b>{gold.toLocaleString()}</b></div>
     <div><small>잔여 기록</small><b>{(registration?.residualRecords??0).toLocaleString()}</b></div>
     <div><small>보장 / 천장</small><b>없음</b></div>
    </div>

    <div className="tc-reg-rates" aria-label="직능등록 확률">{RATE_LABELS.map(([r,label])=><span key={r} className={'rarity-'+r.toLowerCase()}><b>{r}</b>{label}</span>)}</div>

    <div className="tc-reg-actions">
     <button className="tc-reg-draw single" disabled={!canRegister||gold<100} onClick={()=>void draw(1)}><span>1회 등록</span><small>100 Gold · 기록 1개</small></button>
     <button className="tc-reg-draw ten" disabled={!canRegister||gold<1000} onClick={()=>void draw(10)}><span>10+1 등록</span><small>1,000 Gold · 총 11개</small></button>
    </div>

    <div className="tc-reg-note" role="status"><span>{message||(!onlineLease?'Google 로그인 후 활성 플레이 세션에서 이용할 수 있습니다.':'모든 결과는 서버에서 독립 판정됩니다. 픽업 실패 보정은 없습니다.')}</span><small>외부 UI 이미지 에셋 없이 서버 판정 결과만 표시합니다.</small></div>
   </div>}
  </div>
 </Screen>;
}

function RegistrationResult({result,onClose}:{result:OnlineJobRegistrationResult;onClose:()=>void}){
 const single=result.results.length===1;
 if(single){
  const entry=result.results[0],job=jobById(entry.jobId);
  return <div className="tc-reg-result tc-reg-result-single" key={result.requestId}>
   <section className={'tc-reg-reveal rarity-'+entry.rarity.toLowerCase()}>
    <div className="tc-reg-reveal-burst" aria-hidden="true"/>
    <div className="tc-reg-record-icon" aria-hidden="true"><i/><i/></div>
    <small>직능기록 판독 완료</small>
    <h2>{job?.displayName??entry.jobId}</h2>
    <strong>{entry.rarity}{entry.pickup?' · 집중 열람':''}</strong>
    <p>{entry.newlyUnlocked?'신규 직능 해금':entry.residualGained>0?'★★★ 초과 · 잔여 기록 +'+entry.residualGained:'직능 기록 +1 · '+entry.recordCount+'/60'}</p>
   </section>
   <div className="tc-reg-result-foot"><span>{result.goldCost.toLocaleString()} Gold 사용 · 잔액 {result.goldAfter.toLocaleString()} Gold</span><button className="tc-action" onClick={onClose}>기록함으로</button></div>
  </div>;
 }
 return <div className="tc-reg-result tc-reg-result-multi" key={result.requestId}>
  <div className="tc-reg-result-head"><div><small>JOB RECORD BATCH</small><b>10+1 판독 완료</b></div><span>{result.goldAfter.toLocaleString()} Gold</span></div>
  <div className="tc-reg-result-grid" aria-label="10+1 직능등록 결과">{result.results.map((entry,index)=>{const job=jobById(entry.jobId);return <article className={'tc-reg-mini rarity-'+entry.rarity.toLowerCase()} key={index} style={{'--i':index} as React.CSSProperties}>
   <div className="tc-reg-record-icon" aria-hidden="true"><i/><i/></div>
   <strong>{entry.rarity}</strong>
   <b>{job?.displayName??entry.jobId}</b>
   <small>{entry.newlyUnlocked?'NEW':entry.residualGained>0?'잔여 +'+entry.residualGained:entry.recordCount+'/60'}{entry.pickup?' · PICKUP':''}</small>
  </article>;})}</div>
  <div className="tc-reg-result-foot"><span>1,000 Gold · 11회 독립 판정</span><button className="tc-action" onClick={onClose}>확인</button></div>
 </div>;
}
