import {GameSelect} from '../../ui/GameSelect';
import React,{useEffect,useRef} from 'react';
import {GradeChips,equipmentGradeOptions,bookGradeOptions} from '../filters/LucianFilters';
import '../inventory/inventory-filter-dialog.css';
export type MarketSort='default'|'name'|'available';
export function sortMarketCatalog<T extends {name:string;available:number}>(rows:readonly T[],sort:MarketSort):T[]{
 const result=[...rows];
 return sort==='name'?result.sort((a,b)=>a.name.localeCompare(b.name,'ko')):sort==='available'?result.sort((a,b)=>b.available-a.available):result;
}
export function marketGradeSummary(category:string,grades:readonly string[]){
 if(!grades.length)return '전체 등급';const options=category==='skillbooks'?bookGradeOptions:equipmentGradeOptions;
 const first=options.find(([id])=>id===grades[0])?.[1]??grades[0];return grades.length>1?`${first} 외 ${grades.length-1}개`:first;
}
export function MarketFilterDialog({category,query,sort,grades,onQuery,onSort,onGrades,onReset,onClose,returnFocus}:{category:string;query:string;sort:MarketSort;grades:readonly string[];onQuery:(value:string)=>void;onSort:(value:MarketSort)=>void;onGrades:(value:string[])=>void;onReset:()=>void;onClose:()=>void;returnFocus:React.RefObject<HTMLButtonElement|null>}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const el=dialog.current;if(!el)return;const trigger=returnFocus.current;el.showModal();el.querySelector<HTMLInputElement>('input[type="search"]')?.focus();return()=>{el.close();trigger?.focus({preventScroll:true});};},[returnFocus]);
 return <dialog ref={dialog} className="tc-inventory-filter-dialog tc-market-filter-dialog" aria-label="거래소 필터" onKeyDown={e=>{if(e.key!=='Tab')return;const controls=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)'));const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div className="tc-filter-panel"><header><b>필터</b><button aria-label="필터 닫기" onClick={onClose}>×</button></header>
   <input type="search" aria-label="거래 품목 검색" placeholder="거래 품목 검색" value={query} onChange={e=>onQuery(e.target.value)}/>
   <GameSelect aria-label="거래 품목 정렬" value={sort} onChange={e=>onSort(e.target.value as MarketSort)}><option value="default">기본 정렬</option><option value="name">이름순</option><option value="available">보유 수량순</option></GameSelect>
   {(category==='equipment'||category==='skillbooks')&&<div><small>등급 · 여러 개 선택 가능</small><GradeChips className="tc-filter-popup-grades" label={category==='skillbooks'?'스킬북 등급':'장비 등급'} options={category==='skillbooks'?bookGradeOptions:equipmentGradeOptions} value={grades} onChange={onGrades}/></div>}
   <footer><button onClick={onReset}>초기화</button><button className="tc-filter-done" onClick={onClose}>완료</button></footer>
  </div>
 </dialog>;
}
