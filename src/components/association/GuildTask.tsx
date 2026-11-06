import React,{useId,useRef} from 'react';
import {GameScrollSelect} from '../../ui/GameScrollSelect';

export function GuildTask({title,children,feedback,trigger}:{title:string;children:React.ReactNode;feedback?:string;trigger?:React.ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),id=useId();
 return <>
  <button type="button" className="tc-guild-task-open" aria-haspopup="dialog" onClick={()=>ref.current?.showModal()}>{trigger??title}</button>
  <dialog className="tc-guild-task" ref={ref} aria-labelledby={id}>
   <header><strong id={id}>{title}</strong><button type="button" aria-label={title+' 닫기'} onClick={()=>ref.current?.close()}>닫기</button></header>
   <div className="tc-guild-task-content">{children}</div>
   {feedback&&<p role="status">{feedback}</p>}
  </dialog>
 </>;
}

/** Choose a record by name. The detail area always displays one complete record. */
export function GuildRecord<T>({items,id,label,title,children}:{items:readonly T[];id:(item:T)=>string;label:(item:T)=>string;title:string;children:(item:T)=>React.ReactNode}){
 const [chosen,setChosen]=React.useState('');
 const item=items.find(row=>id(row)===chosen)??items[0];
 if(!item)return <p>등록된 기록이 없습니다.</p>;
 return <>
  {items.length>1&&<GameScrollSelect ariaLabel={title} options={items.map(row=>({value:id(row),label:label(row)}))} value={id(item)} onChange={setChosen}/>}
  {children(item)}
 </>;
}
