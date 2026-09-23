import React,{useEffect,useId,useRef} from 'react';
import type {GameState} from '../../game/types';
import type {InventoryViewItem} from '../../game/inventoryView';
import {categoryNames} from '../../game/inventoryView';
import {itemName} from '../../game/engine/state';
import {previewEquipment,statLabels,formatStat,tierRoman,shortItemName} from '../../game/equipmentView';
const iconPath=(id:string,tier?:number)=>['sword','bow','dagger','staff'].includes(id)&&tier?id+'-t'+tier:id;
export function InventoryIcon({id,tier}:{id:string;tier?:number}){return <img key={iconPath(id,tier)} className="inventory-icon" src={'./assets/ui/inventory/'+iconPath(id,tier)+'.png'} alt="" draggable={false} onError={event=>{const image=event.currentTarget;if(!image.dataset.fallback){image.dataset.fallback='true';image.src='./assets/ui/inventory/other.png';}}}/>;}
export function InventoryDetailSheet({item,onClose,action,disabled,label,game,onCharacter}:{item:InventoryViewItem;onClose:()=>void;action?:()=>void;disabled?:boolean;label?:string;game?:GameState;onCharacter?:()=>void}){
 const root=useRef<HTMLDialogElement>(null),titleId=useId();
 const preview=game&&item.category==='equipment'?previewEquipment(game,item.sourceId):null;
 useEffect(()=>{const dialog=root.current!,previous=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();return()=>{dialog.close();document.body.style.overflow=overflow;if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};},[]);
 return <dialog ref={root} aria-labelledby={titleId} className="inventory-modal" onCancel={event=>{event.preventDefault();onClose();}}>
   <div className="item-dialog-top"><span>물품 기록 · {categoryNames[item.category]}</span><button autoFocus aria-label="상세 닫기" onClick={onClose}>×</button></div>
   <div className="item-dialog-body">
     <div className="item-dialog-heading"><InventoryIcon id={item.iconId} tier={item.tier}/><div><small>{item.tier?'등급 '+tierRoman(item.tier)+' · ':''}{item.equipped?'장착 중':'보유 '+item.quantity.toLocaleString()+'개'}</small><h2 id={titleId}>{shortItemName(item.name)}</h2>{!!item.enhancement&&<span>강화 +{item.enhancement}</span>}</div></div>
     <p className="item-description">{item.description}</p>
     {preview&&<section className="equipment-comparison" aria-label="장비 능력치 비교"><div className="comparison-title"><h3>장착 시 기본 능력치</h3><span>현재 → 변경 후</span></div><p>비교 장비 · {preview.current?shortItemName(itemName(preview.current)):'장착한 장비 없음'}</p>
       {statLabels.map(([key,name])=>{const delta=Number((preview.after[key]-preview.before[key]).toFixed(2));return <div className="comparison-row" key={key}><span>{name}</span><span>{formatStat(preview.before[key])} <i>→</i> <b>{formatStat(preview.after[key])}</b></span><strong className={delta>0?'stat-up':delta<0?'stat-down':''}>{delta===0?'—':(delta>0?'+':'')+formatStat(delta)}</strong></div>;})}
       <small>장비의 고유 효과와 전투 중 버프는 기본 능력치 비교에 포함되지 않습니다.</small>
     </section>}
     {item.category==='potions'&&<p className="item-help">거점에서 원정을 준비할 때 챙긴 뒤, 전투 중 포션 버튼으로 사용하세요.</p>}
     {preview?.blockedReason&&<p className="item-help" role="status">{preview.blockedReason}</p>}
   </div>
   <div className="item-dialog-footer">{action&&<button className="item-equip-action" disabled={disabled||!!preview?.blockedReason} onClick={action}>{label}</button>}{onCharacter&&item.category==='equipment'&&<button onClick={onCharacter}>캐릭터 보기 →</button>}</div>
 </dialog>;
}
