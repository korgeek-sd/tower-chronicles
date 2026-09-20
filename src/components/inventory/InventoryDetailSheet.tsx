import React from 'react';
import type {InventoryViewItem} from '../../game/inventoryView';
import {categoryNames} from '../../game/inventoryView';
import {BottomSheet} from '../mobile/BottomSheet';

const iconPath=(id:string,tier?:number)=>['sword','bow','dagger','staff'].includes(id)&&tier?id+'-t'+tier:id;

export function InventoryIcon({id,tier}:{id:string;tier?:number}){
 return <img className="inventory-icon" src={'./assets/ui/inventory/'+iconPath(id,tier)+'.png'} alt=""/>;
}

export function InventoryDetailSheet({item,onClose,action,disabled,label}:{
 item:InventoryViewItem;
 onClose:()=>void;
 action?:()=>void;
 disabled?:boolean;
 label?:string;
}){
 return <BottomSheet open title={item.name} onClose={onClose}>
  <div className="inventory-detail-content">
   <div className="inventory-detail-heading">
    <InventoryIcon id={item.iconId} tier={item.tier}/>
    <div>
     <strong>{item.name}</strong>
     <small>
      {item.tier?item.tier+'등급 · ':''}
      {categoryNames[item.category]}
      {item.equipped?' · 장착 중':''}
      {item.learned?' · 습득 완료':''}
      {item.registered?' · 등록 완료':''}
     </small>
    </div>
   </div>
   <p>{item.description}</p>
   <div className="inventory-detail-facts">
    <span>수량 <b>{item.quantity.toLocaleString()}</b></span>
    {item.enhancement!==undefined&&<span>강화 <b>+{item.enhancement}</b></span>}
   </div>
   {action&&<button className="primary inventory-detail-action" disabled={disabled} onClick={action}>{label}</button>}
  </div>
 </BottomSheet>;
}
