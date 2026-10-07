import React,{useState} from 'react';
import {WORLD_TOWNS,TOWN_ROUTES,canTravel,townKindLabel} from './worldMap';
export function WorldMapScreen({currentId,onTravel}:{currentId:string;onTravel:(id:string)=>void}){
 const [selectedId,setSelectedId]=useState(currentId),[message,setMessage]=useState('');
 const current=WORLD_TOWNS.find(t=>t.id===currentId)??WORLD_TOWNS[5];
 const selected=WORLD_TOWNS.find(t=>t.id===selectedId)??current;
 const reachable=canTravel(current.id,selected.id);
 return <section className="tc-world" aria-label="마을 이동">
  <header className="tc-world-heading"><div><small>WORLD MAP</small><h1>마을 이동</h1></div><span>10개 마을 · 1개 도시</span></header>
  <div className="tc-world-location"><span>현재 위치 <b>{current.name}</b></span></div>
  <div className="tc-world-map" aria-label="거점 지도">
   <svg className="tc-world-roads" viewBox="0 0 500 500" aria-hidden="true">{TOWN_ROUTES.map(([a,b])=>{const from=WORLD_TOWNS.find(t=>t.id===a)!,to=WORLD_TOWNS.find(t=>t.id===b)!;return <line key={a+b} x1={from.x*100+50} y1={from.y*100+50} x2={to.x*100+50} y2={to.y*100+50}/>;})}</svg>
   {Array.from({length:25},(_,i)=>{const town=WORLD_TOWNS.find(t=>t.x===i%5&&t.y===Math.floor(i/5));if(!town)return <div key={i} className="tc-world-terrain" aria-hidden="true"/>;const here=town.id===current.id;return <button key={i} data-town-id={town.id} className={'tc-world-town '+town.kind+(here?' current':'')} aria-pressed={town.id===selected.id} aria-label={`${town.name}, ${townKindLabel(town.kind)}, 소유 ${town.owner}, ${here?'현재 위치':'정보 보기'}`} onClick={()=>{setSelectedId(town.id);setMessage('');}}><b>{town.name}</b><small>{town.owner}</small></button>;})}
  </div>
  <section className="tc-world-details" aria-label="선택한 마을 정보">
   <header><div><small>{townKindLabel(selected.kind)}</small><h2>{selected.name}</h2></div><span>소유 <b>{selected.owner==='중립'?'중립':selected.owner+' 원정단'}</b></span></header>
   <div className="tc-world-facts"><div><small>생산물 세율</small><b>{selected.tax}%</b></div><div><small>소유 원정단원</small><b>생산 +20%</b></div><div><small>시설 레벨</small><b>한도 0 · 효율 0</b></div></div>
   {(selected.kind==='city'?['약초','농산물']:[selected.kind==='herb'?'약초':'농산물']).map(resource=><div className="tc-world-stock" key={resource}><span>{resource} 잔여량</span><b>30,000 / 30,000</b><div><i/></div></div>)}
   <button aria-label="이동하기" className="tc-action tc-feel-press tc-world-travel" disabled={!reachable} onClick={()=>{if(!canTravel(current.id,selected.id))return;onTravel(selected.id);setMessage(`${selected.name}(으)로 이동했습니다.`);}}>{selected.id===current.id?'현재 위치':reachable?selected.name+' 이동하기':'현재 위치'} <span aria-hidden="true">›</span></button>
  </section>
  <p className="tc-world-message" role="status">{message}</p>
  <p className="tc-world-preview">미리보기 · 소유·세율·생산량은 예시 데이터</p>
 </section>;
}
