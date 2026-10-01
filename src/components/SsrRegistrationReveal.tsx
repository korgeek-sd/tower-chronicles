import React,{useLayoutEffect,useRef,useState} from 'react';
import {gsap} from 'gsap';
import {jobById} from '../game/jobs/catalog';
import {assetUrl} from '../game/data/graphics';
import type {OnlineJobRegistrationResult} from '../online/economy';
import './ssr-registration.css';

/** Presentation only: the server has already committed all draw results. */
export function SsrRegistrationReveal({entries,onFinish}:{entries:OnlineJobRegistrationResult['results'];onFinish:()=>void}){
 const [index,setIndex]=useState(0),[ready,setReady]=useState(false);
 const root=useRef<HTMLDivElement>(null),timeline=useRef<gsap.core.Timeline|null>(null),button=useRef<HTMLButtonElement>(null);
 const entry=entries[index],job=jobById(entry.jobId);
 useLayoutEffect(()=>{
  setReady(false);
  button.current?.focus();
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx=gsap.context(()=>{
   if(reduced){setReady(true);return;}
   const tl=gsap.timeline({defaults:{ease:'power3.out'},onComplete:()=>setReady(true)});
   timeline.current=tl;
   tl.set('.ssr-person',{autoAlpha:0,y:24,scale:.88})
    .set('.ssr-copy',{autoAlpha:0,y:12})
    .set('.ssr-spark',{autoAlpha:0})
    .fromTo('.ssr-seal',{scale:.65,opacity:0},{scale:1,opacity:1,duration:.65})
    .to('.ssr-seal',{rotation:45,scale:1.18,duration:.55,ease:'power2.in'},.65)
    .addLabel('impact',1.32)
    .to('.ssr-seal',{scale:2.4,opacity:0,duration:.3},'impact')
    .fromTo('.ssr-halo',{scale:.2,opacity:0},{scale:1.1,opacity:.8,duration:.35},'impact')
    .to('.ssr-stage',{keyframes:[{x:5},{x:-4},{x:3},{x:-2},{x:0}],duration:.28},'impact')
    .fromTo('.ssr-spark',{x:0,y:0,autoAlpha:1},{x:i=>Math.cos(i*Math.PI*2/24)*(110+i%4*22),y:i=>Math.sin(i*Math.PI*2/24)*(110+i%4*22),autoAlpha:0,rotation:90,duration:.85,stagger:.003},'impact')
    .to('.ssr-person',{autoAlpha:1,y:0,scale:1,duration:.65,ease:'back.out(1.4)'},'impact+=.12')
    .to('.ssr-copy',{autoAlpha:1,y:0,duration:.45},'impact+=.42')
    .to('.ssr-halo',{opacity:.35,scale:1,duration:.6},'impact+=.4');
  },root);
  return ()=>{timeline.current=null;ctx.revert();};
 },[index]);
 const advance=()=>{if(!ready){timeline.current?.progress(1);setReady(true);return;}if(index+1<entries.length)setIndex(index+1);else onFinish();};
 return <div className="ssr-reveal" ref={root} role="dialog" aria-modal="true" aria-label="SSR 직능 등장" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();advance();}if(e.key==='Tab'){e.preventDefault();button.current?.focus();}}}>
  <div className="ssr-topline"><span>특별 직능기록 발견</span><span>{index+1} / {entries.length}</span></div>
  <div className="ssr-stage">
   <div className="ssr-halo" aria-hidden="true"/><div className="ssr-seal" aria-hidden="true"><i/><i/><i/></div>
   <div className="ssr-particles" aria-hidden="true">{Array.from({length:24},(_,i)=><i className="ssr-spark" key={i}/>)}</div>
   <div className="ssr-person">{job?.visualAssetKey?<img src={assetUrl(job.visualAssetKey)} alt=""/>:<div className="ssr-fallback" aria-hidden="true">✦</div>}</div>
   <div className="ssr-copy"><strong>SSR</strong><h2>{job?.displayName??entry.jobId}</h2><p>{entry.newlyUnlocked?'새로운 직능이 해금되었습니다':'직능 기록을 획득했습니다'}</p></div>
  </div>
  <button ref={button} className="tc-action ssr-next" onClick={advance}>{!ready?'연출 건너뛰기':index+1<entries.length?'다음 SSR 확인':'전체 결과 확인'}</button>
 </div>;
}
