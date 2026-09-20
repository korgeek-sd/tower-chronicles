import React,{useEffect,useState} from 'react';
import type {GameState} from '../game/types';
import {JOB_RARITIES,jobById,jobsByRarity,type JobDefinition,type JobRarity} from '../game/jobs/catalog';
import {setCurrentJob} from '../game/jobs/service';
import {BottomSheet} from './mobile/BottomSheet';
import {PageStepper} from './mobile/PageStepper';
import {ScreenHeader} from './mobile/ScreenHeader';
import {SegmentTabs} from './mobile/SegmentTabs';
import {pageSizeFor,pageSlice,clampPageIndex} from './mobile/mobilePagination';
import {useViewportHeight} from './mobile/useViewportHeight';
import './jobs-mobile.css';

const RARITY_TABS=JOB_RARITIES.map(rarity=>({value:rarity,label:rarity}));

function JobKit({job}:{job:JobDefinition}){
  if(!job.combatKit){
    return <div className="job-kit pending">
      <strong>전투 키트 준비 중</strong>
      <p>이 직업은 카탈로그에는 등록되어 있지만 전투 패시브와 액티브 스킬은 아직 연결되지 않았습니다.</p>
    </div>;
  }
  return <div className="job-kit">
    <div><small>패시브</small>{job.combatKit.passiveIds.map(id=><span key={id}>{id}</span>)}</div>
    <div><small>액티브</small>{job.combatKit.activeSkillIds.map(id=><span key={id}>{id}</span>)}</div>
  </div>;
}

export function JobsScreen({game,setGame}:{
  game:GameState;
  setGame:React.Dispatch<React.SetStateAction<GameState>>;
}){
  const current=jobById(game.currentJobId);
  const [rarity,setRarity]=useState<JobRarity>(current?.rarity??'C');
  const [page,setPage]=useState(0);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const height=useViewportHeight();
  const pageSize=pageSizeFor('jobs',height);
  const jobs=jobsByRarity(rarity);
  const safePage=clampPageIndex(page,jobs.length,pageSize);
  const visible=pageSlice(jobs,safePage,pageSize);
  const pageCount=Math.max(1,Math.ceil(jobs.length/pageSize));
  const selected=jobById(selectedId);

  useEffect(()=>{
    setPage(0);
    setSelectedId(null);
  },[rarity]);

  return <section className="jobs-screen" aria-label="직업">
    <ScreenHeader
      title="직업"
      meta={game.expedition?'원정 잠금 · 안전 귀환 후 변경 가능':'현재 '+(current?.displayName??'직업 없음')}
    />
    <SegmentTabs
      items={RARITY_TABS}
      value={rarity}
      onChange={value=>setRarity(value)}
      label="직업 희귀도"
    />

    <div className="jobs-current-strip">
      <span><small>현재 직업</small><b>{current?.displayName??'없음'}</b></span>
      <span><small>보유</small><b>{game.ownedJobIds.length} / 25</b></span>
    </div>

    <div className="jobs-card-list">
      {visible.map(job=>{
        const owned=game.ownedJobIds.includes(job.id);
        const active=game.currentJobId===job.id;
        return <button
          type="button"
          className={'job-card '+(active?'selected ':'')+(owned?'owned':'locked')}
          key={job.id}
          onClick={()=>setSelectedId(job.id)}
        >
          <span className={'job-rarity rarity-'+job.rarity.toLowerCase()}>{job.rarity}</span>
          <span className="job-card-copy">
            <strong>{job.displayName}</strong>
            <small>{job.combatKit?'전투 키트 준비됨':'전투 키트 미구현'}</small>
          </span>
          <span className="job-card-state">{active?'선택 중':owned?'보유':'미보유'}</span>
          <span aria-hidden="true">›</span>
        </button>;
      })}
    </div>

    <PageStepper page={safePage} pageCount={pageCount} onPage={next=>{
      setSelectedId(null);
      setPage(next);
    }}/>

    {selected&&<BottomSheet open title={selected.displayName} onClose={()=>setSelectedId(null)}>
      <div className="job-detail">
        <div className="job-detail-head">
          <span className={'job-detail-rarity rarity-'+selected.rarity.toLowerCase()}>{selected.rarity}</span>
          <div>
            <strong>{selected.displayName}</strong>
            <small>{selected.implementationStatus==='COMBAT_READY'?'전투 사용 가능':'카탈로그 등록 단계'}</small>
          </div>
        </div>
        {selected.description&&<p>{selected.description}</p>}
        <JobKit job={selected}/>
        {game.expedition&&<div className="job-lock-note">원정 잠금 · 안전 귀환 후 직업을 변경할 수 있습니다.</div>}
        <button
          type="button"
          className="primary job-select-action"
          disabled={!!game.expedition||!game.ownedJobIds.includes(selected.id)||game.currentJobId===selected.id}
          onClick={()=>{
            setGame(state=>setCurrentJob(state,selected.id));
            setSelectedId(null);
          }}
        >
          {game.currentJobId===selected.id?'선택 중':game.ownedJobIds.includes(selected.id)?'이 직업 선택':'미보유 직업'}
        </button>
      </div>
    </BottomSheet>}
  </section>;
}
