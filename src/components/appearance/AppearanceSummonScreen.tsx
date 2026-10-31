import React,{useEffect,useRef,useState} from 'react';
import {appearanceSummonTickets} from '../../game/engine/appearanceSummonTickets';
import {APPEARANCE_SUMMON_GOLD_PRICE,APPEARANCE_SUMMON_TEN_DISCOUNT_PERCENT,appearanceSummonPayment} from '../../game/data/appearanceSummonPricing';
import type {GameState} from '../../game/types';
import type {CloudSaveRecord} from '../../online/cloudSave';
import type {GameplayLease} from '../../online/gameSession';
import {getAppearanceSummonHistory,getWeeklyAppearancePickup,summonAppearances,type WeeklyAppearancePickup,type AppearanceSummonDraw,type AppearanceSummonHistoryEntry} from '../../online/appearanceSummon';
import {APPEARANCES} from '../../game/data/cosmetics';
import {APPEARANCE_SUMMON_RATES} from '../../game/data/appearanceSummonRates';
import {assetUrl} from '../../game/data/graphics';
import {Glyph,Screen,Segments} from '../../ui/mobile';
import './appearance-summon.css';
import './iron-summon.css';
import './altar-summon.css';
import {playSummonRequest,unlockSsrSound} from './ssrSound';
import {AppearanceSummonResultView} from './AppearanceSummonResultView';
export {AppearanceSummonResultView} from './AppearanceSummonResultView';

export function AppearanceSummonScreen({game,onList,onCollection,userId=null,lease=null,onPrepare,onPending,onRecord,onEquip}:{game:GameState;onList:()=>void;onCollection?:()=>void;userId?:string|null;lease?:GameplayLease|null;onPrepare?:()=>Promise<void>;onPending?:(busy:boolean)=>void;onRecord?:(record:CloudSaveRecord)=>void;onEquip?:(id:string)=>void}){
 const [panel,setPanel]=useState<'history'|'rates'|'results'|null>(null);
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[draws,setDraws]=useState<AppearanceSummonDraw[]>([]);
 const [history,setHistory]=useState<AppearanceSummonHistoryEntry[]>([]);
 const [lastPayment,setLastPayment]=useState({ticketsSpent:0,goldSpent:0});
 const [resultVersion,setResultVersion]=useState(0);
 const [animateSSR,setAnimateSSR]=useState(false);
 const [resultError,setResultError]=useState('');
 const pendingRequest=useRef<{id:string;rolls:1|10}|null>(null);
 const modal=useRef<HTMLElement>(null);
 const [weeklyPickup,setWeeklyPickup]=useState<WeeklyAppearancePickup|null>(null);
 const [pickupError,setPickupError]=useState(false);
 const featured=APPEARANCES.find(appearance=>appearance.id===weeklyPickup?.id&&appearance.rarity==='SSR');
 const others=Math.max(0,(weeklyPickup?.ssrCount??0)-1);
 useEffect(()=>{
  let mounted=true;
  const refresh=async()=>{
   try{
    const value=await getWeeklyAppearancePickup();
    if(mounted){setWeeklyPickup(value);setPickupError(false);}
   }catch{
    if(mounted){setWeeklyPickup(null);setPickupError(true);}
   }
  };
  void refresh();
  const interval=window.setInterval(()=>{void refresh();},60000);
  return()=>{mounted=false;window.clearInterval(interval);};
 },[]);
 const available=!!userId&&!!lease;

 useEffect(()=>{for(const path of ['assets/vfx/summon/seal-stone-cracks-v5-60f.webp','assets/vfx/summon/seal-stone-dissolve-v2-60f.webp','assets/vfx/summon/seal-rune-mask-v2.webp',...['seal-chamber','seal-flare'].map(name=>'assets/vfx/summon/'+name+'-v1.webp')]){const texture=new Image();texture.src=assetUrl(path);}},[]);
 const names=new Map(APPEARANCES.map(appearance=>[appearance.id,appearance.name]));
 const ownedTickets=appearanceSummonTickets(game);
 const onePayment=appearanceSummonPayment(1,ownedTickets);
 const tenPayment=appearanceSummonPayment(10,ownedTickets);
 const paymentLabel=(p:{ticketsUsed:number;goldSpent:number})=>[
  p.ticketsUsed?('소환권 '+p.ticketsUsed+'장'):'',
  p.goldSpent?(p.goldSpent.toLocaleString('ko-KR')+' G'):'',
 ].filter(Boolean).join(' + ');
 const resultPayment=(tickets:number,gold:number)=>paymentLabel({ticketsUsed:tickets,goldSpent:gold});
 async function summon(rolls:1|10){
  if(!userId||!lease||busy)return;
  const payment=appearanceSummonPayment(rolls,ownedTickets);
  if(game.market.gold<payment.goldSpent){setStatus('소환에 필요한 골드가 부족합니다.');return;}
  unlockSsrSound();
  playSummonRequest(rolls);
  const request=pendingRequest.current?.rolls===rolls?pendingRequest.current:{id:crypto.randomUUID(),rolls};
  pendingRequest.current=request;
  setResultError('');setBusy(true);setStatus('서버에서 외형을 소환하고 있습니다.');
  let prepared=false;
  try{
   await onPrepare?.();
   onPending?.(true);prepared=true;
   const response=await summonAppearances(lease,userId,request.id,rolls);
   onRecord?.(response.record);
   pendingRequest.current=null;
   setLastPayment({ticketsSpent:response.ticketsSpent,goldSpent:response.goldSpent});
   setAnimateSSR(!response.replayed);setDraws(response.draws);setResultVersion(n=>n+1);setPanel('results');
   setStatus((response.replayed?'이전 소환 결과를 복원했습니다. ':'외형 조각 소환 완료. ')+resultPayment(response.ticketsSpent,response.goldSpent)+' 사용');
  }catch(error){const message=error instanceof Error?error.message:'소환 결과를 확인하지 못했습니다. 동일한 버튼으로 재시도해 주세요.';setStatus(message);setResultError(message);}
  finally{setBusy(false);if(prepared)onPending?.(false);}
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
   <section className="tc-summon-stage" aria-label="이번 주 SSR 픽업 외형">
    <img className="tc-altar-background" src={assetUrl('assets/backgrounds/summon/summon-altar-v1.webp')} alt=""/>
    <p className="tc-altar-title">이번 주 SSR 픽업</p>
    {featured?.imagePath?
     <div className="tc-summon-pickup-figure"><img src={assetUrl(featured.imagePath)} alt={featured.name+' 외형'} draggable={false}/></div>:
     <p className="tc-summon-pickup-placeholder" role="status">{pickupError?'픽업 정보를 불러오지 못했습니다.':'이번 주 픽업 확인 중…'}</p>}
   </section>
   <section className="tc-summon-feature" aria-live="polite">
    <small>WEEKLY SSR PICKUP</small><h2>{featured?.name??'주간 SSR 픽업'}</h2>
   </section>
   <footer className="tc-summon-footer" aria-label="외형 소환 및 보유 소환권">
   <div className="tc-summon-wallet"><div><Glyph name="gold"/><span>보유 골드<b>{game.market.gold.toLocaleString()}</b></span></div><div><Glyph name="ticket"/><span>외형 소환권<b>{appearanceSummonTickets(game).toLocaleString()}장</b></span></div></div>
   <div className="tc-summon-actions"><button type="button" disabled={!available||busy||game.market.gold<onePayment.goldSpent} onClick={()=>{void summon(1);}}><strong>1회 소환</strong><small>{paymentLabel(onePayment)}</small></button><button type="button" disabled={!available||busy||game.market.gold<tenPayment.goldSpent} onClick={()=>{void summon(10);}}><strong>10회 소환</strong><small>{paymentLabel(tenPayment)}{tenPayment.goldSpent>0?' · '+APPEARANCE_SUMMON_TEN_DISCOUNT_PERCENT+'% 할인':''}</small></button></div>
   <p className="tc-summon-status" role="status">{status||(available?'C 60% · B 30% · A 8% · SR 1.8% · SSR 0.2%':'온라인 로그인 및 플레이 세션이 필요합니다.')}</p>
   <div className="tc-summon-utilities"><button type="button" onClick={()=>{void showHistory();}}><Glyph name="bestiary"/>소환 기록</button><button type="button" onClick={()=>setPanel('rates')}><Glyph name="search"/>확률 정보</button>{onCollection&&<button type="button" onClick={onCollection}><Glyph name="bestiary"/>컬렉션</button>}</div>
   </footer>
  </div>
  {panel&&<div className="tc-summon-modal-backdrop" role="presentation" onClick={()=>{if(!busy)setPanel(null);}}>
   <section ref={modal} tabIndex={-1} className={'tc-summon-modal'+(panel==='results'?' tc-summon-result-modal':'')} role="dialog" aria-modal="true" aria-labelledby="summon-modal-title" onClick={e=>e.stopPropagation()}>
    {panel!=='results'&&<header><h2 id="summon-modal-title">{panel==='history'?'소환 기록':'등급별 확률'}</h2><button type="button" aria-label="닫기" onClick={()=>setPanel(null)}>×</button></header>}
    {panel==='rates'&&<><p>1회 {APPEARANCE_SUMMON_GOLD_PRICE.single} G / 10회 {APPEARANCE_SUMMON_GOLD_PRICE.ten.toLocaleString('ko-KR')} G ({APPEARANCE_SUMMON_TEN_DISCOUNT_PERCENT}% 할인)</p><div className="tc-summon-rate-table">{APPEARANCE_SUMMON_RATES.map(rate=><div key={rate.rarity}><b>{rate.rarity}</b><span>{rate.basisPoints/100}%</span></div>)}</div><div className="tc-weekly-ssr-rate"><strong>이번 주 SSR 픽업: {featured?.name??'확인 중'}</strong>
     {featured?<><span>픽업 외형 개별 확률 {weeklyPickup?.pickupRatePercent}%</span><small>나머지 SSR {others}종은 각각 약 {others>0?((0.2-(weeklyPickup?.pickupRatePercent??0.1))/others).toFixed(6):'0'}%</small><small>다음 갱신: {weeklyPickup?.nextWeekStartKst} 00:00 (한국시간)</small></>:<small>서버에서 주간 픽업을 확인하고 있습니다.</small>}</div>
     <p>SSR 전체 등장 확률은 0.2%입니다. 픽업은 매주 월요일 00:00(한국시간) 변경됩니다. 각 소환마다 해당 외형 전용 조각 1개를 획득합니다. 해금 5개, 강화마다 10개, 최대 Lv.5입니다. 확정 지급과 천장은 없습니다.</p></>}
    {panel==='results'&&<AppearanceSummonResultView key={resultVersion} animateSSR={animateSSR} draws={draws} payment={lastPayment} repeatPayment={appearanceSummonPayment(draws.length===10?10:1,ownedTickets)} canRepeat={available&&game.market.gold>=appearanceSummonPayment(draws.length===10?10:1,ownedTickets).goldSpent} busy={busy} selectedAppearanceId={game.cosmetics.selectedAppearanceId} ownedAppearanceIds={game.cosmetics.unlockedAppearanceIds} expedition={!!game.expedition} onRepeat={()=>{void summon(draws.length===10?10:1);}} onClose={()=>setPanel(null)} onList={()=>{setPanel(null);onList();}} onEquip={onEquip} error={resultError}/>}

    {panel==='history'&&(!history.length?<p>저장된 소환 기록이 없습니다.</p>:<div className="tc-summon-history">{history.map((entry,index)=><div key={index}><small>{new Date(entry.at).toLocaleString('ko-KR')} · {resultPayment(entry.ticketsSpent,entry.goldSpent)}</small><p>{entry.draws.map(draw=>draw.rarity+' '+(names.get(draw.id)??draw.id)).join(' · ')}</p></div>)}</div>)}
    {panel!=='results'&&<button type="button" className="tc-action" onClick={()=>setPanel(null)}>닫기</button>}
   </section>
  </div>}
 </Screen>;
}
