import React,{useEffect,useRef,useState} from 'react';
import type {EquipmentGrade,GameState} from '../../game/types';
import {EQUIPMENT_GRADES,EQUIPMENT_GRADE_NAMES} from '../../game/data/equipment';
import {bulkDismantleCandidates,equipmentDismantleYield} from '../../game/engine/equipmentDismantle';
type Request={id:string;ids:string[];stones:number};
type Result={count:number;stones:number};
function GradeBadge({selected}:{selected:boolean}){
 const id=React.useId();
 return <svg className="tc-bulk-badge-art" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
  <defs>
   <linearGradient id={id+'-metal'} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f2dbad"/><stop offset=".18" stopColor="#8c6241"/><stop offset=".36" stopColor="#e9bd76"/><stop offset=".55" stopColor="#503b2a"/><stop offset=".76" stopColor="#b08a55"/><stop offset="1" stopColor="#f9d8a1"/></linearGradient>
   <radialGradient id={id+'-field'} cx=".5" cy=".28" r=".83"><stop stopColor="var(--badge-field)"/><stop offset="1" stopColor="#0b0b0c"/></radialGradient>
   <linearGradient id={id+'-gem'} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--badge-light)"/><stop offset=".42" stopColor="var(--badge-tone)"/><stop offset="1" stopColor="var(--badge-shade)"/></linearGradient>
  </defs>
  <path d="M12 3H88L97 12V88L88 97H12L3 88V12Z" fill="#0a0909" stroke="#382c22" strokeWidth="2"/>
  <path d="M13 4H87L96 13V87L87 96H13L4 87V13Z" fill={'url(#'+id+'-field)'} stroke={'url(#'+id+'-metal)'} strokeWidth="3"/>
  <path d="M15 9H85L91 15V85L85 91H15L9 85V15Z" fill="none" stroke="var(--badge-tone)" strokeOpacity=".8" strokeWidth="1.5"/>
  <path d="M7 25V13L13 7H31M69 7H87L93 13V25M7 75V87L13 93H31M69 93H87L93 87V75" fill="none" stroke="#f1d3a2" strokeWidth="2.4" strokeLinejoin="miter"/>
  <path d="M7 27L18 13L33 10L20 18ZM93 27L82 13L67 10L80 18ZM7 73L18 87L33 90L20 82ZM93 73L82 87L67 90L80 82Z" fill={'url(#'+id+'-metal)'}/>
  <g fill="none" stroke="var(--badge-tone)" strokeWidth="1.2" opacity=".5">
   <path d="M46 28Q25 31 18 20M54 28Q75 31 82 20M33 27L25 19M38 28L31 21M67 27L75 19M62 28L69 21"/>
   <path d="M20 38L16 52L20 65M80 38L84 52L80 65"/>
  </g>
  <path d="M17 66H83L88 72V84L83 88H17L12 84V72Z" fill="#08080b" fillOpacity=".8" stroke="var(--badge-tone)" strokeOpacity=".6" strokeWidth="1"/>
  <path d="M50 1L65 16L50 31L35 16Z" fill="#140e09" stroke={'url(#'+id+'-metal)'} strokeWidth="2.5"/>
  <path d="M50 5L61 16L50 27L39 16Z" fill={'url(#'+id+'-gem)'}/>
  <path d="M50 5L50 16L39 16Z" fill="#fff" opacity=".64"/>
  <path d="M50 16L61 16L50 27Z" fill="#000" opacity=".35"/>
  <path d="M50 6L54 16L50 26L46 16Z" fill="var(--badge-light)" opacity=".8"/>
  {selected&&<g className="tc-bulk-selected-emblem"><circle cx="50" cy="16" r="14" fill="var(--badge-shade)" stroke="#fff1c8" strokeWidth="2.1"/><circle cx="50" cy="16" r="11" fill="#151009" stroke="var(--badge-tone)" strokeWidth="1.3"/><path d="M44 16L48.5 20.5L56.5 11.5" fill="none" stroke="#fff2cb" strokeWidth="3.1" strokeLinecap="square" strokeLinejoin="miter"/></g>}
 </svg>;
}
export function BulkDismantleDialog({game,disabled,returnFocus,onClose,onDismantle}:{game:GameState;disabled:boolean;returnFocus:React.RefObject<HTMLButtonElement|null>;onClose:()=>void;onDismantle:(id:string,ids:string[])=>Promise<Result>}){
 const root=useRef<HTMLDialogElement>(null),lock=useRef(false);
 const [grades,setGrades]=useState<EquipmentGrade[]>(['common','uncommon']);
 const [confirm,setConfirm]=useState(false),[working,setWorking]=useState(false),[error,setError]=useState(''),[request,setRequest]=useState<Request|null>(null),[result,setResult]=useState<Result|null>(null);
 useEffect(()=>{const el=root.current;if(!el)return;const trigger=returnFocus.current;el.showModal();el.querySelector<HTMLButtonElement>('button')?.focus();return()=>{el.close();trigger?.focus({preventScroll:true});};},[returnFocus]);
 const candidates=bulkDismantleCandidates(game,grades);
 const count=request?.ids.length??candidates.length,stones=request?.stones??candidates.reduce((sum,item)=>sum+equipmentDismantleYield(item),0);
 const danger=grades.includes('heroic')||grades.includes('legendary');
 const dismiss=()=>{if(!lock.current)onClose();};
 const toggle=(grade:EquipmentGrade)=>{if(working||request)return;setGrades(old=>old.includes(grade)?old.filter(g=>g!==grade):[...old,grade]);setConfirm(false);setError('');};
 const execute=async()=>{
  if(lock.current||disabled||!count||result)return;
  if(danger&&!confirm&&!request){setConfirm(true);return;}
  const next=request??{id:crypto.randomUUID(),ids:candidates.map(i=>i.id),stones};
  lock.current=true;setWorking(true);setRequest(next);setError('');
  try{setResult(await onDismantle(next.id,next.ids));}
  catch(e){setError(e instanceof Error?e.message:'분해 결과를 확인하지 못했습니다.');}
  finally{lock.current=false;setWorking(false);}
 };
 return <dialog ref={root} className="tc-bulk-dialog" aria-labelledby="tc-bulk-title" onCancel={e=>{e.preventDefault();dismiss();}}>
  <div className="tc-bulk-panel">
   <header><i aria-hidden="true">◆</i><h2 id="tc-bulk-title">장비 일괄 분해</h2><button type="button" aria-label="닫기" className="tc-bulk-close" disabled={working} onClick={dismiss}>×</button></header>
   {result?<><p className="tc-bulk-done">분해 완료</p><div className="tc-bulk-summary"><span>분해 장비 <b>{result.count.toLocaleString()}개</b></span><span>획득 분해석 <b>{result.stones.toLocaleString()}개</b></span></div><button type="button" className="tc-bulk-commit" onClick={dismiss}>확인</button></>:<>
    <p className="tc-bulk-caption">분해할 장비 등급을 선택하세요</p>
    <div className="tc-bulk-grades" aria-label="분해 등급">
     {EQUIPMENT_GRADES.map(grade=><button type="button" key={grade} className={'grade-'+grade} aria-pressed={grades.includes(grade)} disabled={working||!!request} onClick={()=>toggle(grade)}><GradeBadge selected={grades.includes(grade)}/><span className="tc-bulk-badge-name">{EQUIPMENT_GRADE_NAMES[grade]}</span><small className="tc-bulk-badge-count">{bulkDismantleCandidates(game,[grade]).length.toLocaleString()}</small></button>)}
    </div>
    <p className="tc-bulk-note">현재 페이지가 아닌 전체 보유 장비에 적용됩니다.</p>
    <div className="tc-bulk-summary"><span>선택 장비 <b>{count.toLocaleString()}개</b></span><span>예상 분해석 <b>{stones.toLocaleString()}개</b></span></div>
    {confirm&&!request&&<p role="alert" className="tc-bulk-warning">영웅·전설 장비도 분해됩니다. 복구할 수 없습니다. 다시 확인해 주세요.</p>}
    {error&&<p role="alert" className="tc-bulk-warning">{error} {request?'같은 요청으로 결과를 다시 확인하거나 창을 닫아 주세요.':''}</p>}
    <footer><button type="button" disabled={working} onClick={dismiss}>취소</button><button type="button" className="tc-bulk-commit" disabled={working||disabled||!count} onClick={()=>void execute()}>{working?'분해 중…':request?'결과 다시 확인':confirm?'최종 분해':'분해하기'}</button></footer>
   </>}
  </div>
 </dialog>;
}
