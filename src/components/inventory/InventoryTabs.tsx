import React from 'react';
import {categories,categoryNames,type InventoryCategory} from '../../game/inventoryView';
import {InventoryIcon} from './InventoryDetailSheet';
export function InventoryTabs({value,onChange}:{value:InventoryCategory;onChange:(v:InventoryCategory)=>void}){return <div className="inventory-tabs" aria-label="아이템 종류">{categories.filter(c=>c!=='skillbooks').map(c=><button aria-pressed={value===c} className={value===c?'selected':''} key={c} onClick={()=>onChange(c)}>{categoryNames[c]}</button>)}</div>;}
