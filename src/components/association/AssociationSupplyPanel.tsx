import React,{useEffect,useRef,useState} from 'react';
import {Pager,Segments} from '../../ui/mobile';
import type {GameplayLease} from '../../online/gameSession';
import type {CloudSaveRecord} from '../../online/cloudSave';
import {donateToAssociation,loadAssociationProgression,type AssociationProgression} from '../../online/associationProgression';
import {buyOnlineAssociationShopItem,loadOnlineAssociationShop,type OnlineAssociationShopState,type AssociationShopReset} from '../../online/associationShop';
import {associationDonationGain,associationLevelProgress} from '../../game/association/growthRules';
import {pendingGrowthRequest,completeGrowthRequest} from '../../online/associationPendingRequests';
import './supply.css';

export function AssociationSupplyPanel({lease,mode,expedition,silver,gold,refreshKey,onRecord,onChanged}:{
 lease:GameplayLease;mode:'growth'|'shop';expedition:boolean;silver:number;gold:number;
 refreshKey?:number;
 onRecord:(record:CloudSaveRecord,message:string)=>void;onChanged:()=>void;
}){
 const [progress,setProgress]=useState<AssociationProgression|null>(null);
 const [shop,setShop]=useState<OnlineAssociationShopState|null>(null);
 const [period,setPeriod]=useState<AssociationShopReset>('DAILY'),[page,setPage]=useState(0);
 const [currency,setCurrency]=useState<'silver'|'gold'>('silver'),[amount,setAmount]=useState(10000);
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
  if(mounted.current){setProgress(next.progression);setMessage('기부 완료 · 경험치와 공헌도를 획득했습니다.');}
 });
 const buy=(itemId:string)=>mutate(itemId,async id=>{
  const next=await buyOnlineAssociationShopItem(lease,itemId,id);
  onRecord(next.record,next.reward.name+' 지급 완료');onChanged();
  if(mounted.current){setShop(next.state);setMessage(next.reward.name+' 지급 완료');}
 });
 const refresh=async()=>{try{if(mode==='growth')setProgress(await loadAssociationProgression(lease));else setShop(await loadOnlineAssociationShop(lease));setMessage('');}catch(e){setMessage(e instanceof Error?e.message:'정보를 불러오지 못했습니다.');}};
 if(loading||!(mode==='growth'?progress:shop))return <section className="tc-supply"><p role="status">{message||'보급 정보를 불러오는 중입니다.'}</p><button disabled={busy} onClick={()=>void refresh()}>다시 확인</button></section>;
 if(mode==='growth'&&progress){
  const level=associationLevelProgress(progress.associationExp),used=currency==='silver'?progress.dailySilverDonation:progress.dailyGoldDonation;
  const limit=currency==='silver'?progress.dailySilverLimit:progress.dailyGoldLimit,balance=currency==='silver'?silver:gold;
  return <section className="tc-supply tc-supply-growth">
   <header><b>원정단 성장 <strong>Lv.{progress.associationLevel}</strong></b><span>공헌도 <b>{progress.contributionPoint.toLocaleString()}</b></span></header>
   <div className="tc-supply-exp" role="progressbar" aria-label="원정단 경험치" aria-valuenow={Math.round(level.percent)} aria-valuemin={0} aria-valuemax={100}><i style={{width:level.percent+'%'}}/></div>
   <small>{progress.associationExp.toLocaleString()} / {level.nextExp.toLocaleString()} EXP {level.level===10?'· 최고 레벨':''}</small>
   <details className="tc-supply-donation-fold"><summary>원정단에 기부하기 <span>실버·골드</span></summary>
   <Segments items={[['silver','실버 기부'],['gold','골드 기부']] as const} value={currency} onChange={c=>{setCurrency(c);setAmount(c==='silver'?10000:100);}} label="기부 재화"/>
   <div className="tc-supply-donate"><label>기부량<select disabled={busy||expedition} value={amount} onChange={e=>setAmount(Number(e.target.value))}>{(currency==='silver'?[10000,20000,30000,40000,50000]:[100,200,500,1000]).map(n=><option key={n} value={n}>{n.toLocaleString()} {currency==='silver'?'Silver':'Gold'}</option>)}</select></label><button disabled={busy||expedition||amount+used>limit||balance<amount} onClick={()=>void donate()}>기부 · +{associationDonationGain(currency,amount)}</button></div>
   <small>오늘 {used.toLocaleString()} / {limit.toLocaleString()} · 경험치·공헌도 각각 +{associationDonationGain(currency,amount)}</small>
   <small>매일 00:00 초기화 (한국 시간){expedition?' · 안전 귀환 후 이용':''}</small>
   </details>
   {message&&<p role="status">{message}</p>}
  </section>;
 }
 if(!shop)return null;
 const items=period==='DAILY'?shop.daily:shop.weekly,pages=Math.max(1,Math.ceil(items.length/3)),safe=Math.min(page,pages-1);
 return <section className="tc-supply tc-supply-shop">
  <header><b>원정단 보급소 <small>Lv.{shop.level}</small></b><span>공헌도 <b>{shop.contribution.toLocaleString()}</b></span></header>
  <Segments items={[['DAILY','일일 보급'],['WEEKLY','주간 보급']] as const} value={period} onChange={p=>{setPeriod(p);setPage(0);}} label="보급 기간"/>
  <small>{period==='DAILY'?'매일':'매주 월요일'} 00:00 초기화 · 한국 시간</small>
  <div className="tc-supply-products">{items.slice(safe*3,safe*3+3).map(item=>{
   const locked=shop.level<item.requiredLevel,sold=item.purchased>=item.purchaseLimit;
   return <article key={item.itemId}><div><b>{item.name}</b><small>{item.description}</small><small>{item.contributionCost.toLocaleString()} 공헌도 · {item.purchased}/{item.purchaseLimit}회 구매</small></div><button disabled={busy||expedition||locked||sold||shop.contribution<item.contributionCost} onClick={()=>void buy(item.itemId)}>{locked?'Lv.'+item.requiredLevel+' 해금':sold?'구매 완료':'구매'}</button></article>;
  })}</div>
  <Pager page={safe} count={pages} onChange={setPage}/>
  {expedition&&<small>안전 귀환 후 구매할 수 있습니다.</small>}
  <p role="status">{message}</p>
  <button className="tc-supply-refresh" disabled={busy} onClick={()=>void refresh()}>잔액·구매 현황 새로고침</button>
 </section>;
}
