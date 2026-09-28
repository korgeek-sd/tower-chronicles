import React,{useMemo,useState} from 'react';
import type {EquipmentGrade,EquipmentItem,EquipmentKind,GameState} from '../../game/types';
import {
 EQUIPMENT_DEFINITIONS,
 EQUIPMENT_GRADE_NAMES,
 EQUIPMENT_GRADES,
 V2_STARTER_EQUIPMENT_ID,
 equipmentItemName,
} from '../../game/data/equipment';
import type {GameplayLease} from '../../online/gameSession';
import {
 buyOnlineEquipmentListing,
 cancelOnlineEquipmentListing,
 listOnlineEquipment,
 type OnlineEquipmentListing,
 type OnlineMarketState,
} from '../../online/market';
import {Glyph,Segments} from '../../ui/mobile';
import {useGameFeel} from '../../gameFeel/react/useGameFeel';

type Mode='buy'|'sell'|'mine';
type GradeFilter='all'|EquipmentGrade;
type KindFilter='all'|EquipmentKind;
type EnhancementFilter='all'|number;

const modes=[['buy','구매'],['sell','판매 등록'],['mine','내 등록']] as const;
const money=(value:number)=>Math.round(value).toLocaleString()+' S';
const hoursLeft=(expiresAt:number)=>Math.max(0,Math.ceil((expiresAt-Date.now())/3_600_000));
const iconFor=(item:EquipmentItem)=>{
 const def=EQUIPMENT_DEFINITIONS[item.kind];
 if('weaponFamily' in def&&def.weaponFamily)return def.weaponFamily;
 return def.slot==='helmet'||def.slot==='armor'||def.slot==='gloves'?'armor':
  def.slot==='boots'?'boots':'accessory';
};

export function EquipmentMarketPanel({
 game,snapshot,lease,onSnapshot,
}:{game:GameState;snapshot:OnlineMarketState;lease:GameplayLease;onSnapshot:(next:OnlineMarketState)=>void}){
 const feel=useGameFeel();
 const [mode,setMode]=useState<Mode>('buy');
 const [kindFilter,setKindFilter]=useState<KindFilter>('all');
 const [gradeFilter,setGradeFilter]=useState<GradeFilter>('all');
 const [enhancementFilter,setEnhancementFilter]=useState<EnhancementFilter>('all');
 const [selectedSell,setSelectedSell]=useState<string|null>(null);
 const [price,setPrice]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');

 const listings=useMemo(()=>snapshot.equipmentListings
  .filter(listing=>kindFilter==='all'||listing.kind===kindFilter)
  .filter(listing=>gradeFilter==='all'||listing.grade===gradeFilter)
  .filter(listing=>enhancementFilter==='all'||listing.enhancement===enhancementFilter)
  .slice()
  .sort((a,b)=>a.kind.localeCompare(b.kind)||EQUIPMENT_GRADES.indexOf(a.grade)-EQUIPMENT_GRADES.indexOf(b.grade)||a.enhancement-b.enhancement||a.price-b.price||a.createdAt-b.createdAt),
 [snapshot.equipmentListings,kindFilter,gradeFilter,enhancementFilter]);

 const owned=useMemo(()=>snapshot.assets
  .filter(asset=>asset.itemId.startsWith('equipment_v2:')&&asset.gear)
  .map(asset=>asset.gear as EquipmentItem)
  .sort((a,b)=>equipmentItemName(a).localeCompare(equipmentItemName(b),'ko')),
 [snapshot.assets]);

 const myListings=useMemo(()=>snapshot.equipmentListings.filter(listing=>listing.mine).sort((a,b)=>a.expiresAt-b.expiresAt),[snapshot.equipmentListings]);
 const sellItem=owned.find(item=>item.id===selectedSell)??null;
 const parsedPrice=/^\d+$/.test(price)?Number(price):NaN;
 const policy=snapshot.equipmentPolicy;
 const registrationFee=Number.isSafeInteger(parsedPrice)&&parsedPrice>0
  ?Math.min(policy.maxRegistrationFee,Math.max(policy.minRegistrationFee,Math.ceil(parsedPrice*policy.registrationFeeBps/10000)))
  :0;
 const sellerFee=Number.isSafeInteger(parsedPrice)&&parsedPrice>0?Math.floor(parsedPrice*policy.sellerFeeBps/10000):0;
 const expectedNet=Number.isSafeInteger(parsedPrice)&&parsedPrice>0?parsedPrice-sellerFee:0;
 const sellEquipped=!!sellItem&&Object.values(game.equipped).includes(sellItem.id);
 const sellStarter=sellItem?.id===V2_STARTER_EQUIPMENT_ID;
 const canList=!!sellItem&&!sellEquipped&&!sellStarter&&!game.expedition&&!busy&&Number.isSafeInteger(parsedPrice)&&parsedPrice>0&&snapshot.wallet.silver>=registrationFee;

 const act=async(fn:()=>Promise<OnlineMarketState>,success:'market.order-placed'|'market.order-cancelled'='market.order-placed')=>{
  setBusy(true);setError('');
  try{const next=await fn();onSnapshot(next);feel.play(success);}
  catch(e){feel.play('ui.error');setError(e instanceof Error?e.message:'장비 거래 요청을 처리하지 못했습니다.');}
  finally{setBusy(false);}
 };

 const buy=(listing:OnlineEquipmentListing)=>void act(()=>buyOnlineEquipmentListing(lease,listing.listingId));
 const list=()=>{
  if(!sellItem||!canList)return;
  void act(async()=>{
   const next=await listOnlineEquipment(lease,sellItem.id,parsedPrice);
   setSelectedSell(null);setPrice('');
   return next;
  });
 };

 return <div className="tc-equipment-market">
  <Segments items={modes} value={mode} onChange={setMode} label="장비 거래 메뉴"/>

  {mode==='buy'&&<>
   <section className="tc-equipment-market-policy">
    <b>정가 즉시구매</b>
    <span>입찰 없음 · 구매자 수수료 없음 · 등록 72시간</span>
   </section>
   <div className="tc-equipment-market-filters">
    <select aria-label="장비 종류" value={kindFilter} onChange={e=>setKindFilter(e.target.value as KindFilter)}>
     <option value="all">전체 종류</option>
     {(Object.keys(EQUIPMENT_DEFINITIONS) as EquipmentKind[]).map(kind=><option value={kind} key={kind}>{EQUIPMENT_DEFINITIONS[kind].name}</option>)}
    </select>
    <select aria-label="장비 등급" value={gradeFilter} onChange={e=>setGradeFilter(e.target.value as GradeFilter)}>
     <option value="all">전체 등급</option>
     {EQUIPMENT_GRADES.map(grade=><option value={grade} key={grade}>{EQUIPMENT_GRADE_NAMES[grade]}</option>)}
    </select>
    <select aria-label="강화 단계" value={String(enhancementFilter)} onChange={e=>setEnhancementFilter(e.target.value==='all'?'all':Number(e.target.value))}>
     <option value="all">전체 강화</option>
     {Array.from({length:11},(_,i)=><option value={i} key={i}>+{i}</option>)}
    </select>
   </div>
   <div className="tc-equipment-market-list">
    {listings.map(listing=><article key={listing.listingId} className="tc-equipment-market-row">
     <span className="tc-market-v2-mini"><Glyph name={iconFor(listing.gear)}/></span>
     <div className="name"><b>{equipmentItemName(listing.gear)}</b><small>{EQUIPMENT_GRADE_NAMES[listing.grade]} · +{listing.enhancement} · {hoursLeft(listing.expiresAt)}시간 남음</small></div>
     <div className="price"><b>{money(listing.price)}</b><small>{listing.mine?'내 등록':'즉시 구매'}</small></div>
     <button disabled={listing.mine||busy||!!game.expedition||snapshot.wallet.silver<listing.price} onClick={()=>buy(listing)}>{listing.mine?'내 매물':'즉시 구매'}</button>
    </article>)}
    {!listings.length&&<div className="tc-market-v2-empty">조건에 맞는 장비 매물이 없습니다.</div>}
   </div>
  </>}

  {mode==='sell'&&<>
   <section className="tc-equipment-market-policy">
    <b>판매 등록</b>
    <span>등록 수수료 1% · 최소 100 S · 최대 100,000 S · 환불 없음</span>
   </section>
   <div className="tc-equipment-sell-grid">
    <div className="tc-equipment-owned">
     {owned.map(item=>{
      const equipped=Object.values(game.equipped).includes(item.id),starter=item.id==='starter-v2';
      return <button key={item.id} className={selectedSell===item.id?'active':''} disabled={starter} onClick={()=>{setSelectedSell(item.id);setError('');}}>
       <Glyph name={iconFor(item)}/><span><b>{equipmentItemName(item)}</b><small>{starter?'보급 장비 · 거래 불가':equipped?'장착 해제 필요':'판매 가능'}</small></span>
      </button>;
     })}
     {!owned.length&&<div className="tc-market-v2-empty">판매 가능한 V2 장비가 없습니다.</div>}
    </div>
    <section className="tc-equipment-sell-ticket">
     {sellItem?<><h3>{equipmentItemName(sellItem)}</h3>
      <label><small>판매 가격</small><input inputMode="numeric" value={price} onChange={e=>setPrice(e.target.value.replace(/\D/g,''))}/><span>S</span></label>
      <div><span>등록 수수료</span><b>{money(registrationFee)}</b></div>
      <div><span>판매 수수료</span><b>{policy.sellerFeeBps/100}% · {money(sellerFee)}</b></div>
      <div><span>예상 정산</span><b>{money(expectedNet)}</b></div>
      <small>등록 수수료는 즉시 차감되며 취소·만료 시 반환되지 않습니다.</small>
      {sellEquipped&&<em>장착 해제 후 등록할 수 있습니다.</em>}
      <button disabled={!canList} onClick={list}>{busy?'등록 처리 중':'72시간 판매 등록'}</button>
     </>:<p>판매할 장비를 선택하세요.</p>}
    </section>
   </div>
  </>}

  {mode==='mine'&&<>
   <section className="tc-equipment-market-policy">
    <b>내 등록</b>
    <span>취소·만료 시 동일 장비가 그대로 반환됩니다. 등록 수수료는 반환되지 않습니다.</span>
   </section>
   <div className="tc-equipment-market-list">
    {myListings.map(listing=><article key={listing.listingId} className="tc-equipment-market-row">
     <span className="tc-market-v2-mini"><Glyph name={iconFor(listing.gear)}/></span>
     <div className="name"><b>{equipmentItemName(listing.gear)}</b><small>{hoursLeft(listing.expiresAt)}시간 남음 · 등록비 {money(listing.registrationFee)}</small></div>
     <div className="price"><b>{money(listing.price)}</b><small>판매 대기</small></div>
     <button disabled={busy||!!game.expedition} onClick={()=>void act(()=>cancelOnlineEquipmentListing(lease,listing.listingId),'market.order-cancelled')}>취소</button>
    </article>)}
    {!myListings.length&&<div className="tc-market-v2-empty">판매 중인 장비가 없습니다.</div>}
   </div>
  </>}

  {error&&<div className="tc-floor-risk">{error}</div>}
 </div>;
}
