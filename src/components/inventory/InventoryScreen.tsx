import React,{useState,useCallback,useEffect} from 'react';
import type {GameState} from '../../game/types';
import {inventoryView,selectInventory,type InventoryCategory,type InventorySort,type InventoryFilter} from '../../game/inventoryView';
import {equip} from '../../game/engine/state';
import {useSkillBook} from '../../game/engine/skills';
import {registerAppearance} from '../../game/engine/cosmetics';
import {SKILLS} from '../../game/data/config';
import {pageSizeFor,pageSlice,clampPageIndex} from '../mobile/mobilePagination';
import {useViewportHeight} from '../mobile/useViewportHeight';
import {PageStepper} from '../mobile/PageStepper';
import {ScreenHeader} from '../mobile/ScreenHeader';
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
 const height=useViewportHeight();
 const size=pageSizeFor('inventory',height);
 const items=inventoryView(game);
 const visible=selectInventory(items,category,query,sort,filter);
 const pageCount=Math.max(1,Math.ceil(visible.length/size));
 const safePage=clampPageIndex(page,visible.length,size);
 const pageItems=pageSlice(visible,safePage,size);
 const item=visible.find(i=>i.key===selected);
 const close=useCallback(()=>setSelected(null),[]);

 useEffect(()=>{
  setPage(0);
  setSelected(null);
 },[category,query,sort,filter.tier,filter.status]);

 useEffect(()=>{
  if(page!==safePage)setPage(safePage);
 },[page,safePage]);

 let action:(()=>void)|undefined,label='',disabled=false;
 if(item?.category==='equipment'){
  action=()=>setGame(s=>equip(s,item.sourceId));
  label=item.equipped?'장착 중':game.expedition?'원정 중 변경 불가':'장착';
  disabled=!!item.equipped||!!game.expedition;
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
  <ScreenHeader title="모험가의 가방" meta={'보유 '+items.length+'종 · 표시 '+visible.length+'종'}/>
  <InventoryToolbar key={category} {...{query,setQuery,sort,setSort,filter,setFilter,category}}/>
  <InventoryTabs value={category} onChange={c=>{
   setCategory(c);
   setFilter({tier:0,status:false});
  }}/>
  <InventoryGrid items={pageItems} selected={selected} onSelect={setSelected}/>
  <PageStepper page={safePage} pageCount={pageCount} onPage={changePage}/>
  {item&&<InventoryDetailSheet item={item} onClose={close} {...{action,label,disabled}}/>}
 </section>;
}
