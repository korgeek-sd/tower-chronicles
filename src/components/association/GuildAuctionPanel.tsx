import React,{useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import type {CloudSaveRecord} from '../../online/cloudSave';
import {equipmentItemName,EQUIPMENT_GRADE_NAMES,equipmentItemStats} from '../../game/data/equipment';
import {GameScrollSelect} from '../../ui/GameScrollSelect';
import {getGuildAuctionState,bidGuildAuction,claimGuildBossReward,claimGuildAuctionItem,registerGuildAuctionItem,recoverGuildAuctionItem,relistGuildBossAuctionItem,type GuildAuctionState,type GuildAuctionListing} from '../../online/guildAuction';
import './guildAuction.css';

const n=(v:number)=>Math.max(0,Math.trunc(v)).toLocaleString('ko-KR');
const left=(until:string,clock:number)=>{
 const secs=Math.max(0,Math.ceil((Date.parse(until)-clock)/1000));
 const d=Math.floor(secs/86400),h=Math.floor(secs%86400/3600),m=Math.floor(secs%3600/60);
 return d?d+'일 '+h+'시간':h+'시간 '+m+'분';
};
const describe=(item:GuildAuctionListing)=>{
 const stat=equipmentItemStats(item.gear);
 return Object.entries(stat).filter(([key,val])=>!!val&&['hp','attack','defense'].includes(key)).map(([key,value])=>({hp:'HP',attack:'공격력',defense:'방어력'}[key]??key)+' +'+value).join(' · ');
};
type PendingBid={id:string;amount:number};
export function GuildAuctionPanel({lease,associationId,expedition,onRecord,onChanged}:{lease:GameplayLease;associationId:string;expedition:boolean;onRecord:(record:CloudSaveRecord,message:string)=>void;onChanged:()=>void}){
 const [state,setState]=useState<GuildAuctionState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [amounts,setAmounts]=useState<Record<string,number>>({}),[clock,setClock]=useState(Date.now());
 const [selectedGear,setSelectedGear]=useState(''),[startPrice,setStartPrice]=useState('1000');
 const [relistPrices,setRelistPrices]=useState<Record<string,string>>({});
 const [pendingRegistration,setPendingRegistration]=useState<{requestId:string;itemId:string;bid:number}|null>(null);
 const mounted=useRef(true),locking=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  try{const raw=window.sessionStorage.getItem('tc-guild-auction-register:'+associationId);
   setPendingRegistration(raw?JSON.parse(raw) as {requestId:string;itemId:string;bid:number}:null);
  }catch{setPendingRegistration(null);}
 },[associationId]);
 const refresh=async()=>{
  try{const next=await getGuildAuctionState(lease);if(mounted.current){setState(next);setError('');}}
  catch(e){if(mounted.current)setError(e instanceof Error?e.message:'경매 정보를 불러오지 못했습니다.');}
 };
 useEffect(()=>{
  let active=true;
  void getGuildAuctionState(lease).then(s=>{if(active)setState(s);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'경매 정보를 불러오지 못했습니다.');});
  const timer=window.setInterval(()=>{setClock(Date.now());if(!locking.current&&!document.hidden)void getGuildAuctionState(lease).then(s=>{if(active)setState(s);}).catch(()=>{});},15000);
  const focus=()=>{if(active&&!locking.current)void getGuildAuctionState(lease).then(s=>{if(active)setState(s);}).catch(()=>{});};
  window.addEventListener('focus',focus);
  return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',focus);};
 },[lease.leaseId,lease.generation,associationId]);
 const mutate=async(fn:()=>Promise<void>)=>{
  if(locking.current)return;
  locking.current=true;setBusy(true);setError('');setNotice('');
  try{await fn();}catch(e){if(mounted.current)setError(e instanceof Error?e.message:'요청 처리에 실패했습니다.');}
  finally{locking.current=false;if(mounted.current)setBusy(false);}
 };
 const claimReward=(id:string)=>void mutate(async()=>{
  const r=await claimGuildBossReward(lease,id);
  if(!mounted.current)return;
  setState(r.state);onRecord(r.record,'보스 참여 보상을 지급했습니다.');onChanged();
  setNotice(r.replayed?'이미 지급된 참여 보상입니다.':'참여 보상을 받았습니다. 공헌도와 재화가 지급됐습니다.');
 });
 const claimEquipment=(id:string)=>void mutate(async()=>{
  const r=await claimGuildAuctionItem(lease,id);
  if(!mounted.current)return;
  setState(r.state);onRecord(r.record,'길드 경매 낙찰 장비가 보관함에 지급됐습니다.');onChanged();
  setNotice(r.replayed?'이미 수령한 낙찰 장비입니다.':'낙찰 장비를 보관함에 지급했습니다.');
 });
 const bid=(l:GuildAuctionListing)=>{
  const target=amounts[l.listingId]??l.nextBid;
  const key='tc-guild-auction-bid:'+associationId+':'+l.listingId;
  void mutate(async()=>{
   let pending:PendingBid|null=null;
   try{const raw=window.sessionStorage.getItem(key);pending=raw?JSON.parse(raw) as PendingBid:null;}catch{}
   if(!pending){pending={id:crypto.randomUUID(),amount:target};window.sessionStorage.setItem(key,JSON.stringify(pending));}
   const r=await bidGuildAuction(lease,l.listingId,pending.amount,pending.id);
   window.sessionStorage.removeItem(key);
   if(!mounted.current)return;
   setState(r.state);setAmounts(old=>({...old,[l.listingId]:0}));
   setNotice('공헌도 '+n(pending.amount)+'P 입찰 완료. 최고 입찰자가 바뀌면 기존 보류 공헌도는 반환됩니다.');
  });
 };
 const register=()=>void mutate(async()=>{
  const key='tc-guild-auction-register:'+associationId;
  const itemId=pendingRegistration?.itemId??selectedGear;
  const bid=pendingRegistration?.bid??Number(startPrice);
  if(!itemId||!Number.isSafeInteger(bid)||bid<1||bid>1000000000)return;
  const request=pendingRegistration??{requestId:crypto.randomUUID(),itemId,bid};
  if(!pendingRegistration)window.sessionStorage.setItem(key,JSON.stringify(request));
  setPendingRegistration(request);
  const r=await registerGuildAuctionItem(lease,request.requestId,request.itemId,request.bid);
  window.sessionStorage.removeItem(key);setPendingRegistration(null);
  if(!mounted.current)return;
  setState(r.state);setSelectedGear('');onRecord(r.record,'장비를 원정단 경매에 등록했습니다.');onChanged();
  setNotice(r.replayed?'기존 등록 요청을 확인했습니다.':'장비 등록 완료 · 보관함에서 이동하여 24시간 경매가 시작됐습니다.');
 });
 const recover=(item:GuildAuctionListing)=>void mutate(async()=>{
  const r=await recoverGuildAuctionItem(lease,item.listingId);
  if(!mounted.current)return;
  setState(r.state);onRecord(r.record,item.canCancel?'경매를 취소하고 장비를 반환했습니다.':'유찰 장비를 보관함에 반환했습니다.');onChanged();
  setNotice(r.replayed?'이미 반환한 장비입니다.':item.canCancel?'경매 취소 완료 · 장비 반환':'유찰 장비 반환 완료');
 });
 const relist=(item:GuildAuctionListing)=>void mutate(async()=>{
  const bid=Number(relistPrices[item.listingId]??item.startingBid);
  if(!Number.isSafeInteger(bid)||bid<1||bid>1000000000)return;
  const r=await relistGuildBossAuctionItem(lease,item.listingId,bid);
  if(!mounted.current)return;
  setState(r.state);setNotice('보스 전리품이 24시간 경매에 다시 등록됐습니다.');
 });
 const records=state?.listings??[];
 const winners=records.filter(x=>x.status==='SOLD'&&x.isMyTopBid);
 return <section className="tc-guild-auction" aria-label="원정단 경매장">
  <div className="tc-ga-heading"><div><small>GUILD AUCTION</small><h2>원정단 경매장</h2></div><div><small>사용 가능한 공헌도</small><strong>{state?n(state.points):'—'} P</strong></div></div>
  <p className="tc-ga-description">보스 전리품과 길드장이 직접 등록한 장비를 공헌도로 입찰합니다. 입찰 금액은 보류되고 상위 입찰자가 나오면 반환됩니다. 종료 시각은 서버 기준으로 확정되며, 경매 기간은 등록 후 24시간입니다.</p>
  {!state?<div role="status">{error||'경매 정보를 불러오는 중입니다.'}</div>:<>
   {state.isLeader&&<section className="tc-ga-register" aria-label="길드장 장비 경매 등록">
    <div className="tc-ga-section-title"><b>길드장 장비 등록</b><small>개인 장비 → 길드 경매 · 공용 실버 사용 없음</small></div>
    <p>장착하지 않은 장비만 등록할 수 있습니다. 입찰 전에는 취소할 수 있으며, 첫 입찰이 들어오면 취소할 수 없습니다.</p>
    <div className="tc-ga-equip-field">
     <span className="tc-ga-equip-label">등록할 장비</span>
     <GameScrollSelect
      ariaLabel="경매 등록 장비" value={selectedGear} onChange={setSelectedGear}
      disabled={busy||!!pendingRegistration} placeholder="장비를 선택하세요"
      emptyMessage="경매에 등록 가능한 미착용 장비가 없습니다."
      options={state.availableEquipment.map(({itemId,gear})=>{
       const stats=equipmentItemStats(gear);
       const detail=[stats.attack?'공격 +'+stats.attack:null,stats.defense?'방어 +'+stats.defense:null,stats.hp?'HP +'+stats.hp:null].filter(Boolean).join(' · ');
       return {value:itemId,label:equipmentItemName(gear),grade:gear.grade,gradeLabel:EQUIPMENT_GRADE_NAMES[gear.grade],detail};
      })}
     />
    </div>
    <label>최소 입찰 공헌도
     <input type="number" inputMode="numeric" min="1" max="1000000000" step="1" value={startPrice} disabled={busy||!!pendingRegistration} onChange={e=>setStartPrice(e.target.value)}/>
    </label>
    <button type="button" disabled={busy||expedition||!!pendingRegistration||!selectedGear||!Number.isSafeInteger(Number(startPrice))||Number(startPrice)<1||Number(startPrice)>1000000000} onClick={register}>24시간 경매 등록</button>
    {pendingRegistration&&<div className="tc-ga-pending"><span>이전 등록 요청이 처리됐는지 확인해야 합니다. 같은 요청 번호로 재확인합니다.</span>
      <button disabled={busy} type="button" onClick={register}>이전 등록 재확인</button></div>}
   </section>}
   {state.claimableRewards.length>0&&<section className="tc-ga-reward"><h3>받지 않은 보스 참여 보상 <b>{state.claimableRewards.length}</b></h3>
    {state.claimableRewards.map(r=><article key={r.encounterId}><div><b>{r.name} · {r.kind==='DAILY'?'일일':'주간'}</b><small>실버 {n(r.silver)} · 공헌도 {n(r.contribution)} P · 회복 포션 {n(r.potions)}개{r.vitalityPotions?' · 활력 포션 '+r.vitalityPotions+'개':''}</small></div><button disabled={busy||expedition} onClick={()=>claimReward(r.encounterId)}>보상받기</button></article>)}
   </section>}
   {!!winners.length&&<section className="tc-ga-reward"><h3>낙찰 장비 수령</h3>
    {winners.map(l=><article key={l.listingId}><div><b>{equipmentItemName(l.gear)}</b><small>낙찰 공헌도 {n(l.topBid)} P</small></div><button disabled={busy||expedition} onClick={()=>claimEquipment(l.listingId)}>장비 받기</button></article>)}
   </section>}
   <div className="tc-ga-section-title"><b>경매 물품</b><small>최근 {records.length}건</small></div>
   <div className="tc-ga-list">
    {records.length?records.map(l=>{
     const open=l.status==='OPEN'&&Date.parse(l.endsAt)>clock,ask=l.nextBid;
     const bidValue=amounts[l.listingId]||ask;
     return <article key={l.listingId} className={'tc-ga-lot '+(open?'open':'closed')}>
      <div className="tc-ga-item">
       <span className={'tc-ga-grade '+l.gear.grade}>◆</span>
       <div className="tc-ga-item-copy"><small>{l.source==='BOSS'?'보스 토벌 전리품':'길드장 등록 장비'} · {EQUIPMENT_GRADE_NAMES[l.gear.grade]}</small>
        <b>{equipmentItemName(l.gear)}</b><small>{describe(l)||'고정 능력치 장비'}</small></div>
       <div className="tc-ga-status">{open?'남은 '+left(l.endsAt,clock):l.status==='UNSOLD'?'유찰':l.status==='CLAIMED'?'수령 완료':l.status==='CANCELLED'?'경매 취소':l.status==='RETURNED'?'반환 완료':'경매 종료'}</div>
      </div>
      <div className="tc-ga-bids"><span>현재 최고 입찰 <b>{l.topBid?n(l.topBid)+' P':'없음'}</b></span><span>다음 최소 입찰 <b>{n(ask)} P</b></span></div>
      {l.isMyTopBid&&<p className="tc-ga-top">내가 현재 최고 입찰자입니다. 입찰 공헌도 {n(l.topBid)}P 보류 중.</p>}
      {open&&l.source==='LEADER'&&l.isMyListing&&<p className="tc-ga-top">내가 등록한 장비 · 자신의 경매에는 입찰할 수 없습니다.</p>}
      {open&&<div className="tc-ga-action"><label>입찰 공헌도<input type="number" min={ask} max={1000000000} step={10} inputMode="numeric" value={bidValue} onChange={e=>setAmounts(o=>({...o,[l.listingId]:Number(e.target.value)}))}/></label>
       <button disabled={busy||l.isMyListing||!Number.isSafeInteger(bidValue)||bidValue<ask||bidValue-(l.isMyTopBid?l.topBid:0)>state.points} onClick={()=>bid(l)}>입찰하기</button></div>}
      {(l.canCancel||l.canReturn)&&<div className="tc-ga-management">
       <button type="button" disabled={busy||expedition} onClick={()=>recover(l)}>{l.canCancel?'입찰 없는 경매 취소 · 장비 반환':'유찰 장비 돌려받기'}</button>
      </div>}
      {l.canRelist&&<div className="tc-ga-management">
       <label>재경매 시작가
        <input type="number" min="1" max="1000000000" inputMode="numeric" value={relistPrices[l.listingId]??String(l.startingBid)} onChange={e=>setRelistPrices(a=>({...a,[l.listingId]:e.target.value}))}/>
       </label>
       <button type="button" disabled={busy||!Number.isSafeInteger(Number(relistPrices[l.listingId]??l.startingBid))||Number(relistPrices[l.listingId]??l.startingBid)<1} onClick={()=>relist(l)}>보스 전리품 재경매</button>
      </div>}
     </article>;
    }):<div className="tc-ga-empty">현재 등록된 경매 물품이 없습니다. 길드장이 직접 장비를 등록하거나 보스를 토벌하면 등록됩니다.</div>}
   </div>
  </>}
  {notice&&<p role="status" className="tc-ga-notice">{notice}</p>}
  {error&&<div role="alert" className="tc-ga-error">{error}<button disabled={busy} onClick={()=>void refresh()}>다시 확인</button></div>}
 </section>;
}
