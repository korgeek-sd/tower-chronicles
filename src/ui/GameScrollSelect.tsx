import React,{useEffect,useId,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import './game-scroll-select.css';

export type GameScrollOption={
 value:string;
 label:string;
 grade?:'common'|'uncommon'|'rare'|'heroic'|'legendary';
 gradeLabel?:string;
 detail?:string;
 disabled?:boolean;
};
export interface GameScrollSelectProps{
 options:readonly GameScrollOption[];
 value:string;
 onChange:(value:string)=>void;
 disabled?:boolean;
 placeholder?:string;
 ariaLabel:string;
 emptyMessage?:string;
 className?:string;
 style?:React.CSSProperties;
 id?:string;
 compact?:boolean;
}
type PopupPlacement={top:number;left:number;width:number;maxHeight:number;above:boolean};

/** Scroll picker with a viewport-bound popup. Never invokes the OS-native select sheet. */
export function GameScrollSelect({
 options,value,onChange,disabled=false,placeholder='선택하세요',ariaLabel,
 emptyMessage='선택 가능한 항목이 없습니다.',className='',style,id,compact=false,
}:GameScrollSelectProps){
 const [open,setOpen]=useState(false);
 const [search,setSearch]=useState('');
 const [position,setPosition]=useState<PopupPlacement>({top:0,left:8,width:220,maxHeight:260,above:false});
 const [scroll,setScroll]=useState({top:0,client:1,total:1});
 const uid=useId();
 const listId=uid+'-options';
 const rootRef=useRef<HTMLDivElement>(null);
 const popupRef=useRef<HTMLDivElement>(null);
 const listRef=useRef<HTMLDivElement>(null);
 const railRef=useRef<HTMLDivElement>(null);
 const dragRef=useRef<{y:number;scrollTop:number}|null>(null);
 const selected=options.find(option=>option.value===value);
 const filtered=useMemo(()=>{
  const term=search.trim().toLocaleLowerCase('ko-KR');
  if(!term)return options;
  return options.filter(option=>(option.label+' '+(option.gradeLabel??'')+' '+(option.detail??'')).toLocaleLowerCase('ko-KR').includes(term));
 },[options,search]);
 const syncScroll=()=>{
  const list=listRef.current;
  if(list)setScroll({top:list.scrollTop,client:list.clientHeight||1,total:list.scrollHeight||1});
 };
 useEffect(()=>{
  if(disabled&&open)setOpen(false);
 },[disabled,open]);
 useEffect(()=>{
  if(!open)return;
  const update=()=>{
   const rect=rootRef.current?.getBoundingClientRect();
   if(!rect)return;
   const vv=window.visualViewport;
   const vx=vv?.offsetLeft??0,vy=vv?.offsetTop??0;
   const vw=vv?.width??window.innerWidth,vh=vv?.height??window.innerHeight;
   const below=vy+vh-rect.bottom-7,above=rect.top-vy-7;
   const flip=above>below&&below<200;
   const available=Math.max(84,Math.min(330,flip?above:below,vh-16));
   const width=Math.min(Math.max(rect.width,180),Math.max(120,vw-16));
   const left=Math.max(vx+8,Math.min(rect.left,vx+vw-width-8));
   setPosition({left,top:flip?rect.top-6:rect.bottom+6,width,maxHeight:available,above:flip});
  };
  update();
  const pointer=(event:PointerEvent)=>{
   const target=event.target;
   if(target instanceof Node&&!rootRef.current?.contains(target)&&!popupRef.current?.contains(target))setOpen(false);
  };
  const keyboard=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){
    setOpen(false);
    rootRef.current?.querySelector<HTMLButtonElement>('.tc-game-select-trigger')?.focus();
    return;
   }
   if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key)||document.activeElement?.tagName==='INPUT')return;
   const focused=document.activeElement;
   if(!rootRef.current?.contains(focused)&&!popupRef.current?.contains(focused))return;
   const items=Array.from(popupRef.current?.querySelectorAll<HTMLButtonElement>('.tc-game-scroll-option:not(:disabled)')??[]);
   if(!items.length)return;
   event.preventDefault();
   const index=items.indexOf(focused as HTMLButtonElement);
   const next=event.key==='Home'?0:event.key==='End'?items.length-1:event.key==='ArrowUp'?Math.max(0,index-1):Math.min(items.length-1,index+1);
   items[next]?.focus();
  };
  const moved=(event:Event)=>{
   if(event.target instanceof Node&&popupRef.current?.contains(event.target))return;
   update();
  };
  document.addEventListener('pointerdown',pointer);
  document.addEventListener('keydown',keyboard);
  window.addEventListener('resize',update);
  window.addEventListener('scroll',moved,true);
  window.visualViewport?.addEventListener('resize',update);
  window.visualViewport?.addEventListener('scroll',update);
  return()=>{
   document.removeEventListener('pointerdown',pointer);
   document.removeEventListener('keydown',keyboard);
   window.removeEventListener('resize',update);
   window.removeEventListener('scroll',moved,true);
   window.visualViewport?.removeEventListener('resize',update);
   window.visualViewport?.removeEventListener('scroll',update);
  };
 },[open]);
 useEffect(()=>{
  if(!open)return;
  const list=listRef.current;
  if(!list)return;
  syncScroll();
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(syncScroll);
  observer?.observe(list);
  return()=>observer?.disconnect();
 },[open,filtered]);
 const choose=(option:GameScrollOption)=>{
  if(option.disabled)return;
  onChange(option.value);
  setOpen(false);
  setSearch('');
  rootRef.current?.querySelector<HTMLButtonElement>('.tc-game-select-trigger')?.focus();
 };
 const overflow=Math.max(0,scroll.total-scroll.client);
 const railHeight=railRef.current?.clientHeight??180;
 const thumbHeight=overflow?Math.max(22,railHeight*scroll.client/scroll.total):railHeight;
 const thumbTop=overflow?((railHeight-thumbHeight)*scroll.top/overflow):0;
 const portalHost=typeof document==='undefined'?null:(rootRef.current?.closest('dialog')??document.body);
 return <div id={id} className={'tc-game-select '+className+(open?' is-open':'')+(disabled?' is-disabled':'')+(compact?' is-compact':'')} style={style} ref={rootRef}>
  <button type="button" className="tc-game-select-trigger" disabled={disabled}
   aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?listId:undefined}
   onClick={()=>{setOpen(v=>!v);setSearch('');}}>
   <span className="tc-game-select-trigger-icon" aria-hidden="true">◆</span>
   <span className={'tc-game-select-trigger-label'+(!selected?' is-placeholder':'')}>{selected?selected.label:placeholder}</span>
   <span className={'tc-game-select-chevron'+(open?' is-open':'')} aria-hidden="true">⌄</span>
  </button>
  {open&&portalHost&&createPortal(<div ref={popupRef} className="tc-game-select-expanded"
    style={{position:'fixed',left:position.left,top:position.top,width:position.width,maxHeight:position.maxHeight,
     transform:position.above?'translateY(-100%)':undefined,zIndex:2147483000}}>
   <div className="tc-game-select-search-wrap">
    <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
     aria-label={ariaLabel+' 검색'} placeholder="이름·등급 검색" autoComplete="off"/>
    <span className="tc-game-select-counter">{filtered.length} / {options.length}</span>
   </div>
   <div className="tc-game-scroll-viewport">
    <div className="tc-game-scroll-list" id={listId} role="listbox" aria-label={ariaLabel} tabIndex={0}
     ref={listRef} onScroll={syncScroll}>
     {filtered.length?filtered.map(option=><button
      type="button" role="option" key={option.value} disabled={option.disabled}
      aria-selected={value===option.value}
      className={'tc-game-scroll-option'+(value===option.value?' is-selected':'')}
      onClick={()=>choose(option)}>
      <span className="tc-game-scroll-option-copy">
       <span className="tc-game-scroll-option-name">{option.label}</span>
       {(option.gradeLabel||option.detail)&&<small>{option.gradeLabel}{option.gradeLabel&&option.detail?' · ':''}{option.detail}</small>}
      </span>
     </button>):<div className="tc-game-scroll-empty" role="status">{search?'검색 결과가 없습니다.':emptyMessage}</div>}
    </div>
    <div className="tc-game-scroll-rail" ref={railRef} aria-hidden="true"
     onPointerDown={event=>{
      if(!overflow||!listRef.current)return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current={y:event.clientY,scrollTop:listRef.current.scrollTop};
      const bounds=event.currentTarget.getBoundingClientRect();
      const fraction=(event.clientY-bounds.top-thumbHeight/2)/Math.max(1,bounds.height-thumbHeight);
      listRef.current.scrollTop=Math.max(0,Math.min(overflow,fraction*overflow));
      dragRef.current={y:event.clientY,scrollTop:listRef.current.scrollTop};
     }}
     onPointerMove={event=>{
      if(!dragRef.current||!listRef.current||!overflow)return;
      listRef.current.scrollTop=dragRef.current.scrollTop+(event.clientY-dragRef.current.y)*overflow/Math.max(1,railRef.current!.clientHeight-thumbHeight);
     }}
     onPointerUp={()=>{dragRef.current=null;}}
     onPointerCancel={()=>{dragRef.current=null;}}>
     <div className="tc-game-scroll-thumb" style={{height:thumbHeight||'100%',transform:'translateY('+thumbTop+'px)'}}/>
    </div>
   </div>
   <div className="tc-game-scroll-hint"><span>목록을 위아래로 밀어 선택</span>
    <button type="button" onClick={()=>setOpen(false)}>접기</button>
   </div>
  </div>,portalHost)}
 </div>;
}
