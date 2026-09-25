import React,{useCallback,useMemo,useState} from 'react';
import type {GameState,Slot} from '../../game/types';
import {inventoryView,selectInventory,categories,categoryNames,type InventoryCategory,type InventorySort,type InventoryFilter} from '../../game/inventoryView';
import {equip,equippedItem,itemName,itemSlot,stats} from '../../game/engine/state';
import {useSkillBook} from '../../game/engine/skills';
import {registerAppearance} from '../../game/engine/cosmetics';
import {SKILLS,SLOTS} from '../../game/data/config';
import {assetUrl,playerGraphicFor} from '../../game/data/graphics';
import {Glyph,Pager,Screen} from '../../ui/mobile';
import {InventoryDetailSheet} from './InventoryDetailSheet';

const PAGE_SIZE=8;
const SLOT_GLYPH:Record<Slot,string>={weapon:'sword',armor:'armor',boots:'boots',accessory:'accessory'};

export function InventoryScreen({game,setGame}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>}){
 const [category,setCategory]=useState<InventoryCategory>('all'),[query,setQuery]=useState(''),[sort,setSort]=useState<InventorySort>('default'),[filter,setFilter]=useState<InventoryFilter>({tier:0,status:false}),[selected,setSelected]=useState<string|null>(null),[page,setPage]=useState(0),[toolsOpen,setToolsOpen]=useState(false);
 const close=useCallback(()=>setSelected(null),[]);
 const items=inventoryView(game),visible=selectInventory(items,category,query,sort,filter),pages=Math.max(1,Math.ceil(visible.length/PAGE_SIZE)),safe=Math.min(page,pages-1),shown=visible.slice(safe*PAGE_SIZE,safe*PAGE_SIZE+PAGE_SIZE),item=items.find(i=>i.key===selected);
 const categorySet=useMemo(()=>categories,[ ]),st=stats(game),graphic=playerGraphicFor(game.cosmetics.selectedAppearanceId),characterSrc=graphic.image.idle?assetUrl(graphic.image.idle):undefined;
 let action:(()=>void)|undefined,label='',disabled=false;
 if(item?.category==='equipment'){action=()=>setGame(s=>equip(s,item.sourceId));label=item.equipped?'장착 중':game.expedition?'원정 중 변경 불가':'장착';disabled=!!item.equipped||!!game.expedition;}
 if(item?.category==='skillbooks'){action=()=>setGame(s=>useSkillBook(s,item.sourceId));label=item.learned?'습득 완료':game.expedition?'원정 중 사용 불가':'사용하여 학습';disabled=!!item.learned||!!game.expedition||!SKILLS.some(s=>s.id===item.sourceId);}
 if(item?.category==='cosmetics'){action=()=>setGame(s=>registerAppearance(s,item.sourceId));label=item.registered?'등록 완료':'외형 등록';disabled=!!item.registered;}
 const tierVisible=['all','equipment','materials','tickets'].includes(category);
 const statusLabel=category==='equipment'?'장착 중':category==='skillbooks'?'미습득':category==='cosmetics'?'미등록':'';
 function openEquipped(slot:Slot){const equipped=equippedItem(game,slot);if(!equipped)return;const view=items.find(i=>i.category==='equipment'&&i.sourceId===equipped.id);if(view)setSelected(view.key);}
 return <Screen eyebrow="EXPLORER LOADOUT / STORAGE" title="장비 · 보관함" meta={<span>{items.length}종</span>} className="tc-inventory-screen">
  <div className="tc-ref-inventory">
   <section className="tc-loadout-stage" aria-label="현재 장착 장비">
    <div className="tc-loadout-vitals"><span><small>공격</small><b>{Math.round(st.attack)}</b></span><span><small>HP</small><b>{Math.round(st.hp)}</b></span><span><small>방어</small><b>{Math.round(st.defense)}</b></span></div>
    <div className="tc-loadout-character">{characterSrc?<img src={characterSrc} alt="현재 모험가"/>:<Glyph name="jobs"/>}<div className="tc-loadout-ground"/></div>
    {(Object.keys(SLOTS) as Slot[]).map(slot=>{const equipped=equippedItem(game,slot);return <button key={slot} className={'tc-equip-slot slot-'+slot+(equipped?' filled':'')} onClick={()=>openEquipped(slot)} disabled={!equipped} aria-label={SLOTS[slot]+(equipped?' '+itemName(equipped):' 비어 있음')}><span className="tc-equip-icon"><Glyph name={equipped?itemSlot(equipped.kind):SLOT_GLYPH[slot]}/></span><strong>{SLOTS[slot]}</strong><small>{equipped?itemName(equipped):'비어 있음'}</small>{equipped&&equipped.enhancement>0&&<b>+{equipped.enhancement}</b>}</button>;})}
    <div className="tc-loadout-caption">현재 장착 장비를 누르면 상세 정보를 확인할 수 있습니다.</div>
   </section>

   <section className="tc-storage-board">
    <div className="tc-storage-head"><div><b>영구 보관함</b><small>{categoryNames[category]} · {visible.length}종</small></div><button className={toolsOpen?'active':''} onClick={()=>setToolsOpen(v=>!v)} aria-label="검색과 정렬"><Glyph name="filter"/> 정렬</button></div>
    <div className="tc-storage-categories">{categorySet.map(c=><button key={c} aria-selected={category===c} aria-label={categoryNames[c]} onClick={()=>{setCategory(c);setSelected(null);setFilter({tier:0,status:false});setPage(0);}}><Glyph name={c}/><small>{categoryNames[c]}</small></button>)}</div>
    {toolsOpen&&<div className="tc-storage-tools"><input aria-label="아이템 검색" placeholder="이름 검색" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/><select aria-label="정렬" value={sort} onChange={e=>setSort(e.target.value as InventorySort)}><option value="default">기본 정렬</option><option value="name">이름순</option><option value="tier">티어 높은순</option><option value="quantity">수량 많은순</option></select>{tierVisible&&<select aria-label="티어 필터" value={filter.tier} onChange={e=>{setFilter({...filter,tier:+e.target.value});setPage(0);}}>{[0,1,2,3,4,5].map(t=><option key={t} value={t}>{t?'T'+t:'전체 티어'}</option>)}</select>}{statusLabel&&<label><input type="checkbox" checked={filter.status} onChange={e=>setFilter({...filter,status:e.target.checked})}/>{statusLabel}</label>}</div>}
    <div className="tc-storage-grid">{shown.map(i=><button key={i.key} className="tc-storage-item" aria-label={i.name+' · '+i.quantity+'개'} onClick={()=>setSelected(i.key)}><div className="tc-storage-icon"><Glyph name={i.iconId}/>{i.tier&&<span>T{i.tier}</span>}</div><strong>{i.name}</strong><small>{i.stack?i.quantity.toLocaleString()+'개':i.equipped?'장착 중':i.enhancement!==undefined?'+'+i.enhancement:'1개'}</small>{i.equipped&&<em>●</em>}</button>)}{Array.from({length:Math.max(0,PAGE_SIZE-shown.length)},(_,i)=><div className="tc-storage-item empty" aria-hidden="true" key={'empty'+i}/>)}</div>
    <Pager page={safe} count={pages} onChange={setPage}/>
   </section>
  </div>
  {item&&<InventoryDetailSheet item={item} onClose={close} {...{action,label,disabled}}/>}
 </Screen>;
}
