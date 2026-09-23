import React from 'react';
import type {Item} from '../../game/types';
import {itemName} from '../../game/engine/state';
import {InventoryIcon} from '../inventory/InventoryDetailSheet';
import {WEAPONS} from '../../game/data/config';

export function EnhancementItemCard({item,equipped,selected,onSelect}:{item:Item;equipped:boolean;selected:boolean;onSelect:()=>void}){
  const iconId=item.kind in WEAPONS||item.kind==='armor'||item.kind==='boots'?item.kind:'accessory';
  return <button className={'enhancement-item '+(selected?'selected':'')} aria-pressed={selected} onClick={onSelect}>
    <InventoryIcon id={iconId} tier={item.tier}/>
    <span>
      <strong>{itemName(item)}</strong>
      <small>T{item.tier} · 강화 +{item.enhancement}{equipped?' · 장착 중':''}</small>
    </span>
    <b>{item.id==='starter'?'강화 불가':item.enhancement>=3?'MAX':'선택'}</b>
  </button>;
}
