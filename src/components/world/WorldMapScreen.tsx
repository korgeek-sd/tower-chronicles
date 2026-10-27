import type {LifeTown} from '../../online/villageLife';
import React,{useEffect,useRef,useState} from 'react';
import type {VillageWarState} from '../../online/villageWar';
import {Glyph} from '../../ui/mobile';
import {WORLD_TOWNS,canTravel,townKindLabel,type TownKind} from './worldMap';
import './region-board.css';
import './central-map.css';
export function WorldMapScreen({currentId,onTravel,towns,busy=false,vitality,onLife,war,onDeclareWar,warBusy=false,warPending=false,warError}:{currentId:string;onTravel:(id:string)=>void;towns?:LifeTown[];busy?:boolean;vitality?:number;onLife?:()=>void;war?:VillageWarState|null;onDeclareWar?:(id:string)=>void;warBusy?:boolean;warPending?:boolean;warError?:string}){
 const cancelRef=useRef<HTMLButtonElement|null>(null);
 const data=towns??WORLD_TOWNS;
 const [selectedId,setSelectedId]=useState(currentId),[message,setMessage]=useState(''),[confirmTown,setConfirmTown]=useState<string|null>(null);
 useEffect(()=>{if(!confirmTown)return;const previous=document.activeElement as HTMLElement|null;cancelRef.current?.focus();const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setConfirmTown(null);};window.addEventListener('keydown',close);return()=>{window.removeEventListener('keydown',close);previous?.focus();};},[confirmTown]);
 const current=data.find(t=>t.id===currentId)??data.find(t=>t.id==='city')??data[0];
 if(!current)return <section className="tc-region-board"><h1>마을 이동</h1><p role="status">마을 정보를 다시 확인해 주세요.</p></section>;
 const selected=data.find(t=>t.id===selectedId)??current;
 const liveTown=towns?.find(t=>t.id===selected.id),reachable=canTravel(current.id,selected.id),here=selected.id===current.id;
 const declarationsFor=(id:string)=>war?.declarations.filter(d=>d.townId===id)??[];
 const declaredByMe=(id:string)=>!!war?.myAssociationId&&declarationsFor(id).some(d=>d.associationId===war.myAssociationId);
 const canDeclare=!!onDeclareWar&&war?.phase==='BIDDING'&&war.myRole==='LEADER';
 const selectedDeclarations=declarationsFor(selected.id);
 const declarationNote=war?.phase!=='BIDDING'?'선전포고 기간이 아닙니다':war.myRole!=='LEADER'?'길드장만 선전포고 가능':declaredByMe(selected.id)?'내 길드 선전포고 완료':(war.guildTickets??0)<100?'공용 도전권이 100장보다 부족합니다':'마을당 공용 도전권 100장 · 취소 및 환불 불가';
 const resource=(kind:TownKind)=>kind==='city'?'약초 · 농업':kind==='herb'?'약초':'농업';
 const glyph=(kind:TownKind)=>kind==='city'?'association':kind==='herb'?'kaleon':'farm';
 const select=(id:string)=>{setSelectedId(id);setMessage('');};
 const mapIds=['herb-1','farm-1','city','herb-2','farm-2'];
 const mapTowns=mapIds.map(id=>data.find(t=>t.id===id)).filter((t):t is typeof data[number]=>!!t);
 const remaining=(id:string,kind:TownKind)=>{const t=towns?.find(t=>t.id===id);if(!t)return '—';const n=kind==='herb'?t.herbRemaining:t.farmRemaining;return n===0?'소진':n.toLocaleString();};
 return <section className="tc-region-board" aria-label="마을 이동">
  <header className="tc-region-heading"><div><small>REGION BOARD</small><h1>마을 이동</h1></div><div><span>현재 위치 · <b>{current.name}</b></span><span>활력 <b>{vitality===undefined?'—':`${vitality} / 100`}</b></span></div></header>
  <div className="tc-territory-map" aria-label="중앙 도시와 네 마을 지도">
   {mapTowns.map(town=><button type="button" key={town.id} data-town-id={town.id} data-map-town={town.id} className={'tc-map-node '+town.kind+(town.id===current.id?' current':'')} aria-pressed={town.id===selected.id} aria-label={`${town.name}, ${resource(town.kind)}, 점령 ${town.owner}`} onClick={()=>select(town.id)}>
    <span className="tc-map-label-stack">{town.id===current.id&&<em className="tc-map-location-flag">현재 위치</em>}
    <span className="tc-map-nameplate">{town.kind!=='city'&&<Glyph name={glyph(town.kind)}/>}<b>{town.name}</b></span></span>
    {town.kind!=='city'&&remaining(town.id,town.kind)==='소진'&&<span className="tc-map-depleted">소진</span>}
   </button>)}
  </div>
  <section className="tc-region-details" aria-label="선택한 마을 정보">
   <header><Glyph name={glyph(selected.kind)}/><div><small>{townKindLabel(selected.kind)}</small><h2>{selected.name}</h2></div><span>{here?'현재 위치':'이동 가능'}</span></header>
   <div className="tc-region-facts"><div><small>점령 길드</small><b>{selected.owner}</b></div><div><small>생산물 세율</small><b>{selected.tax}%</b></div></div>
   {war&&<div className="tc-region-war-status"><span>선전포고 <b>{selectedDeclarations.length}개 길드</b></span><span>공용 도전권 <b>{(war.guildTickets??0).toLocaleString()}장</b></span></div>}
   <div className="tc-region-stocks">{(selected.kind==='city'?['herb','farm']:[selected.kind]).map(kind=>{const remaining=kind==='herb'?liveTown?.herbRemaining:liveTown?.farmRemaining,capacity=kind==='herb'?liveTown?.herbCapacity:liveTown?.farmCapacity;return <div key={kind}><span>{kind==='herb'?'약초':'농산물'} 잔여량</span><b>{remaining?.toLocaleString()??'—'} / {capacity?.toLocaleString()??'—'}</b></div>;})}</div>
   <div className="tc-region-actions">{here&&onLife?<button type="button" aria-label="채집 · 생활하기" className="tc-action tc-feel-press" disabled={busy} onClick={onLife}>생산하기</button>:<button type="button" aria-label="이동하기" className="tc-action tc-feel-press" disabled={busy||!reachable} onClick={()=>{if(busy||!canTravel(current.id,selected.id))return;onTravel(selected.id);if(!towns)setMessage(`${selected.name}(으)로 이동했습니다.`);}}>{busy?'처리 중…':here?'현재 위치':`${selected.name} 이동하기`} <span aria-hidden="true">›</span></button>}
    {war&&war.myRole==='LEADER'&&!declaredByMe(selected.id)&&<button type="button" {...(canDeclare?{'data-action':'declare-war'}:{})} className="tc-action tc-feel-press tc-region-declare" disabled={busy||warBusy||warPending||(war.guildTickets??0)<100||!canDeclare} onClick={()=>setConfirmTown(selected.id)}>선전포고 <small>도전권 100장</small></button>}
    </div>
    {war&&<p className={'tc-region-declare-note'+(declaredByMe(selected.id)?' done':'')}>{declarationNote}</p>}
    {warError&&<p className="tc-region-message" role="alert">{warError}</p>}
    {!war&&onDeclareWar&&<p className="tc-region-declare-note">선전포고 현황을 불러오는 중…</p>}
   {message&&<p className="tc-region-message" role="status">{message}</p>}
   <p className="tc-region-footnote">{towns?'매일 24:00 생산량 초기화 · 한국시간':'미리보기 · 소유·세율·생산량은 예시 데이터'}</p>
  </section>
  {confirmTown&&war&&<div className="tc-region-confirm-backdrop" role="presentation" onClick={()=>setConfirmTown(null)}>
   <div className="tc-region-confirm" role="dialog" aria-modal="true" aria-labelledby="tc-war-confirm-title" aria-describedby="tc-war-confirm-desc" onClick={e=>e.stopPropagation()}>
    <small>WAR DECLARATION</small>
    <h2 id="tc-war-confirm-title">선전포고 확인</h2>
    <p><b>{data.find(t=>t.id===confirmTown)?.name}</b>에 이번 주 선전포고합니다.</p>
    <div><span>공용 도전권 소비</span><strong>100장</strong></div>
    <div><span>길드 창고 보유</span><strong>{(war.guildTickets??0).toLocaleString()}장</strong></div>
    <p id="tc-war-confirm-desc">등록 후 취소 및 환불이 불가능합니다. 전쟁 시간에 해당 마을의 길드원 전투 참가 권한이 활성화됩니다.</p>
    <footer><button ref={cancelRef} type="button" onClick={()=>setConfirmTown(null)}>취소</button><button type="button" className="tc-region-confirm-accept tc-feel-press" disabled={busy||warBusy||warPending||!canDeclare||(war.guildTickets??0)<100||declaredByMe(confirmTown)} onClick={()=>{onDeclareWar?.(confirmTown);setConfirmTown(null);}}>공용 도전권 100장 사용</button></footer>
   </div>
  </div>}
 </section>;
}
