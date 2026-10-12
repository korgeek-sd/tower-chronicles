import React,{useState} from 'react';
import {Glyph,Screen,Segments} from '../../ui/mobile';
import type {AppPage} from '../mobile/CoreScreens';
import type {QuestBoard,QuestEntry,QuestPeriod} from '../../online/quests';
import {questRewardSummary} from '../../online/quests';
import './quests.css';
export const DAILY_QUESTS=[['사냥 승리 30회',30,'hunt','sword'],['제작 10회',10,'craft','craft'],['채집 30회',30,'world','materials'],['거래소 구입 3회',3,'market','market'],['원정단 기부 3회',3,'association','association']] as const;
export const WEEKLY_QUESTS=[['사냥 승리 300회',300,'hunt','sword'],['제작 50회',50,'craft','craft'],['채집 150회',150,'world','materials'],['일일 의뢰 완료 10개',10,'quests','bestiary'],['주간 의뢰 4개 모두 완료',4,'quests','bestiary']] as const;
const ids={daily:['hunt','craft','gather','market','donate'],weekly:['hunt','craft','gather','daily','all']} as const;
export function QuestScreen({onMove,board=null,onClaim,busy=false,message='',error='',onRetry,initialTab='daily'}:{onMove:(page:AppPage)=>void;board?:QuestBoard|null;onClaim?:(period:QuestPeriod,q:QuestEntry)=>void;busy?:boolean;message?:string;error?:string;onRetry?:()=>void;initialTab?:QuestPeriod}){
 const [tab,setTab]=useState<QuestPeriod>(initialTab);
 const quests=board?.[tab]??[];
 return <Screen title="일일·주간 과제" className="tc-quest-screen"><div className={'tc-quest-board '+(tab==='weekly'?'is-weekly':'')}>
  <Segments items={[['daily','일일 과제'],['weekly','주간 과제']] as const} value={tab} onChange={setTab} label="의뢰 기간"/>
  <div className="tc-quest-reset"><span>{board?'서로 다른 보상 지급':'의뢰 불러오는 중'}</span><span>{tab==='daily'?'매일 00시':'월요일 00시'} 초기화 · 한국시간</span></div>
  {(message||error)&&<div className="tc-quest-status" role={error?'alert':'status'}>{error||message}{error&&onRetry&&<button type="button" disabled={busy} onClick={onRetry}>다시 확인</button>}</div>}
  <div className="tc-quest-list" aria-label={tab==='daily'?'일일 의뢰 목록':'주간 의뢰 목록'}>{quests.map(q=>{
   const index=(ids[tab] as readonly string[]).indexOf(q.id),definition=(tab==='daily'?DAILY_QUESTS:WEEKLY_QUESTS)[index];if(!definition)return null;
   const [name,,page,glyph]=definition;
   return <article className={'tc-quest-row '+(q.claimed?'is-claimed':q.completed?'is-completed':'')} key={q.id}>
    <div className="tc-quest-symbol"><Glyph name={glyph}/></div>
    <div className="tc-quest-objective"><strong>{name}</strong><div className="tc-quest-track" role="progressbar" aria-label={name} aria-valuemin={0} aria-valuemax={q.target} aria-valuenow={q.progress}><i style={{width:`${Math.min(100,q.progress/q.target*100)}%`}}/></div><small>{q.progress} / {q.target}{q.claimed&&q.reward?' · '+questRewardSummary(q.reward):''}</small></div>
    <div className="tc-quest-mystery"><span className="tc-quest-reward-slot" aria-hidden="true">{q.claimed?<Glyph name="inventory"/>:<b>?</b>}</span><small>{q.claimed?'수령 완료':'랜덤 보상'}</small></div>
    <div className="tc-quest-buttons"><span className="tc-quest-state">{q.claimed?'수령 완료':q.completed?'완료':'진행 중'}</span><button type="button" className={q.completed?'is-ready':undefined} disabled={q.claimed||busy||(q.completed&&!onClaim)} onClick={()=>{if(q.completed)onClaim?.(tab,q);else if(page==='quests')setTab(q.id==='daily'?'daily':'weekly');else onMove(page);}}>{q.claimed?'수령 완료':q.completed?'보상받기':'바로가기'}</button></div>
   </article>;
  })}</div>
  <p className="tc-quest-note">{tab==='daily'?'매일 5종 중 서로 다른 의뢰 3개 배정':'주간 의뢰 5개 · 일일과 별도로 보상 추첨'}</p>
 </div></Screen>;
}
