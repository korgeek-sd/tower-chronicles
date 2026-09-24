import React,{useState,useCallback} from 'react';
import type {GameState} from '../../game/types';
import {inventoryView,selectInventory,categories,categoryNames,type InventoryCategory,type InventorySort,type InventoryFilter} from '../../game/inventoryView';
import {equip} from '../../game/engine/state';
import {useSkillBook} from '../../game/engine/skills';
import {registerAppearance} from '../../game/engine/cosmetics';
import {SKILLS} from '../../game/data/config';
import {Glyph,Pager,Screen} from '../../ui/mobile';
import {InventoryDetailSheet} from './InventoryDetailSheet';

const PAGE_SIZE=12;
export function InventoryScreen({game,setGame,onEnhance}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;onEnhance?:()=>void}){
 const [category,setCategory]=useState<InventoryCategory>('all'),[query,setQuery]=useState(''),[sort,setSort]=useState<InventorySort>('default'),[filter,setFilter]=useState<InventoryFilter>({tier:0,status:false}),[selected,setSelected]=useState<string|null>(null),[page,setPage]=useState(0),[filterOpen,setFilterOpen]=useState(false);
 const close=useCallback(()=>setSelected(null),[]);
 const items=inventoryView(game),visible=selectInventory(items,category,query,sort,filter),pages=Math.max(1,Math.ceil(visible.length/PAGE_SIZE)),safe=Math.min(page,pages-1),shown=visible.slice(safe*PAGE_SIZE,safe*PAGE_SIZE+PAGE_SIZE),item=visible.find(i=>i.key===selected);
 let action:(()=>void)|undefined,label='',disabled=false;
 if(item?.category==='equipment'){action=()=>setGame(s=>equip(s,item.sourceId));label=item.equipped?'장착 중':game.expedition?'원정 중 변경 불가':'장착';disabled=!!item.equipped||!!game.expedition;}
 if(item?.category==='skillbooks'){action=()=>setGame(s=>useSkillBook(s,item.sourceId));label=item.learned?'습득 완료':game.expedition?'원정 중 사용 불가':'사용하여 학습';disabled=!!item.learned||!!game.expedition||!SKILLS.some(s=>s.id===item.sourceId);}
 if(item?.category==='cosmetics'){action=()=>setGame(s=>registerAppearance(s,item.sourceId));label=item.registered?'등록 완료':'외형 등록';disabled=!!item.registered;}
 const tierVisible=['all','equipment','materials','tickets'].includes(category),statusLabel=category==='equipment'?'장착 중':category==='skillbooks'?'미습득':category==='cosmetics'?'미등록':'';
 return <Screen eyebrow="PERMANENT STORAGE" title="보관함" meta={<>{visible.length} / {items.length}</>} className="tc-inventory-screen">
  <div className="tc-inventory">
   <div className="tc-inv-toolbar"><input aria-label="아이템 검색" placeholder="이름 검색" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/><select aria-label="정렬" value={sort} onChange={e=>setSort(e.target.value as InventorySort)}><option value="default">기본</option><option value="name">이름</option><option value="tier">티어↓</option><option value="quantity">수량↓</option></select><button aria-label="필터" onClick={()=>setFilterOpen(v=>!v)}><Glyph name="filter"/></button></div>
   <div className="tc-inv-tabs">{categories.map(c=><button key={c} aria-selected={category===c} onClick={()=>{setCategory(c);setSelected(null);setFilter({tier:0,status:false});setPage(0);}}>{categoryNames[c]}</button>)}</div>
   <div className="tc-inv-grid">{shown.map(i=><button key={i.key} className={'tc-inv-slot '+(i.category==='equipment'?'gear':'')} aria-label={i.name+' · '+i.quantity+'개'} aria-pressed={selected===i.key} onClick={()=>setSelected(i.key)}><span className="tc-item-tier">{i.tier?'T'+i.tier:''}</span><Glyph name={i.iconId}/><small>{i.name}</small>{i.enhancement!==undefined&&i.enhancement>0&&<b>+{i.enhancement}</b>}{i.equipped&&<em>장착</em>}</button>)}{Array.from({length:Math.max(0,PAGE_SIZE-shown.length)},(_,i)=><div className="tc-inv-slot" aria-hidden="true" key={'empty'+i}/>)}</div>
   <Pager page={safe} count={pages} onChange={setPage}/>
   {filterOpen&&<div className="tc-filter-pop">{tierVisible&&<label>티어<select value={filter.tier} onChange={e=>{setFilter({...filter,tier:+e.target.value});setPage(0);}}>{[0,1,2,3,4,5].map(t=><option key={t} value={t}>{t?'T'+t:'전체'}</option>)}</select></label>}{statusLabel&&<label>{statusLabel}<input type="checkbox" checked={filter.status} onChange={e=>setFilter({...filter,status:e.target.checked})}/></label>}<button className="tc-action secondary slim" onClick={()=>{setFilter({tier:0,status:false});setFilterOpen(false);}}>필터 초기화</button></div>}
  </div>
  {item&&<InventoryDetailSheet item={item} onClose={close} {...{action,label,disabled}} secondaryAction={item.category==='equipment'&&onEnhance?()=>{close();onEnhance();}:undefined} secondaryDisabled={!!game.expedition||item.sourceId==='starter'} secondaryLabel="강화"/>}
 </Screen>;
}
