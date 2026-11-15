import React,{useLayoutEffect,useMemo,useRef,useState} from 'react';
export type CatalogQuote={id:string;name:string;description:string;art:React.ReactNode;ask:number|null;bid:number|null};
export function sortCatalogQuotes(rows:CatalogQuote[],field:'ask'|'bid'|null,descending:boolean){
 if(!field)return rows;
 return [...rows].sort((a,b)=>{const x=a[field],y=b[field];if(x===null)return y===null?0:1;if(y===null)return -1;return descending?y-x:x-y;});
}
export function catalogPageSize(height:number){return Math.max(1,Math.min(7,Math.floor(height/56)));}
export function MarketCatalogTable({rows,resetKey,onChoose,empty,status}:{rows:CatalogQuote[];resetKey:string;onChoose:(id:string)=>void;empty:React.ReactNode;status:React.ReactNode}){
 const body=useRef<HTMLDivElement>(null);
 const [size,setSize]=useState(5),[page,setPage]=useState(0),[field,setField]=useState<'ask'|'bid'|null>(null),[descending,setDescending]=useState(false);
 useLayoutEffect(()=>{const el=body.current;if(!el)return;const resize=()=>setSize(catalogPageSize(el.clientHeight));resize();const observer=new ResizeObserver(resize);observer.observe(el);return()=>observer.disconnect();},[]);
 useLayoutEffect(()=>setPage(0),[resetKey,field,descending,size]);
 const sorted=useMemo(()=>sortCatalogQuotes(rows,field,descending),[rows,field,descending]);
 const pages=Math.max(1,Math.ceil(rows.length/size)),current=Math.min(page,pages-1);
 const toggle=(key:'ask'|'bid')=>{setField(key);setDescending(field===key?!descending:false);};
 const money=(value:number|null)=>value===null?'—':value.toLocaleString()+' S';
 return <div className="tc-market-ledger">
  <div className="tc-ledger-columns"><span>품목</span>{(['ask','bid'] as const).map(key=><button key={key} onClick={()=>toggle(key)} aria-label={(key==='ask'?'최저 판매':'최고 구매')+' 가격순 정렬'} aria-pressed={field===key}>{key==='ask'?'최저 판매':'최고 구매'} <small>{field===key?(descending?'↓':'↑'):'↕'}</small></button>)}</div>
  <div className="tc-ledger-rows" ref={body} style={{gridTemplateRows:`repeat(${size},minmax(0,1fr))`}}>
   {sorted.slice(current*size,(current+1)*size).map(row=><button className="tc-ledger-row" key={row.id} onClick={()=>onChoose(row.id)} aria-label={`${row.name}, 최저 판매 ${money(row.ask)}, 최고 구매 ${money(row.bid)}, 시세 보기`}><span className="tc-ledger-item"><span className="tc-ledger-art">{row.art}</span><span className="tc-ledger-name"><b>{row.name}</b><small>{row.description}</small></span></span><span className="tc-ledger-price">{money(row.ask)}</span><span className="tc-ledger-price">{money(row.bid)}</span></button>)}
   {!rows.length&&<div className="tc-ledger-empty">{empty}</div>}
  </div>
  <footer className="tc-ledger-footer"><div><span>품목 선택 후 시세 확인 및 주문</span><small>{status}</small></div><nav aria-label="거래 품목 페이지"><button disabled={current===0} onClick={()=>setPage(current-1)} aria-label="이전 페이지">‹</button><span>{current+1} / {pages}</span><button disabled={current>=pages-1} onClick={()=>setPage(current+1)} aria-label="다음 페이지">›</button></nav></footer>
 </div>;
}
