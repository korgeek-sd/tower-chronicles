import React,{useState} from 'react';
import {Glyph} from '../../ui/mobile';
import type {OnlineAssociationShopItem,OnlineAssociationShopState} from '../../online/associationShop';
import './supply-showcase.css';

export type SupplyShopFilter='ALL'|'DAILY'|'WEEKLY'|'CURRENCY';
const FILTERS:readonly (readonly [SupplyShopFilter,string])[]=[
 ['ALL','추천'],['DAILY','일일'],['WEEKLY','주간'],['CURRENCY','재화']
];
const currencyItem=(item:OnlineAssociationShopItem)=>
 item.itemId==='silver_box_daily'||item.itemId==='gold_box_weekly';
const productIcon=(id:string)=>
 id.includes('vitality_potion')?'potions':id.includes('job_draw_ticket')?'tickets':
 id.includes('rare_equipment')?'inventory':id.includes('box')?'market':'materials';
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

export function AssociationShopShowcase({
 shop,filter,onFilter,busy,expedition,onBuy,onRefresh,message=''
}:{
 shop:OnlineAssociationShopState;filter:SupplyShopFilter;
 onFilter:(filter:SupplyShopFilter)=>void;busy:boolean;expedition:boolean;
 onBuy:(id:string)=>void;onRefresh:()=>void;message?:string;
}){
 const [selectedId,setSelectedId]=useState('');
 const visible=shownItems(shop,filter);
 const selected=visible.find(item=>item.itemId===selectedId)??visible[0]??null;
 const featured=shop.weekly.find(item=>item.itemId==='gold_box_weekly')??
  shop.daily.find(item=>item.itemId==='silver_box_daily')??[...shop.daily,...shop.weekly][0]??null;
 const sold=selected?remaining(selected)===0:false;
 const locked=selected?shop.level<selected.requiredLevel:false;
 const insufficient=selected?shop.contribution<selected.contributionCost:false;
 const canBuy=!!selected&&!busy&&!expedition&&!sold&&!locked&&!insufficient;
 const buyLabel=busy?'처리 중':expedition?'원정 중 구매 불가':locked&&selected?'Lv.'+selected.requiredLevel+' 해금':
  sold?'구매 완료':insufficient?'공헌도 부족':'구매하기';
 const chooseFeatured=()=>{
  if(!featured)return;
  onFilter('ALL');
  setSelectedId(featured.itemId);
 };
 return <section className="tc-supply tc-supply-shop tc-supply-v4" aria-label="원정단 상점">
  <header className="tc-supply-v4-head">
   <div className="tc-supply-v4-heading"><Glyph name="market"/><b>원정단 상점</b><small>Lv.{shop.level}</small></div>
   <div className="tc-supply-v4-balance" aria-label={'보유 공헌도 '+shop.contribution.toLocaleString()}>
    <span className="tc-supply-v4-token" aria-hidden="true">✥</span><span className="tc-supply-v4-balance-value">{shop.contribution.toLocaleString()}</span>
   </div>
   <button type="button" className="tc-supply-v4-refresh" disabled={busy} aria-label="상점 정보 새로고침" onClick={onRefresh}>↻</button>
  </header>
  {featured&&<div className="tc-supply-v4-feature">
   <div className={'tc-supply-v4-feature-emblem is-'+productTone(featured.itemId)} aria-hidden="true"><Glyph name={productIcon(featured.itemId)}/></div>
   <div className="tc-supply-v4-feature-copy">
    <small>원정단 추천 보급품</small>
    <strong>{featured.name}</strong>
    <span><i aria-hidden="true">✥</i> {featured.contributionCost.toLocaleString()} <em>· {featured.reset==='DAILY'?'일일':'주간'} {remaining(featured)}회 남음</em></span>
   </div>
   <button type="button" className="tc-supply-v4-feature-cta" onClick={chooseFeatured} aria-label={featured.name+' 상품 보기'}>보기 ›</button>
  </div>}
  <nav className="tc-supply-v4-tabs" aria-label="원정단 상점 품목 필터">
   {FILTERS.map(([value,label])=><button type="button" key={value} aria-pressed={filter===value} className={filter===value?'active':''} onClick={()=>onFilter(value)}>{label}</button>)}
  </nav>
  <div className="tc-supply-v4-catalog" aria-label="상점 상품 목록">
   {visible.length?<div className="tc-supply-v4-tiles">
    {visible.map(item=>{
     const isSelected=item.itemId===selected?.itemId;
     const itemLocked=shop.level<item.requiredLevel;
     const itemSold=remaining(item)===0;
     return <article className={'tc-supply-v4-card is-'+productTone(item.itemId)+(isSelected?' is-selected':'')+(itemLocked?' is-locked':'')} data-shop-item-id={item.itemId} key={item.itemId}>
      <button type="button" aria-label={item.name+' 상품 선택'} aria-pressed={isSelected} className="tc-supply-v4-product" onClick={()=>setSelectedId(item.itemId)}>
       <span className={'tc-supply-v4-card-tag '+(item.reset==='WEEKLY'?'weekly':'daily')}>{item.reset==='WEEKLY'?'주간':'일일'}</span>
       <span className="tc-supply-v4-card-art"><Glyph name={productIcon(item.itemId)}/></span>
       <span className="tc-supply-v4-card-name">{item.name}</span>
       <span className="tc-supply-v4-card-limit">{itemLocked?'Lv.'+item.requiredLevel+' 잠금':itemSold?'구매 완료':'잔여 '+remaining(item)+'회'}</span>
       <span className="tc-supply-v4-card-price"><i aria-hidden="true">✥</i> {item.contributionCost.toLocaleString()}</span>
      </button>
     </article>;
    })}
   </div>:<p className="tc-supply-v4-empty">이 분류에 등록된 보급품이 없습니다.</p>}
  </div>
  <div className="tc-supply-v4-detail" aria-live="polite">
   {selected?<><div className="tc-supply-v4-detail-top">
    <span className={'tc-supply-v4-detail-icon is-'+productTone(selected.itemId)} aria-hidden="true"><Glyph name={productIcon(selected.itemId)}/></span>
    <div className="tc-supply-v4-detail-copy"><small>선택한 보급품 · {selected.reset==='DAILY'?'일일':'주간'} 교환</small><strong>{selected.name}</strong><span>구매 현황 {selected.purchased}/{selected.purchaseLimit}회 · {locked?'Lv.'+selected.requiredLevel+' 필요':'교환 가능'}</span></div>
    <div className="tc-supply-v4-detail-cost"><small>필요 공헌도</small><b><i aria-hidden="true">✥</i> {selected.contributionCost.toLocaleString()}</b></div>
   </div>
   <div className="tc-supply-v4-detail-action">
    <span className="tc-supply-v4-detail-hint">{message|| (expedition?'안전 귀환 후 구매할 수 있습니다.':selected.reset==='DAILY'?'매일 00:00 초기화':'매주 월요일 00:00 초기화')}</span>
    <button type="button" className="tc-supply-v4-purchase tc-feel-press" disabled={!canBuy} aria-label={selected.name+' 구매'} onClick={()=>onBuy(selected.itemId)}><Glyph name="shop"/>{buyLabel}</button>
   </div></>:<span className="tc-supply-v4-empty">구매 가능한 상품이 없습니다.</span>}
  </div>
 </section>;
}
