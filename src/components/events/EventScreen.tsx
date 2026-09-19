import React,{useRef,useState} from 'react';
import type {GameState,Tower} from '../../game/types';
import type {EventType,ExpeditionEventDefinition} from '../../game/events/types';
import {definitionFor} from '../../game/events/service';
import {meetsConditions} from '../../game/events/selector';
import {eventAsset} from '../../game/events/catalog';
import {stats} from '../../game/engine/state';
import {TOWERS,tierOf,potionIds} from '../../game/data/config';
import {assetUrl,backgroundFor} from '../../game/data/graphics';
import './events.css';

type Props={game:GameState;onChoice:(instance:string,choice:string)=>void;onContinue:(instance:string)=>void;onHome:()=>void;onRevival?:(use:boolean)=>void;definition?:ExpeditionEventDefinition};
const EVENT_TYPE_META:Record<EventType,{label:string;icon:string}>={
 RECOVERY:{label:'회복',icon:'✚'},
 SUPPLY:{label:'보급',icon:'▣'},
 DISCOVERY:{label:'발견',icon:'◇'},
 RISK:{label:'위험',icon:'⚠'},
 STATUS:{label:'정비',icon:'◆'},
 SPECIAL:{label:'특수',icon:'✦'},
 BOSS:{label:'보스',icon:'⚔'}
};
function eventScope(definition:ExpeditionEventDefinition|undefined,type:EventType){
 if(type==='BOSS')return '보스 조우';
 if(definition?.towerIds?.length===1)return `${TOWERS[definition.towerIds[0]].name} 전용`;
 return '공통 탐사';
}
function EventArt({assetKey,tower,floor,title,type}:{assetKey?:string;tower:Tower;floor:number;title:string;type:EventType}){
 const authored=eventAsset(assetKey),fallback=assetUrl(backgroundFor(tower,floor)),url=authored??fallback,[failed,setFailed]=useState(false),meta=EVENT_TYPE_META[type];
 return <div className={'event-art '+(authored?'authored':'ambient')}>{!failed?<img src={url} alt={`${title} 배경`} onError={()=>setFailed(true)}/>:<div className="event-art-placeholder"><span aria-hidden="true">{meta.icon}</span><small>{meta.label} 탐사 기록</small></div>}<div className="event-art-shade" aria-hidden="true"/></div>;
}
export function EventScreen({game,onChoice,onContinue,onHome,onRevival,definition}:Props){
 const e=game.expedition!,p=e.events.pendingEvent!,d=definition??definitionFor(e),max=stats(game,e.equipment).hp,eventType=d?.type??'DISCOVERY',meta=EVENT_TYPE_META[eventType],scope=eventScope(d,eventType),selectedChoice=d?.choices.find(choice=>choice.id===p.choiceId);
 const lock=useRef(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 function act(action:()=>void){if(lock.current)return;lock.current=true;setBusy(true);try{action();}catch{setError('선택 결과를 저장하지 못했습니다. 저장 공간을 확인하고 다시 시도하세요.');lock.current=false;setBusy(false);}}
 return <section className={`event-screen event-${eventType.toLowerCase()}`} aria-label="원정 이벤트">{e.pendingRevival&&onRevival&&<div className="battle-dialog-backdrop"><section className="battle-encounter revival-dialog" role="dialog" aria-modal="true"><h2>치명상을 입었습니다</h2><p>회생 포션을 사용해 이벤트 결과로 돌아갈 수 있습니다.</p><button className="primary" onClick={()=>onRevival(true)}>회생 포션 사용</button><button onClick={()=>onRevival(false)}>사용하지 않기</button></section></div>}
 <div className="event-hud"><span>{TOWERS[e.tower].name} · {e.floor}층 / T{tierOf(e.floor)}</span><button onClick={onHome} aria-label="원정 메뉴">메뉴</button><div><span>HP <b>{Math.ceil(e.hp)} / {max}</b></span><span>Silver <b>{e.loot.silver.toLocaleString()}</b></span><span>포션 <b>{potionIds.reduce((n,id)=>n+e.bag[id],0)}</b></span></div><progress aria-label="플레이어 HP" value={e.hp} max={max}/></div>
 {e.events.mode==='test'&&<p className="event-test-label">테스트 모드 · 샘플 이벤트</p>}
 <header className="event-title"><div className="event-title-meta"><span className="event-type-badge"><span aria-hidden="true">{meta.icon}</span>{meta.label}</span><span className="event-scope">{scope}</span></div><h1>{d?.title??'잊힌 탐사 기록'}</h1></header>
 <EventArt key={(d?.imageAssetKey??'ambient')+e.tower+e.floor} assetKey={d?.imageAssetKey} tower={e.tower} floor={e.floor} title={d?.title??'잊힌 탐사 기록'} type={eventType}/>
 {p.state==='CHOICE'?<><section className="event-story"><p className="event-description">{d?.description??'이 이벤트의 기록을 찾을 수 없습니다. 보상 없이 다음 탐사를 진행할 수 있습니다.'}</p></section><div className="event-divider" aria-hidden="true">──── ◇ ────</div><div className="event-choices">{d?.choices.map(c=>{const allowed=meetsConditions(game,c.conditions);return <button key={c.id} className={'event-choice '+(c.styleVariant??'SECONDARY').toLowerCase()} disabled={busy||!allowed} onClick={()=>act(()=>onChoice(p.instanceId,c.id))}><span className="event-choice-icon" aria-hidden="true">{c.icon??(c.styleVariant==='SKIP'?'⇥':'◇')}</span><span className="event-choice-copy"><strong>{c.label}</strong>{c.description&&<small>{c.description}</small>}{!allowed&&<small className="event-choice-locked">선택 조건을 충족하지 못했습니다.</small>}</span><span className="event-choice-arrow" aria-hidden="true">›</span></button>;})??<button className="event-choice" disabled={busy} onClick={()=>act(()=>onChoice(p.instanceId,'missing_skip'))}>지나간다</button>}</div>
 {!!d?.rewardPreview?.length&&<section className="event-rewards" aria-label="기대할 수 있는 발견물"><div className="event-section-heading"><span aria-hidden="true">◇</span><h2>기대할 수 있는 발견물</h2></div><div className="event-reward-grid">{d.rewardPreview.map((reward,i)=><article key={i}>{eventAsset(reward.iconAssetKey)?<img src={eventAsset(reward.iconAssetKey)} alt="" onError={ev=>ev.currentTarget.hidden=true}/>:<span className="event-reward-placeholder" aria-hidden="true">◇</span>}<span><strong>{reward.label}</strong>{reward.note&&<small>{reward.note}</small>}</span></article>)}</div><p>발견물의 종류와 수량은 선택 결과에 따라 달라집니다.</p></section>}</>:<section className="event-result" role="status"><div className="event-result-mark"><span aria-hidden="true">{meta.icon}</span><small>탐사 결과</small></div>{selectedChoice&&<p className="event-result-choice">선택 · {selectedChoice.label}</p>}<h2>탐사 결과</h2><p className="event-result-text">{p.resultText||'탐사 결과가 기록되었습니다.'}</p>{!!p.resultLines.length&&<ul>{p.resultLines.map((line,i)=><li key={i}><span aria-hidden="true">›</span><span>{line}</span></li>)}</ul>}<button className="event-choice primary event-continue" disabled={busy} onClick={()=>act(()=>onContinue(p.instanceId))}><span className="event-choice-copy"><strong>{p.next==='BOSS'?'보스에게 향한다':'탐사를 계속한다'}</strong><small>{p.next==='BOSS'?'조우 지점으로 이동합니다.':'다음 전투 또는 탐사 구간으로 이동합니다.'}</small></span><span className="event-choice-arrow" aria-hidden="true">›</span></button></section>}
 {error&&<p role="alert" className="error">{error}</p>}
 <p className="event-footnote">이곳에서 얻은 것은 살아서 돌아와야 확정됩니다.</p>
 </section>;
}
