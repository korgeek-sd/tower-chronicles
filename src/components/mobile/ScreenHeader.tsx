import React from 'react';

export function ScreenHeader({title,meta,onBack}:{
  title:string;
  meta?:React.ReactNode;
  onBack?:()=>void;
}){
  return <header className="screen-header">
    {onBack&&<button type="button" className="screen-header-back" onClick={onBack} aria-label="뒤로">←</button>}
    <div className="screen-header-copy">
      <h1>{title}</h1>
      {meta!=null&&<div className="screen-header-meta">{meta}</div>}
    </div>
  </header>;
}
