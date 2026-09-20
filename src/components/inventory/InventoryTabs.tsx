import React,{useState} from 'react';
import {categoryNames,type InventoryCategory} from '../../game/inventoryView';
import {CampBagDialog} from '../camp-bag/CampBagDialog';
const primary:InventoryCategory[]=['all','equipment','materials'];
const extra:InventoryCategory[]=['potions','skillbooks','tickets','cosmetics','other'];
export function InventoryTabs({value,onChange}:{value:InventoryCategory;onChange:(v:InventoryCategory)=>void}){
 const [open,setOpen]=useState(false);
 return <><div className="inventory-tabs" aria-label="아이템 종류">{primary.map(c=><button aria-pressed={value===c} key={c} onClick={()=>onChange(c)}>{categoryNames[c]}</button>)}<button aria-pressed={extra.includes(value)} onClick={()=>setOpen(true)}>{extra.includes(value)?categoryNames[value]:'더보기'} ▾</button></div>{open&&<CampBagDialog title="아이템 종류" onClose={()=>setOpen(false)}><div className="camp-menu">{extra.map(c=><button key={c} onClick={()=>{onChange(c);setOpen(false);}}>{categoryNames[c]}</button>)}</div></CampBagDialog>}</>;
}
