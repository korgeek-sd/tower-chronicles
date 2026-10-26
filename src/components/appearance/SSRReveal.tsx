import React,{useEffect,useId,useRef,useState} from 'react';
import type {AppearanceSummonDraw} from '../../online/appearanceSummon';
import type {AppearanceData} from '../../game/data/cosmetics';
import {assetUrl} from '../../game/data/graphics';
import {playSsrBell,unlockSsrSound} from './ssrSound';
import './ssr-reveal.css';
import {SEAL_MOTES} from './sealMotion';
export const SSR_REVEAL_DURATION_MS=4000;
const OPENING_OFFSET_MS=2000;
type Props={draw:AppearanceSummonDraw;appearance?:AppearanceData;total:number;onDone:()=>void;onSkip?:()=>void;onRepeat:()=>void;canRepeat:boolean;busy:boolean;error?:string;hasNext?:boolean;sequenceIndex?:number;sequenceTotal?:number};
const crackAtlas=()=>assetUrl('assets/vfx/summon/seal-stone-cracks-v5-60f.webp');
const dissolveAtlas=()=>assetUrl('assets/vfx/summon/seal-stone-dissolve-v2-60f.webp');
const sealAsset=(name:string)=>assetUrl('assets/vfx/summon/seal-'+name+'-v1.webp');
export function SSRRevealFrame({draw,appearance,total,onDone,onSkip=onDone,onRepeat,canRepeat,busy,error,ready,opened=false,onOpen=()=>{},stoneRef,skipRef,confirmRef,hasNext=false,sequenceIndex=0,sequenceTotal=1}:{ready:boolean;opened?:boolean;onOpen?:()=>void;stoneRef?:React.RefObject<HTMLButtonElement|null>;skipRef?:React.RefObject<HTMLButtonElement|null>;confirmRef?:React.RefObject<HTMLButtonElement|null>}&Props){
 const tintId='seal-violet-'+useId().replace(/[^a-zA-Z0-9_-]/g,'');
 return <div style={draw.rarity==='SR'?{'--seal-filter':`url(#${tintId})`} as React.CSSProperties:undefined} className={'tc-ssr-reveal tc-seal-scene'+(ready?' is-ready':opened?' is-opening':' is-waiting')} data-rarity={draw.rarity} data-phase={ready?'ready':opened?'opening':'waiting'}>
  {!ready&&draw.rarity==='SR'&&<svg className="tc-seal-filter-defs" width="0" height="0" aria-hidden="true"><defs><filter id={tintId} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 4 0 -4 0 -.45" result="warm"/><feColorMatrix in="SourceGraphic" type="hueRotate" values="220" result="violet"/><feComposite in="SourceGraphic" in2="warm" operator="out" result="stone"/><feComposite in="violet" in2="warm" operator="in" result="light"/><feComposite in="stone" in2="light" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/></filter></defs></svg>}
  <img className="tc-seal-background" src={sealAsset('chamber')} alt="" draggable={false}/>
  <header className="tc-seal-heading"><small>탑의 기록</small><p>봉인된 기억</p>{sequenceTotal>1&&<span>희귀 외형 {sequenceIndex+1} / {sequenceTotal}</span>}</header>
  {!ready&&<button ref={skipRef} type="button" className="tc-ssr-skip" disabled={busy} onClick={onSkip}>건너뛰기 ›</button>}
  {!ready&&<div className="tc-ssr-vfx" aria-hidden="true">
   <div className="tc-seal-motes">{SEAL_MOTES.filter((_,i)=>draw.rarity==='SSR'||i%3!==2).map((m,i)=><span className="tc-seal-mote-path" key={i} style={{'--px':m.x,'--py':m.y,'--qx':m.qx,'--qy':m.qy,'--dx':m.dx,'--dy':m.dy} as React.CSSProperties}><i className="tc-seal-mote" style={{width:m.size,height:m.size}}/></span>)}</div>
   <div className="tc-seal-stone"><div className="tc-seal-stone-motion"><div className="tc-seal-stone-sprite" style={{backgroundImage:`url("${crackAtlas()}")`}}/><div className="tc-seal-rune-glow" style={{maskImage:`url("${assetUrl('assets/vfx/summon/seal-rune-mask-v2.webp')}")`}}/></div></div>
   <div className="tc-seal-dissolve"><div className="tc-seal-dissolve-sprite" style={{backgroundImage:`url("${dissolveAtlas()}")`}}/></div>
  </div>}
  {!ready&&!opened&&<button ref={stoneRef} type="button" className="tc-seal-stone-trigger" disabled={busy} onClick={onOpen} aria-label={draw.rarity+' 소환석 봉인 해제'}/> }
  <div className="tc-ssr-art" aria-hidden="true">{appearance?.imagePath?<img src={assetUrl(appearance.imagePath)} alt="" draggable={false}/>:<span>{draw.rarity}</span>}</div>
  {!ready&&<p className="tc-seal-intro" aria-hidden="true">{opened?'봉인 속에서 기억이 깨어납니다.':'소환석을 눌러 봉인을 해제하세요.'}</p>}
  <div className="tc-ssr-caption" aria-hidden={!ready}><h2 id="summon-modal-title" className="tc-ssr-grade">{draw.rarity}</h2><h3>{appearance?.name??draw.id}</h3><p>{'전용 조각 ×1 획득'}</p></div>
  <footer className="tc-ssr-actions"><button ref={confirmRef} type="button" disabled={!ready||busy} onClick={onDone}>{hasNext?'다음 외형':total>1?'결과 보기':'확인'}</button><button type="button" disabled={!ready||busy||(!hasNext&&!canRepeat)} onClick={hasNext?onSkip:onRepeat}>{hasNext?'전체 결과':busy?'소환 중…':'다시 소환'}</button></footer>
  {error&&<p role="alert" className="tc-ssr-error">{error}</p>}
 </div>;
}
export function SSRReveal(props:Props){
 const [ready,setReady]=useState(false),[opened,setOpened]=useState(false),stone=useRef<HTMLButtonElement>(null),stop=useRef<()=>void>(()=>{}),skip=useRef<HTMLButtonElement>(null),confirm=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!opened)stone.current?.focus();},[opened]);
 useEffect(()=>{
  if(!opened)return;
  const motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reduce=()=>{if(motion?.matches){clearTimeout(impact);clearTimeout(finish);stop.current();setReady(true);}};
  if(motion?.matches){setReady(true);return;}
  const impact=setTimeout(()=>{stop.current=playSsrBell(props.draw.rarity==='SSR'?1:.55);},3100-OPENING_OFFSET_MS);
  const finish=setTimeout(()=>setReady(true),SSR_REVEAL_DURATION_MS-OPENING_OFFSET_MS);
  motion?.addEventListener?.('change',reduce);skip.current?.focus();
  return()=>{clearTimeout(impact);clearTimeout(finish);motion?.removeEventListener?.('change',reduce);stop.current();};
 },[opened,props.draw.rarity]);
 useEffect(()=>{if(ready)confirm.current?.focus();},[ready]);
 const done=()=>{stop.current();props.onDone();};
 const skipAll=()=>{stop.current();(props.onSkip??props.onDone)();};
 return <SSRRevealFrame {...props} ready={ready} opened={opened} stoneRef={stone} onOpen={()=>{if(!props.busy&&!opened){unlockSsrSound();setOpened(true);}}} skipRef={skip} confirmRef={confirm} onDone={done} onSkip={skipAll}/>;
}
