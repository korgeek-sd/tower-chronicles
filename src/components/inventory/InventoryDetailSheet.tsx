import React,{useState} from 'react';
import type {InventoryViewItem} from '../../game/inventoryView';
import {categoryNames} from '../../game/inventoryView';
import {CampBagDialog} from '../camp-bag/CampBagDialog';
import {InventoryIcon} from './InventoryIcon';
import {descriptionPages,equipmentPreview} from './inventoryPresentation';
export {InventoryIcon} from './InventoryIcon';
export function InventoryDetailSheet({item,onClose,action,disabled,label,comparison}:{item:InventoryViewItem;onClose:()=>void;action?:()=>void;disabled?:boolean;label?:string;comparison?:ReturnType<typeof equipmentPreview>}){
 const [page,setPage]=useState(0),pages=descriptionPages(item.description,72),safe=Math.min(page,pages.length-1);
 return <CampBagDialog title={item.name} onClose={onClose}><div className="inventory-detail-heading"><InventoryIcon id={item.iconId} tier={item.tier}/><div><strong>{categoryNames[item.category]}{item.tier?' · T'+item.tier:''}</strong><small>{item.equipped?'장착 중':item.learned?'습득 완료':item.registered?'등록 완료':'보유 아이템'}</small></div></div>
 <p className="inventory-description">{pages[safe]}</p>{pages.length>1&&<div className="camp-pages"><button disabled={!safe} onClick={()=>setPage(safe-1)}>이전</button><span>{safe+1} / {pages.length}</span><button disabled={safe===pages.length-1} onClick={()=>setPage(safe+1)}>다음</button></div>}
 <div className="camp-facts"><span>수량</span><b>{item.quantity.toLocaleString()}</b>{item.enhancement!==undefined&&<><span>강화</span><b>+{item.enhancement}</b></>}</div>
 {comparison&&<div className="inventory-comparison" aria-label="장착 시 능력치 변화">{([['체력',comparison.hp],['공격',comparison.attack],['방어',comparison.defense],['공격/초',comparison.speed]] as const).map(([name,value])=><span key={name}>{name}<b className={value>0?'camp-gain':value<0?'camp-loss':''}>{value>0?'+':''}{Number(value.toFixed(2))}</b></span>)}</div>}
 {action&&<button className="camp-primary inventory-detail-action" disabled={disabled} onClick={action}>{label}</button>}</CampBagDialog>;
}
