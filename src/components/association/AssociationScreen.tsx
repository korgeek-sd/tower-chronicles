import {assetUrl,playerGraphicForJob} from '../../game/data/graphics';
import {HubIcon} from '../mobile/HubIcon';
import {GameSelect} from '../../ui/GameSelect';
import React,{useEffect,useMemo,useState} from 'react';
import type {AssociationPolicy,GameState} from '../../game/types';
import {
 ASSOCIATION_CREATION_FEE_SILVER,createAssociation,disbandAssociation,leaveAssociation,updateAssociation,
} from '../../game/association/service';
import {Glyph,Pager,Screen,Segments} from '../../ui/mobile';
import type {GameplayLease} from '../../online/gameSession';
import type {CloudSaveRecord} from '../../online/cloudSave';
import {
 createOnlineAssociation,disbandOnlineAssociation,joinOnlineAssociation,kickOnlineAssociationMember,
 leaveOnlineAssociation,loadOnlineAssociationState,reviewOnlineAssociationApplication,
 subscribeAssociationRealtime,transferOnlineAssociationLeadership,updateOnlineAssociation,
 type OnlineAssociationMutationResult,type OnlineAssociationState,
} from '../../online/association';

import {getOccupationState,type OnlineOccupationState} from '../../online/occupation';
import {loadAssociationProgression,type AssociationProgression} from '../../online/associationProgression';
import {associationLevelProgress} from '../../game/association/growthRules';
import {TOWERS} from '../../game/data/config';
import {getGuildTerritoryState,type GuildTerritoryState} from '../../online/guildTerritory';
import {ACTIVE_TOWN_ID_SET} from '../world/worldMap';
import './hq.css';
import './hq-v2.css';
import './hq-v3.css';
import './hq-v4.css';
import './gatehouse.css';
import {AssociationSupplyPanel} from './AssociationSupplyPanel';
import {AssociationWarehousePanel} from './AssociationWarehousePanel';
import {GuildTerritoryPanel} from './GuildTerritoryPanel';
import {GuildRankingPanel} from './GuildRankingPanel';
import {PagedSelectContext} from '../../ui/GameScrollSelect';
import {GuildTask} from './GuildTask';
import './guild-workspace.css';
import {GuildBossPanel} from './GuildBossPanel';
import {GuildAuctionPanel} from './GuildAuctionPanel';

type LocalTab='overview'|'members'|'activity'|'manage';
const localTabs=[['overview','본부'],['members','단원'],['activity','기록'],['manage','관리']] as const;
type ServerTab='shop'|'overview'|'boss'|'auction'|'warehouse'|'territory'|'rankings'|'members'|'applications'|'activity'|'manage';
const serverTabs=[['overview','본부'],['boss','보스전'],['auction','경매'],['shop','상점'],['warehouse','금고'],['territory','영지'],['rankings','랭킹'],['members','단원'],['applications','신청'],['activity','기록'],['manage','관리']] as const;

type CompanySection='overview'|'combat'|'territory'|'assets'|'people';
const companySections:readonly {id:CompanySection;label:string;art:string;first:ServerTab;tabs:readonly ServerTab[]}[]=[
 {id:'overview',label:'본부',art:'home',first:'overview',tabs:['overview','rankings','activity']},
 {id:'combat',label:'전투',art:'hunt',first:'boss',tabs:['boss']},
 {id:'territory',label:'영지',art:'world',first:'territory',tabs:['territory']},
 {id:'assets',label:'자산',art:'inventory',first:'warehouse',tabs:['warehouse','shop','auction']},
 {id:'people',label:'단원',art:'association',first:'members',tabs:['members','applications','manage']}
];
const PAGE_SIZE=3;

export function AssociationScreen({
 game,setGame,onlineLease,onServerRecord,onOccupation,
}:{
 game:GameState;
 setGame:React.Dispatch<React.SetStateAction<GameState>>;
 onlineLease?:GameplayLease|null;
 onOccupation?:()=>void;
 onServerRecord?:(record:CloudSaveRecord,message:string)=>void;
}){
 if(onlineLease)return <OnlineAssociationScreen game={game} setGame={setGame} lease={onlineLease} onServerRecord={onServerRecord} onOccupation={onOccupation}/>;
 return <LocalAssociationScreen game={game} setGame={setGame}/>;
}

function OnlineAssociationScreen({
 game,setGame,lease,onServerRecord,onOccupation,
}:{
 game:GameState;
 setGame:React.Dispatch<React.SetStateAction<GameState>>;
 lease:GameplayLease;
 onOccupation?:()=>void;
 onServerRecord?:(record:CloudSaveRecord,message:string)=>void;
}){
 const [state,setState]=useState<OnlineAssociationState|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [tab,setTab]=useState<ServerTab>('overview');
 const [discoveryRankings,setDiscoveryRankings]=useState(false);
 const [page,setPage]=useState(0);
 const [name,setName]=useState('');
 const [description,setDescription]=useState('');
 const [policy,setPolicy]=useState<AssociationPolicy>('APPROVAL');
 const [notice,setNotice]=useState('');
 const [share,setShare]=useState(0);
 const [creating,setCreating]=useState(false),[search,setSearch]=useState(''),[available,setAvailable]=useState(true),[selected,setSelected]=useState<string|null>(null),[fullNotice,setFullNotice]=useState(false);
 const [occupation,setOccupation]=useState<OnlineOccupationState|null>(null);
 const [growthOpen,setGrowthOpen]=useState(false);
 const [heroProgress,setHeroProgress]=useState<AssociationProgression|null>(null);
 useEffect(()=>{
  let disposed=false;
  if(!state?.current){setHeroProgress(null);return;}
  void loadAssociationProgression(lease).then(next=>{if(!disposed)setHeroProgress(next);}).catch(()=>{if(!disposed)setHeroProgress(null);});
  return()=>{disposed=true;};
 },[state?.current?.associationId,state?.current?.activity[0]?.activityId,lease.leaseId,lease.generation]);

 const [territorySummary,setTerritorySummary]=useState<Pick<GuildTerritoryState,'ownedCount'|'totalCount'>|null>(null);
 useEffect(()=>{
  let disposed=false;
  if(!state?.current||tab!=='overview'){return;}
  setTerritorySummary(null);
  void getGuildTerritoryState(lease).then(next=>{
   if(!disposed){
    const active=next.towns.filter(t=>ACTIVE_TOWN_ID_SET.has(t.townId));
    setTerritorySummary({ownedCount:active.filter(t=>t.owned).length,totalCount:active.length});
   }
  }).catch(()=>{if(!disposed)setTerritorySummary(null);});
  return()=>{disposed=true;};
 },[state?.current?.associationId,tab,lease.leaseId,lease.generation]);

 useEffect(()=>{let disposed=false;if(state?.current&&tab==='overview')void getOccupationState(lease).then(x=>{if(!disposed)setOccupation(x);}).catch(()=>{if(!disposed)setOccupation(null);});return()=>{disposed=true;};},[state?.current?.associationId,tab,lease.leaseId]);


 const refresh=async()=>{
  try{setState(await loadOnlineAssociationState(lease));setError('');}
  catch(e){setError(e instanceof Error?e.message:'원정단 상태를 불러오지 못했습니다.');}
 };
 useEffect(()=>{
  let disposed=false;
  void loadOnlineAssociationState(lease).then(next=>{if(!disposed)setState(next);}).catch(e=>{if(!disposed)setError(e instanceof Error?e.message:'원정단 상태를 불러오지 못했습니다.');});
  const unsubscribe=subscribeAssociationRealtime(()=>{if(!disposed)void refresh();});
  return()=>{disposed=true;unsubscribe();};
 },[lease.leaseId,lease.generation]);
 useEffect(()=>{
  const current=state?.current;
  if(!current)return;
  setDescription(current.description);
  setNotice(current.notice);
  setPolicy(current.joinPolicy);
  setShare(current.revenueShareRatePercent);
 },[state?.current?.associationId,state?.current?.description,state?.current?.notice,state?.current?.joinPolicy,state?.current?.revenueShareRatePercent]);

 const applyRecord=(record:CloudSaveRecord,message:string)=>{
  if(onServerRecord)onServerRecord(record,message);
  else setGame(record.payload);
 };
 const act=async(fn:()=>Promise<OnlineAssociationMutationResult>,message:string)=>{
  setBusy(true);setError('');
  try{
   const result=await fn();
   setState(result.state);
   applyRecord(result.record,message);
  }catch(e){setError(e instanceof Error?e.message:'원정단 요청을 처리하지 못했습니다.');}
  finally{setBusy(false);}
 };

 if(!state)return <Screen eyebrow="NOVAR REGISTRY / ONLINE" title="원정단"><div className="tc-floor-risk">{error||'서버 원정단 정보를 불러오고 있습니다.'}</div></Screen>;

 const current=state.current;
 if(!current){
  const pending=new Set(state.myApplications.map(item=>item.associationId));
 const directory=state.directory.filter(e=>(!available||(e.joinPolicy!=='CLOSED'&&e.memberCount<e.memberLimit))&&e.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const directoryPages=Math.max(1,Math.ceil(directory.length/3)),safeDirectory=Math.min(page,directoryPages-1);
  return <Screen className="tc-guild-directory-screen" eyebrow="NOVAR COMPANY REGISTRY / ONLINE" title="원정단 찾기" meta={<span>{game.silver.toLocaleString()} S</span>}>
   <PagedSelectContext.Provider value={true}>
   <div className="tc-assoc tc-assoc-online tc-assoc-registry">
    <div className="tc-hq-toolbar"><label>원정단 검색<input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="원정단명 검색"/></label><button onClick={()=>{setCreating(x=>!x);setDiscoveryRankings(false);}}>{creating?'목록으로':'원정단 창설'}</button></div>
     <button type="button" className="tc-gr-discover" onClick={()=>{setDiscoveryRankings(x=>!x);setCreating(false);}}>{discoveryRankings?'모집 게시판으로':'원정단 랭킹 보기'}</button>
    {state.myApplications.length>0&&<div className="tc-hq-waiting">신청 대기 · {state.myApplications.map(x=>x.associationName).join(', ')}</div>}
    {!creating&&<label className="tc-hq-filter"><input type="checkbox" checked={available} onChange={e=>setAvailable(e.target.checked)}/>가입 가능한 원정단만</label>}
    {creating&&<div className="tc-floor-risk tc-assoc-qualification">등록금 {ASSOCIATION_CREATION_FEE_SILVER.toLocaleString()} S</div>}
    {creating&&<section className="tc-panel strong tc-assoc-charter">
     <div className="tc-panel-title"><b>새 원정단 창설</b><small>ASSOCIATION CHARTER</small></div>
     <div className="tc-form">
      <label>원정단명<input value={name} maxLength={20} onChange={e=>setName(e.target.value)} placeholder="2~20자"/></label>
      <label>소개<textarea value={description} maxLength={120} onChange={e=>setDescription(e.target.value)} placeholder="원정단 소개"/></label>
      <label>가입 방식<GameSelect value={policy} onChange={e=>setPolicy(e.target.value as AssociationPolicy)}><option value="APPROVAL">승인 가입</option><option value="OPEN">자유 가입</option></GameSelect></label>
     </div>
     <button className="tc-action" disabled={game.silver<ASSOCIATION_CREATION_FEE_SILVER||name.trim().length<2||busy} onClick={()=>void act(()=>createOnlineAssociation(lease,{name,description,joinPolicy:policy==='OPEN'?'OPEN':'APPROVAL'}),'원정단을 서버에 등록했습니다.')}>{busy?'처리 중':'원정단 등록'}</button>
    </section>}
    {!creating&&discoveryRankings&&<GuildRankingPanel lease={lease}/>}
     {!creating&&!discoveryRankings&&<section className="tc-panel tc-assoc-recruitment">
     <div className="tc-panel-title"><b>원정단 찾기 · 모집 게시판</b><small>{directory.length}개 원정단</small></div>
     <div className="tc-assoc-directory">
      {directory.slice(safeDirectory*3,safeDirectory*3+3).map(entry=>{
       const waiting=pending.has(entry.associationId),full=entry.memberCount>=entry.memberLimit;
       return <article key={entry.associationId} className={selected===entry.associationId?'selected':''}>
        <div><button className="tc-hq-directory-name" onClick={()=>setSelected(selected===entry.associationId?null:entry.associationId)} aria-expanded={selected===entry.associationId}>{entry.name}</button><small>{entry.recordNumber} · {entry.memberCount}/{entry.memberLimit}명 · {entry.joinPolicy==='OPEN'?'자유 가입':entry.joinPolicy==='APPROVAL'?'승인 가입':'모집 중지'}</small>{selected===entry.associationId&&<p>{entry.description||'등록된 소개가 없습니다.'}<br/>안전 귀환 수익 분담 {entry.revenueShareRatePercent??0}%</p>}</div>
        <button hidden={selected!==entry.associationId} disabled={busy||waiting||full||entry.joinPolicy==='CLOSED'} onClick={()=>void act(()=>joinOnlineAssociation(lease,entry.associationId),entry.joinPolicy==='OPEN'?'원정단에 가입했습니다.':'가입 신청을 보냈습니다.')}>{waiting?'신청 대기':full?'정원 마감':entry.joinPolicy==='OPEN'?'즉시 가입':'가입 신청'}</button>
       </article>;
      })}
      {!directory.length&&<div className="tc-market-v2-empty">조건에 맞는 원정단이 없습니다.<br/>검색 조건을 바꾸거나 새 원정단을 창설하세요.</div>}
     </div>
     <Pager page={safeDirectory} count={directoryPages} onChange={setPage}/>
    </section>}
    {error&&<div className="tc-floor-risk">{error}</div>}
   </div>
   </PagedSelectContext.Provider>
  </Screen>;
 }

 const leader=current.myRole==='LEADER';
 const visibleTabs=(leader?serverTabs:serverTabs.filter(([id])=>id!=='applications'&&id!=='manage')) as readonly (readonly [ServerTab,string])[];
 const heroLevel=heroProgress?associationLevelProgress(heroProgress.associationExp):null;
 const activeSection=companySections.find(section=>section.tabs.includes(tab))??companySections[0];
 const subTabs=visibleTabs.filter(([id])=>activeSection.tabs.includes(id));
 const navigate=(destination:ServerTab)=>{setGrowthOpen(false);setFullNotice(false);setTab(destination);setPage(0);};
 const source=tab==='members'?current.members:tab==='applications'?current.applications:tab==='activity'?current.activity:[];
 const pages=Math.max(1,Math.ceil(source.length/PAGE_SIZE)),safe=Math.min(page,pages-1),shown=source.slice(safe*PAGE_SIZE,safe*PAGE_SIZE+PAGE_SIZE);

 const sectionNav=<nav className="tc-company-mainnav" role="tablist" aria-label="원정단 주요 메뉴">
    {companySections.map(section=><button type="button" key={section.id} role="tab" aria-selected={section.id===activeSection.id}
     className={section.id===activeSection.id?'active':''} onClick={()=>navigate(section.first)}>
     <HubIcon name={section.art}/><span>{section.label}</span>
     {section.id==='people'&&leader&&current.applications.length>0&&<i className="tc-company-pending-dot" aria-label={'가입 신청 '+current.applications.length+'건'}/>}
    </button>)}
   </nav>;
 const playerArt=tab==='overview'?playerGraphicForJob(game.currentJobId,game.cosmetics.selectedAppearanceId).image.idle:null;
 return <Screen className={tab==='boss'?'tc-assoc-raid-screen tc-company-screen':'tc-company-screen'} eyebrow="NOVAR EXPEDITION COMPANY" title={current.name} meta={<span>{leader?'원정단장':'원정단원'}</span>} hideHeader>
  <div className={"tc-assoc tc-assoc-online tc-assoc-hq tc-assoc-hq-v2"+(tab==='boss'?" tc-assoc-raid-view":"")+" tc-assoc-hq-v4"+(tab==='overview'?" tc-gatehouse":" tc-gate-detail")}>
   <header className="tc-gate-identity">
    <div className="tc-gate-emblem" aria-hidden="true"/>
    <button type="button" className="tc-gate-growth" onClick={()=>setGrowthOpen(true)} aria-label="원정단 성장 및 기부 열기">
     <b>{current.name} 원정단</b>
     <span className="tc-gate-level">
      <span>Lv.{heroProgress?.associationLevel??'—'}</span>
      <span className="tc-gate-meter" role="progressbar" aria-label="원정단 경험치" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(heroLevel?.percent??0)}>
       <i style={{width:(heroLevel?.percent??0)+'%'}}/>
      </span>
      <span>{heroLevel?Math.round(heroLevel.percent)+'%':'—'}</span>
     </span>
    </button>
    <div className="tc-gate-tools">
     <button type="button" onClick={()=>navigate('rankings')}><span><i className="tc-gate-icon" data-icon="ranking" aria-hidden="true"/>랭킹</span></button>
     <button type="button" onClick={()=>navigate('activity')}><span><i className="tc-gate-icon" data-icon="record" aria-hidden="true"/>기록</span></button>
    </div>
    {tab!=='overview'&&<button type="button" className="tc-guild-chat-tool" aria-label="원정단 채팅 열기" onClick={()=>window.dispatchEvent(new CustomEvent('tower-open-association-chat'))}><i className="tc-gate-icon" data-icon="chat"/></button>}
   </header>
   {subTabs.length>1&&activeSection.id!=='overview'&&<div className="tc-company-subnav-wrap"><Segments items={subTabs} value={tab} onChange={navigate} label={activeSection.label+' 세부 메뉴'}/></div>}
   {activeSection.id==='combat'&&<div className="tc-company-combat-nav" role="group" aria-label="공동 전투 기능">
    <button type="button" aria-current="page" onClick={()=>navigate('boss')}>보스전</button>
    <button type="button" onClick={onOccupation} disabled={!onOccupation}>점령전 본부 ›</button>
   </div>}
   {tab==='overview'&&<section className="tc-company-overview tc-hq-fixed-overview tc-hq-line-overview" aria-label="원정단 본부 대시보드">
    <div className="tc-gate-stats" aria-label="원정단 현황">
     <div><small>단원</small><b>{current.members.length}<em> / {current.memberLimit}</em></b></div>
     <div><small>점령 영지</small><b>{territorySummary?territorySummary.ownedCount:'—'}<em>{territorySummary?' / '+territorySummary.totalCount:''}</em></b></div>
     <div><small>공용 실버</small><b>{current.treasurySilver.toLocaleString()}<em> S</em></b></div>
    </div>
    <div className="tc-courtyard-scene">
     <img className="tc-courtyard-art" src={assetUrl('assets/backgrounds/association/guild-courtyard-v3.webp')} alt="" />
     <div className="tc-courtyard-heading"><h2><HubIcon name="world"/>원정단 본부</h2>
      <button type="button" onClick={()=>setFullNotice(true)} aria-label="원정단 공지 열기">원정단 공지 ›</button>
     </div>
     {playerArt&&<img className="tc-courtyard-player" src={assetUrl(playerArt)} alt=""/>}
     <nav className="tc-hq-feature-grid tc-courtyard-places" aria-label="원정단 시설 지도">
     <button type="button" className="tc-hq-feature" onClick={()=>navigate('boss')}>
      <span className="tc-courtyard-plate"><i className="tc-gate-icon" data-icon="boss" aria-hidden="true"/><b>보스전</b></span>
     </button>
     <button type="button" className="tc-hq-feature" onClick={onOccupation} disabled={!onOccupation}>
      <span className="tc-courtyard-plate"><i className="tc-gate-icon" data-icon="siege" aria-hidden="true"/><b>점령전</b></span>
     </button>
     <button type="button" className="tc-hq-feature" onClick={()=>navigate('territory')}>
      <span className="tc-courtyard-plate"><i className="tc-gate-icon" data-icon="land" aria-hidden="true"/><b>영지 관리</b></span>
     </button>
     <button type="button" className="tc-hq-feature" onClick={()=>navigate('shop')}>
      <span className="tc-courtyard-plate"><i className="tc-gate-icon" data-icon="shop" aria-hidden="true"/><b>원정단 상점</b></span>
     </button>
     <button type="button" className="tc-hq-feature" onClick={()=>navigate('warehouse')}>
      <span className="tc-courtyard-plate"><i className="tc-gate-icon" data-icon="vault" aria-hidden="true"/><b>원정단 금고</b></span>
     </button>
     <button type="button" className="tc-hq-feature" onClick={()=>navigate('auction')}>
      <span className="tc-courtyard-plate"><i className="tc-gate-icon" data-icon="auction" aria-hidden="true"/><b>원정단 경매</b></span>
     </button>
     </nav>
    </div>
    {sectionNav}
    <button type="button" className="tc-courtyard-dispatch" onClick={()=>navigate('boss')}><HubIcon name="hunt"/>보스전 출정하기</button>
    <button type="button" className="tc-hq-chat-strip" onClick={()=>window.dispatchEvent(new CustomEvent('tower-open-association-chat'))}>
     <i className="tc-gate-icon" data-icon="chat" aria-hidden="true"/><span className="tc-hq-strip-label">원정단 채팅</span>
     <span className="tc-hq-strip-content">단원들과 대화하기</span>
     <span className="tc-hq-strip-arrow" aria-hidden="true">›</span>
    </button>
   </section>}
   {(growthOpen||fullNotice)&&<div className="tc-hq-overlay-backdrop" onClick={()=>{setGrowthOpen(false);setFullNotice(false);}}>
    <section className="tc-hq-overlay-panel" role="dialog" aria-modal="true" aria-label={growthOpen?'원정단 성장 및 기부':'원정단 공지'} onClick={event=>event.stopPropagation()}>
     <header><b>{growthOpen?'원정단 성장 · 기부':'원정단 공지'}</b><button type="button" onClick={()=>{setGrowthOpen(false);setFullNotice(false);}} aria-label="닫기">✕</button></header>
     <PagedSelectContext.Provider value={true}>
     {growthOpen&&<AssociationSupplyPanel key={current.associationId+'growth'} lease={lease} mode="growth" refreshKey={current.activity[0]?.activityId} expedition={!!game.expedition} silver={game.silver} gold={game.market.gold} onRecord={applyRecord} onChanged={()=>void refresh()}/>}
     {fullNotice&&<p className="tc-hq-notice-full">{current.notice||'등록된 공지가 없습니다.'}</p>}
     </PagedSelectContext.Provider>
    </section>
   </div>}
   {tab!=='overview'&&<PagedSelectContext.Provider value={true}><div key={tab} className="tc-guild-workspace">
   {tab==='boss'&&<GuildBossPanel key={current.associationId+'-boss'} lease={lease} associationId={current.associationId} expedition={!!game.expedition} onAuction={()=>setTab('auction')}/>}
   {tab==='auction'&&<GuildAuctionPanel key={current.associationId+'-auction'} lease={lease} associationId={current.associationId} expedition={!!game.expedition} onRecord={applyRecord} onChanged={()=>void refresh()}/>} 
   {tab==='rankings'&&<GuildRankingPanel lease={lease}/>}
   {tab==='territory'&&<GuildTerritoryPanel key={current.associationId+'-territory'} lease={lease} associationId={current.associationId}/>}
   {tab==='warehouse'&&<AssociationWarehousePanel key={current.associationId+'-warehouse'} lease={lease} associationId={current.associationId} expedition={!!game.expedition} onRecord={applyRecord} onChanged={()=>void refresh()}/>}
   {tab==='shop'&&<AssociationSupplyPanel key={current.associationId+'shop'} lease={lease} mode="shop" expedition={!!game.expedition} silver={game.silver} gold={game.market.gold} onRecord={applyRecord} onChanged={()=>void refresh()}/>}
   {tab==='members'&&<section className="tc-company-records"><div className="tc-member-list">{shown.map((item:any)=>{const member=item as typeof current.members[number];return <div className="tc-member tc-assoc-member" key={member.userId}><div><b>{member.playerLabel}{member.userId===state.userId?' · 나':''}</b><small>{member.role==='LEADER'?'단장':'단원'} · {new Date(member.joinedAt).toLocaleDateString('ko-KR')}</small></div>{leader&&member.role==='MEMBER'&&<GuildTask title={member.playerLabel+' 관리'} feedback={error}><span className="tc-assoc-member-actions"><button disabled={busy} onClick={()=>{if(window.confirm(member.playerLabel+'에게 단장을 위임하시겠습니까?'))void act(()=>transferOnlineAssociationLeadership(lease,member.userId),'원정단장 권한을 위임했습니다.');}}>단장 위임</button><button disabled={busy} onClick={()=>{if(window.confirm(member.playerLabel+'을(를) 내보내시겠습니까?'))void act(()=>kickOnlineAssociationMember(lease,member.userId),'원정단원을 내보냈습니다.');}}>내보내기</button></span></GuildTask>}</div>})}</div><Pager page={safe} count={pages} onChange={setPage}/></section>}

   {tab==='applications'&&leader&&<section className="tc-company-records"><div className="tc-member-list">{shown.map((item:any)=>{const application=item as typeof current.applications[number];return <div className="tc-member tc-assoc-member tc-assoc-application" key={application.applicationId}><div><b>{application.playerLabel}</b><small>{new Date(application.createdAt).toLocaleString('ko-KR')}</small></div><span className="tc-assoc-member-actions"><button disabled={busy} onClick={()=>void act(()=>reviewOnlineAssociationApplication(lease,application.applicationId,true),'가입 신청을 승인했습니다.')}>승인</button><button disabled={busy} onClick={()=>void act(()=>reviewOnlineAssociationApplication(lease,application.applicationId,false),'가입 신청을 거절했습니다.')}>거절</button></span></div>})}{!shown.length&&<div className="tc-market-v2-empty">대기 중인 가입 신청이 없습니다.</div>}</div><Pager page={safe} count={pages} onChange={setPage}/></section>}

   {tab==='activity'&&<section className="tc-company-records"><div className="tc-member-list">{shown.map((item:any)=>{const activity=item as typeof current.activity[number];return <div className="tc-member tc-assoc-activity" key={activity.activityId}><small>{new Date(activity.createdAt).toLocaleString('ko-KR')}</small><span>{activity.text}</span></div>})}{!shown.length&&<div className="tc-market-v2-empty">등록된 활동 기록이 없습니다.</div>}</div><Pager page={safe} count={pages} onChange={setPage}/></section>}

   {tab==='manage'&&leader&&<section className="tc-panel tc-assoc-manage-panel">
    <div className="tc-form">
     <GuildTask title="소개 및 공지" feedback={error}><label>소개<textarea value={description} maxLength={120} onChange={e=>setDescription(e.target.value)}/></label>
     <label>공지<textarea value={notice} maxLength={180} onChange={e=>setNotice(e.target.value)}/></label>
     <button type="button" className="tc-action" disabled={busy} onClick={()=>void act(()=>updateOnlineAssociation(lease,{description,notice,joinPolicy:policy,revenueShareRatePercent:share}),'소개 및 공지를 저장했습니다.')}>소개 및 공지 저장</button></GuildTask>
     <label>가입 방식<GameSelect value={policy} onChange={e=>setPolicy(e.target.value as AssociationPolicy)}><option value="APPROVAL">승인 가입</option><option value="OPEN">자유 가입</option><option value="CLOSED">모집 중지</option></GameSelect></label>
     <label>원정 수익 분담<input type="number" min="0" max="30" value={share} onChange={e=>setShare(Math.max(0,Math.min(30,Math.floor(Number(e.target.value)||0))))}/><small>안전 귀환 Silver의 {share}%가 원정단 금고에 적립됩니다. 출정 시 비율이 고정됩니다.</small></label>
    </div>
    <button className="tc-action" disabled={busy} onClick={()=>void act(()=>updateOnlineAssociation(lease,{description,notice,joinPolicy:policy,revenueShareRatePercent:share}),'원정단 정보를 저장했습니다.')}>설정 저장</button>
    <GuildTask title="원정단 해산"><div className="tc-assoc-danger-zone"><div><small>DANGER</small><b>원정단 해산</b><p>모든 단원이 소속 해제되며 되돌릴 수 없습니다.</p></div><button disabled={busy} onClick={()=>{if(window.confirm('원정단을 해산하시겠습니까? 모든 단원이 소속 해제됩니다.'))void act(()=>disbandOnlineAssociation(lease),'원정단을 해산했습니다.');}}>해산</button></div></GuildTask>
   </section>}

   {!leader&&tab==='members'&&<details className="tc-hq-account-menu"><summary>내 소속 관리</summary><button disabled={busy} onClick={()=>{if(window.confirm('원정단에서 탈퇴하시겠습니까?'))void act(()=>leaveOnlineAssociation(lease),'원정단에서 탈퇴했습니다.');}}>원정단 탈퇴</button></details>}
   </div></PagedSelectContext.Provider>}
   {tab!=='overview'&&sectionNav}

   {error&&<div className="tc-floor-risk">{error}</div>}
  </div>
 </Screen>;
}

function LocalAssociationScreen({game,setGame}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>}){
 const [name,setName]=useState(''),[description,setDescription]=useState(''),[policy,setPolicy]=useState<AssociationPolicy>('APPROVAL'),[tab,setTab]=useState<LocalTab>('overview'),[page,setPage]=useState(0),[creating,setCreating]=useState(false);
 const register=()=>setGame(s=>createAssociation(s,{name,description,joinPolicy:policy}));
 const current=game.association.associations.find(a=>a.associationId===game.association.currentId&&a.status==='ACTIVE');
 if(!current&&!creating)return <Screen title="원정단 찾기"><div className="tc-assoc tc-assoc-registry"><div className="tc-hq-toolbar"><label>원정단 검색<input placeholder="로그인 후 원정단명 검색" disabled/></label><button onClick={()=>setCreating(true)}>원정단 창설</button></div><section className="tc-panel tc-assoc-recruitment"><div className="tc-panel-title"><b>모집 게시판</b><small>온라인 전용</small></div><div className="tc-market-v2-empty">Google 로그인 후 닉네임을 정하면<br/>원정단을 찾고 가입할 수 있습니다.</div></section><div className="tc-hq-waiting">게스트의 원정단은 이 기기에만 저장됩니다.</div></div></Screen>;
 if(!current)return <Screen meta={<button className="tc-hq-member-select" onClick={()=>setCreating(false)}>목록으로</button>} eyebrow="NOVAR COMPANY REGISTRY / LOCAL" title="원정단 창설"><div className="tc-assoc"><div className="tc-floor-risk">등록금 {ASSOCIATION_CREATION_FEE_SILVER.toLocaleString()} S</div><section className="tc-panel strong"><div className="tc-form"><label>원정단명<input value={name} maxLength={20} onChange={e=>setName(e.target.value)} placeholder="2~20자"/></label><label>소개<textarea value={description} maxLength={120} onChange={e=>setDescription(e.target.value)} placeholder="원정단 소개"/></label><label>가입 방식<GameSelect value={policy} onChange={e=>setPolicy(e.target.value as AssociationPolicy)}><option value="APPROVAL">승인 가입</option><option value="OPEN">자유 가입</option></GameSelect></label></div></section><div/><button className="tc-action" disabled={game.silver<ASSOCIATION_CREATION_FEE_SILVER||name.trim().length<2} onClick={register}>원정단 등록</button></div></Screen>;
 const leader=current.leaderId===game.market.ownerId,visibleTabs:readonly (readonly [LocalTab,string])[]=leader?localTabs:localTabs.filter(([id])=>id!=='manage'),source=tab==='members'?current.members:tab==='activity'?current.activityLog:[],pages=Math.max(1,Math.ceil(source.length/PAGE_SIZE)),safe=Math.min(page,pages-1),shown=source.slice(safe*PAGE_SIZE,safe*PAGE_SIZE+PAGE_SIZE);
 return <Screen eyebrow="NOVAR EXPEDITION COMPANY / LOCAL" title={current.name} meta={<span>{leader?'원정단장':'원정단원'}</span>}>
  <div className="tc-assoc">
   <Segments items={visibleTabs} value={tab} onChange={v=>{setTab(v);setPage(0);}} label="원정단 메뉴"/>
   {tab==='overview'&&<section className="tc-panel strong"><div className="tc-panel-title"><b>기록번호 {current.recordNumber}</b><small>{current.members.length}명</small></div><p style={{fontSize:'9px',lineHeight:1.45,margin:'0 0 8px'}}>{current.description||'등록된 소개가 없습니다.'}</p><div className="tc-floor-risk"><b>공지</b><br/>{current.notice||'등록된 공지가 없습니다.'}</div><div className="tc-stat-grid"><div className="tc-stat"><small>가입</small><b>{current.joinPolicy==='OPEN'?'자유':current.joinPolicy==='APPROVAL'?'승인':'중지'}</b></div><div className="tc-stat"><small>역할</small><b>{leader?'단장':'단원'}</b></div></div></section>}
   {(tab==='members'||tab==='activity')&&<><div className="tc-member-list">{shown.map((x:any,i)=>tab==='members'?<div className="tc-member" key={x.playerId}><div><b>{x.playerId===game.market.ownerId?'나':'탐사자 '+x.playerId}</b><small>{x.role==='LEADER'?'단장':'단원'}</small></div><small>{new Date(x.joinedAt).toLocaleDateString('ko-KR')}</small></div>:<div className="tc-member" key={safe*PAGE_SIZE+i}><small>{new Date(x.at).toLocaleString('ko-KR')}</small><span>{x.text}</span></div>)}{Array.from({length:Math.max(0,PAGE_SIZE-shown.length)},(_,i)=><div className="tc-member" key={'blank'+i}/>)}</div><Pager page={safe} count={pages} onChange={setPage}/></>}
   {tab==='manage'&&leader&&<section className="tc-panel"><div className="tc-form"><label>소개<textarea defaultValue={current.description} maxLength={120} onBlur={e=>setGame(s=>updateAssociation(s,{description:e.target.value}))}/></label><label>공지<textarea defaultValue={current.notice} maxLength={180} onBlur={e=>setGame(s=>updateAssociation(s,{notice:e.target.value}))}/></label><label>가입 방식<GameSelect value={current.joinPolicy} onChange={e=>setGame(s=>updateAssociation(s,{joinPolicy:e.target.value as AssociationPolicy}))}><option value="APPROVAL">승인 가입</option><option value="OPEN">자유 가입</option><option value="CLOSED">모집 중지</option></GameSelect></label></div><button className="tc-action danger" onClick={()=>{if(window.confirm('원정단을 해산하시겠습니까?'))setGame(s=>disbandAssociation(s));}}>원정단 해산</button></section>}
   {tab==='overview'&&!leader&&<button className="tc-action danger" onClick={()=>{if(window.confirm('원정단에서 탈퇴하시겠습니까?'))setGame(s=>leaveAssociation(s));}}>원정단 탈퇴</button>}
  </div>
 </Screen>;
}
