import {GuildTask,GuildRecord} from './GuildTask';
import React,{useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import type {CloudSaveRecord} from '../../online/cloudSave';
import {equipmentItemName,EQUIPMENT_GRADE_NAMES,equipmentItemStats} from '../../game/data/equipment';
import {GameScrollSelect} from '../../ui/GameScrollSelect';
import {assetUrl} from '../../game/data/graphics';
import {getGuildAuctionState,bidGuildAuction,claimGuildBossReward,claimGuildAuctionItem,registerGuildAuctionItem,recoverGuildAuctionItem,relistGuildBossAuctionItem,type GuildAuctionState,type GuildAuctionListing} from '../../online/guildAuction';
import './guildAuction.css';
import {GuildMaterialAuctionForm} from './GuildMaterialAuctionForm';
import {recoverGuildMaterialAuction,GUILD_MATERIAL_NAMES} from '../../online/guildMaterials';

const n=(v:number)=>Math.max(0,Math.trunc(v)).toLocaleString('ko-KR');
const left=(until:string,clock:number)=>{
 const secs=Math.max(0,Math.ceil((Date.parse(until)-clock)/1000));
 const d=Math.floor(secs/86400),h=Math.floor(secs%86400/3600),m=Math.floor(secs%3600/60);
 return d?d+'일 '+h+'시간':h+'시간 '+m+'분';
};
const describe=(item:GuildAuctionListing)=>{
 if(item.source==='MATERIAL')return '재료 '+(item.materialQuantity??0).toLocaleString('ko-KR')+'개';
 const stat=equipmentItemStats(item.gear);
 return Object.entries(stat).filter(([key,val])=>!!val&&['hp','attack','defense'].includes(key)).map(([key,value])=>({hp:'HP',attack:'공격력',defense:'방어력'}[key]??key)+' +'+value).join(' · ');
};
const lotName=(l:GuildAuctionListing)=>l.source==='MATERIAL'?GUILD_MATERIAL_NAMES[l.materialId??'herb']+' ×'+n(l.materialQuantity??0):equipmentItemName(l.gear);
const lotSource=(l:GuildAuctionListing)=>l.source==='MATERIAL'?'점령 마을 세금 재료':l.source==='BOSS'?'보스 토벌 전리품':'길드장 등록 장비';
type PendingBid={id:string;amount:number};
type AuctionSection='active'|'mine'|'history';
type AuctionCategory='all'|'gear'|'material'|'boss';
type AuctionSort='ending'|'highest'|'lowest';
function AuctionArt({lot,featured=false}:{lot:GuildAuctionListing;featured?:boolean}){
 return <span className={'tc-ga-art '+(featured?'featured ':'')+(lot.source==='MATERIAL'?'material':'grade-'+lot.gear.grade)} aria-hidden="true">
  {lot.source==='MATERIAL'?<span className="tc-ga-material-symbol">◆</span>:<img src={assetUrl('assets/ui/equipment/'+lot.gear.kind+'.png')} alt="" loading="lazy"/>}
 </span>;
}
export function GuildAuctionPanel({lease,associationId,expedition,onRecord,onChanged,onBack}:{lease:GameplayLease;associationId:string;expedition:boolean;onRecord:(record:CloudSaveRecord,message:string)=>void;onChanged:()=>void;onBack?:()=>void}){
 const [state,setState]=useState<GuildAuctionState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [amounts,setAmounts]=useState<Record<string,number>>({}),[clock,setClock]=useState(Date.now());
 const [selectedGear,setSelectedGear]=useState(''),[startPrice,setStartPrice]=useState('1000');
 const [relistPrices,setRelistPrices]=useState<Record<string,string>>({});
 const [pendingRegistration,setPendingRegistration]=useState<{requestId:string;itemId:string;bid:number}|null>(null);
 const mounted=useRef(true),locking=useRef(false);
 const [section,setSection]=useState<AuctionSection>('active'),[category,setCategory]=useState<AuctionCategory>('all'),[sort,setSort]=useState<AuctionSort>('ending');
 const [selectedLotId,setSelectedLotId]=useState<string|null>(null);
 const detailRef=useRef<HTMLDialogElement>(null);
 const showLot=(id:string)=>{setSelectedLotId(id);if(!detailRef.current?.open)detailRef.current?.showModal();};
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
 const claimEquipment=(item:GuildAuctionListing)=>void mutate(async()=>{
  const r=await claimGuildAuctionItem(lease,item.listingId);
  if(!mounted.current)return;
  setState(r.state);onRecord(r.record,item.source==='MATERIAL'?'낙찰 재료가 개인 생활 재료 보관함에 지급됐습니다.':'길드 경매 낙찰 장비가 보관함에 지급됐습니다.');onChanged();
  setNotice(r.replayed?'이미 수령한 물품입니다.':item.source==='MATERIAL'?'낙찰 재료가 생활 재료 보관함에 지급됐습니다.':'낙찰 장비를 보관함에 지급했습니다.');
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
 const returnMaterial=(item:GuildAuctionListing)=>void mutate(async()=>{
  const r=await recoverGuildMaterialAuction(lease,item.listingId);
  if(!mounted.current)return;
  setState(r.state);setNotice(r.replayed?'이미 반환된 재료입니다.':'세금 재료가 길드 재료 창고로 반환됐습니다.');
 });
 const records=state?.listings??[];
 const winners=records.filter(l=>l.status==='SOLD'&&l.isMyTopBid);
 const openRecords=records.filter(l=>l.status==='OPEN'&&Date.parse(l.endsAt)>clock);
 const subset=records.filter(l=>{
  const isOpen=l.status==='OPEN'&&Date.parse(l.endsAt)>clock;
  const matchesSection=section==='active'?isOpen:section==='mine'?l.isMyTopBid||l.isMyListing:!isOpen;
  const matchesCategory=category==='all'||category==='gear'&&l.source!=='MATERIAL'||category==='material'&&l.source==='MATERIAL'||category==='boss'&&l.source==='BOSS';
  return matchesSection&&matchesCategory;
 });
 const sorted=[...subset].sort((a,b)=>sort==='ending'?Date.parse(a.endsAt)-Date.parse(b.endsAt):sort==='highest'?b.topBid-a.topBid:a.topBid-b.topBid);
 const featured=section==='active'?sorted[0]:null;
 const listRows=featured?sorted.slice(1):sorted;
 const selected=records.find(l=>l.listingId===selectedLotId)??null;
 const detailOpen=!!selected&&selected.status==='OPEN'&&Date.parse(selected.endsAt)>clock;
 const selectedBid=selected?(amounts[selected.listingId]||selected.nextBid):0;
 const validBid=!!selected&&Number.isSafeInteger(selectedBid)&&selectedBid>=selected.nextBid&&selectedBid<=1000000000&&selectedBid-(selected.isMyTopBid?selected.topBid:0)<=(state?.points??0);
 const status=(l:GuildAuctionListing)=>l.status==='OPEN'&&Date.parse(l.endsAt)>clock?left(l.endsAt,clock):l.status==='UNSOLD'?'유찰':l.status==='CLAIMED'?'수령 완료':l.status==='CANCELLED'?'경매 취소':l.status==='RETURNED'?'반환 완료':l.status==='SOLD'?'낙찰 종료':'경매 종료';
 return <section className="tc-guild-auction tc-ga-v2 tc-ga-v3" aria-label="원정단 경매장">
  <header className="tc-ga-heading">
   <button className="tc-ga-back" type="button" onClick={()=>onBack?.()} aria-label="원정단 본부로 돌아가기"><span aria-hidden="true">‹</span> 뒤로</button>
   <div className="tc-ga-heading-title"><small>THE TOWER · GUILD AUCTION</small><h2>원정단 경매장</h2></div>
   <div className="tc-ga-balance"><small>보유 공헌도</small><strong>{state?n(state.points):'—'} <em>P</em></strong></div>
  </header>
  {!state?<div className="tc-ga-loading" role="status">{error||'경매 정보를 불러오는 중입니다.'}</div>:<>
   <div className="tc-ga-intro"><span>원정단 전용 경매 · 공헌도(P)로 입찰</span>
    <details className="tc-ga-quick-menu"><summary>경매 관리 <span aria-hidden="true">⌄</span></summary>
   <div className="tc-ga-shortcuts">
    <GuildTask title="경매 이용 안내" trigger="이용 안내" feedback={error||notice}>
     <p className="tc-ga-description">보스 전리품과 원정단장이 등록한 장비, 세금 재료를 공헌도(P)로 입찰합니다. 입찰 공헌도는 보류되며 다른 단원이 더 높은 금액을 입찰하면 반환됩니다. 경매는 등록 후 24시간 진행되고 서버 시간에 종료됩니다.</p>
    </GuildTask>
    {(state.claimableRewards.length>0||winners.length>0)&&<GuildTask title="토벌 보상 · 낙찰 수령" trigger={'수령 대기 '+(state.claimableRewards.length+winners.length)+'건'} feedback={error||notice}>
     {state.claimableRewards.length>0&&<section className="tc-ga-reward"><h3>받지 않은 토벌 보상</h3><GuildRecord items={state.claimableRewards} id={r=>r.encounterId} label={r=>r.name} title="보상 선택">{r=><article key={r.encounterId}><div><b>{r.name}</b><small>실버 {n(r.silver)} · 공헌도 {n(r.contribution)}P · 회복 포션 {n(r.potions)}개{r.vitalityPotions?' · 활력 포션 '+r.vitalityPotions+'개':''}</small></div><button type="button" disabled={busy||expedition} onClick={()=>claimReward(r.encounterId)}>보상받기</button></article>}</GuildRecord></section>}
     {winners.length>0&&<section className="tc-ga-reward"><h3>낙찰 물품 수령</h3><GuildRecord items={winners} id={l=>l.listingId} label={lotName} title="낙찰품 선택">{l=><article key={l.listingId}><div><b>{lotName(l)}</b><small>낙찰 공헌도 {n(l.topBid)}P</small></div><button type="button" disabled={busy||expedition} onClick={()=>claimEquipment(l)}>물품 받기</button></article>}</GuildRecord></section>}
    </GuildTask>}
    {state.isLeader&&<GuildTask title="장비 경매 등록" trigger="장비 등록" feedback={error||notice}><section className="tc-ga-register" aria-label="길드장 장비 경매 등록">
     <div className="tc-ga-section-title"><b>길드장 장비 등록</b><small>미착용 장비 · 24시간</small></div><p>장착하지 않은 장비를 등록합니다. 입찰 전에는 취소할 수 있으며 첫 입찰 이후에는 취소할 수 없습니다.</p>
     <div className="tc-ga-equip-field"><span className="tc-ga-equip-label">등록할 장비</span><GameScrollSelect ariaLabel="경매 등록 장비" value={selectedGear} onChange={setSelectedGear} disabled={busy||!!pendingRegistration} placeholder="장비를 선택하세요" emptyMessage="등록 가능한 미착용 장비가 없습니다." options={state.availableEquipment.map(({itemId,gear})=>{const s=equipmentItemStats(gear);return {value:itemId,label:equipmentItemName(gear),grade:gear.grade,gradeLabel:EQUIPMENT_GRADE_NAMES[gear.grade],detail:[s.attack?'공격 +'+s.attack:null,s.defense?'방어 +'+s.defense:null,s.hp?'HP +'+s.hp:null].filter(Boolean).join(' · ')};})}/></div>
     <label>시작 입찰 공헌도<input type="number" inputMode="numeric" min="1" max="1000000000" value={startPrice} disabled={busy||!!pendingRegistration} onChange={e=>setStartPrice(e.target.value)}/></label>
     <button type="button" disabled={busy||expedition||!!pendingRegistration||!selectedGear||!Number.isSafeInteger(Number(startPrice))||Number(startPrice)<1||Number(startPrice)>1000000000} onClick={register}>24시간 경매 등록</button>
     {pendingRegistration&&<div className="tc-ga-pending"><span>이전 등록 요청을 확인해야 합니다.</span><button type="button" disabled={busy} onClick={register}>이전 등록 재확인</button></div>}
    </section></GuildTask>}
    {state.isLeader&&<GuildTask title="세금 재료 경매 등록" trigger="재료 등록" feedback={error||notice}><GuildMaterialAuctionForm lease={lease} associationId={associationId} expedition={expedition} onListed={setState}/></GuildTask>}
   </div>
    </details>
   </div>
   <nav className="tc-ga-categories" aria-label="경매 물품 분류">
    {([['all','전체'],['gear','장비'],['material','재료'],['boss','보스 전리품']] as const).map(([id,label])=><button key={id} type="button" className={category===id?'active':''} aria-pressed={category===id} onClick={()=>setCategory(id)}>{label}</button>)}
   </nav>
   {featured&&<article className="tc-ga-feature" aria-label="주요 경매 물품">
    <div className="tc-ga-feature-ribbon"><span>✦ 주요 경매 아이템</span><span>{lotSource(featured)}</span></div>
    <div className="tc-ga-feature-main">
     <AuctionArt lot={featured} featured/>
     <div className="tc-ga-feature-copy">
      <b>{lotName(featured)}</b>
      <span className="tc-ga-feature-rarity"><strong>{featured.source==='MATERIAL'?'재료':EQUIPMENT_GRADE_NAMES[featured.gear.grade]}</strong><small>{lotSource(featured)}</small></span>
      <p>{describe(featured)||'원정단이 함께 입찰하는 특별 경매 물품입니다.'}</p>
     </div>
    </div>
    <div className="tc-ga-feature-bottom">
     <div className="tc-ga-feature-stats">
      <span><small>{featured.topBid?'현재 최고 입찰':'경매 시작가'}</small><strong>{n(featured.topBid||featured.startingBid)} <i>P</i></strong></span>
      <span><small>남은 시간</small><strong className="time">{status(featured)}</strong></span>
     </div>
     <button type="button" className="tc-ga-feature-bid" onClick={()=>showLot(featured.listingId)}><span aria-hidden="true">⚒</span> 입찰하기</button>
    </div>
   </article>
   {section==='active'&&!featured&&<div className="tc-ga-feature-empty">진행 중인 경매가 없습니다.<small>다른 분류를 선택하거나 새 경매 등록을 확인해 주세요.</small></div>}
   <div className="tc-ga-toolbar"><span><b>{section==='active'?'경매 목록':section==='mine'?'내 경매 및 입찰':'지난 경매'}</b><small>{subset.length}건</small></span>
    <div className="tc-ga-sort" role="group" aria-label="경매 정렬">
     {([['ending','종료순'],['highest','높은 입찰'],['lowest','낮은 입찰']] as const).map(([id,label])=><button type="button" key={id} aria-pressed={sort===id} className={sort===id?'active':''} onClick={()=>setSort(id)}>{label}</button>)}
    </div>
   </div>
   <div className="tc-ga-list" role="list" aria-label="경매 물품 목록">
    {listRows.map(l=><button role="listitem" type="button" key={l.listingId} className={'tc-ga-list-entry '+(l.status==='OPEN'?'open':'closed')} onClick={()=>showLot(l.listingId)}>
     <AuctionArt lot={l}/>
     <div className="tc-ga-list-title"><b>{lotName(l)}</b><small>{lotSource(l)}{l.source==='MATERIAL'?'':' · '+EQUIPMENT_GRADE_NAMES[l.gear.grade]}</small>{l.isMyTopBid&&<em>현재 내 입찰</em>}</div>
     <div className="tc-ga-list-stats"><strong>{n(l.topBid||l.startingBid)} <i>P</i></strong><small>{l.topBid?'최고 입찰':'시작가'} · {status(l)}</small></div><span className="tc-ga-entry-arrow" aria-hidden="true">›</span>
    </button>)}
    {!listRows.length&&<div className="tc-ga-empty">{featured?'나머지 경매 물품이 없습니다.':'이 분류에 해당하는 경매 내역이 없습니다.'}</div>}
   </div>
   <nav className="tc-ga-bottom-tabs" aria-label="경매 현황">
    {([['active','진행 중',openRecords.length],['mine','내 입찰',records.filter(l=>l.isMyTopBid||l.isMyListing).length],['history','종료 내역',records.filter(l=>l.status!=='OPEN'||Date.parse(l.endsAt)<=clock).length]] as const).map(([id,label,count])=><button key={id} type="button" className={section===id?'active':''} aria-pressed={section===id} onClick={()=>setSection(id)}>{label} <small>{count}</small></button>)}
   </nav>

  </>}
  {notice&&<p role="status" className="tc-ga-notice">{notice}</p>}
  {error&&<div role="alert" className="tc-ga-error">{error}<button type="button" disabled={busy} onClick={()=>void refresh()}>다시 확인</button></div>}
  <dialog ref={detailRef} className="tc-ga-detail-dialog" aria-label="경매 물품 상세 및 입찰" onCancel={()=>setSelectedLotId(null)}>
   <header className="tc-ga-detail-head"><div><small>GUILD AUCTION / ITEM</small><h3>경매 상세</h3></div><button type="button" aria-label="경매 상세 닫기" onClick={()=>{detailRef.current?.close();setSelectedLotId(null);}}>닫기</button></header>
   {selected&&<div className="tc-ga-detail-body">
    <div className="tc-ga-detail-item"><AuctionArt lot={selected} featured/><div><b>{lotName(selected)}</b><small>{lotSource(selected)}{selected.source==='MATERIAL'?'':' · '+EQUIPMENT_GRADE_NAMES[selected.gear.grade]}</small><p>{describe(selected)||'원정단 경매 물품'}</p></div></div>
    <div className="tc-ga-detail-metrics"><span>현재 최고 입찰<strong>{selected.topBid?n(selected.topBid)+' P':'입찰 없음'}</strong></span><span>{detailOpen?'남은 시간':'경매 상태'}<strong>{status(selected)}</strong></span><span>다음 최소 입찰<strong>{n(selected.nextBid)} P</strong></span></div>
    {selected.isMyTopBid&&<p className="tc-ga-top">현재 최고 입찰자입니다. 보류 중인 공헌도 {n(selected.topBid)}P</p>}
    {selected.isMyListing&&<p className="tc-ga-top">내가 등록한 물품입니다. 자신의 경매에는 입찰할 수 없습니다.</p>}
    {detailOpen&&<div className="tc-ga-action"><label>입찰할 공헌도(P)<input type="number" inputMode="numeric" min={selected.nextBid} max={1000000000} step={10} value={selectedBid} onChange={e=>setAmounts(o=>({...o,[selected.listingId]:Number(e.target.value)}))}/></label><button type="button" disabled={busy||selected.isMyListing||!validBid} onClick={()=>bid(selected)}>입찰하기</button></div>}
    {selected.status==='SOLD'&&selected.isMyTopBid&&<button type="button" disabled={busy||expedition} onClick={()=>claimEquipment(selected)}>낙찰 물품 수령</button>}
    {(selected.canCancel||selected.canReturn)&&<div className="tc-ga-management"><button type="button" disabled={busy||expedition} onClick={()=>recover(selected)}>{selected.canCancel?'경매 취소 · 장비 반환':'유찰 장비 반환'}</button></div>}
    {selected.source==='MATERIAL'&&selected.canReturnMaterial&&<div className="tc-ga-management"><button type="button" disabled={busy} onClick={()=>returnMaterial(selected)}>{detailOpen?'경매 취소 · 세금 재료 반환':'유찰 재료 창고 반환'}</button></div>}
    {selected.canRelist&&<div className="tc-ga-management"><label>재경매 시작 공헌도<input type="number" min="1" max="1000000000" inputMode="numeric" value={relistPrices[selected.listingId]??String(selected.startingBid)} onChange={e=>setRelistPrices(a=>({...a,[selected.listingId]:e.target.value}))}/></label><button type="button" disabled={busy||!Number.isSafeInteger(Number(relistPrices[selected.listingId]??selected.startingBid))||Number(relistPrices[selected.listingId]??selected.startingBid)<1} onClick={()=>relist(selected)}>보스 전리품 재경매</button></div>}
    {notice&&<p role="status" className="tc-ga-notice">{notice}</p>}
    {error&&<p role="alert" className="tc-ga-error">{error}</p>}
   </div>}
  </dialog>
 </section>;
}
