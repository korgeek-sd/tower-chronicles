import React,{useState} from 'react';
import {Glyph} from '../../ui/mobile';
import {ShopRewardArt} from './ShopRewardArt';
import type {OnlineAssociationShopItem,OnlineAssociationShopState} from '../../online/associationShop';
import './supply-showcase.css';

export type SupplyShopFilter='ALL'|'DAILY'|'WEEKLY'|'CURRENCY';
type ShopDestination='overview'|'auction'|'warehouse';
const FILTERS:readonly (readonly [SupplyShopFilter,string])[]=[
 ['ALL','추천'],['DAILY','일일'],['WEEKLY','주간'],['CURRENCY','재화']
];
const currencyItem=(item:OnlineAssociationShopItem)=>
 item.itemId==='silver_box_daily'||item.itemId==='gold_box_weekly';
const productTone=(id:string)=>
 id.includes('gold_box')?'gold':id.includes('silver_box')?'silver':
 id.includes('rare_equipment')?'rare':id.includes('vitality_potion')?'vitality':
 id.includes('job_draw_ticket')?'summon':'other';
const remaining=(item:OnlineAssociationShopItem)=>Math.max(0,item.purchaseLimit-item.purchased);
const shownItems=(shop:OnlineAssociationShopState,filter:SupplyShopFilter)=>{
 const all=[...shop.daily,...shop.weekly];
 return filter==='DAILY'?shop.daily:filter==='WEEKLY'?shop.weekly:
  filter==='CURRENCY'?all.filter(currencyItem):all;
};
const PAGE_SIZE=6;

export function AssociationShopShowcase({
 shop,filter,onFilter,busy,expedition,onBuy,onRefresh,message='',onNavigate
}:{
 shop:OnlineAssociationShopState;filter:SupplyShopFilter;
 onFilter:(filter:SupplyShopFilter)=>void;busy:boolean;expedition:boolean;
 onBuy:(id:string)=>void;onRefresh:()=>void;message?:string;
 onNavigate?:(destination:ShopDestination)=>void;
}){
 const [selectedId,setSelectedId]=useState('');
 const [page,setPage]=useState(0);
 const visible=shownItems(shop,filter);
 const pages=Math.max(1,Math.ceil(visible.length/PAGE_SIZE));
 const safePage=Math.min(page,pages-1);
 const pageItems=visible.slice(safePage*PAGE_SIZE,(safePage+1)*PAGE_SIZE);
 const featured=shop.weekly.find(item=>item.itemId==='gold_box_weekly')??
  shop.daily.find(item=>item.itemId==='silver_box_daily')??[...shop.daily,...shop.weekly][0]??null;
 const selected=pageItems.find(item=>item.itemId===selectedId)??
  pageItems.find(item=>item.itemId===featured?.itemId)??pageItems[0]??null;
 const sold=selected?remaining(selected)===0:false;
 const locked=selected?shop.level<selected.requiredLevel:false;
 const insufficient=selected?shop.contribution<selected.contributionCost:false;
 const canBuy=!!selected&&!busy&&!expedition&&!sold&&!locked&&!insufficient;
 const buyLabel=busy?'처리 중':expedition?'원정 중 구매 불가':locked&&selected?'Lv.'+selected.requiredLevel+' 해금':
  sold?'구매 완료':insufficient?'공헌도 부족':'구매하기';
 const changeFilter=(next:SupplyShopFilter)=>{onFilter(next);setPage(0);setSelectedId('');};
 const chooseFeatured=()=>{
  if(!featured)return;
  onFilter('ALL');
  const index=[...shop.daily,...shop.weekly].findIndex(item=>item.itemId===featured.itemId);
  setPage(Math.max(0,Math.floor(index/PAGE_SIZE)));
  setSelectedId(featured.itemId);
 };
 const dock=onNavigate?(
  <nav className="tc-supply-v5-dock" aria-label="원정단 시설 바로가기">
   <button type="button" onClick={()=>onNavigate('overview')}><Glyph name="home"/>본부</button>
   <button type="button" onClick={()=>onNavigate('auction')}><Glyph name="market"/>경매</button>
   <button type="button" aria-current="page" onClick={()=>{changeFilter('ALL');}}><Glyph name="shop"/>상점</button>
   <button type="button" onClick={()=>onNavigate('warehouse')}><Glyph name="inventory"/>금고</button>
  </nav>
 ):null;
 return <section className="tc-supply tc-supply-shop tc-supply-v5" aria-label="원정단 상점">
  <header className="tc-supply-v5-top">
   {onNavigate&&<button type="button" className="tc-supply-v5-back" onClick={()=>onNavigate('overview')} aria-label="원정단 본부로 돌아가기">‹</button>}
   <div className="tc-supply-v5-title"><small>EXPEDITION SUPPLY</small><h2>원정단 상점</h2></div>
   <div className="tc-supply-v5-wallet" aria-label={'보유 공헌도 '+shop.contribution.toLocaleString()}>
    <small>공헌도</small><b><i aria-hidden="true">✥</i>{shop.contribution.toLocaleString()}</b>
   </div>
   <button type="button" className="tc-supply-v5-refresh" disabled={busy} aria-label="상점 정보 새로고침" onClick={onRefresh}>↻</button>
  </header>
  {featured&&<button type="button" className="tc-supply-v5-feature" onClick={chooseFeatured} aria-label={featured.name+' 추천 상품 선택'}>
   <span className="tc-supply-v5-feature-copy">
    <small>✦ 원정단 추천 보급 ✦</small>
    <strong>{featured.name}</strong>
    <span>주간 보급 · 보유 공헌도로 교환</span>
    <span className="tc-supply-v5-feature-price"><i aria-hidden="true">✥</i>{featured.contributionCost.toLocaleString()} <em>· 잔여 {remaining(featured)}회</em></span>
   </span>
   <span className="tc-supply-v5-feature-art" aria-hidden="true"><ShopRewardArt itemId={featured.itemId} large/></span>
   <span className="tc-supply-v5-feature-chevron" aria-hidden="true">›</span>
  </button>}
  <div className="tc-supply-v5-filterbar">
   <nav className="tc-supply-v5-tabs" aria-label="원정단 상점 품목">
    {FILTERS.map(([value,label])=><button type="button" key={value} aria-pressed={filter===value} className={filter===value?'active':''} onClick={()=>changeFilter(value)}>{label}</button>)}
   </nav>
   {pages>1&&<div className="tc-supply-v5-pager" aria-label="상품 페이지">
    <button type="button" onClick={()=>{setPage(Math.max(0,safePage-1));setSelectedId('');}} disabled={safePage===0} aria-label="이전 상품">‹</button>
    <span>{safePage+1}/{pages}</span>
    <button type="button" onClick={()=>{setPage(Math.min(pages-1,safePage+1));setSelectedId('');}} disabled={safePage===pages-1} aria-label="다음 상품">›</button>
   </div>}
  </div>
  <div className="tc-supply-v5-catalog" aria-label="상점 상품 목록">
   {pageItems.length?<div className="tc-supply-v5-tiles">
    {pageItems.map(item=>{
     const isSelected=item.itemId===selected?.itemId;
     const itemLocked=shop.level<item.requiredLevel;
     const itemSold=remaining(item)===0;
     return <article className={'tc-supply-v5-card is-'+productTone(item.itemId)+(isSelected?' is-selected':'')+(itemLocked?' is-locked':'')} data-shop-item-id={item.itemId} key={item.itemId}>
      <button type="button" className="tc-supply-v5-product" aria-label={item.name+' 상품 선택'} aria-pressed={isSelected} onClick={()=>setSelectedId(item.itemId)}>
       <span className={'tc-supply-v5-tag '+(item.reset==='WEEKLY'?'weekly':'daily')}>{item.reset==='WEEKLY'?'주간 한정':'일일 한정'}</span>
       <span className="tc-supply-v5-art"><ShopRewardArt itemId={item.itemId}/></span>
       <strong className="tc-supply-v5-card-name">{item.name}</strong>
       <span className="tc-supply-v5-card-limit">{itemLocked?'Lv.'+item.requiredLevel+' 해금':itemSold?'구매 완료':'잔여 '+remaining(item)+'회'}</span>
       <span className="tc-supply-v5-card-price"><i aria-hidden="true">✥</i>{item.contributionCost.toLocaleString()}</span>
      </button>
     </article>;
    })}
   </div>:<p className="tc-supply-v5-empty">등록된 보급품이 없습니다.</p>}
  </div>
  {selected&&<section className="tc-supply-v5-detail" aria-label="선택한 상품 상세 정보">
   <div className={'tc-supply-v5-detail-art is-'+productTone(selected.itemId)} aria-hidden="true"><ShopRewardArt itemId={selected.itemId} large/></div>
   <div className="tc-supply-v5-detail-body">
    <div className="tc-supply-v5-detail-heading">
     <div><small>선택한 상품</small><h3>{selected.name}</h3></div>
     <span>{selected.reset==='DAILY'?'일일':'주간'} {selected.purchased}/{selected.purchaseLimit}</span>
    </div>
    <div className="tc-supply-v5-detail-meta">
     <span>원정단 Lv.{selected.requiredLevel} 이상</span>
     <span>{selected.reset==='DAILY'?'매일':'매주 월요일'} 00:00 초기화</span>
    </div>
    <div className="tc-supply-v5-detail-purchase">
     <div className="tc-supply-v5-total"><small>구매 가격</small><b><i aria-hidden="true">✥</i> {selected.contributionCost.toLocaleString()}</b></div>
     <button type="button" className="tc-supply-v5-purchase tc-feel-press" disabled={!canBuy} aria-label={selected.name+' 구매'} onClick={()=>onBuy(selected.itemId)}><Glyph name="shop"/>{buyLabel}</button>
    </div>
   </div>
  </section>}
  {(expedition||message)&&<p className="tc-supply-v5-feedback" role="status">{message||'안전 귀환 후 구매할 수 있습니다.'}</p>}
  {dock}
 </section>;
}
