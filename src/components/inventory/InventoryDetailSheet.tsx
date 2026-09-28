import React,{useEffect,useRef,useState} from 'react';
import type {InventoryViewItem} from '../../game/inventoryView';
import {categoryNames} from '../../game/inventoryView';
import {Glyph} from '../../ui/mobile';
import {EQUIPMENT_GRADE_NAMES,EQUIPMENT_SLOT_NAMES} from '../../game/data/equipment';
import type {EquipmentStatComparison} from '../../game/engine/state';

export function InventoryIcon({id}:{id:string;tier?:number}){return <Glyph name={id}/>;}

export function InventoryDetailSheet({item,comparison,onClose,action,disabled,label,dangerAction,dangerDisabled,dangerLabel}:{item:InventoryViewItem;comparison?:EquipmentStatComparison|null;onClose:()=>void;action?:()=>void;disabled?:boolean;label?:string;dangerAction?:()=>void|Promise<void>;dangerDisabled?:boolean;dangerLabel?:string}){
 const root=useRef<HTMLElement>(null),equipment=item.category==='equipment';
 const [confirmDanger,setConfirmDanger]=useState(false);
 const metric=(value:number)=>Math.round(value).toLocaleString();
 const delta=(value:number)=>{const rounded=Math.round(value);return rounded>0?'+'+rounded.toLocaleString():rounded.toLocaleString();};
 useEffect(()=>{setConfirmDanger(false);},[item.key]);
 useEffect(()=>{const previous=document.activeElement as HTMLElement;root.current?.focus();const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',handler);return()=>{document.removeEventListener('keydown',handler);previous?.focus();};},[onClose]);
 return <div className="tc-item-modal-backdrop" onClick={onClose}><section ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="inventory-detail-title" className="tc-item-modal" onClick={e=>e.stopPropagation()}>
  <header className="tc-item-modal-title"><Glyph name={item.iconId}/><div><small>{equipment?'EQUIPMENT RECORD':'STORAGE RECORD'}</small><h2 id="inventory-detail-title">{item.name}</h2></div><button aria-label="상세 닫기" onClick={onClose}>×</button></header>
  <div className="tc-item-summary"><div className="tc-item-portrait"><Glyph name={item.iconId}/>{item.tier&&<b>T{item.tier}</b>}{item.grade&&<b className={'tc-detail-grade grade-'+item.grade}>{EQUIPMENT_GRADE_NAMES[item.grade]}</b>}{item.equipped&&<em>장착 중</em>}</div><div className="tc-item-summary-copy"><strong>{item.slot?EQUIPMENT_SLOT_NAMES[item.slot]+' · ':item.tier?'T'+item.tier+' · ':''}{item.grade?EQUIPMENT_GRADE_NAMES[item.grade]+' 장비':categoryNames[item.category]}</strong>{item.enhancement!==undefined&&<span>강화 +{item.enhancement}</span>}<p>{item.description}</p></div></div>
  <section className="tc-item-ability"><h3>{equipment?'장비 성능':'기록 정보'}</h3>{comparison&&<div className="tc-stat-compare" aria-label={comparison.equipped?'장비 해제 전후 비교':'장비 장착 전후 비교'}>{(['attack','defense','hp'] as const).map(key=><div key={key}><span>{key==='attack'?'공격':key==='defense'?'방어':'HP'}</span><b>{metric(comparison.before[key])}<i>→</i>{metric(comparison.after[key])}</b><em className={comparison.delta[key]>0?'up':comparison.delta[key]<0?'down':'same'}>{delta(comparison.delta[key])}</em></div>)}<small>{comparison.equipped?'해제 시 변화':'장착 시 변화'}</small></div>}<div className="tc-item-facts">{item.facts?.length?item.facts.map(fact=>{const [factLabel,...value]=fact.split(' ');return <div key={fact}><span>{factLabel}</span><b>{value.join(' ')||'—'}</b></div>}):<div><span>수량</span><b>{item.quantity.toLocaleString()}</b></div>}</div></section>
  <div className="tc-item-ownership"><span>보유 수량</span><b>{item.quantity.toLocaleString()}</b>{item.learned&&<small>습득 완료</small>}{item.registered&&<small>등록 완료</small>}</div>
  <footer className={'tc-item-modal-actions'+(dangerAction?' with-danger':'')}><button className="tc-action secondary" onClick={onClose}>닫기</button>{dangerAction&&<button className="tc-action danger" disabled={dangerDisabled} onClick={()=>{if(!confirmDanger){setConfirmDanger(true);return;}void dangerAction();}}>{confirmDanger?'정말 분해':dangerLabel}</button>}{action&&<button className="tc-action" disabled={disabled} onClick={action}>{label}</button>}</footer>
 </section></div>;
}
