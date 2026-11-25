import {GuildTask} from './GuildTask';
import {GuildEmblem} from './GuildEmblem';
import React,{useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {getGuildRankings,getGuildPublicProfile,type GuildPublicProfile,type GuildRankingEntry,type GuildRankingState} from '../../online/guildRankings';
import './guildRankings.css';
import powerIcon from '../../assets/ui/guild/guild-ranking-power.webp';
import crownIcon from '../../assets/ui/guild/guild-ranking-crown.webp';

const int=(value:number)=>Math.max(0,Math.trunc(value)).toLocaleString('ko-KR');
function RankNumber({rank}:{rank:number}){
 return <span className={'tc-gr-rank'+(rank<=3?' top top-'+rank:'')} aria-label={rank+'위'}>{rank<=3?rank:rank<10?'0'+rank:rank}</span>;
}
function RankingIcon({kind}:{kind:'power'|'crown'}){
 return <img className="tc-gr-stat-icon" src={kind==='power'?powerIcon:crownIcon} alt="" aria-hidden="true"/>;
}
const profileDate=(value:string)=>{const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):'—';};
function GuildProfile({entry,lease}:{entry:GuildRankingEntry;lease:GameplayLease}){
 const [profile,setProfile]=useState<GuildPublicProfile|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(false),[retry,setRetry]=useState(0),[all,setAll]=useState(false);
 useEffect(()=>{let active=true;setLoading(true);setError(false);setProfile(null);
  void getGuildPublicProfile(lease,entry.associationId).then(data=>{if(active){setProfile(data);if(!data)setError(true);}}).catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[entry.associationId,lease.leaseId,lease.generation,retry]);
 const members=profile?.members??[];
 const count=profile?members.length:entry.members;
 const total=profile?members.reduce((sum,m)=>sum+m.combatPower,0):entry.combatPower;
 const top=profile?Math.max(0,...members.map(m=>m.combatPower)):entry.topPower;
 const join=profile?(profile.joinPolicy==='CLOSED'?'모집 중지':profile.joinPolicy==='OPEN'?'즉시 가입':'승인 가입'):'—';
 const recruitment=profile?(profile.joinPolicy==='CLOSED'?'모집 중지':count>=entry.memberLimit?'정원 마감':'모집 중'):'—';
 const outcome={CAPTURED:'점령 성공',DEFENDED:'방어 성공',LOST:'영지 상실',UNDECIDED:'승자 없음'};
 return <section className="tc-gr-profile" aria-label={entry.name+' 프로필'}>
  <div className="tc-gr-profile-hero" data-rank={entry.rank<=3?entry.rank:undefined}>
   <GuildEmblem value={entry.emblem} size={76} label={entry.name+' 문장'}/>
   <div><small>전투력 랭킹 {entry.rank}위</small><h2>{entry.name}</h2><span>No.{entry.recordNumber} · Lv.{entry.level} · {count}/{entry.memberLimit}명</span></div>
  </div>
  <div className="tc-gr-profile-power"><div><span><RankingIcon kind="power"/>총 전투력</span><b>{int(total)} <small>CP</small></b></div><div><span><RankingIcon kind="crown"/>최고 단원 전투력</span><b>{int(top)} <small>CP</small></b></div></div>
  <section className="tc-gr-profile-section"><h3>원정단 정보</h3><dl>
   <div><dt>원정단장</dt><dd>{profile?.leaderName??'—'}</dd></div>
   <div><dt>창설일</dt><dd>{profileDate(entry.createdAt)}</dd></div>
   <div><dt>가입 방식</dt><dd>{join}</dd></div>
   <div><dt>모집 상태</dt><dd>{recruitment}</dd></div>
   <div><dt>평균 전투력</dt><dd>{int(count?total/count:0)} CP</dd></div>
   <div><dt>보유 영지</dt><dd>{profile?profile.territories.length:entry.territories}곳</dd></div>
  </dl></section>
  {loading?<p className="tc-gr-profile-status" role="status">원정단 정보를 불러오는 중…</p>:error?<div className="tc-gr-profile-status" role="alert">추가 정보를 불러오지 못했습니다.<button type="button" onClick={()=>setRetry(n=>n+1)}>다시 시도</button></div>:profile&&<>
   <section className="tc-gr-profile-section"><h3>원정단 소개</h3><p className="tc-gr-profile-description">{profile.description||'등록된 소개글이 없습니다.'}</p></section>
   <section className="tc-gr-profile-section"><h3>{all?'전체 단원':'주요 단원'} <small>{all?members.length+'명':'전투력 TOP 3'}</small></h3>
    {members.length?<div className="tc-gr-profile-members">{(all?members:members.slice(0,3)).map((m,i)=><div key={i} className="tc-gr-profile-member"><span>{String(i+1).padStart(2,'0')}</span><div><b>{m.nickname??'이름 미등록'}</b><small>{m.role==='LEADER'?'단장':'단원'}</small></div><strong>{int(m.combatPower)} CP</strong></div>)}</div>:<p className="tc-gr-profile-status">등록된 단원이 없습니다.</p>}
    {members.length>3&&<button type="button" className="tc-gr-profile-toggle" aria-expanded={all} onClick={()=>setAll(v=>!v)}>{all?'주요 단원만 보기':'전체 단원 보기 ('+members.length+'명)'}</button>}
   </section>
   <section className="tc-gr-profile-section"><h3>점령 영지 <small>{profile.territories.length}곳</small></h3>{profile.territories.length?<div className="tc-gr-profile-lands">{profile.territories.map((t,i)=><span key={i}>{t.name}</span>)}</div>:<p className="tc-gr-profile-status">보유 중인 영지가 없습니다.</p>}</section>
   <section className="tc-gr-profile-section"><h3>최근 점령전 기록</h3>{profile.recentWars.length?<div className="tc-gr-profile-history">{profile.recentWars.map((w,i)=><div key={i}><span>{w.townName}<small>{profileDate(w.settledAt)}</small></span><b data-outcome={w.outcome}>{outcome[w.outcome]}</b></div>)}</div>:<p className="tc-gr-profile-status">공개된 점령전 기록이 없습니다.</p>}</section>
  </>}
 </section>;
}
function Row({entry,lease}:{entry:GuildRankingEntry;lease:GameplayLease}){
 const [open,setOpen]=useState(false);
 return <article className={'tc-gr-entry'+(entry.mine?' mine':'')} data-podium={entry.rank>=1&&entry.rank<=3?entry.rank:undefined}>
  <GuildTask title="원정단 프로필" dialogClassName="tc-gr-profile-dialog" onOpen={()=>setOpen(true)} onClose={()=>setOpen(false)} trigger={<span className="tc-gr-summary">
   <RankNumber rank={entry.rank}/>
   <GuildEmblem value={entry.emblem} size={34} label={entry.name+' 문장'}/>
   <span className="tc-gr-name"><b>{entry.name}{entry.mine?' · 우리 길드':''}</b><small>{entry.recordNumber} · Lv.{entry.level} · {entry.members}/{entry.memberLimit}명</small></span>
   <span className="tc-gr-metrics"><b><RankingIcon kind="power"/>{int(entry.combatPower)}<small> CP</small></b><span><RankingIcon kind="crown"/>최고 {int(entry.topPower)}</span></span>
   <span className="tc-gr-arrow" aria-hidden="true">›</span>
  </span>}>{open&&<GuildProfile entry={entry} lease={lease}/>}</GuildTask>
 </article>;
}
export function GuildRankingPanel({lease}:{lease:GameplayLease}){
 const [state,setState]=useState<GuildRankingState|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const generation=useRef(0);
 const load=async()=>{
  const serial=++generation.current;
  setLoading(true);setError('');
  try{
   const next=await getGuildRankings(lease,'OVERALL');
   if(serial!==generation.current)return;
   setState(next);setLoading(false);
  }catch(e){
   if(serial!==generation.current)return;
   setError(e instanceof Error?e.message:'길드 순위를 불러오지 못했습니다.');
   setLoading(false);
  }
 };
 useEffect(()=>{void load();return()=>{generation.current++;};},[lease.leaseId,lease.generation]);
 const rows=state?.entries??[];
 const mine=state?.entries.find(x=>x.mine);
 return <section className="tc-gr" aria-label="길드 랭킹">
  <header className="tc-gr-header">
   <div><small>GUILD LEADERBOARD</small><h2>원정단 랭킹</h2><p>소속 단원 전체의 상시 전투력 합산</p></div>
   <button type="button" className="tc-gr-reload" disabled={loading} onClick={()=>void load()}>새로고침</button>
  </header>
  <div className="tc-gr-stats">
   <div><small>활성 길드</small><b>{int(state?.totalGuilds??0)}<span>개</span></b></div>
   <div><small>우리 길드 순위</small><b>{state?.myRank?int(state.myRank)+'위':'—'}</b></div>
   <div><small>우리 원정단 총 전투력</small><b>{mine?int(mine.combatPower):'—'}</b></div>
  </div>
  <div className="tc-gr-list">
   {loading?<p className="tc-gr-empty" role="status">순위를 불러오는 중입니다.</p>:
    error?<div className="tc-gr-empty" role="alert">{error}<button type="button" onClick={()=>void load()}>다시 시도</button></div>:
    rows.length?rows.map(entry=><Row key={entry.associationId} entry={entry} lease={lease}/>):
    <p className="tc-gr-empty">현재 등록된 활성 원정단이 없습니다.</p>}
  </div>
 </section>;
}
