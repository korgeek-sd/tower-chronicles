import React from 'react';
import type {InventoryViewItem} from '../../game/inventoryView';
import {shortItemName,tierRoman} from '../../game/equipmentView';
import {InventoryIcon} from './InventoryDetailSheet';
import './item-slots.css';
function caption(item:InventoryViewItem){
 if(item.category==='tickets'){const [tower,index]=item.sourceId.split(':');return ({ore:'철맥',leather:'송곳니',gem:'천광',kaleon:'녹빛'}[tower]??'탑')+' '+(Number(index)+1)+'층';}
 return (item.category==='materials'&&item.tier?tierRoman(item.tier)+' ':'')+shortItemName(item.name);
}
export function InventoryGrid({items,selected,onSelect}:{items:InventoryViewItem[];selected:string|null;onSelect:(key:string)=>void}){
 return items.length?<div className="inventory-grid">{items.map(item=><div className="inventory-cell" key={item.key}><button className={'inventory-slot '+(selected===item.key?'selected':'')+(item.equipped?' is-equipped':'')} aria-label={item.name+' · '+item.quantity+'개'+(item.equipped?' · 장착 중':'')} aria-pressed={selected===item.key} onClick={()=>onSelect(item.key)}><InventoryIcon id={item.iconId} tier={item.tier}/>{item.stack&&<span className="item-count">{item.quantity.toLocaleString()}</span>}{!!item.enhancement&&<span className="item-enhancement">+{item.enhancement}</span>}{item.equipped&&<span className="item-equipped" title="장착 중" aria-hidden="true">✓</span>}</button><span className="inventory-cell-name">{caption(item)}</span></div>)}{Array.from({length:Math.max(0,12-items.length)},(_,index)=><div className="inventory-cell is-empty" aria-hidden="true" key={'empty-'+index}><div/><span/></div>)}</div>:<div className="inventory-empty" role="status"><InventoryIcon id="all"/><strong>이곳에는 아직 물품이 없습니다</strong><p>다른 분류를 선택하거나 검색 조건을 바꿔보세요.</p></div>;
}
