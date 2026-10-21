import React,{useEffect,useId,useRef,useState} from 'react';
import {fitTitleArtwork} from './titleArtworkFit';
import './start-atmosphere.css';

export function StartAtmosphere({paused=false}:{paused?:boolean}){
 const id=useId().replace(/:/g,'');
 const frame=useRef<HTMLDivElement>(null);
 const [fit,setFit]=useState<ReturnType<typeof fitTitleArtwork>>(null);
 const [hidden,setHidden]=useState(()=>typeof document!=='undefined'&&document.hidden);
 useEffect(()=>{
  const element=frame.current;if(!element)return;
  const resize=()=>{const bounds=element.getBoundingClientRect();setFit(fitTitleArtwork(bounds.width,bounds.height));};
  resize();
  if(typeof ResizeObserver!=='undefined'){
   const observer=new ResizeObserver(resize);observer.observe(element);return()=>observer.disconnect();
  }
  window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);
 },[]);
 useEffect(()=>{
  const visibility=()=>setHidden(document.hidden);
  document.addEventListener('visibilitychange',visibility);
  return()=>document.removeEventListener('visibilitychange',visibility);
 },[]);
 return <div ref={frame} className="tc-start-atmosphere" aria-hidden="true" data-paused={paused||hidden}>
  {fit&&<svg className="tc-start-atmosphere__canvas" viewBox="0 0 841 1870" style={fit} focusable="false" shapeRendering="crispEdges">
   <defs>
    <radialGradient id={`${id}-bloom`}>
     <stop stopColor="#fff7cb" stopOpacity=".95"/><stop offset=".28" stopColor="#ffc365" stopOpacity=".8"/>
     <stop offset=".62" stopColor="#ed943a" stopOpacity=".32"/><stop offset="1" stopColor="#ed943a" stopOpacity="0"/>
    </radialGradient>
    <linearGradient id={`${id}-core`} x1="0" y1="0" x2="0" y2="1">
     <stop stopColor="#fff6c7" stopOpacity=".15"/><stop offset=".55" stopColor="#ffe8a0" stopOpacity=".7"/><stop offset="1" stopColor="#fffbd9"/>
    </linearGradient>
    <clipPath id={`${id}-door`}>
     <path d="M420 1023V897H424V883H430V872H438V863H445V858H451V863H458V872H465V883H471V897H475V1027Z"/>
    </clipPath>
   </defs>
   <g className="tc-start-atmosphere__fog tc-start-atmosphere__fog--sky" fill="#aeb0af">
    <CloudBank x={10} y={310} w={390} h={140}/><CloudBank x={635} y={400} w={410} h={160}/>
    <CloudBank x={-100} y={565} w={420} h={170}/><CloudBank x={690} y={650} w={350} h={140}/>
   </g>
   <g className="tc-start-atmosphere__fog tc-start-atmosphere__fog--far" fill="#c0bfb0">
    <CloudBank x={-90} y={865} w={430} h={130}/><CloudBank x={620} y={925} w={370} h={150}/>
    <CloudBank x={-45} y={1020} w={360} h={110}/><CloudBank x={580} y={1120} w={400} h={120}/>
   </g>
   <g className="tc-start-atmosphere__glow">
    <ellipse cx="449" cy="955" rx="115" ry="182" fill={`url(#${id}-bloom)`}/>
    <g clipPath={`url(#${id}-door)`}>
     <rect x="418" y="855" width="60" height="176" fill={`url(#${id}-core)`}/>
    </g>
    <ellipse cx="451" cy="1030" rx="105" ry="31" fill={`url(#${id}-bloom)`} opacity=".8"/>
   </g>
   <g className="tc-start-atmosphere__fog tc-start-atmosphere__fog--middle" fill="#b9bbaf">
    <CloudBank x={-80} y={1195} w={440} h={130}/><CloudBank x={580} y={1250} w={400} h={125}/>
    <CloudBank x={55} y={1330} w={260} h={90}/><CloudBank x={650} y={1400} w={330} h={100}/>
   </g>
   <g className="tc-start-atmosphere__fog tc-start-atmosphere__fog--near" fill="#b8b6a9">
    <CloudBank x={-100} y={1490} w={440} h={100}/><CloudBank x={485} y={1520} w={460} h={110}/>
    <CloudBank x={-45} y={1640} w={500} h={95}/><CloudBank x={450} y={1700} w={480} h={100}/>
   </g>
  </svg>}
 </div>;
}

// Layered stepped contours keep cloud edges pixelated without a solid rectangular wash.
function CloudBank({x,y,w,h}:{x:number;y:number;w:number;h:number}){
 return <g transform={`translate(${x} ${y}) scale(${w/400} ${h/100})`}>
  <path opacity=".34" d="M0 53H20V40H48V28H82V18H111V8H146V16H176V5H209V19H239V12H269V27H302V35H330V44H368V53H400V68H376V78H342V85H308V93H274V84H239V96H204V88H166V98H130V85H94V92H60V79H27V68H0Z"/>
  <path opacity=".46" d="M35 54H68V43H103V34H136V28H169V37H204V25H239V36H272V43H304V50H343V62H368V72H328V79H290V72H252V83H215V77H176V86H136V76H99V82H66V70H35Z"/>
  <path opacity=".28" d="M82 59H122V48H158V54H194V43H230V53H271V60H312V69H274V76H237V69H200V79H162V71H124V76H82Z"/>
 </g>;
}
