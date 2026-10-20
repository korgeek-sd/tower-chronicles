import React,{useEffect,useRef,useState,type ReactNode} from 'react';
import {Studio0322Splash} from '../splash/Studio0322Splash';
import {hasSeenWorldIntro,markWorldIntroSeen,WORLD_INTRO_PAGES} from './worldIntroState';
import './world-intro.css';
import {getStoredSession} from '../../online/auth';
import {StartScreen} from './StartScreen';
import {canEnterGame} from './serverSelection';

export function GameEntry({children,initialError=''}:{children:ReactNode;initialError?:string}){
 const qa=import.meta.env.DEV&&new URLSearchParams(location.search).has('combatFixture');
 const [session,setSession]=useState(()=>getStoredSession());
 const [entered,setEntered]=useState(qa);
 const sessionUser=useRef(session?.userId);
 const signedIn=qa||!!session;
 const ready=canEnterGame(signedIn,entered);
 useEffect(()=>{
  const refresh=()=>{const next=getStoredSession();if(next?.userId!==sessionUser.current||!next)setEntered(qa);sessionUser.current=next?.userId;setSession(next);};
  window.addEventListener('storage',refresh);window.addEventListener('tower:session-changed',refresh);
  return()=>{window.removeEventListener('storage',refresh);window.removeEventListener('tower:session-changed',refresh);};
 },[qa]);
 const [splashDone,setSplashDone]=useState(false);
 const [open,setOpen]=useState(()=>{try{return !hasSeenWorldIntro(localStorage);}catch{return true;}});
 const [page,setPage]=useState(0);
 const nextButton=useRef<HTMLButtonElement>(null);
 const previousFocus=useRef<HTMLElement|null>(null);
 const visible=splashDone&&ready&&open;
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
  {ready&&<div inert={!splashDone||open} aria-hidden={!splashDone||open} style={{display:'contents'}}>{children}</div>}
  {splashDone&&!ready&&<StartScreen session={session} initialError={initialError} onEnter={()=>{if(getStoredSession())setEntered(true);}}/>}
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
    <div key={'art-'+page} className="tc-world-intro__art" aria-hidden="true" ><svg viewBox="0 0 384 1024" preserveAspectRatio="xMidYMid meet" focusable="false">
     <defs><clipPath id="world-intro-art-clip"><rect width="384" height="1024"/></clipPath></defs>
     <g clipPath="url(#world-intro-art-clip)"><image href={import.meta.env.BASE_URL+'assets/intro/world-intro.png'} x={-page*384} y="0" width="1536" height="1024"/></g>
    </svg></div>
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
