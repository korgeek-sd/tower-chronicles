import React from 'react';
import type {InventoryViewItem} from '../../game/inventoryView';
import {InventoryIcon} from './InventoryDetailSheet';
import './item-slots.css';
export function InventoryGrid({items,selected,onSelect}:{items:InventoryViewItem[];selected:string|null;onSelect:(key:string)=>void}){return items.length?<div className="inventory-grid">{items.map(i=><button key={i.key} className={'inventory-slot '+(selected===i.key?'selected':'')} aria-label={i.name+' · '+i.quantity+'개'+(i.equipped?' · 장착 중':'')} aria-pressed={selected===i.key} onClick={()=>onSelect(i.key)}><InventoryIcon id={i.iconId} tier={i.tier}/>{i.stack&&<span className="item-count">{i.quantity.toLocaleString()}</span>}{!!i.enhancement&&<span className="item-enhancement">+{i.enhancement}</span>}{i.equipped&&<span className="item-equipped" title="장착 중" aria-hidden="true">✓</span>}</button>)}</div>:<p className="inventory-empty" role="status">조건에 맞는 아이템이 없습니다.</p>;}
