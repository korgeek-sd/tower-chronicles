import React,{useMemo,useRef,useState} from 'react';
import type{GameplayLease} from '../../online/gameSession';
import type{OnlineAssociationDirectoryEntry,OnlineAssociationOwnApplication} from '../../online/association';
import{GuildEmblem}from'./GuildEmblem';
import{GuildRankingPanel}from'./GuildRankingPanel';
import'./guildRecruitment.css';

type Filter='all'|'open'|'approval'|'rankings';
type SortMode='recent'|'old'|'many'|'few'|'join'|'name';
const sortOptions:{id:SortMode;label:string}[]=[
 {id:'recent',label:'최근 창설순'},
 {id:'old',label:'오래된 순'},
 {id:'many',label:'단원 많은 순'},
 {id:'few',label:'단원 적은 순'},
 {id:'join',label:'가입 가능 우선'},
 {id:'name',label:'이름 가나다순'}
];
const isJoinable=(e:OnlineAssociationDirectoryEntry)=>e.joinPolicy!=='CLOSED'&&e.memberCount<e.memberLimit;
const sortGuilds=(a:OnlineAssociationDirectoryEntry,b:OnlineAssociationDirectoryEntry,mode:SortMode)=>{
 const recent=()=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.name.localeCompare(b.name,'ko-KR');
 switch(mode){
  case 'old':return Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.name.localeCompare(b.name,'ko-KR');
  case 'many':return b.memberCount-a.memberCount||recent();
  case 'few':return a.memberCount-b.memberCount||recent();
  case 'join':return Number(isJoinable(b))-Number(isJoinable(a))||recent();
  case 'name':return a.name.localeCompare(b.name,'ko-KR')||recent();
  default:return recent();
 }
};
const options:{id:Filter;label:string}[]=[
 {id:'all',label:'전체'},{id:'open',label:'즉시 가입'},
 {id:'approval',label:'승인 가입'},{id:'rankings',label:'랭킹'}
];
const status=(e:OnlineAssociationDirectoryEntry)=>e.memberCount>=e.memberLimit?'정원 마감':e.joinPolicy==='CLOSED'?'모집 중지':e.joinPolicy==='OPEN'?'자유 가입':'승인 가입';
const compactDate=(iso:string)=>{const d=new Date(iso);return Number.isFinite(d.getTime())?d.toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):'—';};
export function GuildRecruitmentBoard({entries,applications,locked,rejoinAt,busy,error,onCreate,onJoin,lease}:{
 entries:OnlineAssociationDirectoryEntry[];
 applications:OnlineAssociationOwnApplication[];
 locked:boolean;rejoinAt:number;busy:boolean;error:string;
 onCreate:()=>void;onJoin:(entry:OnlineAssociationDirectoryEntry)=>void;lease:GameplayLease;
}){
 const[filter,setFilter]=useState<Filter>('all');
 const[query,setQuery]=useState('');
 const[sortMode,setSortMode]=useState<SortMode>('recent');
 const listRef=useRef<HTMLDivElement>(null);
 const scrollListTop=()=>{if(listRef.current)listRef.current.scrollTop=0;};
 const[expandedId,setExpandedId]=useState<string|null>(null);
 const waiting=new Set(applications.map(x=>x.associationId));
 const matching=useMemo(()=>{
  const q=query.trim().toLocaleLowerCase('ko-KR');
  return entries.filter(e=>e.name.toLocaleLowerCase('ko-KR').includes(q))
   .filter(e=>filter==='open'?e.joinPolicy==='OPEN'&&e.memberCount<e.memberLimit:filter==='approval'?e.joinPolicy==='APPROVAL'&&e.memberCount<e.memberLimit:true)
   .sort((a,b)=>sortGuilds(a,b,sortMode));
 },[entries,filter,query,sortMode]);
 const changeFilter=(id:Filter)=>{setFilter(id);setExpandedId(null);scrollListTop();};
 const changeSort=(next:SortMode)=>{setSortMode(next);setExpandedId(null);scrollListTop();};
 const toggleListItem=(id:string)=>setExpandedId(current=>current===id?null:id);
 const joinButton=(e:OnlineAssociationDirectoryEntry)=>{
  const applied=waiting.has(e.associationId);
  const full=e.memberCount>=e.memberLimit,closed=e.joinPolicy==='CLOSED';
  const text=applied?'신청 대기':full?'정원 마감':closed?'모집 중지':e.joinPolicy==='OPEN'?'즉시 가입':'가입 신청';
  return <button type="button" className="tc-grb-join" disabled={locked||busy||applied||full||closed} onClick={()=>onJoin(e)} aria-label={e.name+' · '+text}>
   <span>{text}</span><span aria-hidden="true">{applied||full||closed?'':'›'}</span>
  </button>;
 };
 return <div className="tc-grb" aria-label="원정단 모집 게시판">
  <div className="tc-grb-search-row">
   <label className="tc-grb-search">
    <span>원정단 검색</span>
    <div className="tc-grb-search-field"><span aria-hidden="true" className="tc-grb-magnifier"/><input value={query} onChange={e=>{setQuery(e.target.value);setExpandedId(null);scrollListTop();}} placeholder="원정단명 검색" aria-label="원정단명 검색"/>{query&&<button aria-label="검색어 지우기" onClick={()=>{setQuery('');setExpandedId(null);scrollListTop();}}>×</button>}</div>
   </label>
   <button className="tc-grb-create" onClick={onCreate}><span aria-hidden="true">✧</span> 원정단 창설</button>
  </div>
  {locked&&<div className="tc-grb-banner" role="status">재가입 대기 · {compactDate(new Date(rejoinAt).toISOString())} 이후 가입 및 창설 가능</div>}
  {applications.length>0&&<div className="tc-grb-banner pending" role="status"><span>신청 대기</span><strong>{applications.map(x=>x.associationName).join(' · ')}</strong></div>}
  <div className="tc-grb-tabs" role="tablist" aria-label="원정단 목록 필터">
   {options.map(opt=><button type="button" role="tab" aria-selected={filter===opt.id} key={opt.id} onClick={()=>changeFilter(opt.id)}>{opt.label}</button>)}
  </div>
  {filter==='rankings'?<div className="tc-grb-ranking"><GuildRankingPanel lease={lease}/></div>:<div className="tc-grb-result">
   <div className="tc-grb-sort-row">
    <span className="tc-grb-sort-count">총 <strong>{matching.length.toLocaleString('ko-KR')}</strong>개</span>
    <label className="tc-grb-sort-control">
     <span className="tc-grb-sr-only">원정단 정렬 방식</span>
     <select aria-label="원정단 정렬 방식" value={sortMode} onChange={e=>changeSort(e.target.value as SortMode)}>
      {sortOptions.map(opt=><option key={opt.id} value={opt.id}>{opt.label}</option>)}
     </select>
    </label>
   </div>
   <div className="tc-grb-list-viewport" ref={listRef}>
    <div className="tc-grb-list">
    {matching.map(e=>{
     const isExpanded=expandedId===e.associationId;
     return <article key={e.associationId} className={'tc-grb-list-item'+(isExpanded?' expanded':'')}>
      <button type="button" className="tc-grb-list-card" aria-expanded={isExpanded} aria-controls={'tc-grb-details-'+e.associationId} onClick={()=>toggleListItem(e.associationId)} aria-label={e.name+' 상세 정보 '+(isExpanded?'접기':'보기')}>
       <span className="tc-grb-list-crest"><GuildEmblem value={e.emblem} size={43}/></span>
       <span className="tc-grb-list-copy"><strong>{e.name}</strong><small>{e.description||'등록된 소개가 없습니다.'}</small><span className="tc-grb-list-meta">{e.memberCount}/{e.memberLimit}명 <em className={e.joinPolicy==='OPEN'?'open':''}>{status(e)}</em></span></span>
       <span className="tc-grb-list-arrow" aria-hidden="true">{isExpanded?'⌃':'›'}</span>
      </button>
      {isExpanded&&<div className="tc-grb-list-details" id={'tc-grb-details-'+e.associationId}>
       <p className="tc-grb-list-detail-description">{e.description||'등록된 원정단 소개가 없습니다.'}</p>
       <div className="tc-grb-list-info-row"><span>원정단 기록</span><strong>No. {e.recordNumber}</strong></div>
       <div className="tc-grb-list-info-row"><span>단원 수</span><strong>{e.memberCount} / {e.memberLimit}명</strong></div>
       <div className="tc-grb-member-track"><i style={{width:Math.min(100,e.memberLimit?e.memberCount/e.memberLimit*100:0)+'%'}}/></div>
       <div className="tc-grb-list-info-row"><span>안전 귀환 수익 분담</span><strong>{e.revenueShareRatePercent??0}%</strong></div>
       <div className="tc-grb-list-info-row"><span>창설일</span><strong>{compactDate(e.createdAt)}</strong></div>
       {joinButton(e)}
      </div>}
     </article>;
    })}
    </div>
    {!matching.length&&<div className="tc-grb-empty"><strong>조건에 맞는 원정단이 없습니다.</strong><span>검색어나 가입 조건을 변경하거나 새 원정단을 창설하세요.</span></div>}
   </div>
  </div>}
  {error&&<div className="tc-floor-risk" role="alert">{error}</div>}
 </div>;
}
