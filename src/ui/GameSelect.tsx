import React,{useMemo} from 'react';
import {GameScrollSelect,type GameScrollOption} from './GameScrollSelect';

/** Compatible JSX <option> adapter for legacy controlled select fields.
 * Only a value-bearing change notification is emitted; this is not a native DOM event.
 */
export type GameSelectChange={target:{value:string}};
export type GameSelectProps={
 children:React.ReactNode;
 value?:string|number;
 defaultValue?:string|number;
 disabled?:boolean;
 onChange?:(event:GameSelectChange)=>void;
 'aria-label'?:string;
 className?:string;
 style?:React.CSSProperties;
 id?:string;
 name?:string;
 title?:string;
};
function toText(node:React.ReactNode):string{
 if(typeof node==='string'||typeof node==='number')return String(node);
 if(Array.isArray(node))return node.map(toText).join('');
 if(React.isValidElement<{children?:React.ReactNode}>(node))return toText(node.props.children);
 return '';
}
function toOptions(children:React.ReactNode):GameScrollOption[]{
 return React.Children.toArray(children).flatMap(child=>{
  if(!React.isValidElement<{children?:React.ReactNode;value?:string|number;disabled?:boolean;label?:string}>(child))return [];
  if(child.type===React.Fragment||child.type==='optgroup')return toOptions(child.props.children);
  if(child.type!=='option')return [];
  const label=child.props.label??toText(child.props.children);
  const value=String(child.props.value??label);
  const grades=['common','uncommon','rare','heroic','legendary'] as const;
  const grade=grades.find(g=>g===value);
  return [{value,label,disabled:!!child.props.disabled,grade}];
 });
}
export function GameSelect({children,value,defaultValue,disabled=false,onChange,
 'aria-label':ariaLabel='항목 선택',className,style,id,name}:GameSelectProps){
 const options=useMemo(()=>toOptions(children),[children]);
 const choice=String(value??defaultValue??'');
 const compact=!!style&&(style.height==='30px'||style.height===30);
 return <>
  <GameScrollSelect ariaLabel={ariaLabel} options={options} value={choice} disabled={disabled}
   onChange={next=>onChange?.({target:{value:next}})}
   className={className} style={style} id={id} compact={compact}/>
  {name&&<input type="hidden" name={name} value={choice} readOnly/>}
 </>;
}
