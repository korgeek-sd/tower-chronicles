import React from 'react';

export const GLYPHS:Record<string,string>={
 home:'⌂',inventory:'▦',market:'◫',association:'⌁',craft:'⚒',equipment:'⚔',
 towers:'△',settings:'≡',jobs:'♜',bestiary:'◈',skills:'✦',premium:'◇',
 weapon:'⚔',armor:'⬡',accessory:'◇',alchemy:'⚗',materials:'◆',potions:'✚',
 skillbooks:'✦',tickets:'▱',cosmetics:'♙',other:'·',all:'▦',search:'⌕',filter:'≡',
 sword:'†',dagger:'⌁',bow:'〉',staff:'⌇',boots:'⌄',ore:'◆',leather:'▰',gem:'◇',kaleon:'⌁',
 health:'✚',regen:'✚',attack:'⚔',defense:'⬡',haste:'»',revival:'✚'
};

export function Glyph({name,className=''}:{name:string;className?:string}){
 return <span className={'tc-glyph '+className} aria-hidden="true">{GLYPHS[name]??'◇'}</span>;
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

export function Segments<T extends string>({items,value,onChange,label}:{items:readonly [T,string][];value:T;onChange:(v:T)=>void;label:string}){
 return <div className="tc-segments" role="tablist" aria-label={label}>{items.map(([id,text])=><button key={id} role="tab" aria-selected={value===id} onClick={()=>onChange(id)}>{text}</button>)}</div>;
}

export function Meter({value,max,className=''}:{value:number;max:number;className?:string}){
 const p=max<=0?0:Math.max(0,Math.min(100,value/max*100));
 return <div className={'tc-meter '+className} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.max(0,value)}><i style={{width:p+'%'}}/></div>;
}

export function Stat({label,value}:{label:string;value:React.ReactNode}){
 return <div className="tc-stat"><small>{label}</small><b>{value}</b></div>;
}
