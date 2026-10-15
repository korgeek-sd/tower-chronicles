import React,{useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {getGuildRankings,type GuildRankingEntry,type GuildRankingMode,type GuildRankingState} from '../../online/guildRankings';
import './guildRankings.css';

const MODES:readonly (readonly [GuildRankingMode,string])[]=[
 ['OVERALL','종합'],['TERRITORY','영지'],['WARS','공성전'],['GROWTH','성장']
];
const DESCRIPTIONS:Record<GuildRankingMode,string>={
 OVERALL:'점령 영지 → 공성전 승리 → 길드 레벨 → 단원 수',
 TERRITORY:'점령 영지 → 길드 레벨 → 공성전 승리',
 WARS:'공성전 승리 → 점령 성공 → 현재 영지',
 GROWTH:'길드 레벨 → 누적 경험치 → 단원 수'
};
const int=(value:number)=>Math.max(0,Math.trunc(value)).toLocaleString('ko-KR');
const PAGE_SIZE=8;
function RankNumber({rank}:{rank:number}){
 return <span className={'tc-gr-rank'+(rank<=3?' top top-'+rank:'')} aria-label={rank+'위'}>{rank<10?'0'+rank:rank}</span>;
}
function Row({entry,selected,onSelect}:{entry:GuildRankingEntry;selected:boolean;onSelect:()=>void}){
 return <article className={'tc-gr-entry'+(entry.mine?' mine':'')+(selected?' selected':'')}>
  <button type="button" className="tc-gr-summary" onClick={onSelect} aria-expanded={selected}>
   <RankNumber rank={entry.rank}/>
   <span className="tc-gr-name"><b>{entry.name}{entry.mine?' · 우리 길드':''}</b><small>{entry.recordNumber} · Lv.{entry.level} · {entry.members}/{entry.memberLimit}명</small></span>
   <span className="tc-gr-metrics"><b>{entry.territories}<small> 영지</small></b><span>{entry.victories}승</span></span>
   <span className="tc-gr-arrow" aria-hidden="true">{selected?'⌃':'⌄'}</span>
  </button>
  {selected&&<div className="tc-gr-details">
   <div><small>점령 영지</small><b>{entry.territories}곳</b></div>
   <div><small>공성전 승리</small><b>{entry.victories}회</b></div>
   <div><small>점령 성공</small><b>{entry.captures}회</b></div>
   <div><small>방어 성공</small><b>{entry.defenses}회</b></div>
   <div><small>길드 경험치</small><b>{int(entry.exp)}</b></div>
   <div><small>단원 수</small><b>{entry.members} / {entry.memberLimit}</b></div>
  </div>}
 </article>;
}
export function GuildRankingPanel({lease}:{lease:GameplayLease}){
 const [mode,setMode]=useState<GuildRankingMode>('OVERALL');
 const [state,setState]=useState<GuildRankingState|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [search,setSearch]=useState('');
 const [page,setPage]=useState(0);
 const [chosen,setChosen]=useState<string|null>(null);
 const generation=useRef(0);
 const load=async(type:GuildRankingMode)=>{
  const serial=++generation.current;
  setLoading(true);setError('');
  try{
   const next=await getGuildRankings(lease,type);
   if(serial!==generation.current)return;
   setState(next);setLoading(false);
  }catch(e){
   if(serial!==generation.current)return;
   setError(e instanceof Error?e.message:'길드 순위를 불러오지 못했습니다.');
   setLoading(false);
  }
 };
 useEffect(()=>{void load(mode);return()=>{generation.current++;};},
  [lease.leaseId,lease.generation,mode]);
 const changeMode=(next:GuildRankingMode)=>{
  setMode(next);setPage(0);setChosen(null);setSearch('');setState(null);
 };
 const rows=(state?.entries??[]).filter(entry=>entry.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
 const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
 const safePage=Math.min(page,pages-1);
 const visible=rows.slice(safePage*PAGE_SIZE,(safePage+1)*PAGE_SIZE);
 const mine=state?.entries.find(x=>x.mine);
 return <section className="tc-gr" aria-label="길드 랭킹">
  <header className="tc-gr-header">
   <div><small>GUILD LEADERBOARD</small><h2>원정단 랭킹</h2><p>실제 점령·공성전·성장 기록 기준</p></div>
   <button type="button" className="tc-gr-reload" disabled={loading} onClick={()=>void load(mode)}>새로고침</button>
  </header>
  <nav className="tc-gr-modes" aria-label="랭킹 종류">
   {MODES.map(([id,label])=><button key={id} type="button" aria-pressed={mode===id} className={mode===id?'active':''} onClick={()=>changeMode(id)}>{label}</button>)}
  </nav>
  <p className="tc-gr-rule">정렬 순서: {DESCRIPTIONS[mode]}</p>
  <div className="tc-gr-stats">
   <div><small>활성 길드</small><b>{int(state?.totalGuilds??0)}<span>개</span></b></div>
   <div><small>우리 길드 순위</small><b>{state?.myRank?int(state.myRank)+'위':'—'}</b></div>
   <div><small>우리 길드 영지</small><b>{mine?mine.territories:'—'}</b></div>
  </div>
  <label className="tc-gr-search"><span>길드명 검색</span><input value={search} maxLength={40}
   placeholder="표시된 상위 100개 길드 검색" onChange={e=>{setSearch(e.target.value);setPage(0);}}/></label>
  <div className="tc-gr-list">
   {loading?<p className="tc-gr-empty" role="status">순위를 불러오는 중입니다.</p>:
    error?<div className="tc-gr-empty" role="alert">{error}<button type="button" onClick={()=>void load(mode)}>다시 시도</button></div>:
    visible.length?visible.map(entry=><Row key={entry.associationId} entry={entry} selected={chosen===entry.associationId} onSelect={()=>setChosen(x=>x===entry.associationId?null:entry.associationId)}/>):
    <p className="tc-gr-empty">{search?'검색 결과가 없습니다.':'현재 등록된 활성 길드가 없습니다.'}</p>}
  </div>
  <footer className="tc-gr-footer">
   <span>{state?'전체 '+int(state.totalGuilds)+'개 · 상위 '+state.entries.length+'개 표시':'서버 기록 조회'}</span>
   <div className="tc-gr-pages" aria-label="랭킹 페이지">
    <button type="button" disabled={safePage<=0||loading} onClick={()=>{setPage(safePage-1);setChosen(null);}}>이전</button>
    <b>{safePage+1} / {pages}</b>
    <button type="button" disabled={safePage>=pages-1||loading} onClick={()=>{setPage(safePage+1);setChosen(null);}}>다음</button>
   </div>
  </footer>
 </section>;
}
