import React from 'react';

export interface SegmentTabItem<T extends string>{
  value:T;
  label:string;
  disabled?:boolean;
}

export function SegmentTabs<T extends string>({items,value,onChange,label}:{
  items:readonly SegmentTabItem<T>[];
  value:T;
  onChange:(value:T)=>void;
  label:string;
}){
  return <div className="segment-tabs" role="tablist" aria-label={label}>
    {items.map(item=><button
      key={item.value}
      type="button"
      role="tab"
      aria-selected={value===item.value}
      disabled={item.disabled}
      className={value===item.value?'active':''}
      onClick={()=>onChange(item.value)}
    >{item.label}</button>)}
  </div>;
}
