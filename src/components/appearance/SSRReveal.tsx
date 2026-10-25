import React,{useEffect,useRef,useState} from 'react';
import type {AppearanceSummonDraw} from '../../online/appearanceSummon';
import type {AppearanceData} from '../../game/data/cosmetics';
import {assetUrl} from '../../game/data/graphics';
import {playSsrBell} from './ssrSound';
import './ssr-reveal.css';
export const SSR_REVEAL_DURATION_MS=4000;
type Props={draw:AppearanceSummonDraw;appearance?:AppearanceData;total:number;onDone:()=>void;onSkip?:()=>void;onRepeat:()=>void;canRepeat:boolean;busy:boolean;error?:string;hasNext?:boolean;sequenceIndex?:number;sequenceTotal?:number};
const sealAsset=(name:string)=>assetUrl('assets/vfx/summon/seal-'+name+'-v1.webp');
export function SSRRevealFrame({draw,appearance,total,onDone,onSkip=onDone,onRepeat,canRepeat,busy,error,ready,skipRef,confirmRef,hasNext=false,sequenceIndex=0,sequenceTotal=1}:{ready:boolean;skipRef?:React.RefObject<HTMLButtonElement|null>;confirmRef?:React.RefObject<HTMLButtonElement|null>}&Props){
 return <div className={'tc-ssr-reveal tc-seal-scene'+(ready?' is-ready':'')} data-rarity={draw.rarity}>
  <img className="tc-seal-background" src={sealAsset('chamber')} alt="" draggable={false}/>
  <header className="tc-seal-heading"><small>탑의 기록</small><p>봉인된 기억</p>{sequenceTotal>1&&<span>희귀 외형 {sequenceIndex+1} / {sequenceTotal}</span>}</header>
  {!ready&&<button ref={skipRef} type="button" className="tc-ssr-skip" disabled={busy} onClick={onSkip}>건너뛰기 ›</button>}
  {!ready&&<div className="tc-ssr-vfx" aria-hidden="true">
   <div className="tc-seal-particles"><img src={sealAsset('particles')} alt="" draggable={false}/></div>
   <div className="tc-seal-stone"><div className="tc-seal-stone-sprite" style={{backgroundImage:`url("${assetUrl('assets/vfx/summon/seal-stone-16frames-v2.webp')}")`}}/></div>
   <img className="tc-seal-flare" src={sealAsset('flare')} alt="" draggable={false}/>
   <div className="tc-ssr-flash"/>
  </div>}
  <div className="tc-ssr-art" aria-hidden="true">{appearance?.imagePath?<img src={assetUrl(appearance.imagePath)} alt="" draggable={false}/>:<span>{draw.rarity}</span>}</div>
  {!ready&&<p className="tc-seal-intro" aria-hidden="true">봉인 속에서 기억이 깨어납니다.</p>}
  <div className="tc-ssr-caption"><h2 id="summon-modal-title" className="tc-ssr-grade">{draw.rarity}</h2><h3>{appearance?.name??draw.id}</h3><p>{draw.duplicate?'중복 획득':'새로운 외형 획득'}</p></div>
  <footer className="tc-ssr-actions"><button ref={confirmRef} type="button" disabled={!ready||busy} onClick={onDone}>{hasNext?'다음 외형':total>1?'결과 보기':'확인'}</button><button type="button" disabled={!ready||busy||(!hasNext&&!canRepeat)} onClick={hasNext?onSkip:onRepeat}>{hasNext?'전체 결과':busy?'소환 중…':'다시 소환'}</button></footer>
  {error&&<p role="alert" className="tc-ssr-error">{error}</p>}
 </div>;
}
export function SSRReveal(props:Props){
 const [ready,setReady]=useState(false),stop=useRef<()=>void>(()=>{}),skip=useRef<HTMLButtonElement>(null),confirm=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  const motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reduce=()=>{if(motion?.matches){clearTimeout(impact);clearTimeout(finish);stop.current();setReady(true);}};
  if(motion?.matches){setReady(true);return;}
  const impact=setTimeout(()=>{stop.current=playSsrBell(props.draw.rarity==='SSR'?1:.55);},3100);
  const finish=setTimeout(()=>setReady(true),SSR_REVEAL_DURATION_MS);
  motion?.addEventListener?.('change',reduce);skip.current?.focus();
  return()=>{clearTimeout(impact);clearTimeout(finish);motion?.removeEventListener?.('change',reduce);stop.current();};
 },[props.draw.rarity]);
 useEffect(()=>{if(ready)confirm.current?.focus();},[ready]);
 const done=()=>{stop.current();props.onDone();};
 const skipAll=()=>{stop.current();(props.onSkip??props.onDone)();};
 return <SSRRevealFrame {...props} ready={ready} skipRef={skip} confirmRef={confirm} onDone={done} onSkip={skipAll}/>;
}
