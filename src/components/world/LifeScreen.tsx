import React from 'react';
import {LIFE_MATERIAL_NAMES,lifeBatchLimit,type VillageLifeState,type LifeResource,type LifeMaterial} from '../../online/villageLife';
import {townKindLabel} from './worldMap';
type Props={state:VillageLifeState;busy:boolean;count:number;now:number;message?:string;onCount:(n:number)=>void;onGather:(r:LifeResource)=>void;onBack:()=>void;onRefresh:()=>void};
export function LifeScreen({state,busy,count,now,message,onCount,onGather,onBack,onRefresh}:Props){
 const town=state.towns.find(t=>t.id===state.location)!;
 const resources:LifeResource[]=town.kind==='city'?['herb','farm']:[town.kind];
 const remaining=Math.max(0,Math.ceil((state.nextResetAt-now)/1000));const reset=`${Math.floor(remaining/3600)}시간 ${Math.floor(remaining%3600/60)}분`;
 return <section className="tc-life" aria-label="마을 생활">
  <header className="tc-life-header"><div><small>{townKindLabel(town.kind)}</small><h1>{town.name} 생활</h1></div><button className="tc-action secondary" onClick={onBack}>지도</button></header>
  <section className="tc-life-ap"><div><small>생활 행동력</small><b>{state.actionPoints}<span> / 100</span></b></div><p>매일 00:00 초기화<small>다음 초기화까지 {reset}</small></p><div className="tc-life-meter"><i style={{width:state.actionPoints+'%'}}/></div></section>
  <section className="tc-life-inventory" aria-label="생활 재료 보유량">{(Object.keys(LIFE_MATERIAL_NAMES) as LifeMaterial[]).map(id=><div key={id}><small>{LIFE_MATERIAL_NAMES[id]}</small><b>{state.materials[id].toLocaleString()}</b></div>)}</section>
  <section className="tc-life-quantity"><label htmlFor="life-count">생활 횟수</label><div>{[1,10,100].map(n=><button key={n} aria-pressed={count===n} disabled={busy} onClick={()=>onCount(n)}>{n}회</button>)}<input id="life-count" aria-label="생활 횟수 직접 입력" type="number" min="1" max="100" step="1" value={count} disabled={busy} onChange={e=>onCount(Math.max(1,Math.min(100,Math.trunc(Number(e.target.value)||1))))}/></div></section>
  <div className="tc-life-actions">{resources.map(resource=>{const herb=resource==='herb',stock=herb?town.herbRemaining:town.farmRemaining,capacity=herb?town.herbCapacity:town.farmCapacity,limit=lifeBatchLimit(state,resource);return <section className="tc-life-gather" key={resource}><header><h2>{herb?'약초 채집':'농사'}</h2><small>오늘 잔여 {stock.toLocaleString()} / {capacity.toLocaleString()}</small></header><p>{herb?'약초':'고추·감자·밀 중 매회 랜덤 한 종류'} 10개 / 행동력 1</p><button className="tc-action tc-feel-press" disabled={busy||count>limit} onClick={()=>onGather(resource)}>{busy?'처리 중…':`${count}회 ${herb?'채집':'농사'} · 행동력 ${count}`}</button><small>총 {count*10}개 생산 · 현재 최대 {limit}회 가능</small></section>;})}</div>
  <p className="tc-life-result" role="status">{message||'획득한 재료는 계정의 생활 재료함에 저장됩니다.'}</p>
  <footer><span>중립 마을 · 세율 0%</span><button disabled={busy} onClick={onRefresh}>잔여량 새로고침</button></footer>
 </section>;
}
