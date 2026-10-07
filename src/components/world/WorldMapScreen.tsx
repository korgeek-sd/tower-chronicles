import type {LifeTown} from '../../online/villageLife';
import React,{useState} from 'react';
import {WORLD_TOWNS,TOWN_ROUTES,canTravel,townKindLabel} from './worldMap';
export function WorldMapScreen({currentId,onTravel,towns,busy=false,actionPoints,onLife}:{currentId:string;onTravel:(id:string)=>void;towns?:LifeTown[];busy?:boolean;actionPoints?:number;onLife?:()=>void}){
 const data=towns??WORLD_TOWNS;
 const [selectedId,setSelectedId]=useState(currentId),[message,setMessage]=useState('');
 const current=data.find(t=>t.id===currentId)??data.find(t=>t.id==='city')!;
 const selected=data.find(t=>t.id===selectedId)??current;
 const liveTown=towns?.find(t=>t.id===selected.id);
 const reachable=canTravel(current.id,selected.id);
 return <section className="tc-world" aria-label="마을 이동">
  <header className="tc-world-heading"><div><small>WORLD MAP</small><h1>마을 이동</h1></div><span>{actionPoints===undefined?'10개 마을 · 1개 도시':`생활 행동력 ${actionPoints}/100`}</span></header>
  <div className="tc-world-location"><span>현재 위치 <b>{current.name}</b></span></div>
  <div className="tc-world-map" aria-label="거점 지도">
   <svg className="tc-world-roads" viewBox="0 0 500 500" aria-hidden="true">{TOWN_ROUTES.map(([a,b])=>{const from=data.find(t=>t.id===a)!,to=data.find(t=>t.id===b)!;return <line key={a+b} x1={from.x*100+50} y1={from.y*100+50} x2={to.x*100+50} y2={to.y*100+50}/>;})}</svg>
   {Array.from({length:25},(_,i)=>{const town=data.find(t=>t.x===i%5&&t.y===Math.floor(i/5));if(!town)return <div key={i} className="tc-world-terrain" aria-hidden="true"/>;const here=town.id===current.id;return <button key={i} data-town-id={town.id} className={'tc-world-town '+town.kind+(here?' current':'')} aria-pressed={town.id===selected.id} aria-label={`${town.name}, ${townKindLabel(town.kind)}, 소유 ${town.owner}, ${here?'현재 위치':'정보 보기'}`} onClick={()=>{setSelectedId(town.id);setMessage('');}}><b>{town.name}</b><small>{town.owner}</small></button>;})}
  </div>
  <section className="tc-world-details" aria-label="선택한 마을 정보">
   <header><div><small>{townKindLabel(selected.kind)}</small><h2>{selected.name}</h2></div><span>소유 <b>{selected.owner==='중립'?'중립':selected.owner+' 원정단'}</b></span></header>
   <div className="tc-world-facts"><div><small>생산물 세율</small><b>{selected.tax}%</b></div><div><small>소유 원정단원</small><b>{towns?'점령 후 적용':'생산 +20%'}</b></div><div><small>시설 레벨</small><b>한도 0 · 효율 0</b></div></div>
   {(selected.kind==='city'?['약초','농산물']:[selected.kind==='herb'?'약초':'농산물']).map(resource=><div className="tc-world-stock" key={resource}><span>{resource} 잔여량</span><b>{(resource==='약초'?liveTown?.herbRemaining:liveTown?.farmRemaining)?.toLocaleString()??'30,000'} / {(resource==='약초'?liveTown?.herbCapacity:liveTown?.farmCapacity)?.toLocaleString()??'30,000'}</b><div><i style={{width:liveTown?((resource==='약초'?liveTown.herbRemaining/Math.max(1,liveTown.herbCapacity):liveTown.farmRemaining/Math.max(1,liveTown.farmCapacity))*100)+'%':'100%'}}/></div></div>)}
   <div className="tc-world-buttons"><button aria-label="이동하기" className="tc-action tc-feel-press tc-world-travel" disabled={busy||!reachable} onClick={()=>{if(busy||!canTravel(current.id,selected.id))return;onTravel(selected.id);if(!towns)setMessage(`${selected.name}(으)로 이동했습니다.`);}}>{selected.id===current.id?'현재 위치':reachable?selected.name+' 이동하기':'현재 위치'} <span aria-hidden="true">›</span></button>{onLife&&<button className="tc-action tc-world-life" disabled={busy||selected.id!==current.id} onClick={onLife}>생활하기</button>}</div>
  </section>
  <p className="tc-world-message" role="status">{message}</p>
  <p className="tc-world-preview">{towns?'매일 00시 행동력·마을 생산량 초기화':'미리보기 · 소유·세율·생산량은 예시 데이터'}</p>
 </section>;
}
