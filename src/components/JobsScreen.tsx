import React,{useMemo,useState} from 'react';
import type {GameState} from '../game/types';
import {JOB_CATALOG,JOB_RARITIES,jobById} from '../game/jobs/catalog';
import {setCurrentJob} from '../game/jobs/service';
import {Pager,Screen,Segments} from '../ui/mobile';

const PAGE_SIZE=5;
export function JobsScreen({game,setGame}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>}){
 const [rarity,setRarity]=useState<(typeof JOB_RARITIES)[number]>(JOB_RARITIES[0]),[page,setPage]=useState(0);
 const current=jobById(game.currentJobId),list=useMemo(()=>JOB_CATALOG.filter(j=>j.rarity===rarity),[rarity]),pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE)),safe=Math.min(page,pages-1),shown=list.slice(safe*PAGE_SIZE,safe*PAGE_SIZE+PAGE_SIZE);
 const tabs=JOB_RARITIES.map(r=>[r,r] as [(typeof JOB_RARITIES)[number],string]);
 return <Screen eyebrow="ASSOCIATION JOB CATALOG" title="직업" meta={<span>{current?.displayName??'미선택'}</span>}>
  <div className="tc-jobs">
   <div className="tc-floor-risk">{game.expedition?'원정 중에는 직업을 변경할 수 없습니다.':'직업은 패시브 2개와 액티브 3개의 고정 전투 키트입니다.'}</div>
   <Segments items={tabs} value={rarity} onChange={v=>{setRarity(v);setPage(0);}} label="직업 등급"/>
   <div className="tc-job-list">{shown.map(job=>{const owned=game.ownedJobIds.includes(job.id),selected=game.currentJobId===job.id;return <article className="tc-job" key={job.id}><div><b>{job.displayName}</b><small>{job.combatKit?'전투 키트 준비됨':'전투 키트 미구현'} · {owned?'등록 직능':'미등록 직능'}</small></div><button disabled={!!game.expedition||!owned||selected} onClick={()=>setGame(s=>setCurrentJob(s,job.id))}>{selected?'선택 중':owned?'선택':'미보유'}</button></article>})}{Array.from({length:Math.max(0,PAGE_SIZE-shown.length)},(_,i)=><div className="tc-job" aria-hidden="true" key={'j'+i}/>)}</div>
   <Pager page={safe} count={pages} onChange={setPage}/>
  </div>
 </Screen>;
}
