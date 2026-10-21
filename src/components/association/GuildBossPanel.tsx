import React,{useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {getGuildBossState,attackGuildBoss,type GuildBossState,type GuildBossAttackResult,type GuildBossKind,type GuildBossInfo} from '../../online/guildBoss';
import './guildBoss.css';

const num=(value:number)=>Math.max(0,Math.trunc(value)).toLocaleString('ko-KR');
const remaining=(end:string,now:number)=>{
 const seconds=Math.max(0,Math.ceil((Date.parse(end)-now)/1000));
 const days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60);
 return days>0?days+'일 '+hours+'시간':hours>0?hours+'시간 '+minutes+'분':minutes+'분';
};
const isDefeated=(boss:GuildBossInfo)=>boss.remainingHp<=0;
const attackLabel=(boss:GuildBossInfo,busy:boolean,expedition:boolean)=>{
 if(busy)return '공격 처리 중…';
 if(isDefeated(boss))return '토벌 완료';
 if(boss.attacksLeft<=0)return '오늘의 공격 완료';
 if(expedition)return '원정 중 공격 불가';
 return '보스 공격';
};
const asset=(p:string)=>(import.meta.env?.BASE_URL??'/')+p;
const raidImage={
 DAILY:asset('assets/monsters/guild-bosses/famished_saint-left.webp'),
 WEEKLY:asset('assets/monsters/iron-bosses/echo_devourer.png'),
} as const;

export function GuildBossDetail({boss,now,result,busy,expedition,error,onFight,onReload,onDismiss,onAuction}:{
 boss:GuildBossInfo;now:number;result:GuildBossAttackResult|null;busy:boolean;expedition:boolean;error:string;
 onFight:()=>void;onReload:()=>void;onDismiss:()=>void;onAuction?:()=>void;
}){
 const daily=boss.kind==='DAILY';
 const bossName=daily?'굶주린 성자':boss.name;
 const defeated=isDefeated(boss);
 const pct=Math.max(0,Math.min(100,boss.maxHp>0?boss.remainingHp/boss.maxHp*100:0));
 const remainingAttempts=Math.max(0,Math.min(5,boss.attacksLeft));
 const disabled=busy||defeated||remainingAttempts===0||expedition;
 const latest=result?.encounterId===boss.encounterId?result:null;
 const first=boss.leaderboard[0];
 const close=(event:React.MouseEvent<HTMLButtonElement>)=>{
  event.currentTarget.closest('details')?.removeAttribute('open');
 };
 return <div className={'tc-boss-body '+(daily?'tc-boss-daily':'tc-boss-weekly')}>
  <div className="tc-boss-arena">
   <div className="tc-boss-art-glow" aria-hidden="true"/>
   <div className="tc-boss-art-figure" aria-hidden="true" style={{backgroundImage:'url("'+raidImage[boss.kind]+'")'}}/>
   <div className="tc-boss-arena-top">
    <span className="tc-boss-eyebrow">{daily?'DAILY RAID':'WEEKLY RAID'}</span>
    <span className={'tc-boss-status '+(defeated?'done':'')}>{defeated?'토벌 성공':'토벌 진행 중'}</span>
   </div>
   <div className="tc-boss-identity">
    <div className="tc-boss-title">
     <h2>{bossName}</h2>
     <p>{daily?'매일 00:00 새로운 보스 등장':'토요일 00:00 새로운 보스 등장'}</p>
     <span className="tc-boss-countdown">{defeated?'다음 보스 등장 대기':'교체까지 '+remaining(boss.cycleEnd,now)}</span>
    </div>
    <div className="tc-boss-mark" aria-hidden="true"><span>✦</span></div>
   </div>
   <div className="tc-boss-health" aria-label="길드 공동 보스 체력">
    <div className="tc-boss-health-label"><span>BOSS HP</span><strong>{num(boss.remainingHp)}<small> / {num(boss.maxHp)}</small></strong></div>
    <div className="tc-boss-health-meter">
     <div className="tc-boss-track" role="progressbar" aria-label="보스 남은 체력" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <span style={{width:pct+'%'}}/>
     </div>
     <strong>{pct.toFixed(1)}%</strong>
    </div>
   </div>
  </div>
  <div className="tc-boss-dashboard" aria-label="보스전 현황">
   <div className="tc-boss-attempts"><span>오늘 남은 공격</span><strong>{remainingAttempts}<small> / 5회</small></strong>
    <div className="tc-boss-attempt-pips" aria-label={'공격 가능 '+remainingAttempts+'회'}>
     {[0,1,2,3,4].map(i=><span key={i} className={i<remainingAttempts?'ready':'used'}/>)}
    </div>
   </div>
   <div className="tc-boss-damage"><span>내 누적 피해</span><strong>{num(boss.myDamage)}</strong></div>
   <div className="tc-boss-participants"><span>참여 길드원</span><strong>{num(boss.participants)}<small>명</small></strong></div>
   <div className="tc-boss-total"><span>길드 총 공격</span><strong>{num(boss.totalAttacks)}<small>회</small></strong></div>
  </div>
  <section className="tc-boss-result" aria-label="최근 전투 결과" role={latest?'status':undefined}>
   <div className="tc-boss-result-header">
    <b>최근 전투 결과</b>
    {latest&&<button type="button" onClick={onDismiss} aria-label="전투 결과 닫기">×</button>}
   </div>
   {latest?<div className="tc-boss-result-numbers">
    <div><span>이번 공격 피해</span><strong>+{num(latest.damage)}</strong></div>
    <div><span>남은 보스 HP</span><strong>{num(latest.remainingHp)}</strong></div>
   </div>:<div className="tc-boss-result-empty">보스를 공격하면 이곳에 피해량과 결과가 표시됩니다.</div>}
  </section>
  <div className="tc-boss-action">
   <button type="button" className="tc-boss-attack" disabled={disabled} onClick={onFight}>
    <span aria-hidden="true" className="tc-boss-attack-icon">⚔</span>
    <span>{attackLabel(boss,busy,expedition)}</span>
    {!disabled&&<small>{remainingAttempts}회 가능</small>}
    <span className="tc-boss-attack-chevron" aria-hidden="true">›</span>
   </button>
   <div className="tc-boss-reset"><span>공격 횟수는 매일 00:00 초기화</span><span>활력 소모 없음</span></div>
  </div>
  {error&&<div className="tc-boss-error" role="alert">
   <span>{error}</span><button type="button" disabled={busy} onClick={onReload}>상태 확인</button>
  </div>}
  <div className="tc-boss-expansion-grid">
   <details className="tc-boss-leaderboard">
    <summary><span className="tc-boss-ranking-icon" aria-hidden="true">♜</span>
     <span className="tc-boss-ranking-title">길드 피해량 순위</span>
     <span className="tc-boss-ranking-preview">{first?'1위 '+first.name+' · '+num(first.damage):'기록 없음'}</span>
     <span className="tc-boss-chevron" aria-hidden="true">⌄</span>
    </summary>
    <div className="tc-boss-popover tc-boss-ranking-list">
     <header><b>길드 피해량 순위</b><button type="button" onClick={close} aria-label="피해량 순위 닫기">닫기 ×</button></header>
     <div className="tc-boss-popover-scroll">
      {boss.leaderboard.length?boss.leaderboard.slice(0,10).map((member,i)=><div className="tc-boss-ranking-row" key={member.userId}>
       <b>{i+1}</b><span>{member.name}</span><strong>{num(member.damage)}</strong><small>{member.attacks}회</small>
      </div>):<p>아직 참여한 길드원이 없습니다.</p>}
     </div>
     <div className="tc-boss-ranking-total">길드 전체 누적 공격 {num(boss.totalAttacks)}회</div>
    </div>
   </details>
   <details className="tc-boss-turn-details">
    <summary><span className="tc-boss-ranking-icon" aria-hidden="true">☷</span><span className="tc-boss-ranking-title">턴별 전투 기록</span>
     <span className="tc-boss-ranking-preview">{latest?latest.combat.turns.length+'턴 보기':'기록 없음'}</span>
     <span className="tc-boss-chevron" aria-hidden="true">⌄</span>
    </summary>
    <div className="tc-boss-popover tc-boss-turn-list">
     <header><b>턴별 전투 기록</b><button type="button" onClick={close} aria-label="전투 기록 닫기">닫기 ×</button></header>
     <div className="tc-boss-popover-scroll">
      {latest?latest.combat.turns.map(t=><p key={t.turn}><b>{t.turn}T</b><span>{t.lines.map(line=>boss.name?line.split(boss.name).join(bossName):line).join(' · ')}</span></p>):<p>이 보스에게 공격한 뒤 기록을 확인할 수 있습니다.</p>}
     </div>
     {latest?.defeated&&onAuction&&<button type="button" className="tc-boss-result-reward" onClick={onAuction}>토벌 보상·경매 확인 ›</button>}
    </div>
   </details>
  </div>
  {onAuction&&<button type="button" className="tc-boss-auction-link" onClick={onAuction}>
   <span>토벌 보상 · 길드 경매장</span><span aria-hidden="true">›</span>
  </button>}
  <p className="tc-boss-footnote">길드원 피해량은 공유 HP에 누적됩니다.</p>
 </div>;
}

export function GuildBossPanel({lease,associationId,expedition,onAuction}:{
 lease:GameplayLease;associationId:string;expedition:boolean;onAuction?:()=>void;
}){
 const [state,setState]=useState<GuildBossState|null>(null);
 const [kind,setKind]=useState<GuildBossKind>('WEEKLY');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [result,setResult]=useState<GuildBossAttackResult|null>(null);
 const [time,setTime]=useState(()=>Date.now());
 const busyRef=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const refresh=async()=>{
  try{
   const next=await getGuildBossState(lease);
   if(mounted.current){setState(next);setError('');setTime(Date.now());}
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'보스 정보를 불러오지 못했습니다.');}
 };
 useEffect(()=>{
  let alive=true;
  void getGuildBossState(lease).then(x=>{if(alive){setState(x);setError('');}}).catch(e=>{if(alive)setError(e instanceof Error?e.message:'보스 정보를 불러오지 못했습니다.');});
  const timer=window.setInterval(()=>{
   if(!alive)return;
   setTime(Date.now());
   if(!document.hidden&&!busyRef.current)void getGuildBossState(lease).then(x=>{if(alive)setState(x);}).catch(()=>{});
  },15000);
  const focus=()=>{if(alive&&!busyRef.current)void getGuildBossState(lease).then(x=>{if(alive)setState(x);}).catch(()=>{});};
  window.addEventListener('focus',focus);
  return()=>{alive=false;window.clearInterval(timer);window.removeEventListener('focus',focus);};
 },[lease.leaseId,lease.generation,associationId]);
 const boss=state?.bosses.find(b=>b.kind===kind);
 const fight=async()=>{
  if(busyRef.current||!boss||boss.remainingHp<=0||boss.attacksLeft<=0||expedition)return;
  busyRef.current=true;setBusy(true);setError('');setResult(null);
  const requestKey='tc-guild-boss-request:'+associationId+':'+boss.encounterId;
  try{
   let id=window.sessionStorage.getItem(requestKey);
   if(!id){id=crypto.randomUUID();window.sessionStorage.setItem(requestKey,id);}
   const response=await attackGuildBoss(lease,kind,id);
   if(!mounted.current)return;
   window.sessionStorage.removeItem(requestKey);
   setState(response.state);setResult(response.result);setTime(Date.now());
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'전투 결과를 확인하지 못했습니다.');}
  finally{busyRef.current=false;if(mounted.current)setBusy(false);}
 };
 const selectKind=(next:GuildBossKind)=>{if(busyRef.current)return;setKind(next);setResult(null);setError('');};
 return <section className={'tc-guild-boss '+(kind==='WEEKLY'?'is-weekly':'is-daily')} aria-label="원정단 보스전">
  <header className="tc-boss-toolbar">
   <div className="tc-boss-tabs" role="group" aria-label="보스 종류">
    {(['DAILY','WEEKLY'] as GuildBossKind[]).map(k=>{
     const item=state?.bosses.find(b=>b.kind===k);
     return <button key={k} type="button" className={kind===k?'selected':''}
      aria-pressed={kind===k} disabled={busy} onClick={()=>selectKind(k)}>
      <strong>{k==='DAILY'?'일일 보스':'주간 보스'}</strong>
      <small>{item?item.remainingHp<=0?'처치 완료':item.attacksLeft+' / 5회':k==='DAILY'?'매일 00시':'토요일 00시'}</small>
     </button>;
    })}
   </div>
   <button type="button" className="tc-boss-refresh" disabled={busy} onClick={()=>void refresh()} aria-label="보스 정보 새로고침" title="보스 정보 새로고침">↻</button>
  </header>
  {boss?<GuildBossDetail boss={boss} now={time} result={result} busy={busy} expedition={expedition} error={error}
   onFight={()=>void fight()} onReload={()=>void refresh()} onDismiss={()=>setResult(null)} onAuction={onAuction}/>:
   <div role="status" className="tc-boss-loading">{error||'원정단 보스 정보를 불러오는 중입니다.'}
    {error&&<button type="button" onClick={()=>void refresh()}>다시 불러오기</button>}
   </div>}
 </section>;
}
