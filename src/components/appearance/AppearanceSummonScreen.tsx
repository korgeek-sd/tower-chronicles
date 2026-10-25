import React,{useEffect,useRef,useState} from 'react';
import {appearanceSummonTickets} from '../../game/engine/appearanceSummonTickets';
import {APPEARANCE_SUMMON_GOLD_PRICE,APPEARANCE_SUMMON_TEN_DISCOUNT_PERCENT} from '../../game/data/appearanceSummonPricing';
import type {GameState} from '../../game/types';
import type {CloudSaveRecord} from '../../online/cloudSave';
import type {GameplayLease} from '../../online/gameSession';
import {getAppearanceSummonHistory,summonAppearances,type AppearanceSummonCurrency,type AppearanceSummonDraw,type AppearanceSummonHistoryEntry} from '../../online/appearanceSummon';
import {APPEARANCES} from '../../game/data/cosmetics';
import {jobById} from '../../game/jobs/catalog';
import {assetUrl} from '../../game/data/graphics';
import {Glyph,Screen,Segments} from '../../ui/mobile';
import './appearance-summon.css';
import './iron-summon.css';
import './altar-summon.css';

// Existing artwork previews only: these are not summon rewards or appearance IDs.
const showcase=['relic_collector','lantern_keeper','expedition_medic'].map(id=>jobById(id)!);
export function AppearanceSummonScreen({game,onList,onCollection,userId=null,lease=null,onPrepare,onPending,onRecord}:{game:GameState;onList:()=>void;onCollection?:()=>void;userId?:string|null;lease?:GameplayLease|null;onPrepare?:()=>Promise<void>;onPending?:(busy:boolean)=>void;onRecord?:(record:CloudSaveRecord)=>void}){
 const [focus,setFocus]=useState(1),[panel,setPanel]=useState<'history'|'rates'|'results'|null>(null);
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[draws,setDraws]=useState<AppearanceSummonDraw[]>([]);
 const [history,setHistory]=useState<AppearanceSummonHistoryEntry[]>([]);
 const pendingRequest=useRef<{id:string;currency:AppearanceSummonCurrency;rolls:1|10}|null>(null);
 const modal=useRef<HTMLElement>(null),selected=showcase[focus];
 const available=!!userId&&!!lease;
 const names=new Map(APPEARANCES.map(appearance=>[appearance.id,appearance.name]));
 async function summon(currency:AppearanceSummonCurrency,rolls:1|10){
  if(!userId||!lease||busy)return;
  const cost=currency==='ticket'?1:rolls===1?APPEARANCE_SUMMON_GOLD_PRICE.single:APPEARANCE_SUMMON_GOLD_PRICE.ten;
  if((currency==='gold'&&game.market.gold<cost)||(currency==='ticket'&&appearanceSummonTickets(game)<1)){setStatus('소환에 필요한 재화가 부족합니다.');return;}
  const request=pendingRequest.current?.currency===currency&&pendingRequest.current.rolls===rolls?pendingRequest.current:{id:crypto.randomUUID(),currency,rolls};
  pendingRequest.current=request;
  setBusy(true);onPending?.(true);setStatus('서버에서 외형을 소환하고 있습니다.');
  try{
   await onPrepare?.();
   const response=await summonAppearances(lease,userId,request.id,currency,rolls);
   onRecord?.(response.record);
   pendingRequest.current=null;
   setDraws(response.draws);setPanel('results');
   setStatus(response.replayed?'이전 소환 결과를 복원했습니다.':'외형 소환이 완료되었습니다.');
  }catch(error){setStatus(error instanceof Error?error.message:'소환 결과를 확인하지 못했습니다. 동일한 버튼으로 재시도해 주세요.');}
  finally{setBusy(false);onPending?.(false);}
 }
 async function showHistory(){
  if(!lease||!userId){setPanel('history');return;}
  try{const response=await getAppearanceSummonHistory(lease,userId);setHistory(response.history);setStatus('');}
  catch(error){setStatus(error instanceof Error?error.message:'소환 기록을 불러오지 못했습니다.');}
  setPanel('history');
 }
 useEffect(()=>{
  if(!panel)return;
  const previous=document.activeElement as HTMLElement|null;
  modal.current?.focus();
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setPanel(null);};
  document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('keydown',escape);previous?.focus();};
 },[panel]);
 return <Screen title="외형 소환" eyebrow="APPEARANCE SUMMON" className="tc-appearance-summon-screen tc-iron-summon-screen tc-altar-summon-screen">
  <div className="tc-appearance-summon">
   <Segments items={[['summon','외형 소환'],['list','외형 목록']] as const} value="summon" onChange={value=>{if(value==='list')onList();}} label="외형 메뉴"/>
   <section className="tc-summon-stage" aria-label="캐릭터 외형 미리보기">
    <img className="tc-altar-background" src={assetUrl('assets/backgrounds/summon/summon-altar-v1.webp')} alt=""/><p className="tc-altar-title">잊힌 기록을 부르다</p>
    <div className="tc-summon-figures">{showcase.map((figure,index)=><button type="button" key={figure.id} className={'tc-summon-figure '+(index===focus?'is-focused':'')} aria-pressed={index===focus} aria-label={figure.displayName+' 이미지 미리보기'} onClick={()=>setFocus(index)}>{figure.visualAssetKey&&<img src={assetUrl(figure.visualAssetKey)} alt="" draggable={false}/>}<span>{figure.displayName}</span></button>)}</div>
    <button type="button" className="tc-altar-prev" aria-label="이전 외형 미리보기" onClick={()=>setFocus(v=>(v+showcase.length-1)%showcase.length)}>‹</button><button type="button" className="tc-altar-next" aria-label="다음 외형 미리보기" onClick={()=>setFocus(v=>(v+1)%showcase.length)}>›</button><span className="tc-summon-preview-note">기존 캐릭터 이미지 미리보기</span>
   </section>
   <section className="tc-summon-feature" aria-live="polite"><small>APPEARANCE PREVIEW</small><h2>{selected.displayName}</h2><div><span>착용 효과</span><b>능력치 확정 예정</b></div></section>
   <footer className="tc-summon-footer" aria-label="외형 소환 및 보유 소환권">
   <div className="tc-summon-wallet"><div><Glyph name="gold"/><span>보유 골드<b>{game.market.gold.toLocaleString()}</b></span></div><div><Glyph name="ticket"/><span>외형 소환권<b>{appearanceSummonTickets(game).toLocaleString()}장</b></span></div></div>
   <div className="tc-summon-actions"><button type="button" disabled={!available||busy||game.market.gold<APPEARANCE_SUMMON_GOLD_PRICE.single} onClick={()=>{void summon('gold',1);}}><strong>1회 소환</strong><small>{APPEARANCE_SUMMON_GOLD_PRICE.single.toLocaleString('ko-KR')} G</small></button><button type="button" disabled={!available||busy||game.market.gold<APPEARANCE_SUMMON_GOLD_PRICE.ten} onClick={()=>{void summon('gold',10);}}><strong>10회 소환</strong><small>{APPEARANCE_SUMMON_GOLD_PRICE.ten.toLocaleString('ko-KR')} G · {APPEARANCE_SUMMON_TEN_DISCOUNT_PERCENT}% 할인</small></button><button type="button" disabled={!available||busy||appearanceSummonTickets(game)<1} onClick={()=>{void summon('ticket',1);}}><strong>소환권 사용</strong><small>1회 · 1장</small></button></div>
   <p className="tc-summon-status" role="status">{status||(available?'C 60% · B 30% · A 8% · SR 1.8% · SSR 0.2%':'온라인 로그인 및 플레이 세션이 필요합니다.')}</p>
   <div className="tc-summon-utilities"><button type="button" onClick={()=>{void showHistory();}}><Glyph name="bestiary"/>소환 기록</button><button type="button" onClick={()=>setPanel('rates')}><Glyph name="search"/>확률 정보</button>{onCollection&&<button type="button" onClick={onCollection}><Glyph name="bestiary"/>컬렉션</button>}</div>
   </footer>
  </div>
  {panel&&<div className="tc-summon-modal-backdrop" role="presentation" onClick={()=>setPanel(null)}>
   <section ref={modal} tabIndex={-1} className="tc-summon-modal" role="dialog" aria-modal="true" aria-labelledby="summon-modal-title" onClick={e=>e.stopPropagation()}>
    <header><h2 id="summon-modal-title">{panel==='history'?'소환 기록':panel==='rates'?'등급별 확률':'소환 결과'}</h2><button type="button" aria-label="닫기" onClick={()=>setPanel(null)}>×</button></header>
    {panel==='rates'&&<><p>1회 {APPEARANCE_SUMMON_GOLD_PRICE.single} G / 10회 {APPEARANCE_SUMMON_GOLD_PRICE.ten.toLocaleString('ko-KR')} G ({APPEARANCE_SUMMON_TEN_DISCOUNT_PERCENT}% 할인)</p><div className="tc-summon-rate-table">{(['C','B','A','SR','SSR'] as const).map((rarity,index)=><div key={rarity}><b>{rarity}</b><span>{['60%','30%','8%','1.8%','0.2%'][index]}</span></div>)}</div><p>각 회차는 독립 추첨이며 확정 지급과 천장은 없습니다.</p></>}
    {panel==='results'&&<div className="tc-summon-results">{draws.map((draw,index)=><div key={index} className={'tc-summon-result tc-summon-rarity-'+draw.rarity.toLowerCase()}><b>{draw.rarity}</b><span>{names.get(draw.id)??draw.id}</span>{draw.duplicate&&<small>중복 획득</small>}</div>)}</div>}
    {panel==='history'&&(!history.length?<p>저장된 소환 기록이 없습니다.</p>:<div className="tc-summon-history">{history.map((entry,index)=><div key={index}><small>{new Date(entry.at).toLocaleString('ko-KR')} · {entry.currency==='ticket'?'소환권':entry.cost.toLocaleString('ko-KR')+' G'}</small><p>{entry.draws.map(draw=>draw.rarity+' '+(names.get(draw.id)??draw.id)).join(' · ')}</p></div>)}</div>)}
    <button type="button" className="tc-action" onClick={()=>setPanel(null)}>닫기</button>
   </section>
  </div>}
 </Screen>;
