import React,{useRef,useState} from 'react';
import type {GameState} from '../game/types';
import {APP_VERSION,createRepository} from '../storage/repository';
import type {StoragePort} from '../storage/repository';

const MAX_IMPORT_BYTES=5*1024*1024;

export function SaveManagement({game,storage,onImported}:{game:GameState;storage:StoragePort;onImported:(state:GameState)=>void}){
  const input=useRef<HTMLInputElement>(null);
  const [message,setMessage]=useState('');
  function download(){
    try{
      const raw=createRepository(storage).exportSave(game);
      const blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=`tower-chronicles-v${APP_VERSION}-${new Date().toISOString().slice(0,10)}.json`;link.click();URL.revokeObjectURL(url);
      setMessage('저장 파일을 내보냈습니다.');
    }catch(error){setMessage(error instanceof Error?error.message:'저장 파일을 내보내지 못했습니다.');}
  }
  async function choose(file:File|undefined){
    if(!file)return;
    try{
      if(file.size>MAX_IMPORT_BYTES)throw Error('저장 파일은 5MB 이하여야 합니다.');
      const raw=await file.text();
      if(!window.confirm('현재 진행 상황을 백업한 뒤 선택한 저장 파일로 교체할까요?'))return;
      const next=createRepository(storage).importSave(raw);onImported(next);setMessage('저장 파일을 안전하게 불러왔습니다.');
    }catch(error){setMessage(error instanceof Error?error.message:'저장 파일을 불러오지 못했습니다.');}
    finally{if(input.current)input.current.value='';}
  }
  return <><div className="section-label">SAVE DATA / v19</div><h1>저장 관리</h1><p className="muted">현재 진행 상황을 파일로 보관하거나 다른 기기에서 만든 저장 파일을 불러올 수 있습니다.</p>
    <section className="panel save-management"><div className="section-heading"><h2>백업 파일 만들기</h2><span>게임 v{APP_VERSION}</span></div><p>Silver, Gold, 장비, 원정과 전투 상태를 한 파일에 저장합니다.</p><button className="primary" onClick={download}>저장 파일 내보내기 <span>↓</span></button></section>
    <section className="panel save-management"><div className="section-heading"><h2>저장 파일 불러오기</h2><span>JSON · 최대 5MB</span></div><p>파일을 먼저 검증하고 이전 버전은 자동 변환합니다. 현재 저장은 별도 복구용 키에 백업됩니다.</p><input ref={input} className="save-file-input" type="file" accept="application/json,.json" onChange={event=>void choose(event.target.files?.[0])}/><button className="danger-button" onClick={()=>input.current?.click()}>저장 파일 선택</button></section>
    {message&&<div className="note" role="status">{message}</div>}<div className="note">온라인 서버가 추가되기 전까지 이 파일에는 로컬 게임 진행 정보가 들어 있습니다. 직접 편집한 파일은 검증을 통과하지 못할 수 있습니다.</div></>;
}
