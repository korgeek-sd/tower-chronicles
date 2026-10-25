import React,{useEffect,useRef,useState} from 'react';
import type {AppearanceSummonDraw} from '../../online/appearanceSummon';
import type {AppearanceData} from '../../game/data/cosmetics';
import {assetUrl} from '../../game/data/graphics';
import {playSsrBell} from './ssrSound';
import './ssr-reveal.css';
export function SSRReveal({draw,appearance,total,onDone,onRepeat,canRepeat,busy,error}:{draw:AppearanceSummonDraw;appearance?:AppearanceData;total:number;onDone:()=>void;onRepeat:()=>void;canRepeat:boolean;busy:boolean;error?:string}){
 const [ready,setReady]=useState(false),stop=useRef<()=>void>(()=>{}),skip=useRef<HTMLButtonElement>(null),confirm=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(reduced){setReady(true);return;}
  const impact=setTimeout(()=>{stop.current=playSsrBell();},650);
  const finish=setTimeout(()=>{setReady(true);},2000);
  skip.current?.focus();
  return()=>{clearTimeout(impact);clearTimeout(finish);stop.current();};
 },[]);
 useEffect(()=>{if(ready)confirm.current?.focus();},[ready]);
 return <div className={'tc-ssr-reveal'+(ready?' is-ready':'')} data-rarity="SSR">
  <button ref={skip} type="button" className="tc-ssr-skip" disabled={busy} onClick={()=>{stop.current();onDone();}}>건너뛰기 ›</button>
  <div className="tc-ssr-scene" aria-hidden="true">
   <svg className="tc-ssr-crack" viewBox="0 0 320 650" preserveAspectRatio="none"><path className="tc-ssr-crack-glow" d="M158 0 164 68 149 121 170 173 151 223 164 272 147 322 170 374 157 425 169 476 150 536 163 592 157 650"/><path d="m149 121-25 24-9 38m55-10 32 22 12 31M147 322l-34 18-16 37m73-3 37 30 12 44m-69 88-30 17-10 41"/></svg>
   <div className="tc-ssr-breach"/><div className="tc-ssr-flash"/>
   <div className="tc-ssr-dust">{Array.from({length:18},(_,i)=><i key={i} style={{'--x':(i*47%100)+'%','--delay':(i%6)*.13+'s','--drift':(i%2?-1:1)*(15+i*2)+'px'} as React.CSSProperties}/>)}</div>
   <div className="tc-ssr-character">{appearance?.imagePath?<img src={assetUrl(appearance.imagePath)} alt="" draggable={false}/>:<span>SSR</span>}</div>
  </div>
  <div className="tc-ssr-caption"><h2 id="summon-modal-title">SSR</h2><p className="tc-ssr-waking">기록이 깨어납니다</p><div className="tc-ssr-name"><h3>{appearance?.name??draw.id}</h3><p>{draw.duplicate?'이미 기록된 외형을 다시 발견했습니다':'새로운 외형 획득'}</p>{total>1&&<small>전체 소환 결과에서 다른 외형도 확인할 수 있습니다.</small>}</div></div>
  <footer className="tc-ssr-actions"><button ref={confirm} type="button" disabled={!ready||busy} onClick={onDone}>{total>1?'전체 결과 확인':'확인'}</button><button type="button" disabled={!ready||busy||!canRepeat} onClick={onRepeat}>{busy?'소환 중…':total===10?'10회 다시 소환':'다시 소환'}</button></footer>
  {error&&<p role="alert" className="tc-ssr-error">{error}</p>}
 </div>;
}
