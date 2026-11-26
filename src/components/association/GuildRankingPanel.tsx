import {GuildTask} from './GuildTask';
import {GuildEmblem} from './GuildEmblem';
import React,{useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {getGuildRankings,getGuildPublicProfile,type GuildPublicProfile,type GuildRankingEntry} from '../../online/guildRankings';
import {getAdventurerRanking,openAdventurerProfile,type AdventurerEntry} from '../../online/adventurerDirectory';
import {getOnboardingClassLabel} from '../intro/onboardingClassLabels';
import {assetUrl} from '../../game/data/graphics';
import {PersonalRankingRewards} from '../growth/PersonalRankingRewards';
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
  <div className="tc-gr-profile-power"><div><span><RankingIcon kind="power"/>총 전투력</span><b>{int(total)}</b></div><div><span><RankingIcon kind="crown"/>최고 단원 전투력</span><b>{int(top)}</b></div></div>
  <section className="tc-gr-profile-section"><h3>원정단 정보</h3><dl>
   <div><dt>원정단장</dt><dd>{profile?.leaderName??'—'}</dd></div>
   <div><dt>창설일</dt><dd>{profileDate(entry.createdAt)}</dd></div>
   <div><dt>가입 방식</dt><dd>{join}</dd></div>
   <div><dt>모집 상태</dt><dd>{recruitment}</dd></div>
   <div><dt>평균 전투력</dt><dd>{int(count?total/count:0)} CP</dd></div>
   <div><dt>공성전 승리</dt><dd>{int(entry.victories)}회</dd></div>
   <div><dt>보유 영지</dt><dd>{profile?profile.territories.length:entry.territories}곳</dd></div>
  </dl></section>
  {loading?<p className="tc-gr-profile-status" role="status">원정단 정보를 불러오는 중…</p>:error?<div className="tc-gr-profile-status" role="alert">추가 정보를 불러오지 못했습니다.<button type="button" onClick={()=>setRetry(n=>n+1)}>다시 시도</button></div>:profile&&<>
   <section className="tc-gr-profile-section"><h3>원정단 소개</h3><p className="tc-gr-profile-description">{profile.description||'등록된 소개글이 없습니다.'}</p></section>
   <section className="tc-gr-profile-section"><h3>{all?'전체 단원':'주요 단원'} <small>{all?members.length+'명':'전투력 TOP 3'}</small></h3>
    {members.length?<div className="tc-gr-profile-members">{(all?members:members.slice(0,3)).map((m,i)=><div key={i} className="tc-gr-profile-member"><span>{String(i+1).padStart(2,'0')}</span><div><b>{m.nickname??'이름 미등록'}</b><small>{m.role==='LEADER'?'단장':'단원'}</small></div><strong>전투력 {int(m.combatPower)}</strong></div>)}</div>:<p className="tc-gr-profile-status">등록된 단원이 없습니다.</p>}
    {members.length>3&&<button type="button" className="tc-gr-profile-toggle" aria-expanded={all} onClick={()=>setAll(v=>!v)}>{all?'주요 단원만 보기':'전체 단원 보기 ('+members.length+'명)'}</button>}
   </section>
   <section className="tc-gr-profile-section"><h3>점령 영지 <small>{profile.territories.length}곳</small></h3>{profile.territories.length?<div className="tc-gr-profile-lands">{profile.territories.map((t,i)=><span key={i}>{t.name}</span>)}</div>:<p className="tc-gr-profile-status">보유 중인 영지가 없습니다.</p>}</section>
   <section className="tc-gr-profile-section"><h3>최근 점령전 기록</h3>{profile.recentWars.length?<div className="tc-gr-profile-history">{profile.recentWars.map((w,i)=><div key={i}><span>{w.townName}<small>{profileDate(w.settledAt)}</small></span><b data-outcome={w.outcome}>{outcome[w.outcome]}</b></div>)}</div>:<p className="tc-gr-profile-status">공개된 점령전 기록이 없습니다.</p>}</section>
  </>}
 </section>;
}

type RankingTab='guild'|'personal';

const rankingTabs=[
 {id:'guild',label:'원정단 랭킹',icon:crownIcon},
 {id:'personal',label:'개인 전투력 랭킹',icon:powerIcon},
] as const;

function RankingSummary({entry,portrait,name,detail,secondary}:{
 entry:{rank:number;combatPower:number};portrait:React.ReactNode;name:string;
 detail:React.ReactNode;secondary?:React.ReactNode;
}){
 const power=entry.combatPower.toLocaleString('ko-KR',{maximumFractionDigits:2});
 return <span className="tc-gr-summary">
  <RankNumber rank={entry.rank}/>
  {portrait}
  <span className="tc-gr-name"><b>{name}</b><small>{detail}</small></span>
  <span className="tc-gr-metrics">
   <b aria-label={'전투력 '+power}><RankingIcon kind="power"/>{power}</b>
   {secondary && <span>{secondary}</span>}
  </span>
 </span>;
}

function Row({entry,lease}:{entry:GuildRankingEntry;lease:GameplayLease}){
 const [open,setOpen]=useState(false);
 return <article className={'tc-gr-entry'+(entry.mine?' mine':'')} data-podium={entry.rank>=1&&entry.rank<=3?entry.rank:undefined}>
  <GuildTask title="원정단 프로필" dialogClassName="tc-gr-profile-dialog" onOpen={()=>setOpen(true)} onClose={()=>setOpen(false)}
   trigger={<RankingSummary entry={entry} name={entry.name+(entry.mine?' · 우리 원정단':'')}
    portrait={<GuildEmblem value={entry.emblem} size={34} label={entry.name+' 문장'}/>}
    detail={entry.recordNumber+' · Lv.'+entry.level+' · '+entry.members+'/'+entry.memberLimit+'명'}
    secondary={<><RankingIcon kind="crown"/>최고 {int(entry.topPower)}</>}/>}>
   {open&&<GuildProfile entry={entry} lease={lease}/>}
  </GuildTask>
 </article>;
}

function PersonalRow({entry,mine}:{entry:AdventurerEntry;mine:boolean}){
 const id=entry.classId;
 const classId=id==='warrior'||id==='mage'||id==='archer'?id:null;
 const job=classId?getOnboardingClassLabel(classId):'직업 미선택';
 return <article className={'tc-gr-entry'+(mine?' mine':'')} data-podium={entry.rank>=1&&entry.rank<=3?entry.rank:undefined}>
  <button type="button" className="tc-guild-task-open" aria-haspopup="dialog" onClick={()=>openAdventurerProfile(entry.userId, true)}>
   <RankingSummary entry={entry} name={entry.nickname+(mine?' · 나':'')}
    portrait={classId?<img className="tc-gr-portrait" src={assetUrl('assets/characters/classes/'+classId+'-portrait-v2.svg')} loading="lazy" alt=""/>:<span className="tc-gr-portrait" aria-hidden="true"/>}
    detail={<>{entry.guildEmblem&&<GuildEmblem value={entry.guildEmblem} size={14}/>}Lv.{entry.level} · {job}{entry.guildName?' · '+entry.guildName:''}</>}/>
  </button>
 </article>;
}

const readGuildStandings=(lease:GameplayLease)=>getGuildRankings(lease,'OVERALL');

function useStandings<T>(lease:GameplayLease,read:(lease:GameplayLease)=>Promise<T>){
 const [data,setData]=useState<T|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState(false);
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  let current=true;
  setLoading(true);
  setError(false);
  void read(lease).then(result=>{if(current)setData(result);})
   .catch(()=>{if(current)setError(true);})
   .finally(()=>{if(current)setLoading(false);});
  return ()=>{current=false;};
 },[lease.leaseId,lease.generation,read,revision]);
 return {data,loading,error,refresh:()=>setRevision(n=>n+1)};
}

function StandingsList({loading,error,ready,refresh,listRef,children}:{
 listRef:React.Ref<HTMLDivElement>;
 loading:boolean;error:boolean;ready:boolean;refresh:()=>void;children:React.ReactNode;
}){
 return <div ref={listRef} className="tc-gr-list" aria-busy={loading}>
  {loading&&!ready && <p className="tc-gr-empty" role="status">순위를 불러오는 중입니다.</p>}
  {error && <div className="tc-gr-empty" role="alert">순위를 불러오지 못했습니다.<button type="button" onClick={refresh}>다시 시도</button></div>}
  {ready && children}
 </div>;
}

type StandingsProps={lease:GameplayLease;listRef:React.Ref<HTMLDivElement>};

function GuildStandings({lease,listRef}:StandingsProps){
 const {data,loading,error,refresh}=useStandings(lease,readGuildStandings);
 const [search,setSearch]=useState<string|null>(null);
 const query=search?.trim().toLocaleLowerCase('ko-KR');
 const entries=data?.entries??[];
 const rows=query?entries.filter(entry=>entry.name.toLocaleLowerCase('ko-KR').includes(query)):entries;
 const mine=entries.find(entry=>entry.mine);
 const rank=data?.myRank??mine?.rank;
 return <>
  <div className="tc-gr-context">
   <div className="tc-gr-standing"><small>우리 원정단</small><strong>{rank?int(rank)+'위':data?(data.myAssociationId?'순위 없음':'미가입'):'—'}</strong>
    {mine&&<span>{mine.name} · 전투력 {int(mine.combatPower)}</span>}
   </div>
   <button type="button" className="tc-gr-action" aria-label="원정단명 검색" aria-expanded={search!==null} onClick={()=>setSearch(search===null?'':null)}>검색</button>
   <button type="button" className="tc-gr-action" disabled={loading} onClick={refresh}>새로고침</button>
  </div>
  {search!==null && <input type="search" className="tc-gr-filter" aria-label="원정단명" autoFocus maxLength={40} placeholder="원정단명 검색" value={search} onChange={event=>setSearch(event.target.value)}/>}
  <StandingsList listRef={listRef} ready={!!data} loading={loading} error={error} refresh={refresh}>
   {rows.length?rows.map(entry=><Row key={entry.associationId} entry={entry} lease={lease}/>):<p className="tc-gr-empty">{query?'검색 결과가 없습니다.':'현재 등록된 활성 원정단이 없습니다.'}</p>}
  </StandingsList>
 </>;
}

function PersonalStandings({lease,listRef}:StandingsProps){
 const {data,loading,error,refresh}=useStandings(lease,getAdventurerRanking);
 const own=data?.mine??data?.entries.find(entry=>entry.rank===data.myRank);
 const ownRank=own?.rank??data?.myRank??null;
 return <>
  <div className="tc-gr-context">
   <div className="tc-gr-standing"><small>내 순위</small><strong>{ownRank?int(ownRank)+'위':data?'순위 없음':'—'}</strong>
    {own&&<span>{own.nickname} · 전투력 {int(own.combatPower)}</span>}
   </div>
   <PersonalRankingRewards ownRank={ownRank}/>
   <button type="button" className="tc-gr-action" disabled={loading} onClick={refresh}>새로고침</button>
  </div>
  <StandingsList listRef={listRef} ready={!!data} loading={loading} error={error} refresh={refresh}>
   {data?.entries.length?data.entries.map(entry=><PersonalRow key={entry.userId} entry={entry} mine={entry.userId===own?.userId}/>):<p className="tc-gr-empty">등록된 모험가가 없습니다.</p>}
  </StandingsList>
 </>;
}

export function GuildRankingPanel({lease,initialTab='guild',onClose}:{
 lease:GameplayLease;initialTab?:RankingTab;onClose?:()=>void;
}){
 const id=useId();
 const [tab,setTab]=useState<RankingTab>(initialTab);
 const [visitedBoth,setVisitedBoth]=useState(false);
 const session=lease.leaseId+':'+lease.generation;
 const guildList=useRef<HTMLDivElement>(null);
 const personalList=useRef<HTMLDivElement>(null);
 const activeList=tab==='guild'?guildList:personalList;
 const scrollTopByTab=useRef<Record<RankingTab,number>>({guild:0,personal:0});
 useLayoutEffect(()=>{scrollTopByTab.current={guild:0,personal:0};},[session]);
 useLayoutEffect(()=>{
  if(activeList.current)activeList.current.scrollTop=scrollTopByTab.current[tab];
 },[activeList,tab,session]);
 const selectTab=(next:RankingTab)=>{
  if(next===tab)return;
  if(activeList.current)scrollTopByTab.current[tab]=activeList.current.scrollTop;
  setVisitedBoth(true);
  setTab(next);
 };
 const onTabKey=(event:React.KeyboardEvent<HTMLDivElement>)=>{
  let next:RankingTab;
  switch(event.key){
   case 'Home':next='guild';break;
   case 'End':next='personal';break;
   case 'ArrowLeft':case 'ArrowRight':next=tab==='guild'?'personal':'guild';break;
   default:return;
  }
  event.preventDefault();
  selectTab(next);
  document.getElementById(id+'-tab-'+next)?.focus();
 };
 return <section className="tc-gr tc-combat-rankings" aria-label="전투력 랭킹">
  <header className="tc-gr-navigation">
   <div role="tablist" aria-label="랭킹 종류" className="tc-gr-tabs" onKeyDown={onTabKey}>
    {rankingTabs.map(item=><button key={item.id} type="button" role="tab" id={id+'-tab-'+item.id}
     aria-controls={id+'-panel-'+item.id} aria-selected={tab===item.id} tabIndex={tab===item.id?0:-1}
     className="tc-feel-press" data-game-feel="press" onClick={()=>selectTab(item.id)}>
     <img src={item.icon} alt=""/>{item.label}
    </button>)}
   </div>
   {onClose&&<button type="button" className="tc-gr-close" aria-label="랭킹 닫기" onClick={onClose}>×</button>}
  </header>
  {rankingTabs.map(item=><div key={session+item.id} className="tc-gr-pane" role="tabpanel"
   id={id+'-panel-'+item.id} aria-labelledby={id+'-tab-'+item.id} hidden={tab!==item.id}>
   {(tab===item.id||visitedBoth) && (item.id==='guild'?<GuildStandings lease={lease} listRef={guildList}/>:<PersonalStandings lease={lease} listRef={personalList}/>)}
  </div>)}
 </section>;
}
