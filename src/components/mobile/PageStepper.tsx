import React from 'react';

export function PageStepper({page,pageCount,onPage}:{
  page:number;
  pageCount:number;
  onPage:(page:number)=>void;
}){
  const count=Math.max(1,pageCount);
  const current=Math.min(Math.max(0,page),count-1);
  return <div className="page-stepper" aria-label="페이지 이동">
    <button type="button" disabled={current<=0} onClick={()=>onPage(current-1)}>← 이전</button>
    <span>{current+1} / {count}</span>
    <button type="button" disabled={current>=count-1} onClick={()=>onPage(current+1)}>다음 →</button>
  </div>;
}
