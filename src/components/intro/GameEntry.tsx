import React,{useEffect,useRef,useState,type ReactNode} from 'react';
import {Studio0322Splash} from '../splash/Studio0322Splash';
import {hasSeenWorldIntro,markWorldIntroSeen,WORLD_INTRO_PAGES} from './worldIntroState';
import './world-intro.css';

export function GameEntry({children}:{children:ReactNode}){
 const [splashDone,setSplashDone]=useState(false);
 const [open,setOpen]=useState(()=>{try{return !hasSeenWorldIntro(localStorage);}catch{return true;}});
 const [page,setPage]=useState(0);
 const nextButton=useRef<HTMLButtonElement>(null);
 const previousFocus=useRef<HTMLElement|null>(null);
 const visible=splashDone&&open;
 useEffect(()=>{
  const replay=()=>{setPage(0);setOpen(true);};
  window.addEventListener('tower:replay-world-intro',replay);
  return()=>window.removeEventListener('tower:replay-world-intro',replay);
 },[]);
 useEffect(()=>{
  if(!visible)return;
  previousFocus.current=document.activeElement as HTMLElement|null;
  const oldOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  nextButton.current?.focus();
  return()=>{document.body.style.overflow=oldOverflow;if(previousFocus.current?.isConnected)previousFocus.current.focus();};
 },[visible]);
 function finish(){try{markWorldIntroSeen(localStorage);}catch{/* Storage can be unavailable in private contexts. */}setOpen(false);}
 const current=WORLD_INTRO_PAGES[page];
 return <>
  <div inert={!splashDone||open} aria-hidden={!splashDone||open} style={{display:'contents'}}>{children}</div>
  {!splashDone&&<Studio0322Splash onComplete={()=>setSplashDone(true)}/>}
  {visible&&<div className="tc-world-intro" role="dialog" aria-modal="true" aria-labelledby="world-intro-title" onKeyDown={event=>{
   if(event.key==='Escape'){event.preventDefault();finish();}
   if(event.key==='Tab'){
    const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const first=buttons[0],last=buttons[buttons.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
   }
  }}>
   <section className="tc-world-intro__paper">
    <header><span>탑의 기록</span><button onClick={finish}>건너뛰기</button></header>
    <div className="tc-world-intro__chapter" aria-label={`${page+1} / 4`}>── {current.chapter} ──</div>
    <div key={'art-'+page} className="tc-world-intro__art" aria-hidden="true" style={{backgroundPosition:`${page*100/3}% center`}}/>
    <div key={page} className="tc-world-intro__copy" aria-live="polite">
     <h1 id="world-intro-title">{current.title}</h1><div className="tc-world-intro__rule">✦</div><p>{current.body}</p>
    </div>
    <footer>
     <div className="tc-world-intro__dots" aria-label={`${page+1} / 4`}>{WORLD_INTRO_PAGES.map((_,index)=><span key={index} className={index===page?'active':''}/>)}</div>
     <button ref={nextButton} className="tc-world-intro__next" onClick={()=>page===3?finish():setPage(value=>value+1)}>{page===3?'탑에 들어가기':'다음'}</button>
     {page>0&&<button className="tc-world-intro__back" onClick={()=>setPage(value=>value-1)}>이전 장</button>}
    </footer>
   </section>
  </div>}
 </>;
}
