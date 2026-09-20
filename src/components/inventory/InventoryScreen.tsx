import React,{useState,useCallback,useEffect,useRef,useLayoutEffect} from 'react';
import type {GameState} from '../../game/types';
import {inventoryView,selectInventory,type InventoryCategory,type InventorySort,type InventoryFilter} from '../../game/inventoryView';
import {equip} from '../../game/engine/state';
import {useSkillBook} from '../../game/engine/skills';
import {registerAppearance} from '../../game/engine/cosmetics';
import {SKILLS} from '../../game/data/config';
import {pageSlice,clampPageIndex} from '../mobile/mobilePagination';
import {inventoryPageSize,equipmentPreview} from './inventoryPresentation';
import {PageStepper} from '../mobile/PageStepper';
import {InventoryToolbar} from './InventoryToolbar';
import {InventoryTabs} from './InventoryTabs';
import {InventoryGrid} from './InventoryGrid';
import {InventoryDetailSheet} from './InventoryDetailSheet';
import './inventory.css';

export function InventoryScreen({game,setGame}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>}){
 const [category,setCategory]=useState<InventoryCategory>('all');
 const [query,setQuery]=useState('');
 const [sort,setSort]=useState<InventorySort>('default');
 const [filter,setFilter]=useState<InventoryFilter>({tier:0,status:false});
 const [selected,setSelected]=useState<string|null>(null);
 const [page,setPage]=useState(0);
 const gridSpace=useRef<HTMLDivElement>(null);
 const [size,setSize]=useState(16);
 useLayoutEffect(()=>{
  const el=gridSpace.current;if(!el)return;
  const update=()=>setSize(inventoryPageSize(el.clientHeight,el.clientWidth));
  update();const observer=new ResizeObserver(update);observer.observe(el);return()=>observer.disconnect();
 },[]);
 const items=inventoryView(game);
 const visible=selectInventory(items,category,query,sort,filter);
 const pageCount=Math.max(1,Math.ceil(visible.length/size));
 const safePage=clampPageIndex(page,visible.length,size);
 const pageItems=pageSlice(visible,safePage,size);
 const item=visible.find(i=>i.key===selected);
 const comparison=item?.category==='equipment'?equipmentPreview(game,item.sourceId):null;
 const close=useCallback(()=>setSelected(null),[]);

 useEffect(()=>{
  setPage(0);
  setSelected(null);
 },[category,query,sort,filter.tier,filter.status]);

 useEffect(()=>{
  if(page!==safePage)setPage(safePage);
 },[page,safePage]);

 useEffect(()=>{if(selected&&!item)setSelected(null);},[selected,item]);

 let action:(()=>void)|undefined,label='',disabled=false;
 if(item?.category==='equipment'){
  action=()=>setGame(s=>equip(s,item.sourceId));
  label=comparison?.reason||'장착';
  disabled=!!comparison?.reason;
 }
 if(item?.category==='skillbooks'){
  action=()=>setGame(s=>useSkillBook(s,item.sourceId));
  label=item.learned?'습득 완료':game.expedition?'원정 중 사용 불가':'사용하여 학습';
  disabled=!!item.learned||!!game.expedition||!SKILLS.some(s=>s.id===item.sourceId);
 }
 if(item?.category==='cosmetics'){
  action=()=>setGame(s=>registerAppearance(s,item.sourceId));
  label=item.registered?'등록 완료':'외형 등록';
  disabled=!!item.registered;
 }

 const changePage=(next:number)=>{
  setSelected(null);
  setPage(clampPageIndex(next,visible.length,size));
 };

 return <section className="inventory-screen">
  <div className="inventory-heading"><div><small>소지품</small><h1>가방</h1></div><span>보유 {items.length}종</span></div>
  <InventoryToolbar key={category} {...{query,setQuery,sort,setSort,filter,setFilter,category}}/>
  <InventoryTabs value={category} onChange={c=>{
   setCategory(c);
   setFilter({tier:0,status:false});
  }}/>
  <div className="inventory-grid-space" ref={gridSpace}>
   {visible.length?<InventoryGrid items={pageItems} selected={selected} onSelect={setSelected} size={size}/>:<div className="inventory-empty" role="status"><p>조건에 맞는 아이템이 없습니다.</p><button onClick={()=>{setQuery('');setCategory('all');setFilter({tier:0,status:false});}}>전체 아이템 보기</button></div>}
  </div>
  <PageStepper page={safePage} pageCount={pageCount} onPage={changePage}/>
  {item&&<InventoryDetailSheet key={item.key} item={item} comparison={comparison} onClose={close} {...{action,label,disabled}}/>}
 </section>;
}
