import React,{useState,useCallback,useEffect} from 'react';
import type {GameState,Slot} from '../../game/types';
import {inventoryView,selectInventory,type InventoryCategory,type InventorySort,type InventoryFilter} from '../../game/inventoryView';
import {equip,itemSlot} from '../../game/engine/state';
import {registerAppearance} from '../../game/engine/cosmetics';
import {SLOTS} from '../../game/data/config';
import {InventoryToolbar} from './InventoryToolbar';
import {InventoryTabs} from './InventoryTabs';
import {InventoryGrid} from './InventoryGrid';
import {InventoryDetailSheet} from './InventoryDetailSheet';
import './inventory.css';
export function InventoryScreen({game,setGame,slotFilter=null,onClearSlot,onCharacter}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;slotFilter?:Slot|null;onClearSlot?:()=>void;onCharacter?:()=>void}){
 const [category,setCategory]=useState<InventoryCategory>(slotFilter?'equipment':'all'),[query,setQuery]=useState(''),[sort,setSort]=useState<InventorySort>('default'),[filter,setFilter]=useState<InventoryFilter>({tier:0,status:false}),[selected,setSelected]=useState<string|null>(null);
 const close=useCallback(()=>setSelected(null),[]);
 useEffect(()=>{if(slotFilter){setCategory('equipment');setSelected(null);}},[slotFilter]);
 const items=inventoryView(game).filter(item=>item.category!=='skillbooks');
 const visible=selectInventory(items,category,query,sort,filter).filter(item=>!slotFilter||item.category==='equipment'&&game.items.some(gear=>gear.id===item.sourceId&&itemSlot(gear.kind)===slotFilter));
 const item=visible.find(candidate=>candidate.key===selected);
 let action:(()=>void)|undefined,label='',disabled=false;
 if(item?.category==='equipment'){action=()=>setGame(s=>equip(s,item.sourceId));label=item.equipped?'장착 중':game.expedition?'원정 중 변경 불가':'장비 장착';disabled=!!item.equipped||!!game.expedition;}
 if(item?.category==='cosmetics'){action=()=>setGame(s=>registerAppearance(s,item.sourceId));label=item.registered?'등록 완료':'외형 등록';disabled=!!item.registered;}
 return <section className="inventory-screen">
   <div className="journal-heading"><div><small>INVENTORY / 보관 기록</small><h1>모험가의 가방</h1></div>{onCharacter&&<button onClick={onCharacter}>캐릭터 <span>↗</span></button>}</div>
   <div className="inventory-summary"><span><i/>안전 귀환으로 확보한 보유품</span><b>{items.length}<small>종</small></b></div>
   {game.expedition&&<p className="journal-lock">원정 진행 중 · 장비는 귀환 후 변경할 수 있습니다.</p>}
   {slotFilter&&<div className="inventory-slot-filter"><span>{SLOTS[slotFilter]} 선택</span><button onClick={onClearSlot}>전체 가방 보기 ×</button></div>}
   <InventoryTabs value={category} onChange={value=>{setCategory(value);setSelected(null);setFilter({tier:0,status:false});onClearSlot?.();}}/>
   <InventoryToolbar key={category} {...{query,setQuery,sort,setSort,filter,setFilter,category}}/>
   <div className="inventory-grid-heading"><span>{slotFilter?SLOTS[slotFilter]:'보관함'}</span><small>{visible.length}종 표시 · 눌러서 상세 보기</small></div>
   <InventoryGrid items={visible} selected={selected} onSelect={setSelected}/>
   {item&&<InventoryDetailSheet item={item} onClose={close} game={game} onCharacter={onCharacter} {...{action,label,disabled}}/>}
 </section>;
}

