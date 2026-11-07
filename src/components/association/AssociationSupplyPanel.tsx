import {GuildTask} from './GuildTask';
import {GameSelect} from '../../ui/GameSelect';
import React,{useEffect,useRef,useState} from 'react';
import {Glyph,Segments} from '../../ui/mobile';
import type {GameplayLease} from '../../online/gameSession';
import type {CloudSaveRecord} from '../../online/cloudSave';
import {donateToAssociation,loadAssociationProgression,type AssociationProgression} from '../../online/associationProgression';
import {buyOnlineAssociationShopItem,loadOnlineAssociationShop,type OnlineAssociationShopState,type OnlineAssociationShopItem,type AssociationShopReset} from '../../online/associationShop';
import {associationDonationGain,associationLevelProgress} from '../../game/association/growthRules';
import {pendingGrowthRequest,completeGrowthRequest} from '../../online/associationPendingRequests';
import './supply.css';

export type ShopFilter='ALL'|'DAILY'|'WEEKLY'|'CURRENCY';
const SHOP_FILTERS:readonly (readonly [ShopFilter,string])[]=[['ALL','전체'],['DAILY','일일'],['WEEKLY','주간'],['CURRENCY','재화']];
const isCurrencyProduct=(item:OnlineAssociationShopItem)=>item.itemId==='silver_box_daily'||item.itemId==='gold_box_weekly';
const shopProductIcon=(id:string)=>id.startsWith('enhancement_stone')?'materials':(id.startsWith('greater_potion')||id.startsWith('vitality_potion'))?'potions':id.startsWith('job_draw_ticket')?'tickets':id==='rare_equipment_weekly'?'inventory':'market';

/** Visible catalogue reflects the current server-managed products, not a locally seeded inventory. */
export function AssociationShopCatalog({shop,filter,busy,expedition,onBuy}:{shop:OnlineAssociationShopState;filter:ShopFilter;busy:boolean;expedition:boolean;onBuy:(id:string)=>void}){
 const sections=[
  {id:'DAILY' as const,label:'일일 보급',reset:'매일 00:00 초기화 · 한국 시간',items:shop.daily},
  {id:'WEEKLY' as const,label:'주간 보급',reset:'월요일 00:00 초기화 · 한국 시간',items:shop.weekly},
 ].filter(section=>filter==='ALL'||filter==='CURRENCY'||section.id===filter)
  .map(section=>({...section,items:filter==='CURRENCY'?section.items.filter(isCurrencyProduct):section.items}));
 return <div className="tc-supply-v3-catalog" aria-label="원정단 보급품 목록">
  {sections.filter(section=>section.items.length).map(section=><section className="tc-supply-v3-section" key={section.id} aria-label={section.label}>
   <div className="tc-supply-v3-section-heading"><strong>{section.label} <small>{section.items.length}종</small></strong><span>{section.reset}</span></div>
   <div className="tc-supply-v3-grid">
    {section.items.map(item=>{
     const locked=shop.level<item.requiredLevel;
     const sold=item.purchased>=item.purchaseLimit;
     const insufficient=shop.contribution<item.contributionCost;
     return <article className={'tc-supply-v3-item'+(locked?' is-locked':'')} key={item.itemId} data-shop-item-id={item.itemId}>
      <span className="tc-supply-v3-item-icon"><Glyph name={shopProductIcon(item.itemId)}/></span>
      <div className="tc-supply-v3-item-body">
       <b title={item.name}>{item.name}</b>
       <small className="tc-supply-v3-description" title={item.description}>{item.description}</small>
       <div className="tc-supply-v3-item-facts"><span className="tc-supply-v3-price" aria-label={'공헌도 '+item.contributionCost.toLocaleString()}><i aria-hidden="true">◇</i>{item.contributionCost.toLocaleString()}</span><span className="tc-supply-v3-limit">{item.purchased}/{item.purchaseLimit}회</span></div>
      </div>
      <button type="button" className="tc-supply-v3-buy tc-feel-press" aria-label={item.name+' 구매'} disabled={busy||expedition||locked||sold||insufficient} onClick={()=>onBuy(item.itemId)}>{locked?'Lv.'+item.requiredLevel+' 해금':sold?'구매 완료':'구매'}</button>
     </article>;
    })}
   </div>
  </section>)}
  {!sections.some(section=>section.items.length)&&<p className="tc-supply-v3-empty">이 분류에 등록된 보급품이 없습니다.</p>}
 </div>;
}


export function AssociationSupplyPanel({lease,mode,expedition,silver,gold,refreshKey,onRecord,onChanged}:{
 lease:GameplayLease;mode:'growth'|'shop';expedition:boolean;silver:number;gold:number;
 refreshKey?:number;
 onRecord:(record:CloudSaveRecord,message:string)=>void;onChanged:()=>void;
}){
 const [progress,setProgress]=useState<AssociationProgression|null>(null);
 const [shop,setShop]=useState<OnlineAssociationShopState|null>(null);
 const [shopFilter,setShopFilter]=useState<ShopFilter>('ALL');
 const [currency,setCurrency]=useState<'silver'|'gold'|'ticket'>('silver'),[amount,setAmount]=useState(10000);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState('');
 const running=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  let disposed=false,timer:ReturnType<typeof setTimeout>;
  const refresh=async()=>{
   try{
    if(mode==='growth'){
     const next=await loadAssociationProgression(lease);if(disposed)return;setProgress(next);
     timer=setTimeout(()=>void refresh(),Math.max(1000,Date.parse(next.dailyResetAt)-Date.now()+100));
    }else{
     const next=await loadOnlineAssociationShop(lease);if(disposed)return;setShop(next);
     timer=setTimeout(()=>void refresh(),Math.max(1000,Date.parse(next.dailyResetAt)-Date.now()+100));
    }
   }catch(e){if(!disposed)setMessage(e instanceof Error?e.message:'정보를 불러오지 못했습니다.');}
   finally{if(!disposed)setLoading(false);}
  };
  const focus=()=>{if(document.visibilityState==='visible'){clearTimeout(timer);void refresh();}};
  void refresh();document.addEventListener('visibilitychange',focus);
  return()=>{disposed=true;clearTimeout(timer);document.removeEventListener('visibilitychange',focus);};
 },[lease.leaseId,lease.generation,mode,refreshKey]);

 async function mutate(key:string,fn:(id:string)=>Promise<void>){
  if(running.current)return;
  running.current=true;setBusy(true);setMessage('');
  const requestKey=lease.leaseId+':'+mode+':'+key;
  try{const id=pendingGrowthRequest(requestKey);await fn(id);completeGrowthRequest(requestKey);}
  catch(e){if(mounted.current)setMessage(e instanceof Error?e.message:'요청에 실패했습니다.');}
  finally{running.current=false;if(mounted.current)setBusy(false);}
 }
 const donate=()=>mutate(currency+':'+amount,async id=>{
  const next=await donateToAssociation(lease,{currency,amount},id);
  onRecord(next.record,'원정단 기부를 반영했습니다.');onChanged();
  if(mounted.current){setProgress(next.progression);setMessage('기부 완료 · 공용 금고 적립 · 경험치와 공헌도를 획득했습니다.');}
 });
 const buy=(itemId:string)=>mutate(itemId,async id=>{
  const next=await buyOnlineAssociationShopItem(lease,itemId,id);
  onRecord(next.record,next.reward.name+' 지급 완료');onChanged();
  if(mounted.current){setShop(next.state);setMessage(next.reward.name+' 지급 완료');}
 });
 const refresh=async()=>{try{if(mode==='growth')setProgress(await loadAssociationProgression(lease));else setShop(await loadOnlineAssociationShop(lease));setMessage('');}catch(e){setMessage(e instanceof Error?e.message:'정보를 불러오지 못했습니다.');}};
 if(loading||!(mode==='growth'?progress:shop))return <section className="tc-supply"><p role="status">{message||'보급 정보를 불러오는 중입니다.'}</p><button disabled={busy} onClick={()=>void refresh()}>다시 확인</button></section>;
 if(mode==='growth'&&progress){
  const level=associationLevelProgress(progress.associationExp),used=currency==='silver'?progress.dailySilverDonation:currency==='gold'?progress.dailyGoldDonation:progress.dailyTicketDonation;
  const limit=currency==='silver'?progress.dailySilverLimit:currency==='gold'?progress.dailyGoldLimit:progress.dailyTicketLimit,balance=currency==='silver'?silver:currency==='gold'?gold:progress.personalTickets;
  return <section className="tc-supply tc-supply-growth">
   <header><b>원정단 성장 <strong>Lv.{progress.associationLevel}</strong></b><span>공헌도 <b>{progress.contributionPoint.toLocaleString()}</b></span></header>
   <div className="tc-supply-exp" role="progressbar" aria-label="원정단 경험치" aria-valuenow={Math.round(level.percent)} aria-valuemin={0} aria-valuemax={100}><i style={{width:level.percent+'%'}}/></div>
   <small>{progress.associationExp.toLocaleString()} / {level.nextExp.toLocaleString()} EXP {level.level===10?'· 최고 레벨':''}</small>
   <GuildTask title="원정단에 기부하기" feedback={message}><div className="tc-supply-donation-fold">
   <Segments items={[['silver','실버 기부'],['gold','골드 기부'],['ticket','도전권 기부']] as const} value={currency} onChange={c=>{setCurrency(c);setAmount(c==='silver'?10000:c==='gold'?100:10);}} label="기부 재화"/>
   <div className="tc-supply-donate"><label>기부량<GameSelect disabled={busy||expedition} value={amount} onChange={e=>setAmount(Number(e.target.value))}>{(currency==='silver'?[10000,20000,30000,40000,50000]:currency==='gold'?[100,200,500,1000]:[1,5,10,25,50,100]).map(n=><option key={n} value={n}>{n.toLocaleString()} {currency==='silver'?'Silver':currency==='gold'?'Gold':'장'}</option>)}</GameSelect></label><button disabled={busy||expedition||amount+used>limit||balance<amount} onClick={()=>void donate()}>기부 · +{associationDonationGain(currency,amount)}</button></div>
   <small>오늘 {used.toLocaleString()} / {limit.toLocaleString()} · 공용 금고 적립 · 경험치·공헌도 각각 +{associationDonationGain(currency,amount)}</small>
   <small>매일 00:00 초기화 (한국 시간){expedition?' · 안전 귀환 후 이용':''}</small>
   </div></GuildTask>
   {message&&<p role="status">{message}</p>}
  </section>;
 }
 if(!shop)return null;
 return <section className="tc-supply tc-supply-shop tc-supply-shop-v3">
  <header className="tc-supply-v3-head">
   <b>원정단 상점 <small>Lv.{shop.level}</small></b>
   <div className="tc-supply-v3-balance"><span>공헌도 <b>{shop.contribution.toLocaleString()}</b></span><button type="button" className="tc-supply-v3-refresh" disabled={busy} onClick={()=>void refresh()} aria-label="잔액·구매 현황 새로고침">↻</button></div>
  </header>
  <div className="tc-supply-v3-filters" role="group" aria-label="원정단 상점 품목 필터">
   {SHOP_FILTERS.map(([id,label])=><button type="button" key={id} className={shopFilter===id?'active':''} aria-pressed={shopFilter===id} onClick={()=>setShopFilter(id)}>{label}</button>)}
  </div>
  <AssociationShopCatalog shop={shop} filter={shopFilter} busy={busy} expedition={expedition} onBuy={id=>void buy(id)}/>
  {expedition&&<small className="tc-supply-v3-notice">안전 귀환 후 구매할 수 있습니다.</small>}
  {message&&<p role="status" className="tc-supply-v3-message">{message}</p>}
 </section>;
}
