import React,{useRef,useState} from 'react';
import type {GameState} from '../game/types';
import {APP_VERSION,createRepository} from '../storage/repository';
import type {StoragePort} from '../storage/repository';
import {Screen} from '../ui/mobile';

const MAX_IMPORT_BYTES=5*1024*1024;
export function SaveManagement({game,storage,onImported}:{game:GameState;storage:StoragePort;onImported:(state:GameState)=>void}){
 const input=useRef<HTMLInputElement>(null),[message,setMessage]=useState('');
 function download(){try{const raw=createRepository(storage).exportSave(game),blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='tower-chronicles-v'+APP_VERSION+'-'+new Date().toISOString().slice(0,10)+'.json';link.click();URL.revokeObjectURL(url);setMessage('저장 파일을 내보냈습니다.');}catch(error){setMessage(error instanceof Error?error.message:'저장 파일을 내보내지 못했습니다.');}}
 async function choose(file:File|undefined){if(!file)return;try{if(file.size>MAX_IMPORT_BYTES)throw Error('저장 파일은 5MB 이하여야 합니다.');const raw=await file.text();if(!window.confirm('현재 진행 상황을 백업한 뒤 선택한 저장 파일로 교체할까요?'))return;const next=createRepository(storage).importSave(raw);onImported(next);setMessage('저장 파일을 안전하게 불러왔습니다.');}catch(error){setMessage(error instanceof Error?error.message:'저장 파일을 불러오지 못했습니다.');}finally{if(input.current)input.current.value='';}}
 return <Screen eyebrow="LOCAL SAVE ARCHIVE" title="저장 관리" meta={<span>v{APP_VERSION}</span>}>
  <div style={{height:'100%',display:'grid',gridTemplateRows:'1fr 1fr auto',gap:'6px'}}>
   <section className="tc-panel strong" style={{display:'grid',alignContent:'center',gap:'8px'}}><div><small className="tc-kicker">EXPORT</small><h2 style={{margin:'3px 0 4px',fontSize:'13px'}}>백업 파일 만들기</h2><p style={{margin:0,fontSize:'8px',color:'var(--muted)'}}>Silver, Gold, 장비, 원정과 전투 상태를 JSON 한 파일로 보관합니다.</p></div><button className="tc-action" onClick={download}>저장 파일 내보내기</button></section>
   <section className="tc-panel" style={{display:'grid',alignContent:'center',gap:'8px'}}><div><small className="tc-kicker">IMPORT · MAX 5MB</small><h2 style={{margin:'3px 0 4px',fontSize:'13px'}}>저장 파일 불러오기</h2><p style={{margin:0,fontSize:'8px',color:'var(--muted)'}}>검증 후 불러오며 현재 저장은 복구용 키에 백업됩니다.</p></div><input ref={input} style={{display:'none'}} type="file" accept="application/json,.json" onChange={event=>void choose(event.target.files?.[0])}/><button className="tc-action danger" onClick={()=>input.current?.click()}>저장 파일 선택</button></section>
   <div className="tc-floor-risk" role="status">{message||'온라인 서버 도입 전까지 진행 정보는 이 기기의 로컬 저장소에 보관됩니다.'}</div>
  </div>
 </Screen>;
}
