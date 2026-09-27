import React,{useEffect,useMemo,useState} from 'react';
import type {GameState} from '../game/types';
import {JOB_CATALOG,JOB_RARITIES,jobById,type JobRarity} from '../game/jobs/catalog';
import {
 JOB_RECORD_EXCHANGE_COST,
 JOB_RECORD_EXCHANGE_LIMIT,
 JOB_RECOMMENDATION_COST,
 JOB_RECOMMENDATION_WEEKLY_LIMIT,
 JOB_RESIDUAL_VALUE,
} from '../game/jobs/registration';
import {setCurrentJob} from '../game/jobs/service';
import {
 exchangeOnlineJobResidualRecommendation,
 exchangeOnlineJobResidualRecord,
 getOnlineJobRegistrationState,
 registerOnlineJob,
 setOnlineJobRegistrationPickups,
 type OnlineJobRegistrationResult,
 type OnlineJobRegistrationState,
} from '../online/economy';
import type {GameplayLease} from '../online/gameSession';
import type {CloudSaveRecord} from '../online/cloudSave';
import {Pager,Screen,Segments} from '../ui/mobile';

const PAGE_SIZE=5;
export type JobTab='register'|'list';
type RegistrationView='draw'|'records'|'rates';

const RATE_LABELS:[JobRarity,string][]=[
 ['C','51%'],['B','30%'],['A','13%'],['SR','5%'],['SSR','1%'],
];

function jobName(id:string|null){return jobById(id)?.displayName??'미지정';}
function stageLabel(count:number){
 if(count>=60)return '★★★ MAX';
 if(count>=30)return `★★ ${count}/60`;
 if(count>=10)return `★ ${count}/30`;
 return `${count}/10 해금`;
}

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
 const [registerView,setRegisterView]=useState<RegistrationView>('draw');
 const [rarity,setRarity]=useState<(typeof JOB_RARITIES)[number]>(JOB_RARITIES[0]);
 const [recordRarity,setRecordRarity]=useState<(typeof JOB_RARITIES)[number]>('C');
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
 const recordJobs=JOB_CATALOG.filter(job=>job.rarity===recordRarity);
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

 async function exchangeRecord(jobId:string){
  if(!onlineLease||!registration||busy)return;
  setBusy(true);setMessage('');
  try{
   const next=await exchangeOnlineJobResidualRecord(onlineLease,jobId);
   setRegistration(next.state);
   const name=jobName(jobId);
   setMessage(next.result.newlyUnlocked?`${name} 직능이 해금되었습니다.`:`${name} 기록을 1개 교환했습니다.`);
   if(onServerRecord)onServerRecord(next.record,`${name} 직능 기록 교환을 서버에 반영했습니다.`);
   else setGame(next.record.payload);
  }catch(error){setMessage(error instanceof Error?error.message:'잔여 기록 교환을 처리하지 못했습니다.');}
  finally{setBusy(false);}
 }

 async function exchangeRecommendation(){
  if(!onlineLease||!registration||busy)return;
  setBusy(true);setMessage('');
  try{
   const next=await exchangeOnlineJobResidualRecommendation(onlineLease);
   setRegistration(next.state);
   setMessage('잔여 기록 30개를 협회 추천장 1장으로 교환했습니다.');
  }catch(error){setMessage(error instanceof Error?error.message:'협회 추천장 교환을 처리하지 못했습니다.');}
  finally{setBusy(false);}
 }

 return <Screen title="직능 기록실" meta={<span>{tab==='register'?'직능등록':current?.displayName??'미선택'}</span>}>
  <div className="tc-job-hub">
   <Segments items={[['register','직능등록'],['list','직능목록']] as const} value={tab} onChange={value=>{setTab(value);setResult(null);setMessage('');}} label="직능 메뉴"/>
   {tab==='list'?<div className="tc-jobs tc-job-list-mode">
    <div className="tc-floor-risk">{game.expedition?'원정 중에는 직능을 변경할 수 없습니다.':'직능마다 고유한 패시브 2개와 액티브 3개를 사용합니다.'}</div>
    <Segments items={tabs} value={rarity} onChange={v=>{setRarity(v);setPage(0);}} label="직능 등급"/>
    <div className="tc-job-list">{shown.map(job=>{const owned=game.ownedJobIds.includes(job.id),selected=game.currentJobId===job.id;return <article className="tc-job" key={job.id}><div><b>{job.displayName}</b><small>{job.combatKit?'능력 사용 가능':'능력 준비 중'} · {owned?'등록 직능':'미등록 직능'}</small></div><button disabled={!!game.expedition||!owned||selected} onClick={()=>onSelectJob?onSelectJob(job.id):setGame(s=>setCurrentJob(s,job.id))}>{selected?'선택 중':owned?'선택':'미보유'}</button></article>})}{Array.from({length:Math.max(0,PAGE_SIZE-shown.length)},(_,i)=><div className="tc-job" aria-hidden="true" key={'j'+i}/>)}</div>
    <Pager page={safe} count={pages} onChange={setPage}/>
   </div>:result?<RegistrationResult result={result} onClose={()=>setResult(null)}/>:<div className="tc-reg-shell">
    <div className="tc-reg-subnav"><Segments items={[['draw','등록'],['records','직능기록'],['rates','확률정보']] as const} value={registerView} onChange={value=>{setRegisterView(value);setMessage('');}} label="직능등록 세부 메뉴"/></div>
    {registerView==='draw'?<div className="tc-registration">
     <section className="tc-reg-pickups" aria-label="집중 열람 직능">
      <label><span><b>SR 집중 열람</b><small>SR 등장 시 지정 직능 50%</small></span><select disabled={!onlineLease||busy} value={registration?.pickups.sr??''} onChange={e=>void changePickup('sr',e.target.value)}><option value="">미지정</option>{srJobs.map(job=><option key={job.id} value={job.id}>{job.displayName}</option>)}</select></label>
      <label><span><b>SSR 집중 열람</b><small>SSR 등장 시 지정 직능 50%</small></span><select disabled={!onlineLease||busy} value={registration?.pickups.ssr??''} onChange={e=>void changePickup('ssr',e.target.value)}><option value="">미지정</option>{ssrJobs.map(job=><option key={job.id} value={job.id}>{job.displayName}</option>)}</select></label>
     </section>

     <section className={'tc-reg-vault'+(busy?' is-working':'')} aria-live="polite">
      <div className="tc-reg-vault-lines" aria-hidden="true"/>
      <div className="tc-reg-vault-icon" aria-hidden="true"><i/><i/><span/></div>
      <small>노바르 기록실</small>
      <h2>봉인 직능기록함</h2>
      <p>{busy?'기록을 판독하고 있습니다.':'Gold를 지불해 봉인된 직능기록을 열람합니다.'}</p>
      <div className="tc-reg-focus"><span>SR</span><b>{jobName(registration?.pickups.sr??null)}</b><i/><span>SSR</span><b>{jobName(registration?.pickups.ssr??null)}</b></div>
     </section>

     <div className="tc-reg-status">
      <div><small>보유 GOLD</small><b>{gold.toLocaleString()}</b></div>
      <div><small>잔여 기록</small><b>{(registration?.residualRecords??0).toLocaleString()}</b></div>
      <div><small>협회 추천장</small><b>{(registration?.associationRecommendations??0).toLocaleString()}</b></div>
     </div>

     <div className="tc-reg-rates" aria-label="직능등록 확률">{RATE_LABELS.map(([r,label])=><span key={r} className={'rarity-'+r.toLowerCase()}><b>{r}</b>{label}</span>)}</div>

     <div className="tc-reg-actions">
      <button className="tc-reg-draw single" disabled={!canRegister||gold<100} onClick={()=>void draw(1)}><span>1회 등록</span><small>100 Gold · 기록 1개</small></button>
      <button className="tc-reg-draw ten" disabled={!canRegister||gold<1000} onClick={()=>void draw(10)}><span>10+1 등록</span><small>1,000 Gold · 총 11개</small></button>
     </div>

     <div className="tc-reg-note" role="status"><span>{message||(!onlineLease?'Google 로그인 후 이용할 수 있습니다.':'중복 기록은 직능 성장에 사용됩니다. 픽업 실패 보정은 없습니다.')}</span></div>
    </div>:registerView==='records'?<JobRecordExchange
      registration={registration}
      rarity={recordRarity}
      setRarity={setRecordRarity}
      jobs={recordJobs}
      online={!!onlineLease}
      expedition={!!game.expedition}
      busy={busy}
      message={message}
      onExchange={jobId=>void exchangeRecord(jobId)}
      onRecommendation={()=>void exchangeRecommendation()}
    />:<JobRateInfo/>}
   </div>}
  </div>
 </Screen>;
}

function JobRecordExchange({
 registration,rarity,setRarity,jobs,online,expedition,busy,message,onExchange,onRecommendation,
}:{
 registration:OnlineJobRegistrationState|null;
 rarity:JobRarity;
 setRarity:(rarity:JobRarity)=>void;
 jobs:typeof JOB_CATALOG;
 online:boolean;
 expedition:boolean;
 busy:boolean;
 message:string;
 onExchange:(jobId:string)=>void;
 onRecommendation:()=>void;
}){
 const quota=registration?.exchangeUsage?.[rarity];
 const residual=registration?.residualRecords??0;
 const recommendation=registration?.recommendationExchange;
 const cost=quota?.cost??JOB_RECORD_EXCHANGE_COST[rarity];
 const limit=quota?.limit??JOB_RECORD_EXCHANGE_LIMIT[rarity];
 const used=quota?.used??0;
 return <div className="tc-reg-records">
  <div className="tc-reg-record-summary">
   <div><small>잔여 기록</small><b>{residual.toLocaleString()}</b></div>
   <div><small>협회 추천장</small><b>{(registration?.associationRecommendations??0).toLocaleString()}</b></div>
   <div><small>{rarity} 교환 한도</small><b>{used}/{limit}</b></div>
  </div>
  <Segments items={JOB_RARITIES.map(r=>[r,r] as [JobRarity,string])} value={rarity} onChange={setRarity} label="기록 교환 등급"/>
  <div className="tc-reg-record-list">
   {jobs.map(job=>{
    const progress=registration?.records.find(row=>row.jobId===job.id);
    const count=progress?.recordCount??0;
    const maxed=count>=60;
    const disabled=!online||expedition||busy||maxed||residual<cost||used>=limit;
    return <article className={'tc-reg-record-row rarity-'+rarity.toLowerCase()} key={job.id}>
     <div><strong>{job.displayName}</strong><small>{stageLabel(count)}</small></div>
     <div className="tc-reg-record-progress" aria-label={job.displayName+' 기록 '+count+'개'}><i style={{width:Math.min(100,count/60*100)+'%'}}/></div>
     <button disabled={disabled} onClick={()=>onExchange(job.id)}>{maxed?'MAX':`+1 · ${cost}`}</button>
    </article>;
   })}
  </div>
  <button className="tc-reg-recommend" disabled={!online||expedition||busy||residual<(recommendation?.cost??JOB_RECOMMENDATION_COST)||(recommendation?.used??0)>=(recommendation?.limit??JOB_RECOMMENDATION_WEEKLY_LIMIT)} onClick={onRecommendation}>
   <span>협회 추천장 +1</span><small>잔여 기록 {recommendation?.cost??JOB_RECOMMENDATION_COST} · 주 {(recommendation?.used??0)}/{recommendation?.limit??JOB_RECOMMENDATION_WEEKLY_LIMIT}</small>
  </button>
  <div className="tc-reg-note" role="status"><span>{message||`${rarity==='SSR'?'월간':'주간'} 등급 공용 한도입니다. 교환한 기록도 10/30/60 성장 기준에 포함됩니다.`}</span></div>
 </div>;
}

function JobRateInfo(){
 return <div className="tc-reg-info">
  <section className="tc-reg-info-block">
   <header><b>기본 등장 확률</b><small>모든 결과 독립 판정</small></header>
   <div className="tc-reg-prob-grid">{RATE_LABELS.map(([rarity,label])=><div className={'rarity-'+rarity.toLowerCase()} key={rarity}><strong>{rarity}</strong><b>{label}</b><small>{rarity==='SR'?'픽업 직능 2.5%':rarity==='SSR'?'픽업 직능 0.5%':'등급 내 균등 선택'}</small></div>)}</div>
  </section>
  <section className="tc-reg-info-block tc-reg-rule-grid">
   <div><small>1회 등록</small><b>100 Gold</b><span>1개 결과</span></div>
   <div><small>10+1 등록</small><b>1,000 Gold</b><span>11개 독립 결과</span></div>
   <div><small>보장 / 천장</small><b>없음</b><span>픽업 실패 보정 없음</span></div>
  </section>
  <section className="tc-reg-info-block">
   <header><b>직능 기록 성장</b><small>모든 등급 동일</small></header>
   <div className="tc-reg-thresholds"><span><b>10</b>해금</span><span><b>30</b>★★</span><span><b>60</b>★★★</span></div>
  </section>
  <section className="tc-reg-info-block">
   <header><b>★★★ 초과 기록</b><small>잔여 기록으로 전환</small></header>
   <div className="tc-reg-residual-grid">{JOB_RARITIES.map(r=><span key={r} className={'rarity-'+r.toLowerCase()}><b>{r}</b>+{JOB_RESIDUAL_VALUE[r]}<small>교환 {JOB_RECORD_EXCHANGE_COST[r]}</small></span>)}</div>
  </section>
  <div className="tc-reg-info-foot">C/B/A/SR 교환 한도는 매주 월요일 00:00, SSR은 매월 1일 00:00(KST)에 초기화됩니다.</div>
 </div>;
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
  <div className="tc-reg-result-head"><div><small>직능등록 결과</small><b>10+1 판독 완료</b></div><span>{result.goldAfter.toLocaleString()} Gold</span></div>
  <div className="tc-reg-result-grid" aria-label="10+1 직능등록 결과">{result.results.map((entry,index)=>{const job=jobById(entry.jobId);return <article className={'tc-reg-mini rarity-'+entry.rarity.toLowerCase()} key={index} style={{'--i':index} as React.CSSProperties}>
   <div className="tc-reg-record-icon" aria-hidden="true"><i/><i/></div>
   <strong>{entry.rarity}</strong>
   <b>{job?.displayName??entry.jobId}</b>
   <small>{entry.newlyUnlocked?'NEW':entry.residualGained>0?'잔여 +'+entry.residualGained:entry.recordCount+'/60'}{entry.pickup?' · PICKUP':''}</small>
  </article>;})}</div>
  <div className="tc-reg-result-foot"><span>1,000 Gold · 11회 독립 판정</span><button className="tc-action" onClick={onClose}>확인</button></div>
 </div>;
}
