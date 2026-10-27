import React,{useEffect,useRef,useState,type ReactNode} from 'react';
import {Studio1524Splash} from '../splash/Studio1524Splash';
import {BackgroundMusic} from '../BackgroundMusic';
import {hasSeenWorldIntro,markWorldIntroSeen,WORLD_INTRO_PAGES} from './worldIntroState';
import './world-intro.css';
import {getStoredSession} from '../../online/auth';
import {StartScreen} from './StartScreen';
import {canEnterGame} from './serverSelection';

export function GameEntry({children,initialError=''}:{children:ReactNode;initialError?:string}){
 const preview=new URLSearchParams(location.search).get('story')==='preview';
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
 const [open,setOpen]=useState(()=>{try{return preview||!hasSeenWorldIntro(localStorage);}catch{return true;}});
 const [page,setPage]=useState(0);
 const introFrame=useRef<HTMLDivElement>(null);
 const heading=useRef<HTMLHeadingElement>(null);
 const nextButton=useRef<HTMLButtonElement>(null);
 const previousFocus=useRef<HTMLElement|null>(null);
 const visible=splashDone&&(ready||preview)&&open;
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
  nextButton.current?.focus({preventScroll:true});
  return()=>{document.body.style.overflow=oldOverflow;if(previousFocus.current?.isConnected)previousFocus.current.focus();};
 },[visible]);
 useEffect(()=>{if(visible){if(introFrame.current)introFrame.current.scrollTop=0;heading.current?.focus({preventScroll:true});}},[page,visible]);
 function finish(){try{if(!preview)markWorldIntroSeen(localStorage);}catch{/* Storage can be unavailable in private contexts. */}setOpen(false);}
 const current=WORLD_INTRO_PAGES[page];
 return <>
  {splashDone&&<BackgroundMusic/>}
  {ready&&<div inert={!splashDone||open} aria-hidden={!splashDone||open} style={{display:'contents'}}>{children}</div>}
  {splashDone&&!ready&&!visible&&<StartScreen session={session} initialError={initialError} onEnter={()=>{if(getStoredSession())setEntered(true);}}/>}
  {!splashDone&&<Studio1524Splash onComplete={()=>setSplashDone(true)}/>}
  {visible&&<div ref={introFrame} className="tc-world-intro" role="dialog" aria-modal="true" aria-labelledby="world-intro-title" onKeyDown={event=>{
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
    <div className="tc-world-intro__chapter" aria-label={`${page+1} / ${WORLD_INTRO_PAGES.length}`}>{current.chapter} / {String(WORLD_INTRO_PAGES.length).padStart(2,'0')}</div>
    <div key={'art-'+page} className="tc-world-intro__art" aria-hidden="true">
     <img src={import.meta.env.BASE_URL+current.image} alt="" width="1086" height="1448" fetchPriority={page===0?'high':'auto'}/>
    </div>
    <div key={page} className="tc-world-intro__copy" aria-live="polite">
     <h1 ref={heading} tabIndex={-1} id="world-intro-title">{current.title}</h1><div className="tc-world-intro__rule">✦</div>{current.body&&<div className="tc-world-intro__body">{current.body.split('\n\n').map((paragraph,index)=><p key={index}>{paragraph}</p>)}</div>}{current.quote&&<blockquote><p>“{current.quote}”</p><cite>{current.citation}</cite></blockquote>}
    </div>
    <footer data-first={page===0}>
     <div className="tc-world-intro__dots" aria-label={`${page+1} / ${WORLD_INTRO_PAGES.length}`}>{WORLD_INTRO_PAGES.map((_,index)=><span key={index} className={index===page?'active':''}/>)}</div>
     <button ref={nextButton} className="tc-world-intro__next" onClick={()=>page===WORLD_INTRO_PAGES.length-1?finish():setPage(value=>value+1)}>{page===WORLD_INTRO_PAGES.length-1?'새 이름을 기록한다':'다음 기록 →'}</button>
     {page>0&&<button className="tc-world-intro__back" onClick={()=>setPage(value=>value-1)}>이전 장</button>}
    </footer>
   </section>
  </div>}
 </>;
}
