// Lucian UX/UI Prompt #019 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#019
// Lucian UX/UI Prompt #092 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#092
import React from 'react';
import './lucian-filters.css';
export const equipmentGradeOptions=[['common','일반'],['uncommon','고급'],['rare','희귀'],['heroic','영웅'],['legendary','전설']] as const;
export const bookGradeOptions=['C','B','A','S','SR','SSR'].map(grade=>[grade,grade] as const);
export function toggleGradeSelection(value:readonly string[],grade:string){return grade==='all'?[]:value.includes(grade)?value.filter(v=>v!==grade):[...value,grade];}
export function GradeChips({label,options,value,onChange,className=''}:{label:string;options:readonly (readonly [string,string])[];value:readonly string[];onChange:(grades:string[])=>void;className?:string}){
 return <div className={'ux u019 tc-lucian-grades '+className} style={{'--grade-columns':options.length+1} as React.CSSProperties}><div className="u019-list" role="group" aria-label={label}>{[['all','전체'],...options].map(([key,name])=><button type="button" key={key} className={'u019-chip grade-'+key.toLowerCase()} aria-label={key==='all'?'전체 등급':name+' 등급'} aria-pressed={key==='all'?value.length===0:value.includes(key)} onClick={()=>onChange(toggleGradeSelection(value,key))}><i aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.4l3 3 6-6.4"/></svg></i>{name}</button>)}</div></div>;
}
export type FilterRecovery={label:string;count:number;run:()=>void};
export function EmptySearchResults({actions,title='조건에 맞는 아이템이 없습니다.'}:{actions:FilterRecovery[];title?:string}){
 const suggestions=actions.filter(action=>action.count>0).sort((a,b)=>b.count-a.count).slice(0,2);
 function recover(event:React.MouseEvent,action:FilterRecovery){const screen=event.currentTarget.closest('.tc-screen');const focus=screen?.querySelector<HTMLElement>('input[aria-label="아이템 검색"],input[aria-label="거래 품목 검색"],button[aria-label="전체 등급"]');focus?.focus({preventScroll:true});action.run();}
 return <div className="ux u092 empty tc-lucian-empty" role="status"><div className="u092-none"><div className="u092-art" aria-hidden="true"><svg viewBox="0 0 150 92"><path className="u092-shelf" d="M8 30h134M8 56h134M8 82h134"/><g className="u092-lens"><circle cx="34" cy="38" r="20"/><path className="gl" d="M24 30a12 12 0 0 1 8-5"/><path d="M48 52l14 14"/></g></svg></div><p className="u092-nt">{title}</p><p className="u092-ns">{suggestions.length?'조건을 풀어서 다시 찾아보세요.':'검색어를 바꾸거나 다른 분류를 선택해 주세요.'}</p><div className="u092-sgs">{suggestions.map((action,index)=><button className="u092-sg" type="button" key={action.label} style={{'--i':index} as React.CSSProperties} onClick={event=>recover(event,action)}><s>{action.label}</s><span>해제하면 <b>{action.count}종</b></span><svg viewBox="0 0 15 15" aria-hidden="true"><path d="M3 7.5h9M8.5 4l3.5 3.5L8.5 11"/></svg></button>)}</div></div></div>;
}
