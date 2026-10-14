import {useVillageWarStageOne} from './useVillageWarStageOne';
import {VillageWarDeploymentPanel} from './VillageWarDeploymentPanel';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import type {GameState} from '../../game/types';
import type {GameplayLease} from '../../online/gameSession';
import {getVillageWarDeclarations,type VillageWarState} from '../../online/villageWar';
import {getHuntingState} from '../../online/hunting';
import {WORLD_TOWNS} from '../world/worldMap';
import {stats} from '../../game/engine/state';
import {assetUrl,playerGraphicForJob} from '../../game/data/graphics';
import {jobById} from '../../game/jobs/catalog';
import {Glyph} from '../../ui/mobile';
import './village-war-battle.css';

type Props={userId?:string|null;game:GameState;nickname?:string;lease?:GameplayLease|null;onLegacy?:()=>void;initialWar?:VillageWarState|null;initialPreview?:boolean};
type PreviewFront={id:number;guild:string;guardian:string;hp:number;mine:boolean};
const PREVIEW_FRONTS:PreviewFront[]=[
 {id:1,guild:'붉은달',guardian:'결투가',hp:100,mine:false},
 {id:2,guild:'철의맹세',guardian:'등불지기',hp:86,mine:true},
 {id:3,guild:'새벽별',guardian:'귀환수호자',hp:74,mine:false},
 {id:4,guild:'철의맹세',guardian:'길잡이',hp:100,mine:true},
 {id:5,guild:'암흑단',guardian:'시체조율사',hp:43,mine:false}
];
const FRONTS=[1,2,3,4,5] as const;
const remaining=(iso:string|undefined,now:number)=>{
 if(!iso)return '—';
 const d=Math.max(0,Math.ceil((Date.parse(iso)-now)/1000));
 return String(Math.floor(d/60)).padStart(2,'0')+':'+String(d%60).padStart(2,'0');
};
const pct=(value:number|null,max:number|null)=>value===null||max===null||max<=0?null:Math.round(Math.max(0,Math.min(100,value/max*100)));
function Meter({label,ratio,tone}:{label:string;ratio:number|null;tone:'hp'|'mp'}){
 return <div className="tc-vwb-meter"><span>{label}</span><div className={'tc-vwb-meter-track '+tone} role={ratio===null?undefined:'progressbar'} aria-label={label} aria-valuemin={ratio===null?undefined:0} aria-valuemax={ratio===null?undefined:100} aria-valuenow={ratio===null?undefined:ratio}><i style={{width:(ratio??0)+'%'}}/></div><b>{ratio===null?'—':ratio+'%'}</b></div>;
}
export function VillageWarBattleScreen({userId=null,game,nickname,lease,onLegacy,initialWar=null,initialPreview=false}:Props){
 const [war,setWar]=useState<VillageWarState|null>(initialWar),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [townId,setTownId]=useState('city'),[frontId,setFrontId]=useState(3);
 const stage=useVillageWarStageOne(lease??null,userId,townId);
 const [preview,setPreview]=useState(initialPreview),[previewResult,setPreviewResult]=useState(false),[recordsOpen,setRecordsOpen]=useState(false);
 const [now,setNow]=useState(()=>Date.now()),[myHealth,setMyHealth]=useState<{hp:number|null;mp:number|null;maxHp:number|null;maxMp:number|null}|null>(null);
 const alive=useRef(true),pending=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
 useEffect(()=>{
  if(!lease)return;
  let active=true;
  void getHuntingState(lease).then(s=>{if(active)setMyHealth({hp:s.currentHp??s.maxHp??null,mp:s.currentMp??s.maxMp??null,maxHp:s.maxHp??null,maxMp:s.maxMp??null});}).catch(()=>{});
  return()=>{active=false;};
 },[lease?.leaseId,lease?.generation]);
 useEffect(()=>{
  if(!lease)return;
  let active=true;
  const refresh=async()=>{
   if(pending.current)return;pending.current=true;
   try{const value=await getVillageWarDeclarations(lease);if(active&&alive.current){setWar(value);setError('');}}
   catch(e){if(active&&alive.current)setError(e instanceof Error?e.message:'전쟁 상황을 불러오지 못했습니다.');}
   finally{pending.current=false;if(active)setLoading(false);}
  };
  setLoading(true);void refresh();
  const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},15000);
  const focus=()=>void refresh();
  window.addEventListener('focus',focus);
  return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',focus);};
 },[lease?.leaseId,lease?.generation]);
 const town=WORLD_TOWNS.find(t=>t.id===townId)??WORLD_TOWNS[0];
 const myDeclaration=war?.declarations.some(d=>d.townId===townId&&d.associationId===war.myAssociationId)??false;
 const declarations=useMemo(()=>war?.declarations.filter(d=>d.townId===townId)??[],[war,townId]);
 const phase=war?.phase??'SETTLED';
 const active=preview?PREVIEW_FRONTS[frontId-1]:null;
 const guild=preview?'철의맹세':(declarations.find(d=>d.associationId===war?.myAssociationId)?.associationName??'내 원정단');
 const myStats=stats(game);
 const ownJob=jobById(game.currentJobId);
 const ownArt=playerGraphicForJob(game.currentJobId,game.cosmetics.selectedAppearanceId).image.idle;
 const defenderArt=preview?playerGraphicForJob('return_guardian',game.cosmetics.selectedAppearanceId).image.idle:null;
 const showHp=preview?(active?.hp??null):null;
 const finalHp=previewResult&&frontId===3?62:showHp;
 const canPreviewAttack=preview&&!!active&&!active.mine;
 const myHpPct=preview?100:pct(myHealth?.hp??myStats.hp,myHealth?.maxHp??myStats.hp);
 const myMpPct=preview?100:pct(myHealth?.mp??null,myHealth?.maxMp??null);
 const deadline=phase==='BIDDING'?war?.bidClosesAt:war?.battleStartsAt;
 const battleRemains=phase==='BATTLE'?remaining(war?.battleStartsAt?new Date(Date.parse(war.battleStartsAt)+30*60000).toISOString():undefined,now):'30:00';
 function chooseFront(id:number){setFrontId(id);setPreviewResult(false);}
 if(stage.state?.enabled&&!preview)return <section className="tc-village-stage-shell"><div className="tc-village-stage-controls"><select aria-label="전쟁 마을 선택" disabled={stage.busy||!!stage.pending} value={townId} onChange={e=>setTownId(e.target.value)}>{WORLD_TOWNS.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><button onClick={()=>setPreview(true)}>UI 시안 보기</button></div><VillageWarDeploymentPanel state={stage.state} userId={userId} busy={stage.busy} pending={stage.pending} error={stage.error} now={stage.now} onPlace={stage.place} onRemove={stage.remove} onClaim={stage.claim} onRetry={stage.retry} onRefresh={()=>void stage.refresh()}/></section>;
 return <section className="tc-vwb" aria-label="영지 점령전 전투" data-war-preview={preview}>
  <header className="tc-vwb-header">
   <div className="tc-vwb-title"><small>GUILD WAR · TERRITORY</small><h1>{town.name} 점령전</h1></div>
   <div className="tc-vwb-timer"><small>{phase==='BATTLE'?'전쟁 종료까지':phase==='BIDDING'?'선전포고 마감':phase==='LOCKED'?'전쟁 시작까지':'점령전 대기'}</small><strong>{phase==='BATTLE'?battleRemains:deadline?remaining(deadline,now):'—'}</strong></div>
  </header>
  <div className="tc-vwb-controls">
   <label><span>전장 선택</span><select aria-label="전쟁 마을 선택" value={townId} onChange={e=>{setTownId(e.target.value);setPreviewResult(false);}}>{WORLD_TOWNS.map(t=><option key={t.id} value={t.id}>{t.name}{t.kind==='city'?' · 중앙도시':''}</option>)}</select></label>
   <button type="button" className={preview?'active':''} aria-pressed={preview} onClick={()=>{setPreview(v=>!v);setPreviewResult(false);}}>{preview?'실제 전황 보기':'UI 시안 보기'}</button>
   {onLegacy&&<button type="button" onClick={onLegacy}>구 점령전</button>}
  </div>
  {preview&&<div className="tc-vwb-preview-note" role="status">UI 시연 데이터 · 실제 점령권·전투 결과·도전권에는 영향 없음</div>}
  <section className="tc-vwb-summary">
   <span>내 길드 <b>{guild}</b></span><span>{preview?'점령 전선 2 / 5':myDeclaration?'선전포고 완료':'선전포고 미등록'}</span>
  </section>
  <nav className="tc-vwb-fronts" aria-label="5개 전선 선택">
   {FRONTS.map(id=>{
    const f=preview?PREVIEW_FRONTS[id-1]:null;
    const hp=f?(previewResult&&id===3?62:f.hp):null;
    return <button type="button" key={id} data-front-id={id} aria-label={'제'+id+'전선'+(f?' · '+f.guild:'')} aria-pressed={frontId===id} onClick={()=>chooseFront(id)} className={'tc-vwb-front '+(frontId===id?'selected ':'')+(f?(f.mine?'mine':'enemy'):'unknown')}>
     <b>{id}전선</b><div className="tc-vwb-front-badge"><Glyph name={f?.mine?'defense':f?'sword':'towers'}/></div><span>{f?.guild??'미배치'}</span><div className="tc-vwb-front-mini"><i style={{width:(hp??0)+'%'}}/></div><strong>{hp===null?'—':hp+'%'}</strong>
    </button>;
   })}
  </nav>
  <section className="tc-vwb-selected" aria-label="선택한 전선 정보">
   <div className="tc-vwb-selected-scene" aria-hidden="true"><Glyph name="towers"/></div>
   <div><h2>제{frontId}전선</h2><p>현재 점령 길드 · <b>{active?.guild??'미확정'}</b></p><p>수비자 · <b>{active?.guardian??'수비자 정보 없음'}</b></p></div>
   <strong className="tc-vwb-selected-hp">{finalHp===null?'HP —':'HP '+finalHp+'%'}</strong>
  </section>
  <section className="tc-vwb-fighters" aria-label="1대1 자동전투">
   <article className="tc-vwb-fighter ally">
    <div className="tc-vwb-art">{ownArt?<img alt={ownJob?.displayName??'내 직업'} src={assetUrl(ownArt)}/>:<Glyph name="sword"/>}</div>
    <div className="tc-vwb-fighter-info"><small>내 캐릭터 · {guild}</small><strong>{nickname??'탐사자'}</strong><span>{ownJob?.displayName??'직업 미선택'}</span></div>
    <div className="tc-vwb-vitals"><Meter label="HP" ratio={myHpPct} tone="hp"/><Meter label="MP" ratio={myMpPct} tone="mp"/></div>
   </article>
   <span className="tc-vwb-vs" aria-hidden="true">VS</span>
   <article className="tc-vwb-fighter enemy">
    <div className="tc-vwb-art">{defenderArt?<img alt={active?.guardian??'수비자'} src={assetUrl(defenderArt)}/>:<Glyph name="defense"/>}</div>
    <div className="tc-vwb-fighter-info"><small>수비자 · {active?.guild??'미확정'}</small><strong>{active?.guardian??'수비자 미배치'}</strong><span>{preview?'Lv.85 · 시안':'수비대 편성 대기'}</span></div>
    <div className="tc-vwb-vitals"><Meter label="HP" ratio={finalHp} tone="hp"/><Meter label="MP" ratio={preview?100:null} tone="mp"/></div>
   </article>
  </section>
  <div className="tc-vwb-actions">
   <button type="button" className={'tc-vwb-attack tc-feel-press'+(canPreviewAttack?' allowed':'')} data-action={canPreviewAttack?'preview-attack':undefined} disabled={!canPreviewAttack} onClick={()=>setPreviewResult(true)}><Glyph name="sword"/><span><b>{canPreviewAttack?'즉시 전투':'전투 엔진 연결 전'}</b><small>{canPreviewAttack?'UI 시연 · 실제 도전권 차감 없음':'5전선 서버 전투 연결 후 활성화'}</small></span></button>
   <button type="button" className="tc-vwb-log-trigger" onClick={()=>setRecordsOpen(true)}><Glyph name="registration"/><span>최근 기록</span></button>
  </div>
  <section className="tc-vwb-feed" aria-live="polite">
   <div><b>전투 기록</b><button type="button" onClick={()=>setRecordsOpen(true)}>더보기 ›</button></div>
   {preview?<ul>
    {previewResult&&<li><span>22:15</span><b>철의맹세</b><span>제{frontId}전선 공격 · 수비자 HP 감소</span></li>}
    <li><span>22:14</span><b>철의맹세</b><span>제3전선 공격 · 수비자에게 12% 피해</span></li>
    <li><span>22:11</span><b>새벽별</b><span>제3전선 수비 성공</span></li>
    <li><span>22:08</span><b>붉은달</b><span>제1전선 공격 · 수비자에게 8% 피해</span></li>
    <li><span>22:05</span><b>철의맹세</b><span>제4전선 방어 성공</span></li>
    <li><span>22:03</span><b>암흑단</b><span>제5전선 점령</span></li>
   </ul>:<p>{error||'아직 표시할 전투 기록이 없습니다. 수비대와 서버 전투 연결 후 기록이 표시됩니다.'}</p>}
  </section>
  {!preview&&<p className="tc-vwb-status">{loading?'전장 상태를 조회하는 중…':phase==='BATTLE'?(myDeclaration?'선전포고 완료 · 수비대 편성 및 전투 서버 연결 전':'선전포고한 길드만 공격 가능'):phase==='BIDDING'?'선전포고 기간 · 마을 이동에서 길드장이 참가 등록':phase==='LOCKED'?'선전포고 마감 · 전쟁 시작 대기':'다음 점령전 대기'} · 도전권 {war?.tickets.toLocaleString()??'—'}장</p>}
  {previewResult&&preview&&<div className="tc-vwb-preview-result" role="status">시안 전투 완료 · 수비자 HP 74% → 62% (서버 미반영)</div>}
  {recordsOpen&&<div className="tc-vwb-overlay" role="presentation" onClick={()=>setRecordsOpen(false)}><section role="dialog" aria-modal="true" aria-label="길드전 전투 기록" className="tc-vwb-records" onClick={e=>e.stopPropagation()}><header><h2>길드전 전투 기록</h2><button type="button" onClick={()=>setRecordsOpen(false)}>닫기</button></header>{preview?<p>UI 시안 예시 · 22:14 철의맹세 공격 · 귀환수호자 HP 12% 감소</p>:<p>아직 전투 기록이 없습니다. 전투 서버 연결 후 전선별 기록을 표시합니다.</p>}</section></div>}
 </section>;
}
