import React from 'react';

const ICON_PATHS:Record<string,string>={
 home:'M3 11 12 3l9 8M5 9v12h5v-7h4v7h5V9',
 inventory:'M4 8h16v13H4ZM3 4h18v4H3Zm6 8h6',
 market:'M3 10 5 4h14l2 6M3 10h18M5 10v11h14V10M9 21v-7h6v7M8 4l-1 6m9-6 1 6',
 association:'M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6M9 9h6',
 craft:'m5 3 5 5-3 3-5-5M7 11l11 11 3-3L10 8M14 7l4-4 3 3-4 4M3 21l6-6',
 towers:'M5 21h14M7 21V9h10v12M6 5V2m4 3V2m4 3V2m4 3V2M6 5h12v4H6Zm4 16v-6h4v6',
 farm:'M12 22V5m0 4C6 9 6 5 6 3c4 0 6 2 6 6Zm0 5c-6 0-6-4-6-6 4 0 6 2 6 6Zm0-5c6 0 6-4 6-6-4 0-6 2-6 6Zm0 5c6 0 6-4 6-6-4 0-6 2-6 6Z',
 mail:'M3 5h18v14H3Zm0 0 9 7 9-7',
 settings:'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6',
 jobs:'M5 3h14v18H5ZM8 7h8M8 11h8M8 15h4m2 2 2 2 4-4',
 registration:'M5 3h10l4 4v5M15 3v5h4M5 3v18h7M8 8h3M8 12h5m4 2v8m-4-4h8',
 bestiary:'M12 5C9 3 6 3 3 4v16c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v16M6 8h3m-3 4h3m6-4h3m-3 4h3',
 skills:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Zm0 6v8m-4-4h8',
 shop:'M6 8h12l-1 13H7L6 8Zm3 0V6a3 3 0 0 1 6 0v2M9 12h6',
 sword:'m14 3 7-1-1 7-10 10-5-5ZM7 12l5 5M8 17l-5 5m-1-4 4 4M11 12l7-7',
 dagger:'m15 3 6-1-2 7-9 8-4-4ZM5 12l7 7M7 16l-5 6m0-4 4 4',
 bow:'M5 3c17 0 17 18 0 18L14 12Zm-3 9h20m-4-4 4 4-4 4',
 staff:'m6 22 8-15m-3-4 4-2 5 4-2 5-5-1-2-6Zm4 0 3 3',
 armor:'m8 3 4 2 4-2 5 5-4 3v10H7V11L3 8Zm0 0v6h8V3M9 13h6',
 boots:'M9 3h9v13l3 2v3H4v-4l5-3Zm0 5h9M9 11h9',
 accessory:'m12 2 6 6-6 6-6-6Zm-4 11a7 7 0 1 0 8 0',
 materials:'m12 2 9 5v10l-9 5-9-5V7Zm0 10 9-5m-9 5L3 7m9 5v10M7 5l10 6',
 potions:'M9 2h6v5l5 9v5H4v-5l5-9Zm-1 0h8M6 14h12m-6 1v4m-2-2h4',
 tickets:'M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4Zm12 2v2m0 2v2m0 2v2',
 cosmetics:'M9 3h6l4 6-3 3-4-2-4 2-3-3Zm-1 9-4 9h16l-4-9',
 other:'M5 5h14v14H5Zm4 7h6',
 all:'M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z',
 search:'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-1 5 6 6',
 leather:'m8 3 4 2 4-2 5 5-3 4 3 6-5 3-4-2-4 2-5-3 3-6-3-4Z',
 gem:'m7 3-5 6 10 13L22 9l-5-6ZM2 9h20M7 3l5 19 5-19',
 kaleon:'M12 22V10M12 16C4 16 3 11 3 5c6 0 9 4 9 11Zm0-6c0-5 4-8 9-8 0 6-4 9-9 9',
 health:'M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z',
 defense:'m12 2 8 4v7c0 4-4 7-8 9-4-2-8-5-8-9V6Zm-4 10 3 3 5-6',
 haste:'m4 4 8 8-8 8m8-16 8 8-8 8',
 revival:'M5 8a8 8 0 1 1-1 8M3 3v6h6m3-1v8m-4-4h8'
};
const ICON_ALIASES:Record<string,string>={
 weapon:'sword',equipment:'sword',attack:'sword',ore:'materials',alchemy:'potions',
 skillbooks:'bestiary',filter:'settings',regen:'health',
 healing_lesser:'potions',healing_standard:'potions',healing_greater:'potions',healing_supreme:'potions'
};

export function Glyph({name,className=''}:{name:string;className?:string}){
 return <span className={'tc-glyph '+className} aria-hidden="true"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" focusable="false"><path d={ICON_PATHS[ICON_ALIASES[name]??name]??ICON_PATHS.other}/></svg></span>;
}

export function Screen({eyebrow,title,meta,children,className=''}:{eyebrow?:string;title:string;meta?:React.ReactNode;children:React.ReactNode;className?:string}){
 return <section className={'tc-screen '+className}>
  <header className="tc-screen-head"><div>{eyebrow&&<small>{eyebrow}</small>}<h1>{title}</h1></div>{meta&&<div className="tc-screen-meta">{meta}</div>}</header>
  <div className="tc-screen-body">{children}</div>
 </section>;
}

export function Pager({page,count,onChange}:{page:number;count:number;onChange:(page:number)=>void}){
 if(count<=1)return null;
 return <div className="tc-pager" aria-label="페이지 이동">
  <button disabled={page<=0} onClick={()=>onChange(Math.max(0,page-1))} aria-label="이전 페이지">‹</button>
  <span>{page+1}<i>/</i>{count}</span>
  <button disabled={page>=count-1} onClick={()=>onChange(Math.min(count-1,page+1))} aria-label="다음 페이지">›</button>
 </div>;
}

export function Segments<T extends string>({items,value,onChange,label}:{items:readonly (readonly [T,string])[];value:T;onChange:(v:T)=>void;label:string}){
 return <div className="tc-segments" role="tablist" aria-label={label}>{items.map(([id,text])=><button key={id} role="tab" aria-selected={value===id} onClick={()=>onChange(id)}>{text}</button>)}</div>;
}

export function Meter({value,max,className=''}:{value:number;max:number;className?:string}){
 const p=max<=0?0:Math.max(0,Math.min(100,value/max*100));
 return <div className={'tc-meter '+className} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.max(0,value)}><i style={{width:p+'%'}}/></div>;
}

export function Stat({label,value}:{label:string;value:React.ReactNode}){
 return <div className="tc-stat"><small>{label}</small><b>{value}</b></div>;
}
