import React,{Fragment,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';

type Props={children:React.ReactNode;pageKey:string;disabled?:boolean};

function flatten(node:React.ReactNode):React.ReactNode[]{
  const out:React.ReactNode[]=[];
  React.Children.forEach(node,child=>{
    if(child===null||child===undefined||child===false)return;
    if(React.isValidElement(child)&&child.type===Fragment)out.push(...flatten(child.props.children));
    else out.push(child);
  });
  return out;
}

function weight(node:React.ReactNode){
  if(!React.isValidElement(node))return .25;
  if(typeof node.type!=='string')return 2.1;
  const cls=String(node.props.className??'');
  if(node.type==='section'||cls.includes('panel'))return 1.2;
  if(cls.includes('tower-list'))return 1.8;
  if(cls.includes('note')||cls.includes('notice'))return .65;
  if(cls.includes('wide-link')||cls.includes('primary')||cls.includes('back'))return .45;
  if(cls.includes('section-heading')||cls.includes('stats')||cls.includes('steps')||cls.includes('tabs'))return .65;
  if(node.type==='h1'||node.type==='h2'||cls.includes('section-label'))return .35;
  if(node.type==='p'||node.type==='small')return .3;
  return .5;
}

function group(nodes:React.ReactNode[]){
  const pages:React.ReactNode[][]=[];
  let current:React.ReactNode[]=[],total=0;
  for(const node of nodes){
    const w=weight(node);
    if(current.length&&total+w>2.05){pages.push(current);current=[];total=0;}
    current.push(node);total+=w;
  }
  if(current.length)pages.push(current);
  return pages.length?pages:[[]];
}

function FitPage({children}:{children:React.ReactNode}){
  const viewport=useRef<HTMLDivElement>(null),content=useRef<HTMLDivElement>(null);
  const [scale,setScale]=useState(1);
  useLayoutEffect(()=>{
    const fit=()=>{
      const v=viewport.current,c=content.current;
      if(!v||!c)return;
      const available=Math.max(1,v.clientHeight-2);
      const needed=Math.max(1,c.scrollHeight);
      setScale(Math.min(1,available/needed));
    };
    fit();
    const observer=new ResizeObserver(fit);
    if(viewport.current)observer.observe(viewport.current);
    if(content.current)observer.observe(content.current);
    window.addEventListener('resize',fit);
    return()=>{observer.disconnect();window.removeEventListener('resize',fit);};
  },[children]);
  return <div ref={viewport} className="mobile-screen-fit-viewport"><div ref={content} className="mobile-screen-fit-content" style={{transform:`scale(${scale})`}}>{children}</div></div>;
}

export function MobileScreenPager({children,pageKey,disabled=false}:Props){
  const nodes=useMemo(()=>flatten(children),[children]);
  const pages=useMemo(()=>group(nodes),[nodes]);
  const [index,setIndex]=useState(0);
  useEffect(()=>setIndex(0),[pageKey]);
  useEffect(()=>{if(index>pages.length-1)setIndex(Math.max(0,pages.length-1));},[index,pages.length]);
  if(disabled)return <>{children}</>;
  const current=pages[Math.min(index,pages.length-1)]??[];
  return <section className="mobile-screen-pager" aria-label="모바일 화면">
    <FitPage><div className="mobile-screen-page">{current.map((node,i)=><React.Fragment key={React.isValidElement(node)&&node.key!=null?String(node.key):i}>{node}</React.Fragment>)}</div></FitPage>
    {pages.length>1&&<div className="mobile-screen-pager-controls" aria-label="화면 페이지 이동">
      <button type="button" disabled={index===0} onClick={()=>setIndex(i=>Math.max(0,i-1))}>← 이전</button>
      <span>{index+1} / {pages.length}</span>
      <button type="button" disabled={index===pages.length-1} onClick={()=>setIndex(i=>Math.min(pages.length-1,i+1))}>다음 →</button>
    </div>}
  </section>;
}
