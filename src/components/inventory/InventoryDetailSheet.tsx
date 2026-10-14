import {SkillBookArt} from './SkillBookArt';
import {skillBookFor} from '../../game/skills/books';
import React,{useEffect,useRef,useState} from 'react';
import type {InventoryViewItem} from '../../game/inventoryView';
import {categoryNames} from '../../game/inventoryView';
import {EquipmentArt} from './EquipmentArt';
import {CraftItemArt} from '../world/CraftItemArt';
import {Glyph} from '../../ui/mobile';
import {EQUIPMENT_GRADE_NAMES,EQUIPMENT_SLOT_NAMES} from '../../game/data/equipment';
import './inventory-detail-sheet.css';
import {CRAFT_RECIPES} from '../../game/life/crafting';
import type {EquipmentStatComparison} from '../../game/engine/state';

export function InventoryItemArt({item,slot=false}:{item:InventoryViewItem;slot?:boolean}){
 if(item.category==='skillbooks')return <i className={slot?'tc-inventory-slot-art':'tc-glyph'} aria-hidden="true"><SkillBookArt grade={skillBookFor(item.sourceId)?.grade}/></i>;
 if(item.equipmentKind)return <i className={slot?'tc-inventory-slot-art':'tc-glyph'} aria-hidden="true"><EquipmentArt kind={item.equipmentKind} grade={item.grade}/></i>;
 const id=item.lifeMaterial??item.lifeProduct;
 if(id&&slot)return <i className="tc-inventory-slot-art" aria-hidden="true"><CraftItemArt id={id}/></i>;
 return id?<i className="tc-glyph" aria-hidden="true" style={{width:'1em',height:'1em'}}><CraftItemArt id={id}/></i>:<Glyph name={item.iconId}/>;
}

export function InventoryIcon({id}:{id:string;tier?:number}){return <Glyph name={id}/>;}

export function InventoryStackCount({item}:{item:InventoryViewItem}){
 return item.stack&&(item.quantity>1||item.category==='skillbooks')?<small className="tc-storage-count">{item.quantity.toLocaleString('en-US')}</small>:null;
}

export function InventoryDetailSheet({item,comparison,onClose,action,disabled,label,enhancementAction,marketAction,marketDisabled,marketLabel,dangerAction,dangerDisabled,dangerLabel,status,retryAction,retryDisabled}:{item:InventoryViewItem;comparison?:EquipmentStatComparison|null;onClose:()=>void;action?:()=>void;disabled?:boolean;label?:string;enhancementAction?:()=>void;marketAction?:()=>void;marketDisabled?:boolean;marketLabel?:string;dangerAction?:()=>void|Promise<void>;dangerDisabled?:boolean;dangerLabel?:string;status?:string;retryAction?:()=>void;retryDisabled?:boolean}){
 const root=useRef<HTMLDialogElement>(null),equipment=item.category==='equipment';
 const [confirmDanger,setConfirmDanger]=useState(false);
 const [expanded,setExpanded]=useState(false);
 const book=item.category==='skillbooks'?skillBookFor(item.sourceId):null;
 const food=item.category==='foods';
 const remainingFoodTurns=item.facts?.find(fact=>fact.startsWith('남은전투 '))?.slice(5);
 const foodEffect=food?CRAFT_RECIPES.find(recipe=>recipe.id===item.lifeProduct)?.description.split(' · ')[0]:null;
 const identity=[item.slot?EQUIPMENT_SLOT_NAMES[item.slot]:categoryNames[item.category],item.grade?EQUIPMENT_GRADE_NAMES[item.grade]:book?.grade,item.equipped?'장착 중':null,`보유 ${item.quantity.toLocaleString()}${book?'권':'개'}`].filter(Boolean).join(' · ');
 const metric=(value:number)=>Math.round(value).toLocaleString();
 const delta=(value:number)=>{const rounded=Math.round(value);return rounded>0?'+'+rounded.toLocaleString():rounded.toLocaleString();};
 useEffect(()=>{setConfirmDanger(false);setExpanded(false);},[item.key]);
 useEffect(()=>{setConfirmDanger(false);},[dangerDisabled]);
 useEffect(()=>{const previous=document.activeElement as HTMLElement;const dialog=root.current;if(!dialog)return;const fallback=dialog.closest('.tc-screen')?.querySelector<HTMLButtonElement>('button[aria-label="필터"]');dialog.showModal();dialog.querySelector<HTMLButtonElement>('button')?.focus();return()=>{dialog.close();if(previous?.isConnected)previous.focus({preventScroll:true});else fallback?.focus({preventScroll:true});};},[onClose]);
 return <dialog ref={root} aria-modal="true" aria-labelledby="inventory-detail-title" className={'tc-item-modal tc-item-record tc-item-sheet'+(expanded?' is-expanded':'')+(item.grade?' grade-'+item.grade:'')} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}} onKeyDown={e=>{if(e.key!=='Tab')return;const controls=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled)'));const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}>
  <header className="tc-item-modal-title"><InventoryItemArt item={item}/><div><h2 id="inventory-detail-title">{item.name}</h2><small>{identity}</small></div><button aria-label="상세 닫기" onClick={onClose}>×</button></header>
  <div className="tc-item-sheet-body">
   {comparison&&<div className="tc-stat-compare" aria-label={comparison.equipped?'장비 해제 전후 비교':'장비 장착 전후 비교'}><div className="tc-stat-compare-head"><span>능력치</span><span>현재</span><span>{comparison.equipped?'해제 후':'장착 후'}</span><span>변화</span></div>{(['attack','defense','hp'] as const).map(key=><div className="tc-stat-compare-row" key={key}><span>{key==='attack'?'공격':key==='defense'?'방어':'HP'}</span><b>{metric(comparison.before[key])}</b><b>{metric(comparison.after[key])}</b><em className={comparison.delta[key]>0?'up':comparison.delta[key]<0?'down':'same'}>{delta(comparison.delta[key])}</em></div>)}</div>}
   {food&&<div className="tc-item-food-brief"><strong>{foodEffect??item.description.split(' · ')[0]}</strong><div><span>남은 전투 <b>{remainingFoodTurns??'확인 중'}</b></span><span>1개 사용 <b>+30회</b></span></div></div>}
   {book&&<div className="tc-item-book-brief"><b className={item.learned?'learned':'unlearned'}>{item.learned?'습득':'미습득'}</b><span>{book.type==='active'?'액티브':'패시브'} · {book.grade} 등급</span><small>{item.learned?'남은 스킬북으로 강화할 수 있습니다.':'스킬트리에서 1권을 사용해 습득합니다.'}</small></div>}
   {!equipment&&!food&&!book&&<p className="tc-item-brief-description">{item.description}</p>}
   {<section hidden={!expanded} id="inventory-detail-more" className="tc-item-expanded-info" aria-label="아이템 전체 정보"><p>{item.description}</p><div className="tc-item-facts">{item.facts?.map(fact=>{const [factLabel,...value]=fact.split(' ');return <div key={fact}><span>{factLabel}</span><b>{value.join(' ')||'—'}</b></div>;})}</div></section>}
   {status&&<p className="tc-item-request-status" role="status">{status}</p>}
  </div>
  <button className="tc-item-sheet-expand" aria-expanded={expanded} aria-controls="inventory-detail-more" onClick={()=>setExpanded(value=>!value)}>{expanded?'접기':'자세히 보기'} <span aria-hidden="true">{expanded?'⌄':'⌃'}</span></button>
  <footer className={'tc-item-modal-actions'+(dangerAction?' with-danger':'')+(enhancementAction?' with-enhancement':'')+(marketLabel?' with-market':'')}>{action&&<button className="tc-action tc-item-primary" disabled={disabled} onClick={action}>{label}</button>}{retryAction&&<button className="tc-action secondary" disabled={retryDisabled} onClick={retryAction}>결과 다시 확인</button>}{enhancementAction&&<button className="tc-action secondary tc-item-enhance" onClick={enhancementAction}>강화</button>}{marketLabel&&<button className="tc-action secondary tc-item-market" disabled={marketDisabled} onClick={marketAction}>{marketLabel}</button>}{dangerAction&&<button className="tc-action danger" disabled={dangerDisabled} onClick={()=>{if(!confirmDanger){setConfirmDanger(true);return;}void dangerAction();}}>{confirmDanger?'정말 분해':dangerLabel}</button>}{!action&&!enhancementAction&&!marketLabel&&!dangerAction&&<button className="tc-action secondary" onClick={onClose}>닫기</button>}</footer>
 </dialog>;
}
