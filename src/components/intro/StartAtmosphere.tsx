import React,{useEffect,useRef,useState} from 'react';
import {fitTitleArtwork} from './titleArtworkFit';
import './start-atmosphere.css';

export function StartAtmosphere({paused=false}:{paused?:boolean}){
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
   <g className="tc-start-atmosphere__glow" fill="#ffe6ab">
    <path opacity=".65" d="M428 1018V914H432V898H438V886H444V874H450V886H456V898H462V914H466V1024H450V1018Z"/>
    <path opacity=".8" d="M440 1018V912H444V894H450V912H456V1024H448V1018Z"/>
    <path opacity=".35" d="M410 1022H426V1016H446V1022H470V1028H486V1034H452V1030H428V1034H402V1028H410Z"/>
   </g>
   <g className="tc-start-atmosphere__fog tc-start-atmosphere__fog--far" fill="#c0bfb0">
    <path d="M-60 1048H-20V1038H10V1028H42V1018H78V1010H104V1020H138V1028H168V1038H202V1046H238V1056H252V1068H210V1076H162V1070H130V1078H90V1070H46V1078H8V1068H-32V1060H-60Z"/>
    <path d="M592 1168H620V1158H648V1148H680V1138H714V1146H748V1136H780V1146H814V1156H852V1166H900V1180H856V1188H812V1180H778V1190H738V1182H696V1192H654V1184H618V1176H592Z"/>
    <rect x="188" y="1084" width="32" height="6"/><rect x="664" y="1202" width="44" height="6"/>
   </g>
   <g className="tc-start-atmosphere__fog tc-start-atmosphere__fog--near" fill="#b8b6a9">
    <path d="M-44 1548H-8V1536H30V1528H68V1518H112V1510H152V1520H194V1512H230V1524H270V1532H316V1542H350V1554H314V1564H270V1556H228V1568H186V1560H142V1570H96V1560H52V1570H12V1558H-44Z"/>
    <path d="M420 1612H450V1602H486V1592H524V1584H562V1592H604V1580H646V1590H690V1600H732V1608H778V1620H826V1632H874V1646H822V1638H776V1646H730V1636H684V1644H638V1634H590V1642H542V1632H498V1622H458V1628H420Z"/>
    <rect x="278" y="1578" width="48" height="6"/><rect x="540" y="1654" width="36" height="6"/>
   </g>
  </svg>}
 </div>;
}
