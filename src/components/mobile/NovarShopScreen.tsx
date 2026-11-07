import React,{useEffect,useRef,useState} from 'react';
import type {GameState} from '../../game/types';
import {Screen} from '../../ui/mobile';
import {HubIcon} from './HubIcon';
import {assetUrl} from '../../game/data/graphics';
import {GOLD_SHOP_PACKAGES,formatKrw,getGoldPackageBySku} from '../../shop/catalog';
import './novar-shop.css';
import {getFreeAttendanceStatus,claimFreeAttendance,type FreeAttendanceStatus} from '../../online/freeAttendance';
import type {GameplayLease} from '../../online/gameSession';
import type {CloudSaveRecord} from '../../online/cloudSave';

type NovarShopTab='recommend'|'gold'|'package'|'attendance';
type NovarPackageId='starter'|'weekly'|'returning'|'attendance';
const NOVAR_PACKAGES=[
 {id:'starter',title:'신규 모험가 패키지',price:2900,condition:'계정당 1회',gold:1000,tickets:5,potions:2},
 {id:'weekly',title:'주간 원정 지원',price:1900,condition:'주 1회',gold:0,tickets:0,potions:5},
 {id:'returning',title:'복귀 모험가 패키지',price:5900,condition:'14일 이상 미접속 시',gold:2000,tickets:10,potions:3}
] as const;
const NOVAR_SHOP_TABS:readonly [NovarShopTab,string,string][]=[
 ['recommend','추천','quests'],['gold','골드','bank'],['package','패키지','inventory'],['attendance','출석','mail']
];
const SHOP_GOLD_ART='assets/ui/shop/gold_pixel_supply_chest.webp';
const SHOP_TICKET_ART='assets/ui/shop/appearance_summon_ticket_pixel.webp';
const SHOP_VITALITY_ART='assets/ui/shop/vitality_potion_pixel.webp';
const SHOP_SILVER_ART='assets/ui/shop/silver_pixel_supply_chest.webp';

/** Cash purchases remain preview-only; free daily attendance is server-validated. */
export function ShopScreen({game,userId=null,lease=null,onPrepare,onPending,onRecord}:{
 game:GameState;userId?:string|null;lease?:GameplayLease|null;
 onPrepare?:()=>Promise<void>;onPending?:(value:boolean)=>void;
 onRecord?:(record:CloudSaveRecord)=>void;
}){
 const [tab,setTab]=useState<NovarShopTab>('recommend');
 const [selectedSku,setSelectedSku]=useState<string|null>(null);
 const [selectedPackage,setSelectedPackage]=useState<NovarPackageId|null>(null);
 const [day,setDay]=useState(1);
 const [attendance,setAttendance]=useState<FreeAttendanceStatus|null>(null);
 const [attendanceLoading,setAttendanceLoading]=useState(false);
 const [attendanceBusy,setAttendanceBusy]=useState(false);
 const claimingRef=useRef(false);
 const syncedDayRef=useRef('');
 const [attendanceError,setAttendanceError]=useState('');
 const [attendanceNotice,setAttendanceNotice]=useState('');
 useEffect(()=>{
  let active=true;
  if(!userId||!lease){
   setAttendance(null);setAttendanceLoading(false);
   setAttendanceError('Google 로그인과 플레이 권한이 필요합니다.');
   return;
  }
  setAttendanceLoading(true);setAttendanceError('');
  const refresh=async()=>{
   if(claimingRef.current)return;
   try{
    const next=await getFreeAttendanceStatus(lease,userId);
    if(!active)return;
    const currentCycle=next.cycleNumber+':'+next.todayKst;
    if(syncedDayRef.current!==currentCycle){syncedDayRef.current=currentCycle;setDay(next.currentDay);}
    setAttendance(next);
    setAttendanceError('');
   }catch(error){
    if(active)setAttendanceError(error instanceof Error?error.message:'출석 현황을 확인하지 못했습니다.');
   }finally{if(active)setAttendanceLoading(false);}
  };
  void refresh();
  const onFocus=()=>{if(!document.hidden)void refresh();};
  window.addEventListener('focus',onFocus);
  document.addEventListener('visibilitychange',onFocus);
  const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},60_000);
  return()=>{active=false;window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onFocus);window.clearInterval(timer);};
 },[userId,lease?.leaseId,lease?.generation]);
 const claimToday=async()=>{
  if(!lease||!userId||attendanceBusy||attendance?.todayClaimed)return;
  claimingRef.current=true;setAttendanceBusy(true);setAttendanceNotice('');setAttendanceError('');
  let pending=false;
  try{
   await onPrepare?.();
   onPending?.(true);pending=true;
   const result=await claimFreeAttendance(lease,userId);
   onRecord?.(result.record);
   setAttendance(result.status);setDay(result.status.currentDay);
   setAttendanceNotice(result.alreadyClaimed
    ? '오늘 무료 보상은 이미 수령했습니다.'
    : '실버 3,000'+(result.reward.tickets>0?' · 소환권 '+result.reward.tickets+'장':'')+' 지급 완료');
  }catch(error){
   setAttendanceError(error instanceof Error?error.message:'무료 출석 보상을 수령하지 못했습니다.');
   // A lost response may follow a successful database commit: refresh the receipt state.
   try{if(lease&&userId)setAttendance(await getFreeAttendanceStatus(lease,userId));}catch{}
  }finally{
   if(pending)onPending?.(false);
   claimingRef.current=false;setAttendanceBusy(false);
  }
 };
 const selected=selectedSku?getGoldPackageBySku(selectedSku):null;
 const packageInfo=NOVAR_PACKAGES.find(p=>p.id===selectedPackage);
 const modal=!!selected||!!selectedPackage;
 const closeModal=()=>{setSelectedSku(null);setSelectedPackage(null);};
 const milestones=day%5===0;
 const bonusPotion=day===7||day===14||day===21||day===28;
 const previewPackage=(id:NovarPackageId)=>{setSelectedSku(null);setSelectedPackage(id);};
 return <Screen eyebrow="NOVAR SUPPLY" title="상점" className="tc-novar-shop-screen" meta={<span>{game.market.gold.toLocaleString('ko-KR')} G</span>}>
  <div className="tc-novar-shop">
   <nav className="tc-novar-shop-tabs" aria-label="상점 카테고리">
    {NOVAR_SHOP_TABS.map(([id,label,icon])=><button type="button" key={id} className={tab===id?'is-active':''} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>
     <HubIcon name={icon}/><span>{label}</span>
    </button>)}
   </nav>
   <div className="tc-novar-shop-view">
    {tab==='recommend'&&<section className="tc-novar-recommend" aria-label="추천 상품">
     <button type="button" className="tc-novar-feature" onClick={()=>setTab('attendance')}>
      <span className="tc-novar-feature-copy"><small>30 DAYS · NOVAR REWARDS</small><strong>30일 출석 보상</strong><span>무료 실버 · 외형 소환권</span><em>무료 보상 확인  ›</em></span>
      <span className="tc-novar-feature-art"><img src={assetUrl(SHOP_GOLD_ART)} alt=""/><img src={assetUrl(SHOP_TICKET_ART)} alt=""/></span>
     </button>
     <div className="tc-novar-recommend-label"><b>모험가를 위한 특별 보급</b><span>현금 패키지</span></div>
     <div className="tc-novar-recommend-products">
      {NOVAR_PACKAGES.map((p,i)=><button type="button" className="tc-novar-recommend-product" key={p.id} onClick={()=>previewPackage(p.id)}>
       <img src={assetUrl(i===1?SHOP_VITALITY_ART:i===2?SHOP_GOLD_ART:SHOP_TICKET_ART)} alt=""/>
       <span>{p.title}</span><b>{formatKrw(p.price)}</b>
      </button>)}
     </div>
     <button type="button" className="tc-novar-gold-promo" onClick={()=>setTab('gold')}>
      <img src={assetUrl(SHOP_GOLD_ART)} alt=""/><span><b>골드 충전</b><small>원하는 수량을 선택하세요</small></span><strong>전체 보기 ›</strong>
     </button>
    </section>}
    {tab==='gold'&&<section className="tc-novar-gold-pane" aria-label="골드 충전 상품">
     <div className="tc-novar-section-line"><strong>골드 보급</strong><small>현금 충전 · 6종</small></div>
     <div className="tc-shop-grid" aria-label="Gold 충전 상품">
      {GOLD_SHOP_PACKAGES.map((item,index)=><button type="button" className="tc-shop-card tc-feel-press" data-game-feel="press" key={item.sku} onClick={()=>setSelectedSku(item.sku)}>
       <img className="tc-novar-coin-art" src={assetUrl(index<2?SHOP_GOLD_ART:index<4?SHOP_SILVER_ART:SHOP_GOLD_ART)} alt=""/>
       <span className="tc-shop-amount"><b>{item.gold.toLocaleString('ko-KR')}</b><small>GOLD</small></span>
       <strong>{formatKrw(item.priceKrw)}</strong>
      </button>)}
     </div>
     <p className="tc-novar-shop-disclaimer">Google Play 결제 연동 후 구매가 활성화됩니다.</p>
    </section>}
    {tab==='package'&&<section className="tc-novar-package-pane" aria-label="현금 패키지">
     <div className="tc-novar-section-line"><strong>특별 보급 패키지</strong><small>기간·계정별 구매 제한</small></div>
     <div className="tc-novar-package-list">
      {NOVAR_PACKAGES.map((p,i)=><article className="tc-novar-package-card" key={p.id}>
       <div className="tc-novar-package-art"><img src={assetUrl(i===1?SHOP_VITALITY_ART:i===2?SHOP_GOLD_ART:SHOP_TICKET_ART)} alt=""/></div>
       <div className="tc-novar-package-info">
        <strong>{p.title}</strong>
        <small>{p.condition}</small>
        <div className="tc-novar-package-rewards">
         {p.gold>0&&<span><img src={assetUrl(SHOP_GOLD_ART)} alt=""/> {p.gold.toLocaleString()}G</span>}
         {p.tickets>0&&<span><img src={assetUrl(SHOP_TICKET_ART)} alt=""/> ×{p.tickets}</span>}
         <span><img src={assetUrl(SHOP_VITALITY_ART)} alt=""/> ×{p.potions}</span>
        </div>
       </div>
       <button type="button" className="tc-novar-buy" onClick={()=>previewPackage(p.id)}>{formatKrw(p.price)}</button>
      </article>)}
     </div>
     <button type="button" className="tc-novar-passage" onClick={()=>setTab('attendance')}>30일 출석 패스 <span>추가 보상 보기 ›</span></button>
    </section>}
    {tab==='attendance'&&<section className="tc-novar-attendance-pane" aria-label="30일 출석 보상">
     <div className="tc-novar-section-line"><strong>30일 출석 보상</strong><small>{attendance?'오늘 '+attendance.currentDay+'일 차':'한국 시간 00:00 기준'}</small></div>
     <div className="tc-novar-attendance-totals">
      <div><b>무료 보상</b><span>90,000 S</span><small>외형 소환권 30장</small></div>
      <div className="is-paid"><b>유료 추가 보상</b><span>600 G</span><small>외형 소환권 60장 · 포션 4개</small></div>
     </div>
     <div className="tc-novar-attendance-days" role="group" aria-label="날짜별 출석 보상">
      {Array.from({length:30},(_,index)=>index+1).map(n=><button type="button" key={n} onClick={()=>setDay(n)} className={(day===n?'is-selected ':'')+(n%5===0?'is-milestone ':'')+(attendance?.claimedDays.includes(n)?'is-claimed ':'')+(n===attendance?.currentDay?'is-today':'')} aria-pressed={day===n}>
       <small>{n}일</small><img src={assetUrl(n%5===0?SHOP_TICKET_ART:SHOP_SILVER_ART)} alt=""/>
      </button>)}
     </div>
     <div className="tc-novar-day-reward" aria-live="polite">
      <strong>{day}일 차 보상</strong>
      <span>무료: 실버 3,000{milestones?' · 소환권 5장':''}{attendance?.claimedDays.includes(day)?' · 수령 완료':''}</span>
      <span>유료 추가(준비 중): 골드 20 · 소환권 2장{bonusPotion?' · 활력 포션 1개':''}</span>
      {(attendanceNotice||attendanceError||attendanceLoading)&&<small role="status" className={attendanceError?'is-error':''}>{attendanceError||attendanceNotice||(attendanceLoading?'출석 기록을 불러오는 중...':'')}</small>}
     </div>
     <div className="tc-novar-attendance-actions">
      <button type="button" className="tc-novar-attendance-claim" onClick={()=>void claimToday()} disabled={!userId||!lease||!attendance||attendance.todayClaimed||attendanceBusy}>
       {attendanceBusy?'수령 중...':attendance?.todayClaimed?'오늘 수령 완료':!userId||!lease?'로그인 후 수령':attendanceLoading?'불러오는 중...':'오늘 무료 받기'}
      </button>
      <button type="button" className="tc-novar-attendance-buy" onClick={()=>previewPackage('attendance')}><span>유료 패스</span><strong>4,900원 ›</strong></button>
     </div>
    </section>}
   </div>
  </div>
  {modal&&<div className="tc-modalback tc-shop-confirm" role="presentation" onClick={closeModal}>
   <section className="tc-modal tc-novar-shop-modal" role="dialog" aria-modal="true" aria-label="상품 상세 확인" onClick={e=>e.stopPropagation()}>
    <div className="tc-novar-shop-modal-title">
     <img src={assetUrl(selected?SHOP_GOLD_ART:selectedPackage==='weekly'?SHOP_VITALITY_ART:SHOP_TICKET_ART)} alt=""/>
     <div><small>{selected?'GOLD REQUISITION':'NOVAR SUPPLY PACKAGE'}</small><h2>{selected?selected.gold.toLocaleString('ko-KR')+' Gold':selectedPackage==='attendance'?'30일 출석 패스':packageInfo?.title}</h2></div>
    </div>
    <div className="tc-shop-confirm-price"><span>결제 금액</span><b>{formatKrw(selected?selected.priceKrw:selectedPackage==='attendance'?4900:packageInfo?.price??0)}</b></div>
    <p>{selected?'앱에서 Google Play 결제 연동 후 서버 검증을 거쳐 골드가 지급됩니다.':selectedPackage==='attendance'?'모든 이용자는 무료 출석 보상에 참여할 수 있습니다. 유료 패스 구매 시 30일간 추가 보상이 제공됩니다.':'구성품과 가격은 기획안입니다. 실제 구매 및 서버 지급 기능은 아직 제공되지 않습니다.'}</p>
    <p>현재 결제와 출석 보상 수령 기능은 준비 중이며, 이 화면에서 재화나 아이템이 지급되지 않습니다.</p>
    <div className="tc-modal-actions"><button type="button" className="tc-action secondary" onClick={closeModal}>닫기</button><button type="button" className="tc-action" disabled>결제 준비중</button></div>
   </section>
  </div>}
 </Screen>;
}

