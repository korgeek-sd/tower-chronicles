import React,{useEffect,useRef} from 'react';
import type {InventoryViewItem} from '../../game/inventoryView';
import {categoryNames} from '../../game/inventoryView';
import {Glyph} from '../../ui/mobile';

export function InventoryIcon({id}:{id:string;tier?:number}){return <Glyph name={id}/>;}

export function InventoryDetailSheet({item,onClose,action,disabled,label}:{item:InventoryViewItem;onClose:()=>void;action?:()=>void;disabled?:boolean;label?:string}){
 const root=useRef<HTMLElement>(null),equipment=item.category==='equipment';
 useEffect(()=>{const previous=document.activeElement as HTMLElement;root.current?.focus();const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',handler);return()=>{document.removeEventListener('keydown',handler);previous?.focus();};},[onClose]);
 return <div className="tc-item-modal-backdrop" onClick={onClose}><section ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="inventory-detail-title" className="tc-item-modal" onClick={e=>e.stopPropagation()}>
  <header className="tc-item-modal-title"><Glyph name={item.iconId}/><div><small>{equipment?'EQUIPMENT RECORD':'STORAGE RECORD'}</small><h2 id="inventory-detail-title">{item.name}</h2></div><button aria-label="상세 닫기" onClick={onClose}>×</button></header>
  <div className="tc-item-summary"><div className="tc-item-portrait"><Glyph name={item.iconId}/>{item.tier&&<b>T{item.tier}</b>}{item.equipped&&<em>장착 중</em>}</div><div className="tc-item-summary-copy"><strong>{item.tier?'T'+item.tier+' · ':''}{categoryNames[item.category]}</strong>{item.enhancement!==undefined&&<span>강화 +{item.enhancement}</span>}<p>{item.description}</p></div></div>
  <section className="tc-item-ability"><h3>{equipment?'장비 성능':'기록 정보'}</h3><div className="tc-item-facts">{item.facts?.length?item.facts.map(fact=>{const [factLabel,...value]=fact.split(' ');return <div key={fact}><span>{factLabel}</span><b>{value.join(' ')||'—'}</b></div>}):<div><span>수량</span><b>{item.quantity.toLocaleString()}</b></div>}</div></section>
  <div className="tc-item-ownership"><span>보유 수량</span><b>{item.quantity.toLocaleString()}</b>{item.learned&&<small>습득 완료</small>}{item.registered&&<small>등록 완료</small>}</div>
  <footer className="tc-item-modal-actions"><button className="tc-action secondary" onClick={onClose}>닫기</button>{action&&<button className="tc-action" disabled={disabled} onClick={action}>{label}</button>}</footer>
 </section></div>;
}
