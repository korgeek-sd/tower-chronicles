import {GuildTask} from './GuildTask';
import {GuildEmblem} from './GuildEmblem';
import React,{useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {getGuildRankings,type GuildRankingEntry,type GuildRankingState} from '../../online/guildRankings';
import './guildRankings.css';

const int=(value:number)=>Math.max(0,Math.trunc(value)).toLocaleString('ko-KR');
function RankNumber({rank}:{rank:number}){
 return <span className={'tc-gr-rank'+(rank<=3?' top top-'+rank:'')} aria-label={rank+'위'}>{rank<=3?rank:rank<10?'0'+rank:rank}</span>;
}
function RankingIcon({kind}:{kind:'power'|'crown'}){
 return <svg className="tc-gr-stat-icon" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter">{kind==='power'?<path d="M2 2l2 5 7 7m-2-5 5-7-5 2-7 10m-1-4 5 5m4-5 5 5"/>:<path fill="currentColor" strokeWidth=".6" d="M1 5l4 3 3-6 3 6 4-3-2 8H3L1 5zm2 9h10v1H3z"/>}</svg>;
}
function PodiumFrame({rank}:{rank:number}){
 return <><svg className="tc-gr-podium-frame" viewBox="0 0 340 60" preserveAspectRatio="none" aria-hidden="true"><path d="M12 2H328L338 12V48L328 58H12L2 48V12Z" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke"/><path d="M3 17V8L8 8V3H18M322 3H332V8H337V17M3 43V52H8V57H18M322 57H332V52H337V43" fill="none" stroke="currentColor" strokeWidth="1.3" vectorEffect="non-scaling-stroke"/></svg>{rank===1&&<svg className="tc-gr-podium-crown" viewBox="0 0 46 16" aria-hidden="true"><path d="M2 10L12 12 17 10 14 2 20 6 23 0 26 6 32 2 29 10 34 12 44 10 35 15H11Z" fill="#9f6a26" stroke="currentColor" strokeWidth=".9"/><path d="M18 10H28L27 13H19Z" fill="currentColor"/><path d="M23 6l2 2-2 2-2-2Z" fill="#b34a3c"/></svg>}</>;
}
function Row({entry}:{entry:GuildRankingEntry}){
 return <article className={'tc-gr-entry'+(entry.mine?' mine':'')} data-podium={entry.rank>=1&&entry.rank<=3?entry.rank:undefined}>
  <GuildTask title={entry.name+' 상세'} trigger={<span className="tc-gr-summary">
   {entry.rank>=1&&entry.rank<=3&&<PodiumFrame rank={entry.rank}/>}
   <RankNumber rank={entry.rank}/>
   <GuildEmblem value={entry.emblem} size={34} label={entry.name+' 문장'}/>
   <span className="tc-gr-name"><b>{entry.name}{entry.mine?' · 우리 길드':''}</b><small>{entry.recordNumber} · Lv.{entry.level} · {entry.members}/{entry.memberLimit}명</small></span>
   <span className="tc-gr-metrics"><b><RankingIcon kind="power"/>{int(entry.combatPower)}<small> CP</small></b><span><RankingIcon kind="crown"/>최고 {int(entry.topPower)}</span></span>
   <span className="tc-gr-arrow" aria-hidden="true">›</span>
  </span>}><div className="tc-gr-details">
   <div><small>총 전투력</small><b>{int(entry.combatPower)}</b></div><div><small>최고 단원 전투력</small><b>{int(entry.topPower)}</b></div><div><small>점령 영지</small><b>{entry.territories}곳</b></div>
   <div><small>공성전 승리</small><b>{entry.victories}회</b></div>
   <div><small>점령 성공</small><b>{entry.captures}회</b></div>
   <div><small>방어 성공</small><b>{entry.defenses}회</b></div>
   <div><small>길드 경험치</small><b>{int(entry.exp)}</b></div>
   <div><small>단원 수</small><b>{entry.members} / {entry.memberLimit}</b></div>
  </div></GuildTask>
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
    rows.length?rows.map(entry=><Row key={entry.associationId} entry={entry}/>):
    <p className="tc-gr-empty">현재 등록된 활성 원정단이 없습니다.</p>}
  </div>
 </section>;
}
