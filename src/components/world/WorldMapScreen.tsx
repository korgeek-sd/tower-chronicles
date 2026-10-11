import type {LifeTown} from '../../online/villageLife';
import React,{useEffect,useState} from 'react';
import type {VillageWarState} from '../../online/villageWar';
import {Glyph} from '../../ui/mobile';
import {WORLD_TOWNS,canTravel,townKindLabel,type TownKind,type WorldTown} from './worldMap';
import './region-board.css';
export function WorldMapScreen({currentId,onTravel,towns,busy=false,actionPoints,onLife,war,onDeclareWar,warBusy=false,warPending=false,warError}:{currentId:string;onTravel:(id:string)=>void;towns?:LifeTown[];busy?:boolean;actionPoints?:number;onLife?:()=>void;war?:VillageWarState|null;onDeclareWar?:(id:string)=>void;warBusy?:boolean;warPending?:boolean;warError?:string}){
 const data=towns??WORLD_TOWNS;
 const [selectedId,setSelectedId]=useState(currentId),[filter,setFilter]=useState<'all'|TownKind>('all'),[message,setMessage]=useState(''),[confirmTown,setConfirmTown]=useState<string|null>(null);
 useEffect(()=>{if(!confirmTown)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setConfirmTown(null);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[confirmTown]);
 const current=data.find(t=>t.id===currentId)??data.find(t=>t.id==='city')??data[0];
 if(!current)return <section className="tc-region-board"><h1>마을 이동</h1><p role="status">마을 정보를 다시 확인해 주세요.</p></section>;
 const selected=data.find(t=>t.id===selectedId)??current,city=data.find(t=>t.kind==='city');
 const liveTown=towns?.find(t=>t.id===selected.id),reachable=canTravel(current.id,selected.id),here=selected.id===current.id;
 const declarationsFor=(id:string)=>war?.declarations.filter(d=>d.townId===id)??[];
 const declaredByMe=(id:string)=>!!war?.myAssociationId&&declarationsFor(id).some(d=>d.associationId===war.myAssociationId);
 const canDeclare=!!onDeclareWar&&war?.phase==='BIDDING'&&war.myRole==='LEADER';
 const selectedDeclarations=declarationsFor(selected.id);
 const declarationNote=war?.phase!=='BIDDING'?'선전포고 기간이 아닙니다':war.myRole!=='LEADER'?'길드장만 선전포고 가능':declaredByMe(selected.id)?'내 길드 선전포고 완료':war.tickets<100?'도전권이 100장보다 부족합니다':'마을당 도전권 100장 · 취소 및 환불 불가';
 const resource=(kind:TownKind)=>kind==='city'?'약초 · 농업':kind==='herb'?'약초':'농업';
 const glyph=(kind:TownKind)=>kind==='city'?'association':kind==='herb'?'kaleon':'farm';
 const select=(id:string)=>{setSelectedId(id);setMessage('');};
 const status=(town:WorldTown)=>town.id===current.id?'현재 위치':canTravel(current.id,town.id)?'이동 가능':'이동 불가';
 return <section className="tc-region-board" aria-label="마을 이동">
  <header className="tc-region-heading"><div><small>REGION BOARD</small><h1>마을 이동</h1></div><div><span>현재 위치 · <b>{current.name}</b></span><span>행동력 <b>{actionPoints===undefined?'—':`${actionPoints} / 100`}</b></span></div></header>
  <div className="tc-region-destinations">
   {city&&<button type="button" data-town-id={city.id} className={'tc-region-city'+(city.id===current.id?' current':'')} aria-pressed={city.id===selected.id} onClick={()=>select(city.id)}><span className="tc-region-city-crest"><Glyph name="association"/></span><span><small>CENTRAL CITY</small><b>{city.name} <em>중앙 도시</em></b><span>모든 생활 자원 · 약초 · 농업</span></span><i className={city.id===current.id?'current':'reachable'}>{status(city)}</i></button>}
   <nav className="tc-region-filters" aria-label="자원별 마을">{([['all','전체'],['herb','약초'],['farm','농업']] as const).map(([id,label])=><button type="button" key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</nav>
   <div className="tc-region-grid" aria-label="마을 목록">{data.filter(t=>t.kind!=='city'&&(filter==='all'||t.kind===filter)).map(town=><button type="button" key={town.id} data-town-id={town.id} className={'tc-region-card '+town.kind+(town.id===current.id?' current':'')} aria-pressed={town.id===selected.id} aria-label={`${town.name}, ${resource(town.kind)}, 소유 ${town.owner}, ${status(town)}`} onClick={()=>select(town.id)}><span className="tc-region-card-icon"><Glyph name={glyph(town.kind)}/></span><span className="tc-region-card-copy"><b>{town.name}</b><span>{resource(town.kind)}</span><small>점령 · {town.owner}{war&&declarationsFor(town.id).length>0?' · 포고 '+declarationsFor(town.id).length:''}</small></span><i className={town.id===current.id?'current':'reachable'} aria-label={status(town)}/></button>)}</div>
  </div>
  <section className="tc-region-details" aria-label="선택한 마을 정보">
   <header><Glyph name={glyph(selected.kind)}/><div><small>{townKindLabel(selected.kind)}</small><h2>{selected.name}</h2></div><span>{here?'현재 위치':'이동 가능'}</span></header>
   <div className="tc-region-facts"><div><small>점령 길드</small><b>{selected.owner}</b></div><div><small>생산물 세율</small><b>{selected.tax}%</b></div><div><small>생활 자원</small><b>{resource(selected.kind)}</b></div></div>
   {war&&<div className="tc-region-war-status"><span>선전포고 <b>{selectedDeclarations.length}개 길드</b></span><span>보유 도전권 <b>{war.tickets.toLocaleString()}장</b></span></div>}
   <div className="tc-region-stocks">{(selected.kind==='city'?['herb','farm']:[selected.kind]).map(kind=>{const remaining=kind==='herb'?liveTown?.herbRemaining:liveTown?.farmRemaining,capacity=kind==='herb'?liveTown?.herbCapacity:liveTown?.farmCapacity;return <div key={kind}><span>{kind==='herb'?'약초':'농산물'} 잔여량</span><b>{remaining?.toLocaleString()??'30,000'} / {capacity?.toLocaleString()??'30,000'}</b></div>;})}</div>
   <div className="tc-region-actions">{here&&onLife?<button type="button" aria-label="채집 · 생활하기" className="tc-action tc-feel-press" disabled={busy} onClick={onLife}>채집 · 생활하기</button>:<button type="button" aria-label="이동하기" className="tc-action tc-feel-press" disabled={busy||!reachable} onClick={()=>{if(busy||!canTravel(current.id,selected.id))return;onTravel(selected.id);if(!towns)setMessage(`${selected.name}(으)로 이동했습니다.`);}}>{busy?'처리 중…':here?'현재 위치':`${selected.name} 이동하기`} <span aria-hidden="true">›</span></button>}
    {war&&war.myRole==='LEADER'&&!declaredByMe(selected.id)&&<button type="button" {...(canDeclare?{'data-action':'declare-war'}:{})} className="tc-action tc-feel-press tc-region-declare" disabled={busy||warBusy||warPending||war.tickets<100||!canDeclare} onClick={()=>setConfirmTown(selected.id)}>선전포고 <small>도전권 100장</small></button>}
    </div>
    {war&&<p className={'tc-region-declare-note'+(declaredByMe(selected.id)?' done':'')}>{declarationNote}</p>}
    {warError&&<p className="tc-region-message" role="alert">{warError}</p>}
    {!war&&onDeclareWar&&<p className="tc-region-declare-note">선전포고 현황을 불러오는 중…</p>}
   {message&&<p className="tc-region-message" role="status">{message}</p>}
   <p className="tc-region-footnote">{towns?'매일 00시 행동력·마을 생산량 초기화':'미리보기 · 소유·세율·생산량은 예시 데이터'}</p>
  </section>
  {confirmTown&&war&&<div className="tc-region-confirm-backdrop" role="presentation" onClick={()=>setConfirmTown(null)}>
   <div className="tc-region-confirm" role="dialog" aria-modal="true" aria-labelledby="tc-war-confirm-title" onClick={e=>e.stopPropagation()}>
    <small>WAR DECLARATION</small>
    <h2 id="tc-war-confirm-title">선전포고 확인</h2>
    <p><b>{data.find(t=>t.id===confirmTown)?.name}</b>에 이번 주 선전포고합니다.</p>
    <div><span>소모 도전권</span><strong>100장</strong></div>
    <div><span>현재 보유</span><strong>{war.tickets.toLocaleString()}장</strong></div>
    <p>등록 후 취소 및 환불이 불가능합니다. 전쟁 시간에 해당 마을의 길드원 전투 참가 권한이 활성화됩니다.</p>
    <footer><button type="button" onClick={()=>setConfirmTown(null)}>취소</button><button type="button" className="tc-region-confirm-accept tc-feel-press" disabled={busy||warBusy||warPending||!canDeclare||war.tickets<100||declaredByMe(confirmTown)} onClick={()=>{onDeclareWar?.(confirmTown);setConfirmTown(null);}}>도전권 100장 사용</button></footer>
   </div>
  </div>}
 </section>;
}
