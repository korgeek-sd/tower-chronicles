import React,{useState} from 'react';
import {Glyph,Screen,Segments} from '../../ui/mobile';
import type {AppPage} from '../mobile/CoreScreens';
import './quests.css';
export const DAILY_QUESTS=[['사냥 승리 30회',30,'hunt','sword'],['제작 10회',10,'craft','craft'],['채집 30회',30,'world','materials'],['거래소 구입 3회',3,'market','market'],['원정단 기부 3회',3,'association','association']] as const;
export const WEEKLY_QUESTS=[['사냥 승리 300회',300,'hunt','sword'],['제작 50회',50,'craft','craft'],['채집 150회',150,'world','materials'],['일일 의뢰 완료 10개',10,'quests','bestiary'],['주간 의뢰 4개 모두 완료',4,'quests','bestiary']] as const;
export function QuestScreen({onMove,status={},onClaim}:{onMove:(page:AppPage)=>void;status?:Readonly<Record<string,{completed:boolean;claimed?:boolean}>>;onClaim?:(name:string)=>void}){
 const [tab,setTab]=useState<'daily'|'weekly'>('daily');
 // Assignment/progress/reward claiming are server-owned and not connected yet.
 const quests=tab==='daily'?DAILY_QUESTS.slice(0,3):WEEKLY_QUESTS;
 return <Screen title="의뢰" className="tc-quest-screen">
  <div className={'tc-quest-board '+(tab==='weekly'?'is-weekly':'')}>
   <Segments items={[['daily','일일'],['weekly','주간']] as const} value={tab} onChange={setTab} label="의뢰 기간"/>
   <div className="tc-quest-reset"><span>배정 예시 · 서버 연결 준비 중</span><span>{tab==='daily'?'매일 00시':'월요일 00시'} 초기화 · 한국시간</span></div>
   <div className="tc-quest-list" aria-label={tab==='daily'?'일일 의뢰 배정 예시':'주간 의뢰 목록'}>{quests.map(([name,target,page,glyph])=><article className="tc-quest-row" key={name}>
    <div className="tc-quest-symbol"><Glyph name={glyph}/></div>
    <div className="tc-quest-objective"><strong>{name}</strong><div className="tc-quest-track" aria-hidden="true"/><small>진행도 확인 대기 / {target}</small></div>
    <div className="tc-quest-mystery"><Glyph name="inventory"/><b>?</b><small>랜덤 보상</small></div>
    <div className="tc-quest-buttons"><button type="button" className={status[name]?.completed?'is-ready':undefined} disabled={!!status[name]?.claimed||(!!status[name]?.completed&&!onClaim)} onClick={()=>{if(status[name]?.completed)onClaim?.(name);else onMove(page);}}>{status[name]?.claimed?'수령 완료':status[name]?.completed?'보상받기':'바로가기'}</button></div>
   </article>)}</div>
   <p className="tc-quest-note">{tab==='daily'?'매일 5종 중 서로 다른 의뢰 3개 배정':'주간 의뢰 5개 · 일일과 별도로 보상 추첨'}</p>
  </div>
 </Screen>;
}
