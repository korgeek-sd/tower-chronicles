import React,{useEffect,useRef} from 'react';
import type {InventoryViewItem} from '../../game/inventoryView';
import {categoryNames} from '../../game/inventoryView';
import {ENHANCEMENT_POLICY} from '../../game/data/enhancement';
import {Glyph,Meter} from '../../ui/mobile';

export function InventoryIcon({id}:{id:string;tier?:number}){return <Glyph name={id}/>;}

export function InventoryDetailSheet({item,onClose,action,disabled,label,secondaryAction,secondaryDisabled,secondaryLabel}:{item:InventoryViewItem;onClose:()=>void;action?:()=>void;disabled?:boolean;label?:string;secondaryAction?:()=>void;secondaryDisabled?:boolean;secondaryLabel?:string}){
 const root=useRef<HTMLElement>(null),equipment=item.category==='equipment';
 useEffect(()=>{const previous=document.activeElement as HTMLElement;root.current?.focus();const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',handler);return()=>{document.removeEventListener('keydown',handler);previous?.focus();};},[onClose]);
 return <div className="tc-sheetback" onClick={onClose}><section ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="inventory-detail-title" className={'tc-sheet '+(equipment?'equipment-detail':'')} onClick={e=>e.stopPropagation()}>
  <div className="tc-sheet-title"><span className="tc-sheet-round"><InventoryIcon id={item.iconId}/></span><h2 id="inventory-detail-title">{equipment?'장비 정보':'보관품 정보'}</h2><button aria-label="상세 닫기" onClick={onClose}>×</button></div>
  <div className="tc-sheet-type">{categoryNames[item.category]}</div>
  <div className="tc-item-overview">
   <div className="tc-sheet-icon"><InventoryIcon id={item.iconId}/>{item.equipped&&<em>장착 중</em>}</div>
   <div><h3>{item.name}</h3><strong>{item.tier?'T'+item.tier:'일반'}{item.enhancement!==undefined?' · +'+item.enhancement:''}</strong><p>{item.description}</p></div>
  </div>
  {equipment?<div className="tc-item-ability"><header>능력치</header><div className="tc-item-fact-list">{item.facts?.length?item.facts.map(fact=>{const [factLabel,...value]=fact.split(' ');return <div key={fact}><span>{factLabel}</span><b>{value.join(' ')}</b></div>}):<div><span>장비 기록</span><b>추가 수치 없음</b></div>}</div>{item.enhancement!==undefined&&<div className="tc-item-rank"><div><span>강화 단계</span><b>+{item.enhancement} / +{ENHANCEMENT_POLICY.maxEnhancement}</b></div><Meter value={item.enhancement} max={ENHANCEMENT_POLICY.maxEnhancement}/></div>}</div>:<div className="tc-item-ability"><header>보관 정보</header><div className="tc-item-fact-list"><div><span>수량</span><b>{item.quantity.toLocaleString()}</b></div>{item.tier&&<div><span>티어</span><b>T{item.tier}</b></div>}</div></div>}
  <div className="tc-sheet-actions">{action&&<button className="tc-action secondary" disabled={disabled} onClick={action}>{label}</button>}{secondaryAction&&<button className="tc-action" disabled={secondaryDisabled} onClick={secondaryAction}>{secondaryLabel}</button>}</div>
 </section></div>;
}
