import React,{useEffect,useRef} from 'react';
import type {InventoryViewItem} from '../../game/inventoryView';
import {categoryNames} from '../../game/inventoryView';
import {Glyph} from '../../ui/mobile';

export function InventoryIcon({id}:{id:string;tier?:number}){return <Glyph name={id}/>;}

export function InventoryDetailSheet({item,onClose,action,disabled,label}:{item:InventoryViewItem;onClose:()=>void;action?:()=>void;disabled?:boolean;label?:string}){
 const root=useRef<HTMLElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement;root.current?.focus();const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',handler);return()=>{document.removeEventListener('keydown',handler);previous?.focus();};},[onClose]);
 return <div className="tc-sheetback" onClick={onClose}><section ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="inventory-detail-title" className="tc-sheet" onClick={e=>e.stopPropagation()}>
  <div className="tc-sheet-head"><div className="tc-sheet-icon"><InventoryIcon id={item.iconId}/></div><div><h2 id="inventory-detail-title">{item.name}</h2><small>{item.tier?'T'+item.tier+' · ':''}{categoryNames[item.category]}{item.equipped?' · 장착 중':''}{item.learned?' · 습득 완료':''}{item.registered?' · 등록 완료':''}</small></div><button aria-label="상세 닫기" onClick={onClose}>×</button></div>
  <p>{item.description}</p>
  <dl className="tc-sheet-facts">{item.facts?.map(fact=>{const [factLabel,...value]=fact.split(' ');return <div key={fact}><dt>{factLabel}</dt><dd>{value.join(' ')}</dd></div>})}<div><dt>수량</dt><dd>{item.quantity.toLocaleString()}</dd></div>{item.enhancement!==undefined&&<div><dt>강화</dt><dd>+{item.enhancement}</dd></div>}</dl>
  {action&&<button className="tc-action" disabled={disabled} onClick={action}>{label}</button>}
 </section></div>;
}
