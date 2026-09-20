import React from 'react';
import type {InventoryViewItem} from '../../game/inventoryView';
import {InventoryIcon} from './InventoryIcon';
export function InventoryGrid({items,selected,onSelect,size=16}:{items:InventoryViewItem[];selected:string|null;onSelect:(key:string)=>void;size?:number}){
 return <div className="inventory-grid">{items.map(i=><button key={i.key} className={'inventory-slot '+(selected===i.key?'selected':'')} aria-label={i.name+' · '+i.quantity+'개'+(i.equipped?' · 장착 중':'')} aria-pressed={selected===i.key} onClick={()=>onSelect(i.key)}><InventoryIcon id={i.iconId} tier={i.tier}/><span className="item-tier">{i.tier?'T'+i.tier:''}</span>{i.stack&&<span className="item-count">{i.quantity.toLocaleString()}</span>}{!!i.enhancement&&<span className="item-enhancement">+{i.enhancement}</span>}{i.equipped&&<span className="item-equipped" aria-hidden="true">착용</span>}</button>)}{Array.from({length:Math.max(0,size-items.length)},(_,i)=><div className="inventory-empty-slot" aria-hidden="true" key={'empty'+i}/>)}</div>;
}
