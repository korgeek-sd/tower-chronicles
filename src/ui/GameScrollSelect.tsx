import React,{useEffect,useId,useMemo,useRef,useState} from 'react';
import './game-scroll-select.css';

/** A compact, touch-friendly in-game replacement for native mobile <select> menus. */
export type GameScrollOption={
 value:string;
 label:string;
 grade?:'common'|'uncommon'|'rare'|'heroic'|'legendary';
 gradeLabel?:string;
 detail?:string;
};
export interface GameScrollSelectProps {
 options:readonly GameScrollOption[];
 value:string;
 onChange:(value:string)=>void;
 disabled?:boolean;
 placeholder?:string;
 ariaLabel:string;
 emptyMessage?:string;
}
export function GameScrollSelect({
 options,value,onChange,disabled=false,placeholder='선택하세요',ariaLabel,
 emptyMessage='선택 가능한 항목이 없습니다.',
}:GameScrollSelectProps){
 const [open,setOpen]=useState(false);
 const [search,setSearch]=useState('');
 const uid=useId();
 const listId=uid+'-options';
 const rootRef=useRef<HTMLDivElement>(null);
 const selected=options.find(option=>option.value===value);
 const filtered=useMemo(()=>{
  const term=search.trim().toLocaleLowerCase('ko-KR');
  if(!term)return options;
  return options.filter(option=>(option.label+' '+(option.gradeLabel??'')+' '+(option.detail??'')).toLocaleLowerCase('ko-KR').includes(term));
 },[options,search]);
 useEffect(()=>{
  if(disabled&&open)setOpen(false);
 },[disabled,open]);
 useEffect(()=>{
  if(!open)return;
  const onPointer=(event:PointerEvent)=>{
   if(event.target instanceof Node&&!rootRef.current?.contains(event.target))setOpen(false);
  };
  const onEscape=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){setOpen(false);rootRef.current?.querySelector<HTMLButtonElement>('.tc-game-select-trigger')?.focus();}
  };
  document.addEventListener('pointerdown',onPointer);
  document.addEventListener('keydown',onEscape);
  return()=>{document.removeEventListener('pointerdown',onPointer);document.removeEventListener('keydown',onEscape);};
 },[open]);
 const choose=(next:string)=>{
  onChange(next);
  setOpen(false);
  setSearch('');
  rootRef.current?.querySelector<HTMLButtonElement>('.tc-game-select-trigger')?.focus();
 };
 return <div className={'tc-game-select'+(open?' is-open':'')+(disabled?' is-disabled':'')} ref={rootRef}>
  <button type="button" className="tc-game-select-trigger" disabled={disabled}
   aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?listId:undefined}
   onClick={()=>{setOpen(v=>!v);setSearch('');}}>
   <span className="tc-game-select-trigger-icon" aria-hidden="true">◆</span>
   <span className={'tc-game-select-trigger-label'+(!selected?' is-placeholder':'')}>
    {selected?selected.label:placeholder}
   </span>
   <span className={'tc-game-select-chevron'+(open?' is-open':'')} aria-hidden="true">⌄</span>
  </button>
  {open&&<div className="tc-game-select-expanded">
   <div className="tc-game-select-search-wrap">
    <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
     aria-label={ariaLabel+' 검색'} placeholder="장비 이름·등급 검색" autoComplete="off"/>
    <span className="tc-game-select-counter">{filtered.length} / {options.length}</span>
   </div>
   <div className="tc-game-scroll-list" id={listId} role="listbox" aria-label={ariaLabel} tabIndex={0}>
    {filtered.length?filtered.map(option=><button
     type="button" role="option" key={option.value}
     aria-selected={value===option.value}
     className={'tc-game-scroll-option'+(value===option.value?' is-selected':'')}
     onClick={()=>choose(option.value)}>
     <span className={'tc-game-scroll-gem '+(option.grade??'common')} aria-hidden="true">◆</span>
     <span className="tc-game-scroll-option-copy">
      <span className="tc-game-scroll-option-name">{option.label}</span>
      {(option.gradeLabel||option.detail)&&<small>{option.gradeLabel}{option.gradeLabel&&option.detail?' · ':''}{option.detail}</small>}
     </span>
     <span className="tc-game-scroll-check" aria-hidden="true">{value===option.value?'✓':'○'}</span>
    </button>):<div className="tc-game-scroll-empty" role="status">
     {search?'검색 결과가 없습니다.':emptyMessage}
    </div>}
   </div>
   <div className="tc-game-scroll-hint">
    <span>목록을 위아래로 밀어 선택</span>
    <button type="button" onClick={()=>setOpen(false)}>접기</button>
   </div>
  </div>}
 </div>;
}
