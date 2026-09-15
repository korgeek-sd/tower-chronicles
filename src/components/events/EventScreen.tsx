import React,{useRef,useState} from 'react';
import type {GameState} from '../../game/types';
import type {ExpeditionEventDefinition} from '../../game/events/types';
import {definitionFor} from '../../game/events/service';
import {meetsConditions} from '../../game/events/selector';
import {eventAsset} from '../../game/events/catalog';
import {stats} from '../../game/engine/state';
import {TOWERS,tierOf,potionIds} from '../../game/data/config';
import './events.css';
type Props={game:GameState;onChoice:(instance:string,choice:string)=>void;onContinue:(instance:string)=>void;onHome:()=>void;definition?:ExpeditionEventDefinition};
function EventArt({assetKey}:{assetKey?:string}){const url=eventAsset(assetKey),[failed,setFailed]=useState(false);return <div className="event-art">{url&&!failed?<img src={url} alt="발견한 장소" onError={()=>setFailed(true)}/>:<div className="event-art-placeholder"><span aria-hidden="true">◇</span><small>탐사 기록</small></div>}</div>;}
export function EventScreen({game,onChoice,onContinue,onHome,definition}:Props){const e=game.expedition!,p=e.events.pendingEvent!,d=definition??definitionFor(e),max=stats(game,e.equipment).hp;const lock=useRef(false),[busy,setBusy]=useState(false),[error,setError]=useState('');function act(action:()=>void){if(lock.current)return;lock.current=true;setBusy(true);try{action();}catch{setError('선택 결과를 저장하지 못했습니다. 저장 공간을 확인하고 다시 시도하세요.');lock.current=false;setBusy(false);}}
 return <section className="event-screen" aria-label="원정 이벤트">
 <div className="event-hud"><span>{TOWERS[e.tower].name} · {e.floor}층 / T{tierOf(e.floor)}</span><button onClick={onHome} aria-label="원정 메뉴">메뉴</button><div><span>HP <b>{Math.ceil(e.hp)} / {max}</b></span><span>Silver <b>{e.loot.silver.toLocaleString()}</b></span><span>포션 <b>{potionIds.reduce((n,id)=>n+e.bag[id],0)}</b></span></div><progress aria-label="플레이어 HP" value={e.hp} max={max}/></div>
 {e.events.mode==='test'&&<p className="event-test-label">테스트 모드 · 샘플 이벤트</p>}
 <header className="event-title"><span aria-hidden="true">◆</span><h1>{d?.title??'잊힌 탐사 기록'}</h1><span aria-hidden="true">◆</span></header>
 <EventArt key={d?.imageAssetKey??'empty'} assetKey={d?.imageAssetKey}/>
 {p.state==='CHOICE'?<><p className="event-description">{d?.description??'이 이벤트의 기록을 찾을 수 없습니다. 보상 없이 다음 탐사를 진행할 수 있습니다.'}</p><div className="event-divider" aria-hidden="true">──── ◇ ────</div><div className="event-choices">{d?.choices.map(c=>{const allowed=meetsConditions(game,c.conditions);return <div key={c.id}><button className={'event-choice '+(c.styleVariant??'SECONDARY').toLowerCase()} disabled={busy||!allowed} onClick={()=>act(()=>onChoice(p.instanceId,c.id))}><span aria-hidden="true">{c.icon??(c.styleVariant==='SKIP'?'⇥':'◇')}</span><strong>{c.label}</strong><span aria-hidden="true">›</span></button>{c.description&&<small>{c.description}</small>}{!allowed&&<small>선택 조건을 충족하지 못했습니다.</small>}</div>;})??<button className="event-choice" disabled={busy} onClick={()=>act(()=>onChoice(p.instanceId,'missing_skip'))}>지나간다</button>}</div>
 {!!d?.rewardPreview?.length&&<section className="event-rewards" aria-label="기대할 수 있는 발견물"><h2>기대할 수 있는 발견물</h2><div>{d.rewardPreview.map((reward,i)=><article key={i}>{eventAsset(reward.iconAssetKey)?<img src={eventAsset(reward.iconAssetKey)} alt="" onError={ev=>ev.currentTarget.hidden=true}/>:<span aria-hidden="true">◇</span>}<strong>{reward.label}</strong>{reward.note&&<small>{reward.note}</small>}</article>)}</div><p>발견물의 종류와 수량은 선택 결과에 따라 달라집니다.</p></section>}</>:<section className="event-result" role="status"><h2>탐사 결과</h2><p>{p.resultText}</p>{!!p.resultLines.length&&<ul>{p.resultLines.map((line,i)=><li key={i}>{line}</li>)}</ul>}<button className="event-choice primary" disabled={busy} onClick={()=>act(()=>onContinue(p.instanceId))}>{p.next==='BOSS'?'보스에게 향한다':'계속'} <span aria-hidden="true">›</span></button></section>}
 {error&&<p role="alert" className="error">{error}</p>}
 <p className="event-footnote">이곳에서 얻은 것은 살아서 돌아와야 확정됩니다.</p>
 </section>;
}
