import React from 'react';
import {categories,categoryNames,type InventoryCategory} from '../../game/inventoryView';
import {InventoryIcon} from './InventoryDetailSheet';
export function InventoryTabs({value,onChange}:{value:InventoryCategory;onChange:(v:InventoryCategory)=>void}){return <div className="inventory-tabs" role="tablist" aria-label="아이템 종류">{categories.map(c=><button role="tab" aria-selected={value===c} className={value===c?'selected':''} key={c} onClick={()=>onChange(c)}><InventoryIcon id={c}/>{categoryNames[c]}</button>)}</div>;}
