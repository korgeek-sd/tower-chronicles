import React from 'react';
import {HUNT_MAPS,type HuntResult} from '../../game/hunting/model';
import {appendHuntHistory,huntHistoryKey,huntLogEntries} from './huntingLog';

/** Summarize confirmed combat lines only. Full, authoritative history stays in the details dialog. */
export function HuntingCombatLog({result,nickname='탐사자',active}:{result:HuntResult;nickname?:string;active:boolean}){
 const [history,setHistory]=React.useState<readonly HuntResult[]>(()=>[result]);
 const [detailOpen,setDetailOpen]=React.useState(false);
 const [newRecords,setNewRecords]=React.useState(false);
 const feed=React.useRef<HTMLDivElement>(null);
 const dialog=React.useRef<HTMLDialogElement>(null);
 const openButton=React.useRef<HTMLButtonElement>(null);
 const follow=React.useRef(true);
 React.useEffect(()=>{setHistory(previous=>appendHuntHistory(previous,result));},[result]);
 React.useLayoutEffect(()=>{
  if(!active||!detailOpen)return;
  if(follow.current&&feed.current)feed.current.scrollTop=feed.current.scrollHeight;
  else setNewRecords(true);
 },[history,active,detailOpen]);
 const entries=huntLogEntries(result,nickname);
 const selectedTurns=new Set<number>();
 const preview=entries.slice().reverse().filter(entry=>{
  if(entry.turn===undefined||selectedTurns.has(entry.turn))return false;
  selectedTurns.add(entry.turn);
  return true;
 }).slice(0,3).reverse();
 function openDetails(){
  if(!dialog.current)return;
  dialog.current.showModal();
  setDetailOpen(true);
  follow.current=true;
  setNewRecords(false);
 }
 function latest(){follow.current=true;setNewRecords(false);if(feed.current)feed.current.scrollTop=feed.current.scrollHeight;}
 return <div className="tc-hunt-stream tc-hunt-panel">
  <header className="tc-hunt-stream-summary-head"><div><strong>전투 기록 (요약)</strong><small>마지막 전투 · 최대 3턴</small></div><button type="button" ref={openButton} className="tc-hunt-stream-open" onClick={openDetails}>전체 기록 보기 <span aria-hidden="true">›</span></button></header>
  <ol className="tc-hunt-stream-preview" role="log" aria-label="최근 전투 요약" aria-live="off">
   {preview.map((entry,index)=><li key={entry.turn+'-'+index} data-kind={entry.kind}><b>{entry.turn}턴</b><span>{entry.text}</span></li>)}
   {preview.length===0&&<li className="tc-hunt-stream-preview-empty">턴별 기록이 없습니다.</li>}
  </ol>
  <dialog ref={dialog} className="tc-hunt-stream-dialog" aria-label="전체 사냥 전투 기록" onClose={()=>{setDetailOpen(false);openButton.current?.focus();}}>
   <header><div><strong>전체 사냥 기록</strong><small>최근 10회 · 이 화면의 기록</small></div><button type="button" className="tc-hunt-stream-close" onClick={()=>dialog.current?.close()}>닫기</button></header>
   <div ref={feed} className="tc-hunt-stream-feed" role="log" aria-label="연속 사냥 기록" aria-live="off" tabIndex={0} onScroll={event=>{const el=event.currentTarget;follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<=24;if(follow.current)setNewRecords(false);}}>
    {history.map((record,index)=><article key={huntHistoryKey(record)} className="tc-hunt-stream-battle" data-request-id={huntHistoryKey(record)}>
     <h3><span>{HUNT_MAPS.find(m=>m.id===record.mapId)?.name} · {record.monster?.name??'몬스터'}</span><small>{index+1}번째 기록</small></h3>
     <p className="tc-hunt-stream-encounter">새 몬스터 발견 · {record.monster?.name??'몬스터'}</p>
     {huntLogEntries(record,nickname).map((entry,i)=><p key={i} data-kind={entry.kind}>{entry.turn!==undefined&&<small className="tc-hunt-stream-turn">{entry.turn}턴</small>}<span>{entry.text}</span></p>)}
    </article>)}
   </div>
   <button type="button" className="tc-hunt-stream-latest" data-unread={newRecords} onClick={latest}>{newRecords?'새 기록 · 최신 기록':'최신 기록'} ↓</button>
  </dialog>
  <span className="tc-hunt-stream-announcement" role="status" aria-live="polite">{result.outcome==='victory'?`사냥 성공 · 경험치 ${result.exp} · 실버 ${result.silver}`:'사냥 실패'}</span>
 </div>;
}
