import React,{useState,useCallback,useEffect} from 'react';
import type {GameState} from '../../game/types';
import {inventoryView,selectInventory,type InventoryCategory,type InventorySort,type InventoryFilter} from '../../game/inventoryView';
import {equip} from '../../game/engine/state';
import {useSkillBook} from '../../game/engine/skills';
import {registerAppearance} from '../../game/engine/cosmetics';
import {SKILLS} from '../../game/data/config';
import {InventoryToolbar} from './InventoryToolbar';
import {InventoryTabs} from './InventoryTabs';
import {InventoryGrid} from './InventoryGrid';
import {InventoryDetailSheet} from './InventoryDetailSheet';
import './inventory.css';
export function InventoryScreen({game,setGame}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>}){
 useEffect(()=>{const nav=document.querySelector('nav');if(!nav)return;const update=()=>document.documentElement.style.setProperty('--inventory-nav-height',nav.getBoundingClientRect().height+'px');const observer=new ResizeObserver(update);observer.observe(nav);update();return()=>{observer.disconnect();document.documentElement.style.removeProperty('--inventory-nav-height');};},[]);
 const [category,setCategory]=useState<InventoryCategory>('all'),[query,setQuery]=useState(''),[sort,setSort]=useState<InventorySort>('default'),[filter,setFilter]=useState<InventoryFilter>({tier:0,status:false}),[selected,setSelected]=useState<string|null>(null);
 const close=useCallback(()=>setSelected(null),[]),items=inventoryView(game),visible=selectInventory(items,category,query,sort,filter),item=visible.find(i=>i.key===selected);
 let action:(()=>void)|undefined,label='',disabled=false;
 if(item?.category==='equipment'){action=()=>setGame(s=>equip(s,item.sourceId));label=item.equipped?'장착 중':game.expedition?'원정 중 변경 불가':'장착';disabled=!!item.equipped||!!game.expedition;}
 if(item?.category==='skillbooks'){action=()=>setGame(s=>useSkillBook(s,item.sourceId));label=item.learned?'습득 완료':game.expedition?'원정 중 사용 불가':'사용하여 학습';disabled=!!item.learned||!!game.expedition||!SKILLS.some(s=>s.id===item.sourceId);}
 if(item?.category==='cosmetics'){action=()=>setGame(s=>registerAppearance(s,item.sourceId));label=item.registered?'등록 완료':'외형 등록';disabled=!!item.registered;}
 return <section className="inventory-screen"><div className="inventory-heading"><h1>모험가의 가방</h1><small>표시 {visible.length}종 · 전체 {items.length}종</small></div><p className="inventory-caption">안전 귀환으로 확보한 영구 보유품</p><InventoryToolbar key={category} {...{query,setQuery,sort,setSort,filter,setFilter,category}}/><InventoryTabs value={category} onChange={c=>{setCategory(c);setSelected(null);setFilter({tier:0,status:false});}}/><InventoryGrid items={visible} selected={selected} onSelect={setSelected}/>{item&&<InventoryDetailSheet item={item} onClose={close} {...{action,label,disabled}}/>}</section>;
}

