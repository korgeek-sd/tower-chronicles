import React,{useEffect,useRef,useState} from 'react';
import type {AppearanceSummonDraw} from '../../online/appearanceSummon';
import type {AppearanceData} from '../../game/data/cosmetics';
import {assetUrl} from '../../game/data/graphics';
import {playSsrBell} from './ssrSound';
import './ssr-reveal.css';
export const SSR_REVEAL_DURATION_MS=2400;
type Props={draw:AppearanceSummonDraw;appearance?:AppearanceData;total:number;onDone:()=>void;onRepeat:()=>void;canRepeat:boolean;busy:boolean;error?:string};
export function SSRRevealFrame({draw,appearance,total,onDone,onRepeat,canRepeat,busy,error,ready,skipRef,confirmRef}:{ready:boolean;skipRef?:React.RefObject<HTMLButtonElement|null>;confirmRef?:React.RefObject<HTMLButtonElement|null>}&Props){
 return <div className={'tc-ssr-reveal'+(ready?' is-ready':'')} data-rarity="SSR">
  {!ready&&<button ref={skipRef} type="button" className="tc-ssr-skip" disabled={busy} onClick={onDone}>건너뛰기 ›</button>}
  {!ready&&<div className="tc-ssr-vfx" aria-hidden="true"><img className="tc-ssr-fissure" src={assetUrl('assets/vfx/summon/ssr-fissure-v2.webp')} alt="" draggable={false}/><div className="tc-ssr-authored-anima" style={{backgroundImage:`url("${assetUrl('assets/vfx/summon/codemanu-anima-30fps.png')}")`}}/><div className="tc-ssr-flash"/></div>}
  <div className="tc-ssr-art" aria-hidden="true">{appearance?.imagePath?<img src={assetUrl(appearance.imagePath)} alt="" draggable={false}/>:<span>SSR</span>}</div>
  <div className="tc-ssr-caption"><h2 id="summon-modal-title" className="tc-ssr-grade">SSR</h2><h3>{appearance?.name??draw.id}</h3><p>{draw.duplicate?'중복 획득':'새로운 외형 획득'}</p></div>
  <footer className="tc-ssr-actions"><button ref={confirmRef} type="button" disabled={!ready||busy} onClick={onDone}>{total>1?'결과 보기':'확인'}</button><button type="button" disabled={!ready||busy||!canRepeat} onClick={onRepeat}>{busy?'소환 중…':'다시 소환'}</button></footer>
  {error&&<p role="alert" className="tc-ssr-error">{error}</p>}
 </div>;
}
export function SSRReveal(props:Props){
 const [ready,setReady]=useState(false),stop=useRef<()=>void>(()=>{}),skip=useRef<HTMLButtonElement>(null),confirm=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){setReady(true);return;}
  const impact=setTimeout(()=>{stop.current=playSsrBell();},1400);
  const finish=setTimeout(()=>setReady(true),SSR_REVEAL_DURATION_MS);
  skip.current?.focus();
  return()=>{clearTimeout(impact);clearTimeout(finish);stop.current();};
 },[]);
 useEffect(()=>{if(ready)confirm.current?.focus();},[ready]);
 return <SSRRevealFrame {...props} ready={ready} skipRef={skip} confirmRef={confirm} onDone={()=>{stop.current();props.onDone();}}/>;
}
