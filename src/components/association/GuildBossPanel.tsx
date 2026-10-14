import React,{useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {getGuildBossState,attackGuildBoss,type GuildBossState,type GuildBossAttackResult,type GuildBossKind} from '../../online/guildBoss';
import './guildBoss.css';

const num=(n:number)=>Math.max(0,Math.trunc(n)).toLocaleString('ko-KR');
const kst=(s:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(s));
const remaining=(t:string,now:number)=>{
 const seconds=Math.max(0,Math.ceil((Date.parse(t)-now)/1000));
 const d=Math.floor(seconds/86400),h=Math.floor(seconds%86400/3600),m=Math.floor(seconds%3600/60);
 return d?d+'일 '+h+'시간':h+'시간 '+m+'분';
};
export function GuildBossPanel({lease,associationId,expedition}:{lease:GameplayLease;associationId:string;expedition:boolean}){
 const [state,setState]=useState<GuildBossState|null>(null);
 const [kind,setKind]=useState<GuildBossKind>('DAILY');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<GuildBossAttackResult|null>(null);
 const [time,setTime]=useState(()=>Date.now()),busyRef=useRef(false);
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  let cancelled=false;
  const refresh=async()=>{try{const next=await getGuildBossState(lease);if(!cancelled){setState(next);setError('');}}catch(e){if(!cancelled)setError(e instanceof Error?e.message:'보스 정보를 불러오지 못했습니다.');}};
  void refresh();
  const timer=window.setInterval(()=>{setTime(Date.now());if(!document.hidden&&!busyRef.current)void refresh();},15000);
  const focus=()=>void refresh();
  window.addEventListener('focus',focus);
  return()=>{cancelled=true;window.clearInterval(timer);window.removeEventListener('focus',focus);};
 },[lease.leaseId,lease.generation,associationId]);
 const boss=state?.bosses.find(b=>b.kind===kind);
 const pct=boss?Math.max(0,Math.min(100,boss.remainingHp/boss.maxHp*100)):0;
 const requestKey='tc-guild-boss-request:'+associationId+':'+kind;
 const fight=async()=>{
  if(busyRef.current||!boss||boss.remainingHp<=0||boss.attacksLeft<=0||expedition)return;
  busyRef.current=true;setBusy(true);setError('');setResult(null);
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
 return <section className="tc-guild-boss" aria-label="원정단 보스전">
  <div className="tc-guild-boss-selector" role="tablist" aria-label="보스 종류">
   <button type="button" role="tab" aria-selected={kind==='DAILY'} onClick={()=>{setKind('DAILY');setResult(null);setError('');}}>일일 보스 <small>매일 00시</small></button>
   <button type="button" role="tab" aria-selected={kind==='WEEKLY'} onClick={()=>{setKind('WEEKLY');setResult(null);setError('');}}>주간 보스 <small>토요일 00시</small></button>
  </div>
  {!boss?<div role="status" className="tc-guild-boss-message">{error||'원정단 보스 정보를 불러오는 중입니다.'}</div>:<>
   <header className="tc-guild-boss-heading">
    <div><small>{kind==='DAILY'?'DAILY RAID':'WEEKLY RAID'}</small><h2>{boss.name}</h2></div>
    <span className={boss.remainingHp<=0?'tc-guild-boss-tag complete':'tc-guild-boss-tag'}>{boss.remainingHp<=0?'토벌 성공':'토벌 진행 중'}</span>
   </header>
   <div className={'tc-guild-boss-art '+(kind==='WEEKLY'?'weekly':'daily')}>
    <span aria-hidden="true" className="tc-guild-boss-sigil">✦</span>
    <div><small>{kind==='DAILY'?'황혼의 위협':'심연의 지배자'}</small><b>{boss.name}</b></div>
    <span className="tc-guild-boss-time">교체까지 {remaining(boss.cycleEnd,time)}</span>
   </div>
   <div className="tc-guild-boss-health">
    <div><strong>공유 보스 HP</strong><b>{num(boss.remainingHp)} <small>/ {num(boss.maxHp)}</small></b></div>
    <div className="tc-guild-boss-track" role="progressbar" aria-label="보스 남은 체력" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><i style={{width:pct+'%'}}/></div>
   </div>
   <div className="tc-guild-boss-stats">
    <div><small>오늘 남은 공격</small><strong>{boss.attacksLeft}<span> / 5회</span></strong></div>
    <div><small>내 누적 피해</small><strong>{num(boss.myDamage)}</strong></div>
    <div><small>토벌 참여 인원</small><strong>{num(boss.participants)}<span>명</span></strong></div>
   </div>
   <button className="tc-guild-boss-attack" disabled={busy||boss.remainingHp<=0||boss.attacksLeft<=0||expedition} onClick={()=>void fight()}>
    {busy?'전투 처리 중…':boss.remainingHp<=0?'토벌 완료':boss.attacksLeft<=0?'오늘의 공격 완료':expedition?'원정 중 공격 불가':'⚔  보스 공격'}
   </button>
   <div className="tc-guild-boss-reset">공격 횟수 회복 없음 · 다음 초기화 {kst(boss.nextAttackResetAt)} (KST) · 남은 횟수 이월 없음</div>
   {error&&<p role="alert" className="tc-guild-boss-error">{error}<button type="button" disabled={busy} onClick={()=>void fight()}>같은 요청 다시 확인</button></p>}
   {result&&result.encounterId===boss.encounterId&&<div className="tc-guild-boss-result" role="status">
    <div className="tc-guild-boss-result-head"><b>전투 결과 · {result.combat.outcome==='defeated'?'캐릭터 쓰러짐':'전투 종료'}</b><button type="button" onClick={()=>setResult(null)}>닫기</button></div>
    <strong>이번 피해량 {num(result.damage)}</strong><span>보스 남은 HP {num(result.remainingHp)} / {num(result.maxHp)}</span>
    <details><summary>자동전투 기록 · {result.combat.turns.length}턴</summary><div className="tc-guild-boss-turns">{result.combat.turns.map(t=><p key={t.turn}><small>{t.turn}턴</small> {t.lines.join(' · ')}</p>)}</div></details>
    {result.defeated&&<p>보스 토벌 성공! 경매 전리품과 개인 보상은 다음 개발 단계에서 연결됩니다.</p>}
   </div>}
   <div className="tc-guild-boss-ranks">
    <div className="tc-guild-boss-ranks-title"><b>피해량 순위</b><small>길드 전체 {num(boss.totalAttacks)}회 공격</small></div>
    {boss.leaderboard.length?boss.leaderboard.slice(0,5).map((member,i)=><div key={member.userId} className="tc-guild-boss-rank"><b>{i+1}</b><span>{member.name}</span><strong>{num(member.damage)}</strong><small>{member.attacks}회</small></div>):<p>아직 공격한 길드원이 없습니다.</p>}
   </div>
   <small className="tc-guild-boss-disclaimer">서버가 피해량과 공격 횟수를 관리합니다. 기존 장비·스킬·스킬 강화가 적용되며 사냥 활력·HP·MP는 소모하지 않습니다. 보상과 경매 등록은 추후 연결됩니다.</small>
  </>}
 </section>;
}
