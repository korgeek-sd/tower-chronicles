import React,{useRef,useState} from 'react';
import type {GameState} from '../../game/types';
import type {ExpeditionEventDefinition} from '../../game/events/types';
import {definitionFor} from '../../game/events/service';
import {meetsConditions} from '../../game/events/selector';
import {stats} from '../../game/engine/state';
import {TOWERS,tierOf,potionIds} from '../../game/data/config';

type Props={game:GameState;onChoice:(instance:string,choice:string)=>void;onContinue:(instance:string)=>void;onHome:()=>void;onRevival?:(use:boolean)=>void;definition?:ExpeditionEventDefinition};
export function EventScreen({game,onChoice,onContinue,onHome,onRevival,definition}:Props){
 const e=game.expedition!,p=e.events.pendingEvent!,d=definition??definitionFor(e),max=stats(game,e.equipment).hp,lock=useRef(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 function act(action:()=>void){if(lock.current)return;lock.current=true;setBusy(true);try{action();}catch{setError('선택 결과를 저장하지 못했습니다.');lock.current=false;setBusy(false);}}
 return <section className="tc-event" aria-label="원정 이벤트">
  <div className="tc-event-hud"><div><b>{TOWERS[e.tower].name} · {e.floor}F / T{tierOf(e.floor)}</b><small>HP {Math.ceil(e.hp)} / {max} · Silver {e.loot.silver.toLocaleString()} · 포션 {potionIds.reduce((n,id)=>n+e.bag[id],0)}</small></div><button onClick={onHome}>메뉴</button></div>
  <div className="tc-event-symbol" aria-hidden="true">◇</div>
  <div className="tc-event-body">
   <small className="tc-kicker">{e.events.mode==='test'?'TEST EVENT':'FIELD EVENT'}</small>
   <h1>{d?.title??'잊힌 탐사 기록'}</h1>
   {p.state==='CHOICE'?<><p>{d?.description??'이 이벤트의 기록을 찾을 수 없습니다.'}</p><div className="tc-event-choices">{d?.choices.map(c=>{const allowed=meetsConditions(game,c.conditions);return <button key={c.id} className="tc-event-choice" disabled={busy||!allowed} onClick={()=>act(()=>onChoice(p.instanceId,c.id))}><span aria-hidden="true">{c.icon??'◇'}</span><span><strong>{c.label}</strong>{c.description&&<small>{c.description}</small>}</span><span>›</span></button>})??<button className="tc-event-choice" disabled={busy} onClick={()=>act(()=>onChoice(p.instanceId,'missing_skip'))}><span>◇</span><strong>지나간다</strong><span>›</span></button>}</div></>:<><p>{p.resultText}</p>{p.resultLines.slice(0,3).map((line,i)=><p key={i}>{line}</p>)}<button className="tc-action" disabled={busy} onClick={()=>act(()=>onContinue(p.instanceId))}>{p.next==='BOSS'?'보스에게 향한다':'탐사 계속'}</button></>}
   {error&&<p className="error" role="alert">{error}</p>}
  </div>
  <p className="tc-event-foot">이곳에서 얻은 것은 살아서 돌아와야 확정됩니다.</p>
  {e.pendingRevival&&onRevival&&<div className="tc-modalback"><section className="tc-modal"><h2>치명상을 입었습니다</h2><p>회생 포션을 사용해 이벤트 결과로 돌아갈 수 있습니다.</p><div className="tc-modal-actions"><button className="tc-action secondary" onClick={()=>onRevival(false)}>사용하지 않기</button><button className="tc-action" onClick={()=>onRevival(true)}>회생 포션 사용</button></div></section></div>}
 </section>;
}
