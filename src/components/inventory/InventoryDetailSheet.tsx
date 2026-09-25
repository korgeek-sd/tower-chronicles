import React,{useEffect,useRef} from 'react';
import type {GameState} from '../../game/types';
import type {InventoryViewItem} from '../../game/inventoryView';
import {categoryNames} from '../../game/inventoryView';
import {GEAR_MASTERY_NAMES} from '../../game/data/config';
import {masteryKeyOf} from '../../game/engine/state';
import {masteryPercent,masteryRequired} from '../../game/engine/gearMastery';
import {Glyph,Meter} from '../../ui/mobile';

export function InventoryIcon({id}:{id:string;tier?:number}){return <Glyph name={id}/>;}

export function InventoryDetailSheet({game,item,onClose,action,disabled,label,onEnhancement}:{game:GameState;item:InventoryViewItem;onClose:()=>void;action?:()=>void;disabled?:boolean;label?:string;onEnhancement?:()=>void}){
 const root=useRef<HTMLElement>(null),equipment=item.category==='equipment';
 const sourceItem=equipment?game.items.find(i=>i.id===item.sourceId):undefined;
 const masteryKey=sourceItem?masteryKeyOf(sourceItem):null,mastery=masteryKey?game.gearMastery[masteryKey]:null,masteryMax=mastery?.unlockedTier===5,masteryTarget=mastery&&!masteryMax?mastery.unlockedTier+1:null,required=masteryTarget?masteryRequired(masteryTarget):0,masteryPct=mastery&&masteryKey?masteryPercent(game,masteryKey):0;
 useEffect(()=>{const previous=document.activeElement as HTMLElement;root.current?.focus();const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',handler);return()=>{document.removeEventListener('keydown',handler);previous?.focus();};},[onClose]);
 return <div className="tc-item-modal-backdrop" onClick={onClose}><section ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="inventory-detail-title" className={'tc-item-modal '+(equipment?'equipment':'storage')} onClick={e=>e.stopPropagation()}>
  <header className="tc-item-modal-title"><Glyph name={item.iconId}/><div><small>{equipment?'ASSOCIATION EQUIPMENT RECORD':'ASSOCIATION STORAGE RECORD'}</small><h2 id="inventory-detail-title">{item.name}</h2></div><button aria-label="상세 닫기" onClick={onClose}>×</button></header>
  <div className="tc-item-summary">
   <div className="tc-item-portrait"><Glyph name={item.iconId}/>{item.tier&&<b>T{item.tier}</b>}{item.equipped&&<em>장착 중</em>}</div>
   <div className="tc-item-summary-copy"><strong>{item.tier?'T'+item.tier+' · ':''}{categoryNames[item.category]}</strong>{item.enhancement!==undefined&&<span>강화 +{item.enhancement}</span>}<p>{item.description}</p></div>
  </div>
  <section className="tc-item-ability"><h3>{equipment?'능력치':'기록 정보'}</h3><div className="tc-item-facts">{item.facts?.length?item.facts.slice(0,5).map(fact=>{const [factLabel,...value]=fact.split(' ');return <div key={fact}><span>{factLabel}</span><b>{value.join(' ')||'—'}</b></div>}):<div><span>수량</span><b>{item.quantity.toLocaleString()}</b></div>}</div></section>
  {equipment&&mastery&&masteryKey&&<section className="tc-item-mastery"><div><span>착용 숙련</span><b>{GEAR_MASTERY_NAMES[masteryKey]} · T{mastery.unlockedTier} 자격</b></div><Meter value={masteryPct} max={100}/><small>{masteryMax?'모든 티어 착용 자격 획득':mastery.progress+' / '+required+' · T'+masteryTarget+' 자격까지 '+Math.round(masteryPct)+'%'}</small></section>}
  <div className="tc-item-ownership"><span>보유 수량</span><b>{item.quantity.toLocaleString()}</b>{item.equipped&&<small>현재 장착 중</small>}{item.learned&&<small>습득 완료</small>}{item.registered&&<small>등록 완료</small>}</div>
  <footer className={'tc-item-modal-actions '+(equipment&&onEnhancement?'three':'')}><button className="tc-action secondary" onClick={onClose}>닫기</button>{equipment&&onEnhancement&&<button className="tc-action secondary" onClick={onEnhancement}>강화</button>}{action&&<button className="tc-action" disabled={disabled} onClick={action}>{label}</button>}</footer>
 </section></div>;
}
