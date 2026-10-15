import {GameSelect} from '../../ui/GameSelect';
import React,{useEffect,useRef} from 'react';
import type {InventoryCategory,InventoryFilter,InventorySort} from '../../game/inventoryView';
import {GradeChips,equipmentGradeOptions,bookGradeOptions} from '../filters/LucianFilters';
import './inventory-filter-dialog.css';
export function inventoryGradeSummary(category:InventoryCategory,grades:readonly string[]){
 const options=category==='skillbooks'?bookGradeOptions:equipmentGradeOptions;
 if(!grades.length)return '전체 등급';
 const first=options.find(([id])=>id===grades[0])?.[1]??grades[0];
 return grades.length>1?`${first} 외 ${grades.length-1}개`:first;
}
export function InventoryFilterDialog({category,query,sort,filter,onQuery,onSort,onFilter,onReset,onClose,returnFocus}:{category:InventoryCategory;query:string;sort:InventorySort;filter:InventoryFilter;onQuery:(value:string)=>void;onSort:(value:InventorySort)=>void;onFilter:(value:InventoryFilter)=>void;onReset:()=>void;onClose:()=>void;returnFocus:React.RefObject<HTMLButtonElement|null>}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const el=dialog.current;if(!el)return;const trigger=returnFocus.current;el.showModal();el.querySelector<HTMLInputElement>('input[type="search"]')?.focus();return()=>{el.close();trigger?.focus({preventScroll:true});};},[returnFocus]);
 const statusLabel=category==='equipment'?'장착 중':category==='skillbooks'?'미습득':category==='cosmetics'?'미등록':'';
 const hasGrades=category==='equipment'||category==='skillbooks';
 return <dialog ref={dialog} className="tc-inventory-filter-dialog" aria-label="가방 필터" onKeyDown={e=>{if(e.key!=='Tab')return;const controls=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)'));const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div className="tc-filter-panel">
   <header><b>필터</b><button aria-label="필터 닫기" onClick={onClose}>×</button></header>
   <input type="search" aria-label="아이템 검색" placeholder="이름 검색" value={query} onChange={e=>onQuery(e.target.value)}/>
   <GameSelect aria-label="정렬" value={sort} onChange={e=>onSort(e.target.value as InventorySort)}><option value="default">기본 정렬</option><option value="name">이름순</option><option value="tier">티어 높은순</option><option value="quantity">수량 많은순</option></GameSelect>
   <div className="tc-filter-extra">{['all','equipment','materials','tickets'].includes(category)&&<GameSelect aria-label="티어 필터" value={filter.tier} onChange={e=>onFilter({...filter,tier:+e.target.value})}>{[0,1,2,3,4,5].map(t=><option key={t} value={t}>{t?'T'+t:'전체 티어'}</option>)}</GameSelect>}{statusLabel&&<label><input type="checkbox" checked={filter.status} onChange={e=>onFilter({...filter,status:e.target.checked})}/>{statusLabel}</label>}</div>
   {hasGrades&&<div><small>등급 · 여러 개 선택 가능</small><GradeChips className="tc-filter-popup-grades" label={category==='equipment'?'장비 등급':'스킬북 등급'} options={category==='equipment'?equipmentGradeOptions:bookGradeOptions} value={filter.grades??[]} onChange={grades=>onFilter({...filter,grades})}/></div>}
   <footer><button onClick={onReset}>초기화</button><button className="tc-filter-done" onClick={onClose}>완료</button></footer>
  </div>
 </dialog>;
}
