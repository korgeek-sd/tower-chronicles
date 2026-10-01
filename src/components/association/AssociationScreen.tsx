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
import {TOWERS} from '../../game/data/config';
import './hq.css';
import {AssociationSupplyPanel} from './AssociationSupplyPanel';

type LocalTab='overview'|'members'|'activity'|'manage';
const localTabs=[['overview','본부'],['members','단원'],['activity','기록'],['manage','관리']] as const;
type ServerTab='shop'|'overview'|'members'|'applications'|'activity'|'manage';
const serverTabs=[['overview','본부'],['shop','상점'],['members','단원'],['applications','신청'],['activity','기록'],['manage','관리']] as const;
const PAGE_SIZE=5;

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
 const [page,setPage]=useState(0);
 const [name,setName]=useState('');
 const [description,setDescription]=useState('');
 const [policy,setPolicy]=useState<AssociationPolicy>('APPROVAL');
 const [notice,setNotice]=useState('');
 const [share,setShare]=useState(0);
 const [creating,setCreating]=useState(false),[search,setSearch]=useState(''),[available,setAvailable]=useState(true),[selected,setSelected]=useState<string|null>(null),[memberSelected,setMemberSelected]=useState<string|null>(null),[fullNotice,setFullNotice]=useState(false);
 const [occupation,setOccupation]=useState<OnlineOccupationState|null>(null);
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
  return <Screen eyebrow="NOVAR COMPANY REGISTRY / ONLINE" title="원정단 찾기" meta={<span>{game.silver.toLocaleString()} S</span>}>
   <div className="tc-assoc tc-assoc-online tc-assoc-registry">
    <div className="tc-hq-toolbar"><label>원정단 검색<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="원정단명 검색"/></label><button onClick={()=>setCreating(x=>!x)}>{creating?'목록으로':'원정단 창설'}</button></div>
    {state.myApplications.length>0&&<div className="tc-hq-waiting">신청 대기 · {state.myApplications.map(x=>x.associationName).join(', ')}</div>}
    {!creating&&<label className="tc-hq-filter"><input type="checkbox" checked={available} onChange={e=>setAvailable(e.target.checked)}/>가입 가능한 원정단만</label>}
    {creating&&<div className="tc-floor-risk tc-assoc-qualification">등록금 {ASSOCIATION_CREATION_FEE_SILVER.toLocaleString()} S</div>}
    {creating&&<section className="tc-panel strong tc-assoc-charter">
     <div className="tc-panel-title"><b>새 원정단 창설</b><small>ASSOCIATION CHARTER</small></div>
     <div className="tc-form">
      <label>원정단명<input value={name} maxLength={20} onChange={e=>setName(e.target.value)} placeholder="2~20자"/></label>
      <label>소개<textarea value={description} maxLength={120} onChange={e=>setDescription(e.target.value)} placeholder="원정단 소개"/></label>
      <label>가입 방식<select value={policy} onChange={e=>setPolicy(e.target.value as AssociationPolicy)}><option value="APPROVAL">승인 가입</option><option value="OPEN">자유 가입</option></select></label>
     </div>
     <button className="tc-action" disabled={game.silver<ASSOCIATION_CREATION_FEE_SILVER||name.trim().length<2||busy} onClick={()=>void act(()=>createOnlineAssociation(lease,{name,description,joinPolicy:policy==='OPEN'?'OPEN':'APPROVAL'}),'원정단을 서버에 등록했습니다.')}>{busy?'처리 중':'원정단 등록'}</button>
    </section>}
    {!creating&&<section className="tc-panel tc-assoc-recruitment">
     <div className="tc-panel-title"><b>원정단 찾기 · 모집 게시판</b><small>{directory.length}개 원정단</small></div>
     <div className="tc-assoc-directory">
      {directory.map(entry=>{
       const waiting=pending.has(entry.associationId),full=entry.memberCount>=entry.memberLimit;
       return <article key={entry.associationId} className={selected===entry.associationId?'selected':''}>
        <div><button className="tc-hq-directory-name" onClick={()=>setSelected(selected===entry.associationId?null:entry.associationId)} aria-expanded={selected===entry.associationId}>{entry.name}</button><small>{entry.recordNumber} · {entry.memberCount}/{entry.memberLimit}명 · {entry.joinPolicy==='OPEN'?'자유 가입':entry.joinPolicy==='APPROVAL'?'승인 가입':'모집 중지'}</small>{selected===entry.associationId&&<p>{entry.description||'등록된 소개가 없습니다.'}<br/>안전 귀환 수익 분담 {entry.revenueShareRatePercent??0}%</p>}</div>
        <button hidden={selected!==entry.associationId} disabled={busy||waiting||full||entry.joinPolicy==='CLOSED'} onClick={()=>void act(()=>joinOnlineAssociation(lease,entry.associationId),entry.joinPolicy==='OPEN'?'원정단에 가입했습니다.':'가입 신청을 보냈습니다.')}>{waiting?'신청 대기':full?'정원 마감':entry.joinPolicy==='OPEN'?'즉시 가입':'가입 신청'}</button>
       </article>;
      })}
      {!directory.length&&<div className="tc-market-v2-empty">조건에 맞는 원정단이 없습니다.<br/>검색 조건을 바꾸거나 새 원정단을 창설하세요.</div>}
     </div>
    </section>}
    {error&&<div className="tc-floor-risk">{error}</div>}
   </div>
  </Screen>;
 }

 const leader=current.myRole==='LEADER';
 const visibleTabs=(leader?serverTabs:serverTabs.filter(([id])=>id!=='applications'&&id!=='manage')) as readonly (readonly [ServerTab,string])[];
 const source=tab==='members'?current.members:tab==='applications'?current.applications:tab==='activity'?current.activity:[];
 const pages=Math.max(1,Math.ceil(source.length/PAGE_SIZE)),safe=Math.min(page,pages-1),shown=source.slice(safe*PAGE_SIZE,safe*PAGE_SIZE+PAGE_SIZE);
 const memberLabel=(userId:string)=>current.members.find(m=>m.userId===userId)?.playerLabel??'탐사자';

 return <Screen eyebrow="NOVAR EXPEDITION COMPANY" title={current.name} meta={<span>{leader?'원정단장':'원정단원'}</span>}>
  <div className="tc-assoc tc-assoc-online tc-assoc-hq">
   <section className="tc-assoc-banner"><span className="tc-assoc-banner-seal"><Glyph name="association"/></span><div className="tc-assoc-banner-copy"><small>{current.recordNumber}</small><b>{current.name}</b><p>{current.description||'등록된 소개가 없습니다.'}</p></div><div className="tc-assoc-banner-meta"><span><small>단장</small><b>{memberLabel(current.leaderUserId)}</b></span><span><small>단원</small><b>{current.members.length}/{current.memberLimit}</b></span></div></section>
   <Segments items={visibleTabs} value={visibleTabs.some(([id])=>id===tab)?tab:'overview'} onChange={v=>{setTab(v);setPage(0);}} label="원정단 메뉴"/>
   {tab==='shop'&&<AssociationSupplyPanel key={current.associationId+'shop'} lease={lease} mode="shop" expedition={!!game.expedition} silver={game.silver} gold={game.market.gold} onRecord={applyRecord} onChanged={()=>void refresh()}/>}
   {tab==='overview'&&<section className="tc-assoc-overview">
    <AssociationSupplyPanel key={current.associationId+'growth'} lease={lease} mode="growth" refreshKey={current.activity[0]?.activityId} expedition={!!game.expedition} silver={game.silver} gold={game.market.gold} onRecord={applyRecord} onChanged={()=>void refresh()}/>
    <div className="tc-assoc-notice-board"><header><Glyph name="jobs"/><b>원정단 공지</b><small>{current.noticeUpdatedAt?new Date(current.noticeUpdatedAt).toLocaleDateString('ko-KR'):'NOTICE'}</small></header><p className={fullNotice?'':'tc-hq-notice-preview'}>{current.notice||'등록된 공지가 없습니다.'}</p>{current.notice&&<button onClick={()=>setFullNotice(v=>!v)}>{fullNotice?'접기':'공지 전문'}</button>}</div>
    <div className="tc-hq-economy"><span>금고 <b>{current.treasurySilver.toLocaleString()} S</b></span><span>귀환 수익 분담 <b>{current.revenueShareRatePercent}%</b></span></div>
    <button className="tc-hq-occupation" onClick={onOccupation}><Glyph name="towers"/><div><b>점령전 본부</b><small>{occupation?({BIDDING:'입찰 진행 중',LOCKED:'전투 준비',BATTLE:'점령전 진행 중',SETTLED:'전투 종료'}[occupation.window.phase]):'점령 현황 확인 · 입찰 · 전선 참여'}</small><small>{occupation?.towers.filter(t=>t.ownerGroupKey===occupation.identity?.groupKey&&!!t.ownerGroupKey).map(t=>TOWERS[t.tower].name).join(' · ')||'점령한 탑 없음'}</small></div><span>입장 ›</span></button>
    <button className="tc-hq-chat" onClick={()=>window.dispatchEvent(new CustomEvent('tower-open-association-chat'))}><b>원정단 채팅</b><span>단원들과 대화하기 ›</span></button>
    {leader&&current.applications.length>0&&<button className="tc-assoc-pending" onClick={()=>{setTab('applications');setPage(0);}}>가입 신청 <b>{current.applications.length}</b><span>확인 ›</span></button>}
   </section>}

   {tab==='members'&&<><div className="tc-member-list">{shown.map((item:any)=>{const member=item as typeof current.members[number];return <div className="tc-member tc-assoc-member" key={member.userId}><div><b>{member.playerLabel}{member.userId===state.userId?' · 나':''}</b><small>{member.role==='LEADER'?'단장':'단원'} · {new Date(member.joinedAt).toLocaleDateString('ko-KR')}</small></div>{leader&&member.role==='MEMBER'&&<button className="tc-hq-member-select" onClick={()=>setMemberSelected(memberSelected===member.userId?null:member.userId)}>관리</button>}{leader&&member.role==='MEMBER'&&memberSelected===member.userId&&<span className="tc-assoc-member-actions"><button disabled={busy} onClick={()=>{if(window.confirm(member.playerLabel+'에게 단장을 위임하시겠습니까?'))void act(()=>transferOnlineAssociationLeadership(lease,member.userId),'원정단장 권한을 위임했습니다.');}}>단장 위임</button><button disabled={busy} onClick={()=>{if(window.confirm(member.playerLabel+'을(를) 내보내시겠습니까?'))void act(()=>kickOnlineAssociationMember(lease,member.userId),'원정단원을 내보냈습니다.');}}>내보내기</button></span>}</div>})}{Array.from({length:Math.max(0,PAGE_SIZE-shown.length)},(_,i)=><div className="tc-member" key={'blank'+i}/>)}</div><Pager page={safe} count={pages} onChange={setPage}/></>}

   {tab==='applications'&&leader&&<><div className="tc-member-list">{shown.map((item:any)=>{const application=item as typeof current.applications[number];return <div className="tc-member tc-assoc-member tc-assoc-application" key={application.applicationId}><div><b>{application.playerLabel}</b><small>{new Date(application.createdAt).toLocaleString('ko-KR')}</small></div><span className="tc-assoc-member-actions"><button disabled={busy} onClick={()=>void act(()=>reviewOnlineAssociationApplication(lease,application.applicationId,true),'가입 신청을 승인했습니다.')}>승인</button><button disabled={busy} onClick={()=>void act(()=>reviewOnlineAssociationApplication(lease,application.applicationId,false),'가입 신청을 거절했습니다.')}>거절</button></span></div>})}{!shown.length&&<div className="tc-market-v2-empty">대기 중인 가입 신청이 없습니다.</div>}</div><Pager page={safe} count={pages} onChange={setPage}/></>}

   {tab==='activity'&&<><div className="tc-member-list">{shown.map((item:any)=>{const activity=item as typeof current.activity[number];return <div className="tc-member tc-assoc-activity" key={activity.activityId}><small>{new Date(activity.createdAt).toLocaleString('ko-KR')}</small><span>{activity.text}</span></div>})}{Array.from({length:Math.max(0,PAGE_SIZE-shown.length)},(_,i)=><div className="tc-member" key={'blank'+i}/>)}</div><Pager page={safe} count={pages} onChange={setPage}/></>}

   {tab==='manage'&&leader&&<section className="tc-panel tc-assoc-manage-panel">
    <div className="tc-form">
     <label>소개<textarea value={description} maxLength={120} onChange={e=>setDescription(e.target.value)}/></label>
     <label>공지<textarea value={notice} maxLength={180} onChange={e=>setNotice(e.target.value)}/></label>
     <label>가입 방식<select value={policy} onChange={e=>setPolicy(e.target.value as AssociationPolicy)}><option value="APPROVAL">승인 가입</option><option value="OPEN">자유 가입</option><option value="CLOSED">모집 중지</option></select></label>
     <label>원정 수익 분담<input type="number" min="0" max="30" value={share} onChange={e=>setShare(Math.max(0,Math.min(30,Math.floor(Number(e.target.value)||0))))}/><small>안전 귀환 Silver의 {share}%가 원정단 금고에 적립됩니다. 출정 시 비율이 고정됩니다.</small></label>
    </div>
    <button className="tc-action" disabled={busy} onClick={()=>void act(()=>updateOnlineAssociation(lease,{description,notice,joinPolicy:policy,revenueShareRatePercent:share}),'원정단 정보를 저장했습니다.')}>설정 저장</button>
    <div className="tc-assoc-danger-zone"><div><small>DANGER</small><b>원정단 해산</b><p>모든 단원이 소속 해제되며 되돌릴 수 없습니다.</p></div><button disabled={busy} onClick={()=>{if(window.confirm('원정단을 해산하시겠습니까? 모든 단원이 소속 해제됩니다.'))void act(()=>disbandOnlineAssociation(lease),'원정단을 해산했습니다.');}}>해산</button></div>
   </section>}

   {!leader&&tab==='members'&&<details className="tc-hq-account-menu"><summary>내 소속 관리</summary><button disabled={busy} onClick={()=>{if(window.confirm('원정단에서 탈퇴하시겠습니까?'))void act(()=>leaveOnlineAssociation(lease),'원정단에서 탈퇴했습니다.');}}>원정단 탈퇴</button></details>}
   {error&&<div className="tc-floor-risk">{error}</div>}
   {leader&&tab==='overview'&&current.applications.length>0&&<div className="tc-floor-risk">가입 신청 {current.applications.length}건이 대기 중입니다.</div>}
   {leader&&tab==='overview'&&<small className="tc-assoc-leader">현재 단장 · {memberLabel(current.leaderUserId)}</small>}
  </div>
 </Screen>;
}

function LocalAssociationScreen({game,setGame}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>}){
 const [name,setName]=useState(''),[description,setDescription]=useState(''),[policy,setPolicy]=useState<AssociationPolicy>('APPROVAL'),[tab,setTab]=useState<LocalTab>('overview'),[page,setPage]=useState(0),[creating,setCreating]=useState(false);
 const register=()=>setGame(s=>createAssociation(s,{name,description,joinPolicy:policy}));
 const current=game.association.associations.find(a=>a.associationId===game.association.currentId&&a.status==='ACTIVE');
 if(!current&&!creating)return <Screen title="원정단 찾기"><div className="tc-assoc tc-assoc-registry"><div className="tc-hq-toolbar"><label>원정단 검색<input placeholder="로그인 후 원정단명 검색" disabled/></label><button onClick={()=>setCreating(true)}>원정단 창설</button></div><section className="tc-panel tc-assoc-recruitment"><div className="tc-panel-title"><b>모집 게시판</b><small>온라인 전용</small></div><div className="tc-market-v2-empty">Google 로그인 후 닉네임을 정하면<br/>원정단을 찾고 가입할 수 있습니다.</div></section><div className="tc-hq-waiting">게스트의 원정단은 이 기기에만 저장됩니다.</div></div></Screen>;
 if(!current)return <Screen meta={<button className="tc-hq-member-select" onClick={()=>setCreating(false)}>목록으로</button>} eyebrow="NOVAR COMPANY REGISTRY / LOCAL" title="원정단 창설"><div className="tc-assoc"><div className="tc-floor-risk">등록금 {ASSOCIATION_CREATION_FEE_SILVER.toLocaleString()} S</div><section className="tc-panel strong"><div className="tc-form"><label>원정단명<input value={name} maxLength={20} onChange={e=>setName(e.target.value)} placeholder="2~20자"/></label><label>소개<textarea value={description} maxLength={120} onChange={e=>setDescription(e.target.value)} placeholder="원정단 소개"/></label><label>가입 방식<select value={policy} onChange={e=>setPolicy(e.target.value as AssociationPolicy)}><option value="APPROVAL">승인 가입</option><option value="OPEN">자유 가입</option></select></label></div></section><div/><button className="tc-action" disabled={game.silver<ASSOCIATION_CREATION_FEE_SILVER||name.trim().length<2} onClick={register}>원정단 등록</button></div></Screen>;
 const leader=current.leaderId===game.market.ownerId,visibleTabs:readonly (readonly [LocalTab,string])[]=leader?localTabs:localTabs.filter(([id])=>id!=='manage'),source=tab==='members'?current.members:tab==='activity'?current.activityLog:[],pages=Math.max(1,Math.ceil(source.length/PAGE_SIZE)),safe=Math.min(page,pages-1),shown=source.slice(safe*PAGE_SIZE,safe*PAGE_SIZE+PAGE_SIZE);
 return <Screen eyebrow="NOVAR EXPEDITION COMPANY / LOCAL" title={current.name} meta={<span>{leader?'원정단장':'원정단원'}</span>}>
  <div className="tc-assoc">
   <Segments items={visibleTabs} value={tab} onChange={v=>{setTab(v);setPage(0);}} label="원정단 메뉴"/>
   {tab==='overview'&&<section className="tc-panel strong"><div className="tc-panel-title"><b>기록번호 {current.recordNumber}</b><small>{current.members.length}명</small></div><p style={{fontSize:'9px',lineHeight:1.45,margin:'0 0 8px'}}>{current.description||'등록된 소개가 없습니다.'}</p><div className="tc-floor-risk"><b>공지</b><br/>{current.notice||'등록된 공지가 없습니다.'}</div><div className="tc-stat-grid"><div className="tc-stat"><small>가입</small><b>{current.joinPolicy==='OPEN'?'자유':current.joinPolicy==='APPROVAL'?'승인':'중지'}</b></div><div className="tc-stat"><small>역할</small><b>{leader?'단장':'단원'}</b></div></div></section>}
   {(tab==='members'||tab==='activity')&&<><div className="tc-member-list">{shown.map((x:any,i)=>tab==='members'?<div className="tc-member" key={x.playerId}><div><b>{x.playerId===game.market.ownerId?'나':'탐사자 '+x.playerId}</b><small>{x.role==='LEADER'?'단장':'단원'}</small></div><small>{new Date(x.joinedAt).toLocaleDateString('ko-KR')}</small></div>:<div className="tc-member" key={safe*PAGE_SIZE+i}><small>{new Date(x.at).toLocaleString('ko-KR')}</small><span>{x.text}</span></div>)}{Array.from({length:Math.max(0,PAGE_SIZE-shown.length)},(_,i)=><div className="tc-member" key={'blank'+i}/>)}</div><Pager page={safe} count={pages} onChange={setPage}/></>}
   {tab==='manage'&&leader&&<section className="tc-panel"><div className="tc-form"><label>소개<textarea defaultValue={current.description} maxLength={120} onBlur={e=>setGame(s=>updateAssociation(s,{description:e.target.value}))}/></label><label>공지<textarea defaultValue={current.notice} maxLength={180} onBlur={e=>setGame(s=>updateAssociation(s,{notice:e.target.value}))}/></label><label>가입 방식<select value={current.joinPolicy} onChange={e=>setGame(s=>updateAssociation(s,{joinPolicy:e.target.value as AssociationPolicy}))}><option value="APPROVAL">승인 가입</option><option value="OPEN">자유 가입</option><option value="CLOSED">모집 중지</option></select></label></div><button className="tc-action danger" onClick={()=>{if(window.confirm('원정단을 해산하시겠습니까?'))setGame(s=>disbandAssociation(s));}}>원정단 해산</button></section>}
   {tab==='overview'&&!leader&&<button className="tc-action danger" onClick={()=>{if(window.confirm('원정단에서 탈퇴하시겠습니까?'))setGame(s=>leaveAssociation(s));}}>원정단 탈퇴</button>}
  </div>
 </Screen>;
}
