import React from 'react';
import {HUNT_MAPS,type HuntResult} from '../../game/hunting/model';
import {appendHuntHistory,huntHistoryKey,huntLogEntries} from './huntingLog';

export function HuntingCombatLog({result,nickname='탐사자',active,onRecords,onSkills}:{result:HuntResult;nickname?:string;active:boolean;onRecords:()=>void;onSkills?:()=>void}){
 const [history,setHistory]=React.useState<readonly HuntResult[]>(()=>[result]);
 const [newRecords,setNewRecords]=React.useState(false);
 const feed=React.useRef<HTMLDivElement>(null),follow=React.useRef(true);
 React.useEffect(()=>{setHistory(previous=>appendHuntHistory(previous,result));},[result]);
 React.useLayoutEffect(()=>{
  if(!active)return;
  if(follow.current&&feed.current)feed.current.scrollTop=feed.current.scrollHeight;
  else setNewRecords(true);
 },[history,active]);
 function latest(){follow.current=true;setNewRecords(false);if(feed.current)feed.current.scrollTop=feed.current.scrollHeight;}
 return <div className="tc-hunt-stream tc-hunt-panel">
  <header><div><strong>사냥 기록</strong><small>최근 10회 · 이 화면의 기록</small></div><div className="tc-hunt-stream-tools">{onSkills&&<button type="button" className="tc-hunt-skill-open" onClick={onSkills}>스킬 보기</button>}<button type="button" className="tc-hunt-log-button tc-hunt-records-button" onClick={onRecords}>전투 기록 보기 <span>총 {result.turns.length}턴 ›</span></button></div></header>
  <div ref={feed} className="tc-hunt-stream-feed" role="log" aria-label="연속 사냥 기록" aria-live="off" tabIndex={0} onScroll={event=>{const el=event.currentTarget;follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<=24;if(follow.current)setNewRecords(false);}}>
   {history.map((record,index)=><article key={huntHistoryKey(record)} className="tc-hunt-stream-battle" data-request-id={huntHistoryKey(record)}>
    <h3><span>{HUNT_MAPS.find(m=>m.id===record.mapId)?.name} · {record.monster?.name??'몬스터'}</span><small>{index+1}번째 기록</small></h3>
    <p className="tc-hunt-stream-encounter">새 몬스터 발견 · {record.monster?.name??'몬스터'}</p>
    {huntLogEntries(record,nickname).map((entry,i)=><p key={i} data-kind={entry.kind}>{entry.turn!==undefined&&<small className="tc-hunt-stream-turn">{entry.turn}턴</small>}<span>{entry.text}</span></p>)}
   </article>)}
  </div>
  <button type="button" className="tc-hunt-stream-latest" data-unread={newRecords} onClick={latest}>{newRecords?'새 기록 · 최신 기록':'최신 기록'} ↓</button>
  <span className="tc-hunt-stream-announcement" role="status" aria-live="polite">{result.outcome==='victory'?`사냥 성공 · 경험치 ${result.exp} · 실버 ${result.silver}`:'사냥 실패'}</span>
 </div>;
}
