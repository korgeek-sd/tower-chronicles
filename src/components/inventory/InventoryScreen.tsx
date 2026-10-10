import {skillBookFor} from '../../game/skills/books';
import {autoEquip,bestEquipmentIds,isEquipmentUpgrade} from '../../game/engine/equipmentAutoEquip';
import {unifiedInventoryView,LIFE_INVENTORY_CATEGORIES} from '../../game/life/inventory';
import type {FoodId} from '../../game/life/crafting';
import {useInventoryLife} from './useInventoryLife';
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {GameState} from '../../game/types';
import {selectInventory,categoryNames,type InventoryCategory,type InventorySort,type InventoryFilter} from '../../game/inventoryView';
import {equip,equipmentStatComparison,unequip} from '../../game/engine/state';
import {dismantleEquipment,equipmentDismantleYield} from '../../game/engine/equipmentDismantle';
import {V2_STARTER_EQUIPMENT_ID} from '../../game/data/equipment';
import {useSkillBook} from '../../game/engine/skills';
import {registerAppearance} from '../../game/engine/cosmetics';
import {SKILLS} from '../../game/data/config';
import {Glyph,Pager,Screen} from '../../ui/mobile';
import {InventoryDetailSheet,InventoryItemArt,InventoryStackCount} from './InventoryDetailSheet';
import type {GameplayLease} from '../../online/gameSession';
import {applyServerEconomyRecord,dismantleOnlineEquipment} from '../../online/economy';
import {marketItemIdForInventory} from '../../game/market/marketService';
import type {MarketIntent} from '../market/marketNavigation';

import {EQUIPMENT_GRADE_NAMES} from '../../game/data/equipment';

const PAGE_SIZE=36;


export function InventoryScreen({game,setGame,onlineLease,userId=null,onEnhancement,onMarket,onSkills,initialSelected,onInitialSelectedConsumed}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;onlineLease?:GameplayLease|null;userId?:string|null;onEnhancement:(itemId?:string,inventoryKey?:string)=>void;onMarket?:(intent:MarketIntent)=>void;onSkills?:()=>void;initialSelected?:string|null;onInitialSelectedConsumed?:()=>void}){
 const gridRef=useRef<HTMLDivElement>(null);
 const [pageSize,setPageSize]=useState(PAGE_SIZE);
 const [gridRows,setGridRows]=useState(6);
 useEffect(()=>{const grid=gridRef.current;if(!grid)return;const observer=new ResizeObserver(([entry])=>{const rows=Math.max(1,Math.floor((entry.contentRect.height+4)/48));setGridRows(rows);setPageSize(rows*6);});observer.observe(grid);return ()=>observer.disconnect();},[]);
 const life=useInventoryLife(userId,onlineLease??null);
 const [category,setCategory]=useState<InventoryCategory>('all'),[query,setQuery]=useState(''),[sort,setSort]=useState<InventorySort>('default'),[filter,setFilter]=useState<InventoryFilter>({tier:0,status:false}),[selected,setSelected]=useState<string|null>(null),[page,setPage]=useState(0),[toolsOpen,setToolsOpen]=useState(false),[busy,setBusy]=useState(false);
 const close=useCallback(()=>setSelected(null),[]);
 const items=unifiedInventoryView(game,life.state),visible=selectInventory(items,category,query,sort,filter),pages=Math.max(1,Math.ceil(visible.length/pageSize)),safe=Math.min(page,pages-1),shown=visible.slice(safe*pageSize,safe*pageSize+pageSize),item=items.find(i=>i.key===selected);
 useEffect(()=>{if(!initialSelected)return;setSelected(initialSelected);onInitialSelectedConsumed?.();},[initialSelected]);
 const categorySet=useMemo(()=>LIFE_INVENTORY_CATEGORIES,[]);
 const equippedCount=items.filter(i=>i.category==='equipment'&&i.equipped).length;
 let action:(()=>void)|undefined,label='',disabled=false;
 if(item?.category==='equipment'){action=()=>setGame(s=>item.equipped?unequip(s,item.sourceId):equip(s,item.sourceId));label=game.expedition?'원정 중 변경 불가':item.equipped?'장착 해제':'장착';disabled=!!game.expedition;}
 if(item?.lifeProduct&&item.category==='foods'){action=()=>life.consume(item.lifeProduct as FoodId);label=life.busy?'사용 처리 중…':'음식 먹기 · +30회';disabled=life.disabled;}
 if(item?.category==='skillbooks'&&skillBookFor(item.sourceId)){action=onSkills;label='스킬트리에서 습득';disabled=!onSkills;}
 else if(item?.category==='skillbooks'){action=()=>setGame(s=>useSkillBook(s,item.sourceId));label=item.learned?'습득 완료':game.expedition?'원정 중 사용 불가':'사용하여 학습';disabled=!!item.learned||!!game.expedition||!SKILLS.some(s=>s.id===item.sourceId);}
 if(item?.category==='cosmetics'){action=()=>setGame(s=>registerAppearance(s,item.sourceId));label=item.registered?'등록 완료':'외형 등록';disabled=!!item.registered;}
 const selectedEquipment=item?.category==='equipment'&&item.modern?(game.equipmentItems??[]).find(value=>value.id===item.sourceId):undefined;
 const marketItemId=item?marketItemIdForInventory(game,item):null;
 const marketVisible=!!item&&!item.lifeMaterial&&!item.lifeProduct&&!['potions','cosmetics','foods'].includes(item.category);
 const marketLabel=marketVisible?(marketItemId?'시세 · 거래':'거래 불가'):undefined;
 const marketDisabled=marketVisible&&(!marketItemId||!onMarket);
 const marketAction=marketItemId&&onMarket&&item?()=>onMarket({itemId:marketItemId,inventoryKey:item.key,sourceName:item.name}):undefined;
 const dismantleYield=selectedEquipment?equipmentDismantleYield(selectedEquipment):0;
 const starterProtected=item?.sourceId===V2_STARTER_EQUIPMENT_ID;
 const dismantleDisabled=busy||life.busy||!!game.expedition||!!item?.equipped||starterProtected;
 const dismantleLabel=starterProtected?'보급 장비 분해 불가':`분해 · 분해석 +${dismantleYield}`;
 const dismantleSelected=async()=>{
  if(!item||item.category!=='equipment'||!item.modern||!selectedEquipment)return;
  if(!onlineLease){setGame(s=>dismantleEquipment(s,item.sourceId));setSelected(null);return;}
  setBusy(true);
  try{
   const result=await dismantleOnlineEquipment(onlineLease,item.sourceId);
   setGame(s=>({...applyServerEconomyRecord(s,result.record),notice:`${item.name} 분해 완료 · 분해석 ${result.splitStones??0}개 획득`}));
   setSelected(null);void life.refresh();
  }catch(error){
   setGame(s=>({...s,notice:error instanceof Error?error.message:'장비 분해에 실패했습니다.'}));
  }finally{setBusy(false);}
 };
 const tierVisible=['all','equipment','materials','tickets'].includes(category);
 const statusLabel=category==='equipment'?'장착 중':category==='skillbooks'?'미습득':category==='cosmetics'?'미등록':'';
 function comparisonFor(sourceId:string){return equipmentStatComparison(game,sourceId);}
 return <Screen eyebrow="NOVAR QUARTERMASTER / LOADOUT" title="장비 · 보관함" meta={<><span>장착 {equippedCount}/7 · {items.length}종</span></>} className="tc-inventory-screen tc-unified-inventory">
  <div className="tc-ref-inventory tc-inventory-v081 tc-storage-only">
   <section className={'tc-storage-board'+(pages===1?' tc-storage-single-page':'')}>
    <div className="tc-storage-head"><div><small>QUARTERMASTER STORAGE</small><b>인벤토리</b><em role="status">{life.error||life.pending?'아이템 상태 확인 필요':life.busy?'수량 확인 중…':life.message||`${categoryNames[category]} · ${visible.length}종`}</em></div>{(life.error||life.pending)&&<button disabled={life.busy||!onlineLease} onClick={life.retry}>다시 확인</button>}<button className="tc-auto-equip" title="무기 종류 유지 · 상위 등급 장착" disabled={!!game.expedition||busy||bestEquipmentIds(game).length===0} onClick={()=>setGame(autoEquip)}>자동 장착</button><button className={toolsOpen?'active':''} onClick={()=>setToolsOpen(v=>!v)} aria-label="검색과 정렬"><Glyph name="filter"/> 정렬</button></div>
    <div className="tc-storage-categories">{categorySet.map(c=><button key={c} aria-selected={category===c} aria-label={categoryNames[c]} onClick={()=>{setCategory(c);setSelected(null);setFilter({tier:0,status:false});setPage(0);}}><Glyph name={c==='foods'?'health':c}/><small>{categoryNames[c]}</small></button>)}</div>
    {toolsOpen&&<div className="tc-storage-tools"><input aria-label="아이템 검색" placeholder="이름 검색" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/><select aria-label="정렬" value={sort} onChange={e=>setSort(e.target.value as InventorySort)}><option value="default">기본 정렬</option><option value="name">이름순</option><option value="tier">티어 높은순</option><option value="quantity">수량 많은순</option></select>{tierVisible&&<select aria-label="티어 필터" value={filter.tier} onChange={e=>{setFilter({...filter,tier:+e.target.value});setPage(0);}}>{[0,1,2,3,4,5].map(t=><option key={t} value={t}>{t?'T'+t:'전체 티어'}</option>)}</select>}{statusLabel&&<label><input type="checkbox" checked={filter.status} onChange={e=>setFilter({...filter,status:e.target.checked})}/>{statusLabel}</label>}</div>}
    <div ref={gridRef} className="tc-storage-grid tc-storage-dense" style={{gridTemplateRows:`repeat(${gridRows},minmax(0,1fr))`}}>{shown.map(i=><button key={i.key} className={'tc-storage-item tc-storage-item-compact'+(i.grade?' grade-'+i.grade:'')+(i.equipped?' equipped':'')} aria-label={i.name+' · '+i.quantity.toLocaleString()+'개'+(i.grade?' · '+EQUIPMENT_GRADE_NAMES[i.grade]:'')+(i.enhancement!==undefined?' · 강화 +'+i.enhancement:'')+(i.equipped?' · 장착 중':'')} title={i.name} aria-pressed={selected===i.key} onClick={()=>setSelected(i.key)}><div className="tc-storage-icon"><InventoryItemArt item={i} slot/>{i.modern&&isEquipmentUpgrade(game,i.sourceId)&&<svg className="tc-equipment-upgrade" role="img" aria-label="현재 장비보다 상위 등급" viewBox="0 0 16 16"><path d="M8 2 2 8h4v6h4V8h4Z" fill="currentColor"/></svg>}{i.grade&&<span className={'tc-storage-grade grade-'+i.grade}>{EQUIPMENT_GRADE_NAMES[i.grade]}</span>}</div><strong className="tc-storage-item-name">{i.name}</strong><InventoryStackCount item={i}/>{i.enhancement!==undefined&&i.enhancement>0&&<b className="tc-storage-enhance">+{i.enhancement}</b>}{i.equipped&&<em aria-label="장착 중">●</em>}</button>)}{Array.from({length:Math.max(0,pageSize-shown.length)},(_,i)=><div className="tc-storage-item empty" aria-hidden="true" key={'empty'+i}/>)}</div>
    <Pager page={safe} count={pages} onChange={setPage}/>
   </section>
  </div>
  {item&&<InventoryDetailSheet item={item} status={item.category==='foods'?life.error||(life.pending?'사용 결과를 다시 확인해 주세요.':life.message):undefined} retryAction={item.category==='foods'&&(life.pending||life.error)?life.retry:undefined} retryDisabled={life.busy||!onlineLease} comparison={item.category==='equipment'?comparisonFor(item.sourceId):null} onClose={close}  marketAction={marketAction} marketDisabled={marketDisabled} marketLabel={marketLabel} dangerAction={item.category==='equipment'&&item.modern?dismantleSelected:undefined} dangerDisabled={dismantleDisabled} dangerLabel={busy?'분해 처리 중':dismantleLabel} {...{action,label,disabled}}/>}
 </Screen>;
}
