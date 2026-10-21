import React,{useEffect,useRef,useState} from 'react';
import {getPublishedNotices,noticeDate,type NoticeFilter} from './startNotices';
import './start-notices.css';
const filters:[NoticeFilter,string][]=[['all','전체'],['update','업데이트'],['maintenance','점검']];
export function StartNotices({open,onClose}:{open:boolean;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [filter,setFilter]=useState<NoticeFilter>('all');
 useEffect(()=>{
  const element=dialog.current;if(!element)return;
  if(open&&!element.open){setFilter('all');element.showModal();}
  else if(!open&&element.open)element.close();
 },[open]);
 useEffect(()=>()=>{if(dialog.current?.open)dialog.current.close();},[]);
 const notices=getPublishedNotices(undefined,filter);
 return <dialog ref={dialog} className="tc-start-notices" aria-labelledby="start-notices-title" onClose={onClose}>
  <header><div><small>TOWER CHRONICLES</small><h2 id="start-notices-title">공지사항</h2></div><button type="button" className="tc-start-notices__close" aria-label="공지사항 닫기" onClick={()=>dialog.current?.close()}>×</button></header>
  <div className="tc-start-notices__filters" role="group" aria-label="공지 종류">{filters.map(([kind,label])=><button type="button" key={kind} aria-pressed={filter===kind} onClick={()=>setFilter(kind)}>{label}</button>)}</div>
  <section className="tc-start-notices__list" aria-label="공지 목록">
   {notices.length===0?<p className="tc-start-notices__empty" role="status">{filter==='maintenance'?'등록된 점검 공지가 없습니다.':'등록된 공지가 없습니다.'}</p>:notices.map(notice=><details key={notice.id}>
    <summary><span className="tc-start-notices__meta"><span>{notice.kind==='maintenance'?'점검':'업데이트'}</span><time dateTime={notice.publishedAt}>{noticeDate(notice.publishedAt)}</time></span><strong>{notice.title}</strong><span className="tc-start-notices__expand" aria-hidden="true">⌄</span></summary>
    <div className="tc-start-notices__body">{notice.body.map((paragraph,index)=><p key={index}>{paragraph}</p>)}</div>
   </details>)}
  </section>
 </dialog>;
}
