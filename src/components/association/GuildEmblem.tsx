import React,{useId,useState} from 'react';
import {emblemArt} from './guildEmblemArtwork';
import './guildEmblem.css';

export type GuildEmblemData={
 shape:string;symbol:string;pattern:string;border:string;
 base:string;accent:string;scale:number;offsetX:number;offsetY:number;
};
export const DEFAULT_GUILD_EMBLEM:GuildEmblemData={
 shape:'shield',symbol:'sword',pattern:'solid',border:'gold',
 base:'#942f3c',accent:'#c19548',scale:100,offsetX:0,offsetY:0
};
const shapes:[string,string][]=[['shield','기사형'],['round','원형'],['point','첨두형'],['diamond','마름모'],['banner','깃발형'],['wide','장식형'],['tower','탑형'],['crest','왕실형']];
const symbolOptions:[string,string][]=[
 ['sword','검'],['shield','방패'],['crown','왕관'],['skull','해골'],['sun','태양'],['moon','달'],['star','별'],['px-flag','깃발'],
 ['px-heart','심장'],['px-key','열쇠'],['px-anchor','닻'],['px-tree','나무'],['px-eye','눈'],['px-target','표적'],['px-cross','십자가'],['px-castle','요새'],
 ['knight','기사'],['helmet','투구'],['castle','고성'],['cat','고양이'],['fawn','사슴'],['swan','백조'],['rabbit','토끼'],['book','고서'],
 ['bishop','주교'],['candelabra','촛대'],['rook','석탑'],['sugar-maple','단풍잎'],['willow-tree','버드나무'],['lauburu','고대문양']
];
const patterns:[string,string][]=[['solid','단색'],['split','세로 분할'],['horizontal','가로 분할'],['diagonal','대각선'],['cross','십자'],['chevron','V자'],['quarters','사분할'],['stripe','줄무늬'],['triangle','삼각형'],['band','중앙 띠'],['double','이중 띠'],['lattice','격자']];
const borders:[string,string][]=[['gold','황금'],['iron','철제'],['silver','은빛'],['ancient','고대룬'],['royal','왕실'],['plain','기본']];
export const GUILD_EMBLEM_COLORS=['#942f3c','#2f4f80','#386148','#624075','#c19548','#22272e','#b5b8b1','#996139','#1d6372','#9b5b69','#4d5435','#d7b878'] as const;
const tabs:[string,string][]=[['shape','방패'],['symbol','상징'],['pattern','패턴'],['border','테두리'],['colors','색상'],['adjust','조절']];
const framePaths:Record<string,string>={
 shield:'M64 8 L111 22 L105 78 L91 100 L64 119 L37 100 L23 78 L17 22 Z',
 round:'M64 8 L91 15 L111 37 L120 64 L111 91 L91 113 L64 120 L37 113 L17 91 L8 64 L17 37 L37 15 Z',
 point:'M16 12 H112 L106 79 L64 121 L22 79 Z',
 diamond:'M64 5 L123 64 L64 123 L5 64 Z',
 banner:'M22 8 H106 V119 L64 99 L22 119 Z',
 wide:'M64 7 L104 12 L119 44 L108 97 L64 121 L20 97 L9 44 L24 12 Z',
 tower:'M17 10 H36 V18 H53 V10 H75 V18 H92 V10 H111 V96 L64 121 L17 96 Z',
 crest:'M16 12 H37 L64 6 L91 12 H112 L108 81 L64 121 L20 81 Z',
};
const validHex=(color:string)=>/^#[0-9a-fA-F]{6}$/.test(color);
const int=(value:number,fallback:number,min:number,max:number)=>Number.isFinite(value)?Math.min(max,Math.max(min,Math.round(value))):fallback;
export function normalizeGuildEmblem(value?:Partial<GuildEmblemData>|null):GuildEmblemData{
 const v=value??{};
 const pick=(name:'shape'|'symbol'|'pattern'|'border',options:[string,string][])=>options.some(([id])=>id===v[name])?String(v[name]):DEFAULT_GUILD_EMBLEM[name];
 return {
  shape:pick('shape',shapes),symbol:pick('symbol',symbolOptions),pattern:pick('pattern',patterns),border:pick('border',borders),
  base:typeof v.base==='string'&&GUILD_EMBLEM_COLORS.some(x=>x===v.base)?v.base:DEFAULT_GUILD_EMBLEM.base,
  accent:typeof v.accent==='string'&&GUILD_EMBLEM_COLORS.some(x=>x===v.accent)?v.accent:DEFAULT_GUILD_EMBLEM.accent,
  scale:int(v.scale??100,100,60,140),
  offsetX:int(v.offsetX??0,0,-22,22),offsetY:int(v.offsetY??0,0,-22,22)
 };
}
export function GuildEmblem({value,size=44,className='',label}:{value?:Partial<GuildEmblemData>|null;size?:number;className?:string;label?:string}){
 const raw=normalizeGuildEmblem(value),id=useId().replaceAll(':','_'),shape=framePaths[raw.shape]??framePaths.shield;
 const art=emblemArt[raw.symbol]??emblemArt.sword;
 const symbolSize=Math.round(80*raw.scale/100);
 const offsetX=64-Math.round(symbolSize/2)+raw.offsetX;
 const offsetY=64-Math.round(symbolSize/2)+raw.offsetY;
 const border=raw.border==='iron'?'#707b87':raw.border==='silver'?'#cbd9e0':raw.border==='ancient'?'#a58b6a':'#d2a45d';
 const highlight=raw.border==='iron'?'#9da9b2':raw.border==='silver'?'#f4f5f4':'#f5dca0';
 const overlay=(()=>{
  switch(raw.pattern){
   case 'split':return <rect x="64" width="64" height="128"/>;
   case 'horizontal':return <rect y="64" width="128" height="64"/>;
   case 'diagonal':return <path d="M0 128 L128 0 L128 36 L36 128 Z"/>;
   case 'cross':return <><rect x="52" width="24" height="128"/><rect y="52" width="128" height="24"/></>;
   case 'chevron':return <path d="M0 30 L64 80 L128 30 V56 L64 106 L0 56 Z"/>;
   case 'quarters':return <><rect width="64" height="64"/><rect x="64" y="64" width="64" height="64"/></>;
   case 'stripe':return <>{[0,28,56,84,112].map(x=><rect key={x} x={x} width="13" height="128"/>)}</>;
   case 'triangle':return <path d="M0 0 H128 L64 104 Z"/>;
   case 'band':return <rect y="49" width="128" height="28"/>;
   case 'double':return <><rect y="36" width="128" height="15"/><rect y="77" width="128" height="15"/></>;
   case 'lattice':return <>{[0,25,50,75,100,125].map(n=><React.Fragment key={n}><rect x={n} width="8" height="128"/><rect y={n} width="128" height="8"/></React.Fragment>)}</>;
   default:return null;
  }
 })();
 return <svg className={'tc-guild-emblem '+className} width={size} height={size} viewBox="0 0 128 128" aria-label={label} aria-hidden={label?undefined:true} role={label?'img':undefined} shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
  <defs><clipPath id={id}><path d={shape}/></clipPath></defs>
  <path d={shape} fill={raw.base} stroke="#0d1118" strokeWidth={raw.border==='royal'?12:9} strokeLinejoin="miter"/>
  <g clipPath={`url(#${id})`}>
   <path d={shape} fill={raw.base}/>
   <g fill={raw.accent} opacity=".43">{overlay}</g>
   <svg x={offsetX} y={offsetY} width={symbolSize} height={symbolSize} viewBox={`0 0 ${art.size} ${art.size}`} preserveAspectRatio="xMidYMid meet" shapeRendering="crispEdges" overflow="visible">
    <g fill={raw.accent}>{art.paths.map((d,i)=><path key={i} d={d}/>)}</g>
   </svg>
  </g>
  <path d={shape} fill="none" stroke={border} strokeWidth={raw.border==='plain'?2:raw.border==='royal'?9:6} strokeLinejoin="miter"/>
  <path d={shape} fill="none" stroke={highlight} strokeWidth="1.4" strokeLinejoin="miter"/>
  {(raw.border==='ancient'||raw.border==='royal')&&[[64,10],[21,35],[107,35],[64,113]].map(([x,y],i)=><rect key={i} x={x-3} y={y-3} width="6" height="6" fill={raw.border==='ancient'?'#b4cdcf':'#f2d28d'}/>)}
 </svg>;
}
export function GuildEmblemEditor({value,onChange,disabled=false}:{value:GuildEmblemData;onChange:(next:GuildEmblemData)=>void;disabled?:boolean}){
 const [tab,setTab]=useState('shape');
 const set=(field:keyof GuildEmblemData,item:string|number)=>onChange({...value,[field]:item});
 const options=tab==='shape'?shapes:tab==='symbol'?symbolOptions:tab==='pattern'?patterns:borders;
 const randomize=()=>{
  const choose=<T,>(items:readonly T[]):T=>items[Math.floor(Math.random()*items.length)];
  const base=choose(GUILD_EMBLEM_COLORS);
  onChange({...value,shape:choose(shapes)[0],symbol:choose(symbolOptions)[0],pattern:choose(patterns)[0],border:choose(borders)[0],
   base,accent:choose(GUILD_EMBLEM_COLORS.filter(color=>color!==base)),scale:100,offsetX:0,offsetY:0});
 };
 return <section className="tc-guild-emblem-editor" aria-label="원정단 문장 제작">
  <div className="tc-guild-emblem-preview"><GuildEmblem value={value} size={170} label="제작 중인 원정단 문장"/><small>원정단 문장 미리보기</small></div>
  <div className="tc-guild-emblem-tabs" role="tablist" aria-label="문장 편집 항목">{tabs.map(([id,text])=><button key={id} type="button" role="tab" aria-selected={tab===id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{text}</button>)}</div>
  <div className="tc-guild-emblem-options" role="tabpanel">
   {tab==='colors'?(['base','accent'] as const).map(field=><div className="tc-guild-emblem-palette" key={field}><b>{field==='base'?'배경 색상':'상징 색상'}</b><div>{GUILD_EMBLEM_COLORS.map(color=><button key={color} type="button" disabled={disabled} className={value[field]===color?'active':''} style={{backgroundColor:color}} aria-label={field==='base'?'배경색 '+color:'상징색 '+color} aria-pressed={value[field]===color} onClick={()=>set(field,color)}/>)}</div></div>):
    tab==='adjust'?<div className="tc-guild-emblem-sliders">{([['scale','문양 크기',60,140,5],['offsetX','좌우 위치',-22,22,1],['offsetY','상하 위치',-22,22,1]] as const).map(([field,title,min,max,step])=><label key={field}><span>{title} <b>{value[field]}{field==='scale'?'%':''}</b></span><input type="range" min={min} max={max} step={step} value={value[field]} disabled={disabled} onChange={e=>set(field,Number(e.target.value))}/></label>)}</div>:
    <div className="tc-guild-emblem-grid">{options.map(([id,title])=><button key={id} type="button" disabled={disabled} className={value[tab as 'shape'|'symbol'|'pattern'|'border']===id?'active':''} aria-pressed={value[tab as 'shape'|'symbol'|'pattern'|'border']===id} onClick={()=>set(tab as keyof GuildEmblemData,id)}><GuildEmblem value={{...value,[tab]:id}} size={52}/><small>{title}</small></button>)}</div>}
  </div>
  <div className="tc-guild-emblem-actions"><button type="button" disabled={disabled} onClick={randomize}>랜덤 생성</button><button type="button" disabled={disabled} onClick={()=>onChange({...DEFAULT_GUILD_EMBLEM})}>문장 초기화</button></div>
 </section>;
}
