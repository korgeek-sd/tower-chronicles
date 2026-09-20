import React,{useEffect,useMemo,useState} from 'react';
import type {AssociationPolicy,GameState} from '../../game/types';
import {
  ASSOCIATION_CREATION_FEE_SILVER,
  createAssociation,
  disbandAssociation,
  joinAssociation,
  leaveAssociation,
  reviewApplication,
  setRevenueShareRate,
  updateAssociation,
} from '../../game/association/service';
import {pageSizeFor,pageSlice,clampPageIndex} from '../mobile/mobilePagination';
import {useViewportHeight} from '../mobile/useViewportHeight';
import {PageStepper} from '../mobile/PageStepper';
import {ScreenHeader} from '../mobile/ScreenHeader';
import {SegmentTabs} from '../mobile/SegmentTabs';
import './association.css';

type RegistryTab='find'|'create';
type AssociationTab='summary'|'members'|'activity'|'manage';

const REGISTRY_TABS=[
  {value:'find',label:'조합 찾기'},
  {value:'create',label:'조합 창설'},
] as const;

const MEMBER_TABS=[
  {value:'summary',label:'요약'},
  {value:'members',label:'조합원'},
  {value:'activity',label:'활동'},
  {value:'manage',label:'관리'},
] as const;

const policyLabel=(policy:AssociationPolicy)=>policy==='OPEN'?'자유 가입':policy==='APPROVAL'?'승인 가입':'모집 중지';

export function AssociationScreen({game,setGame}:{
  game:GameState;
  setGame:React.Dispatch<React.SetStateAction<GameState>>;
}){
  const current=game.association.associations.find(a=>a.associationId===game.association.currentId&&a.status==='ACTIVE');
  const [registryTab,setRegistryTab]=useState<RegistryTab>('find');
  const [memberTab,setMemberTab]=useState<AssociationTab>('summary');
  const [page,setPage]=useState(0);
  const [name,setName]=useState('');
  const [description,setDescription]=useState(current?.description??'');
  const [notice,setNotice]=useState(current?.notice??'');
  const [policy,setPolicy]=useState<AssociationPolicy>(current?.joinPolicy??'APPROVAL');
  const [shareRate,setShareRate]=useState(current?.revenueShareRatePercent??0);
  const height=useViewportHeight();
  const pageSize=pageSizeFor('association',height);

  useEffect(()=>{
    setPage(0);
  },[registryTab,memberTab,current?.associationId]);

  useEffect(()=>{
    if(!current)return;
    setDescription(current.description);
    setNotice(current.notice);
    setPolicy(current.joinPolicy);
    setShareRate(current.revenueShareRatePercent);
  },[current?.associationId,current?.description,current?.notice,current?.joinPolicy,current?.revenueShareRatePercent]);

  if(!current){
    const active=game.association.associations.filter(a=>a.status==='ACTIVE');
    const safePage=clampPageIndex(page,active.length,pageSize);
    const visible=pageSlice(active,safePage,pageSize);
    const pageCount=Math.max(1,Math.ceil(active.length/pageSize));
    const qualified=game.market.traderCertified;

    return <section className="association-screen" aria-label="조합">
      <ScreenHeader title="탑기록원 · 조합" meta="노바르 등록 조합"/>
      <SegmentTabs
        items={REGISTRY_TABS}
        value={registryTab}
        onChange={value=>{setRegistryTab(value);setPage(0);}}
        label="조합 등록부"
      />

      {registryTab==='find'?<>
        <div className="association-registry-list">
          {visible.length?visible.map(association=><article className="association-registry-card" key={association.associationId}>
            <div>
              <small>{association.recordNumber}</small>
              <strong>{association.name}</strong>
              <p>{association.description||'등록된 소개가 없습니다.'}</p>
            </div>
            <div className="association-registry-meta">
              <span>{association.members.length}명</span>
              <span>{policyLabel(association.joinPolicy)}</span>
            </div>
            <button
              type="button"
              disabled={association.joinPolicy==='CLOSED'}
              onClick={()=>setGame(state=>joinAssociation(state,association.associationId))}
            >
              {association.joinPolicy==='OPEN'?'가입':association.joinPolicy==='APPROVAL'?'신청':'모집 중지'}
            </button>
          </article>):<div className="association-empty">
            <strong>등록된 조합이 없습니다.</strong>
            <span>조건을 갖추었다면 직접 조합을 창설할 수 있습니다.</span>
          </div>}
        </div>
        <PageStepper page={safePage} pageCount={pageCount} onPage={setPage}/>
      </>:<div className="association-create-mobile">
        <div className={'association-qualification '+(qualified?'ready':'locked')}>
          <strong>{qualified?'창설 자격 확인':'창설 자격 미충족'}</strong>
          <small>{qualified
            ?'탑기록원 등록 절차를 진행할 수 있습니다.'
            :'10층 보스 처치 후 안전 귀환이 필요합니다.'}</small>
        </div>
        <label>조합명
          <input value={name} maxLength={20} onChange={event=>setName(event.target.value)} placeholder="2~20자"/>
        </label>
        <label>소개
          <textarea value={description} maxLength={120} onChange={event=>setDescription(event.target.value)} placeholder="조합 소개"/>
        </label>
        <label>가입 방식
          <select value={policy} onChange={event=>setPolicy(event.target.value as AssociationPolicy)}>
            <option value="APPROVAL">승인 가입</option>
            <option value="OPEN">자유 가입</option>
          </select>
        </label>
        <div className="association-create-cost">
          <span>등록금</span>
          <b>{ASSOCIATION_CREATION_FEE_SILVER.toLocaleString()} Silver</b>
          <small>보유 {game.silver.toLocaleString()} Silver</small>
        </div>
        <button
          type="button"
          className="primary association-create-submit"
          disabled={!qualified||game.silver<ASSOCIATION_CREATION_FEE_SILVER||name.trim().length<2}
          onClick={()=>setGame(state=>createAssociation(state,{name,description,joinPolicy:policy}))}
        >조합 등록</button>
      </div>}
    </section>;
  }

  const leader=current.leaderId===game.market.ownerId;
  const memberPage=clampPageIndex(page,current.members.length,pageSize);
  const activityPage=clampPageIndex(page,current.activityLog.length,pageSize);
  const members=pageSlice(current.members,memberPage,pageSize);
  const activities=pageSlice(current.activityLog,activityPage,pageSize);
  const pending=useMemo(()=>current.applications.filter(application=>application.status==='PENDING'),[current.applications]);

  return <section className="association-screen" aria-label="조합">
    <ScreenHeader
      title={current.name}
      meta={current.recordNumber+' · '+(leader?'조합장':'조합원')}
    />
    <SegmentTabs
      items={MEMBER_TABS}
      value={memberTab}
      onChange={value=>{setMemberTab(value);setPage(0);}}
      label="조합 메뉴"
    />

    <div className="association-content">
      {memberTab==='summary'&&<div className="association-summary">
        <section className="association-banner">
          <small>NOVAR REGISTERED ASSOCIATION</small>
          <strong>{current.name}</strong>
          <p>{current.description||'등록된 조합 소개가 없습니다.'}</p>
        </section>
        <section className="association-notice-mobile">
          <small>공지</small>
          <p>{current.notice||'등록된 공지가 없습니다.'}</p>
        </section>
        <div className="association-stat-grid">
          <span><small>조합원</small><b>{current.members.length} / 30</b></span>
          <span><small>가입</small><b>{policyLabel(current.joinPolicy)}</b></span>
          <span><small>분담률</small><b>{current.revenueShareRatePercent}%</b></span>
          <span><small>금고</small><b>{current.treasurySilver.toLocaleString()}</b></span>
        </div>
      </div>}

      {memberTab==='members'&&<>
        <div className="association-page-list">
          {members.map(member=><div className="association-member-row" key={member.playerId}>
            <div className="association-avatar" aria-hidden="true">{member.role==='LEADER'?'♜':'♙'}</div>
            <div>
              <strong>{member.playerId===game.market.ownerId?'나':'탐사자 '+member.playerId}</strong>
              <small>{member.role==='LEADER'?'조합장':'조합원'} · {new Date(member.joinedAt).toLocaleDateString('ko-KR')}</small>
            </div>
          </div>)}
        </div>
        <PageStepper
          page={memberPage}
          pageCount={Math.max(1,Math.ceil(current.members.length/pageSize))}
          onPage={setPage}
        />
      </>}

      {memberTab==='activity'&&<>
        <div className="association-page-list">
          {activities.length?activities.map((entry,index)=><div className="association-activity-row" key={entry.at+'-'+index}>
            <small>{new Date(entry.at).toLocaleString('ko-KR')}</small>
            <p>{entry.text}</p>
          </div>):<div className="association-empty"><strong>활동 기록이 없습니다.</strong></div>}
        </div>
        <PageStepper
          page={activityPage}
          pageCount={Math.max(1,Math.ceil(current.activityLog.length/pageSize))}
          onPage={setPage}
        />
      </>}

      {memberTab==='manage'&&(leader?<div className="association-manage">
        <label>소개
          <textarea value={description} maxLength={120} onChange={event=>setDescription(event.target.value)}/>
        </label>
        <label>공지
          <textarea value={notice} maxLength={180} onChange={event=>setNotice(event.target.value)}/>
        </label>
        <div className="association-manage-row">
          <label>가입 방식
            <select value={policy} onChange={event=>setPolicy(event.target.value as AssociationPolicy)}>
              <option value="APPROVAL">승인 가입</option>
              <option value="OPEN">자유 가입</option>
              <option value="CLOSED">모집 중지</option>
            </select>
          </label>
          <label>수익 분담률
            <select value={shareRate} onChange={event=>setShareRate(Number(event.target.value))}>
              {[0,5,10,15,20,25,30].map(rate=><option key={rate} value={rate}>{rate}%</option>)}
            </select>
          </label>
        </div>
        <button type="button" className="primary" onClick={()=>setGame(state=>{
          let next=updateAssociation(state,{description,notice,joinPolicy:policy});
          next=setRevenueShareRate(next,shareRate);
          return next;
        })}>변경 저장</button>
        {!!pending.length&&<div className="association-applications">
          <strong>가입 신청 {pending.length}건</strong>
          {pending.slice(0,3).map(application=><div key={application.applicationId}>
            <span>{application.applicantId}</span>
            <button onClick={()=>setGame(state=>reviewApplication(state,application.applicationId,true))}>승인</button>
            <button onClick={()=>setGame(state=>reviewApplication(state,application.applicationId,false))}>거절</button>
          </div>)}
        </div>}
        <button
          type="button"
          className="danger"
          onClick={()=>{if(window.confirm('조합을 해산하시겠습니까?'))setGame(state=>disbandAssociation(state));}}
        >조합 해산</button>
      </div>:<div className="association-manage member">
        <p>조합 관리 권한은 조합장에게 있습니다.</p>
        <button
          type="button"
          className="danger"
          onClick={()=>{if(window.confirm('조합에서 탈퇴하시겠습니까?'))setGame(state=>leaveAssociation(state));}}
        >조합 탈퇴</button>
      </div>)}
    </div>
  </section>;
}
