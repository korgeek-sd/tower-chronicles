import React,{useMemo,useState} from 'react';
import type{GameplayLease} from '../../online/gameSession';
import type{OnlineAssociationDirectoryEntry,OnlineAssociationOwnApplication} from '../../online/association';
import{GuildEmblem}from'./GuildEmblem';
import{GuildRankingPanel}from'./GuildRankingPanel';
import{Pager}from'../../ui/mobile';
import'./guildRecruitment.css';

type Filter='recommended'|'all'|'open'|'approval'|'rankings';
const options:{id:Filter;label:string}[]=[
 {id:'recommended',label:'추천'},{id:'all',label:'전체'},{id:'open',label:'즉시 가입'},
 {id:'approval',label:'승인 가입'},{id:'rankings',label:'랭킹'}
];
const fmt=(n:number)=>Math.max(0,n).toLocaleString('ko-KR');
const status=(e:OnlineAssociationDirectoryEntry)=>e.memberCount>=e.memberLimit?'정원 마감':e.joinPolicy==='CLOSED'?'모집 중지':e.joinPolicy==='OPEN'?'자유 가입':'승인 가입';
const compactDate=(iso:string)=>{const d=new Date(iso);return Number.isFinite(d.getTime())?d.toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):'—';};
export function GuildRecruitmentBoard({entries,applications,locked,rejoinAt,busy,error,onCreate,onJoin,lease}:{
 entries:OnlineAssociationDirectoryEntry[];
 applications:OnlineAssociationOwnApplication[];
 locked:boolean;rejoinAt:number;busy:boolean;error:string;
 onCreate:()=>void;onJoin:(entry:OnlineAssociationDirectoryEntry)=>void;lease:GameplayLease;
}){
 const[filter,setFilter]=useState<Filter>('recommended');
 const[query,setQuery]=useState('');
 const[expandedId,setExpandedId]=useState<string|null>(null);
 const[page,setPage]=useState(0);
 const[expanded,setExpanded]=useState(false);
 const waiting=new Set(applications.map(x=>x.associationId));
 const available=(e:OnlineAssociationDirectoryEntry)=>e.joinPolicy!=='CLOSED'&&e.memberCount<e.memberLimit;
 const matching=useMemo(()=>{
  const q=query.trim().toLocaleLowerCase('ko-KR');
  return entries.filter(e=>e.name.toLocaleLowerCase('ko-KR').includes(q))
   .filter(e=>filter==='recommended'?available(e):filter==='open'?e.joinPolicy==='OPEN'&&available(e):filter==='approval'?e.joinPolicy==='APPROVAL'&&available(e):true)
   .sort((a,b)=>filter==='recommended'
    ?b.memberCount-a.memberCount||Date.parse(b.createdAt)-Date.parse(a.createdAt)
    :Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.name.localeCompare(b.name,'ko-KR'));
 },[entries,filter,query]);
 const featured=matching[0]??null;
 const rest=matching.filter(e=>e.associationId!==featured?.associationId);
 const pages=Math.max(1,Math.ceil(rest.length/3));
 const safePage=Math.min(page,pages-1);
 const changeFilter=(id:Filter)=>{setFilter(id);setExpandedId(null);setPage(0);setExpanded(false);};
 const toggleListItem=(id:string)=>setExpandedId(current=>current===id?null:id);
 const joinButton=(e:OnlineAssociationDirectoryEntry,featuredCard=false)=>{
  const applied=waiting.has(e.associationId);
  const full=e.memberCount>=e.memberLimit,closed=e.joinPolicy==='CLOSED';
  const text=applied?'신청 대기':full?'정원 마감':closed?'모집 중지':e.joinPolicy==='OPEN'?'즉시 가입':'가입 신청';
  return <button type="button" className={'tc-grb-join'+(featuredCard?' featured':'')} disabled={locked||busy||applied||full||closed} onClick={()=>onJoin(e)} aria-label={e.name+' · '+text}>
   <span>{text}</span><span aria-hidden="true">{applied||full||closed?'':'›'}</span>
  </button>;
 };
 return <div className="tc-grb" aria-label="원정단 모집 게시판">
  <div className="tc-grb-search-row">
   <label className="tc-grb-search">
    <span>원정단 검색</span>
    <div className="tc-grb-search-field"><span aria-hidden="true" className="tc-grb-magnifier"/><input value={query} onChange={e=>{setQuery(e.target.value);setPage(0);setExpandedId(null);setExpanded(false);}} placeholder="원정단명 검색" aria-label="원정단명 검색"/>{query&&<button aria-label="검색어 지우기" onClick={()=>{setQuery('');setPage(0);setExpandedId(null);setExpanded(false);}}>×</button>}</div>
   </label>
   <button className="tc-grb-create" onClick={onCreate}><span aria-hidden="true">✧</span> 원정단 창설</button>
  </div>
  {locked&&<div className="tc-grb-banner" role="status">재가입 대기 · {compactDate(new Date(rejoinAt).toISOString())} 이후 가입 및 창설 가능</div>}
  {applications.length>0&&<div className="tc-grb-banner pending" role="status"><span>신청 대기</span><strong>{applications.map(x=>x.associationName).join(' · ')}</strong></div>}
  <div className="tc-grb-tabs" role="tablist" aria-label="원정단 목록 필터">
   {options.map(opt=><button type="button" role="tab" aria-selected={filter===opt.id} key={opt.id} onClick={()=>changeFilter(opt.id)}>{opt.label}</button>)}
  </div>
  {filter==='rankings'?<div className="tc-grb-ranking"><GuildRankingPanel lease={lease}/></div>:<div className="tc-grb-result">
   <div className="tc-grb-heading"><span className="tc-grb-heading-decoration">✦</span><strong>{filter==='recommended'?'추천 원정단':filter==='all'?'원정단 목록':filter==='open'?'자유 가입 원정단':'승인 가입 원정단'}</strong><span className="tc-grb-heading-decoration">✦</span></div>
   <div className="tc-grb-count"><span>{filter==='recommended'?'모집 현황을 기준으로 정렬했습니다.':'원정단을 누르면 그 자리에서 상세 정보가 열립니다.'}</span><strong>{fmt(matching.length)}개</strong></div>
   {featured&&<section className="tc-grb-featured" aria-label={featured.name+' 상세 정보'}>
    <div className="tc-grb-featured-main">
     <div className="tc-grb-featured-crest"><GuildEmblem value={featured.emblem} size={76}/></div>
     <div className="tc-grb-featured-content">
      <div className="tc-grb-title-line"><h2>{featured.name}</h2>{filter==='recommended'&&<span className="tc-grb-recommend">추천</span>}</div>
      <span className="tc-grb-record">원정단 No. {featured.recordNumber}</span>
      <p className="tc-grb-description">{featured.description||'등록된 원정단 소개가 없습니다.'}</p>
      <div className="tc-grb-member-line"><span>단원 <b>{featured.memberCount} / {featured.memberLimit}명</b></span><em className={featured.joinPolicy==='OPEN'?'open':'approval'}>{status(featured)}</em></div>
      <div className="tc-grb-member-track"><i style={{width:Math.min(100,featured.memberLimit?featured.memberCount/featured.memberLimit*100:0)+'%'}}/></div>
     </div>
    </div>
    <div className="tc-grb-featured-info"><span>안전 귀환 수익 분담 <b>{featured.revenueShareRatePercent??0}%</b></span><button type="button" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>상세 정보 {expanded?'접기':'보기'} <span aria-hidden="true">{expanded?'⌃':'⌄'}</span></button></div>
    {expanded&&<div className="tc-grb-expanded"><p>{featured.description||'등록된 소개가 없습니다.'}</p><div>창설일 <strong>{compactDate(featured.createdAt)}</strong></div><div>가입 정책 <strong>{status(featured)}</strong></div></div>}
    {joinButton(featured,true)}
   </section>}
   {rest.length>0&&<div className="tc-grb-list-heading"><strong>다른 원정단</strong><span>{rest.length}개</span></div>}
   <div className="tc-grb-list">
    {rest.slice(safePage*3,safePage*3+3).map(e=>{
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
   {pages>1&&<Pager page={safePage} count={pages} onChange={setPage}/>}
   {featured&&<div className="tc-grb-footnote">표시된 정보는 현재 원정단 모집 현황을 기준으로 합니다.</div>}
  </div>}
  {error&&<div className="tc-floor-risk" role="alert">{error}</div>}
 </div>;
}
