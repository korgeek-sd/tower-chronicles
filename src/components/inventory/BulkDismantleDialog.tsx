import React,{useEffect,useRef,useState} from 'react';
import type {EquipmentGrade,GameState} from '../../game/types';
import {EQUIPMENT_GRADES,EQUIPMENT_GRADE_NAMES} from '../../game/data/equipment';
import {bulkDismantleCandidates,equipmentDismantleYield} from '../../game/engine/equipmentDismantle';
type Request={id:string;ids:string[];stones:number};
type Result={count:number;stones:number};
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
     {EQUIPMENT_GRADES.map(grade=><button type="button" key={grade} className={'grade-'+grade} aria-pressed={grades.includes(grade)} disabled={working||!!request} onClick={()=>toggle(grade)}><span className="tc-bulk-check" aria-hidden="true">{grades.includes(grade)?'✓':''}</span><span>{EQUIPMENT_GRADE_NAMES[grade]}</span><small>{bulkDismantleCandidates(game,[grade]).length.toLocaleString()}</small></button>)}
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
