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
 const quests = board?.[tab] ?? [];
 return <Screen title="의뢰 게시판" className="tc-quest-screen">
  <div className="tc-quest-board">
   <div className="tc-quest-toolbar">
    <Segments items={[['daily','일일'],['weekly','주간']] as const} value={tab} onChange={setTab} label="의뢰 기간"/>
    <small>{tab === 'daily' ? '매일' : '월요일'} 00시 초기화</small>
   </div>
   {(error || message || !board) && <div className="tc-quest-status" role={error ? 'alert' : 'status'}>
    {error || message || '의뢰 불러오는 중'}
    {error && onRetry && <button type="button" disabled={busy} onClick={onRetry}>다시 확인</button>}
   </div>}
   <div className={'tc-quest-wall ' + (tab === 'weekly' ? 'is-weekly' : '')} aria-label={tab === 'daily' ? '일일 의뢰 목록' : '주간 의뢰 목록'}>
    {quests.map(q => {
     const index = (ids[tab] as readonly string[]).indexOf(q.id);
     const definition = (tab === 'daily' ? DAILY_QUESTS : WEEKLY_QUESTS)[index];
     if (!definition) return null;
     const [name,,page,glyph] = definition;
     const action = q.claimed ? '수령 완료' : q.completed ? '보상받기' : '바로가기';
     function activate() {
      if (q.completed) onClaim?.(tab,q);
      else if (page === 'quests') setTab(q.id === 'daily' ? 'daily' : 'weekly');
      else onMove(page);
     }
     return <article key={q.id} className={'tc-quest-paper ' + (q.claimed ? 'is-claimed' : q.completed ? 'is-ready' : '')}>
      <span className="tc-quest-emblem"><Glyph name={glyph}/></span>
      <strong>{name}</strong>
      <div className="tc-quest-progress"><span>{q.progress} / {q.target}</span>
       <div className="tc-quest-track" role="progressbar" aria-label={name} aria-valuemin={0} aria-valuemax={q.target} aria-valuenow={q.progress}>
        <i style={{width: Math.min(100,q.progress/q.target*100)+'%'}}/>
       </div>
      </div>
      <div className="tc-quest-foot">
       <small>{q.claimed && q.reward ? questRewardSummary(q.reward) : q.claimed ? '수령 완료' : '랜덤 보상'}</small>
       <button type="button" className="tc-quest-seal" aria-label={name+' '+action} disabled={q.claimed||busy||(q.completed&&!onClaim)} onClick={activate}>{action}</button>
      </div>
     </article>;
    })}
   </div>
  </div>
 </Screen>;
}
