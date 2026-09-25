import React,{useEffect,useRef,useState} from 'react';
import type {GameState} from '../game/types';
import {APP_VERSION,createRepository} from '../storage/repository';
import type {StoragePort} from '../storage/repository';
import {Screen} from '../ui/mobile';
import {onlineConfigured} from '../online/config';
import {consumeOAuthRedirect,getStoredSession,signInWithGoogle,signOutOnline,type OnlineSession} from '../online/auth';
import {CloudConflictError,loadCloudSave,readCloudMeta,rememberCloudRecord,saveCloudState,type CloudSaveRecord} from '../online/cloudSave';

const MAX_IMPORT_BYTES=5*1024*1024;

export function SaveManagement({game,storage,onImported}:{game:GameState;storage:StoragePort;onImported:(state:GameState)=>void}){
 const input=useRef<HTMLInputElement>(null),[message,setMessage]=useState(''),[session,setSession]=useState<OnlineSession|null>(()=>getStoredSession()),[cloud,setCloud]=useState<CloudSaveRecord|null>(null),[busy,setBusy]=useState(false);

 useEffect(()=>{
  const next=consumeOAuthRedirect();
  setSession(next);
  if(next&&onlineConfigured)void inspectCloud();
 },[]);

 async function inspectCloud(){
  try{setCloud(await loadCloudSave());}
  catch(error){setMessage(error instanceof Error?error.message:'클라우드 저장을 확인하지 못했습니다.');}
 }

 function download(){try{const raw=createRepository(storage).exportSave(game),blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='tower-chronicles-v'+APP_VERSION+'-'+new Date().toISOString().slice(0,10)+'.json';link.click();URL.revokeObjectURL(url);setMessage('저장 파일을 내보냈습니다.');}catch(error){setMessage(error instanceof Error?error.message:'저장 파일을 내보내지 못했습니다.');}}

 async function choose(file:File|undefined){if(!file)return;try{if(file.size>MAX_IMPORT_BYTES)throw Error('저장 파일은 5MB 이하여야 합니다.');const raw=await file.text();if(!window.confirm('현재 진행 상황을 백업한 뒤 선택한 저장 파일로 교체할까요?'))return;const next=createRepository(storage).importSave(raw);onImported(next);setMessage('저장 파일을 안전하게 불러왔습니다.');}catch(error){setMessage(error instanceof Error?error.message:'저장 파일을 불러오지 못했습니다.');}finally{if(input.current)input.current.value='';}}

 async function uploadCloud(){
  if(!session)return;
  setBusy(true);
  try{
   const remote=await loadCloudSave(),meta=readCloudMeta();
   if(remote&&(!meta||meta.userId!==session.userId)){
    setCloud(remote);
    throw Error('이미 이 계정에 클라우드 저장이 있습니다. 먼저 클라우드 저장을 불러와 확인해 주세요.');
   }
   if(remote&&meta?.revision!==remote.revision)throw new CloudConflictError(remote.revision);
   const saved=await saveCloudState(game,remote?.revision??0);
   setCloud(saved);
   setMessage('클라우드 저장 완료 · revision '+saved.revision);
  }catch(error){
   setMessage(error instanceof CloudConflictError?'다른 기기에서 더 최근의 저장이 발견되어 업로드를 중단했습니다.':error instanceof Error?error.message:'클라우드 저장에 실패했습니다.');
  }finally{setBusy(false);}
 }

 async function restoreCloud(){
  if(!session)return;
  setBusy(true);
  try{
   const remote=await loadCloudSave();
   if(!remote)throw Error('복구할 클라우드 저장이 없습니다.');
   if(!window.confirm('현재 기기 저장을 클라우드 revision '+remote.revision+' 데이터로 교체할까요?'))return;
   createRepository(storage).save(remote.payload);
   rememberCloudRecord(remote,session.userId);
   onImported(remote.payload);
   setCloud(remote);
   setMessage('클라우드 저장을 이 기기로 복구했습니다.');
  }catch(error){setMessage(error instanceof Error?error.message:'클라우드 저장을 복구하지 못했습니다.');}
  finally{setBusy(false);}
 }

 async function logout(){setBusy(true);try{await signOutOnline();setSession(null);setCloud(null);setMessage('로그아웃했습니다. 로컬 저장은 유지됩니다.');}finally{setBusy(false);}}

 return <Screen eyebrow="SAVE / CLOUD" title="저장 관리" meta={<span>v{APP_VERSION}</span>}>
  <div style={{height:'100%',display:'grid',gridTemplateRows:'1.25fr 1fr auto',gap:'6px'}}>
   <section className="tc-panel strong" style={{display:'grid',alignContent:'center',gap:'7px'}}>
    <div><small className="tc-kicker">CLOUD SAVE</small><h2 style={{margin:'3px 0 4px',fontSize:'13px'}}>{session?'Google 계정 연결됨':'클라우드 계정'}</h2><p style={{margin:0,fontSize:'8px',color:'var(--muted)'}}>{!onlineConfigured?'Supabase 공개 설정이 아직 없습니다.':session?(session.email??'로그인 사용자')+' · '+(cloud?'revision '+cloud.revision:'클라우드 저장 미확인'):'Google 로그인 후 다른 기기에서도 같은 저장을 불러올 수 있습니다.'}</p></div>
    {!session?<button className="tc-action" disabled={!onlineConfigured||busy} onClick={()=>signInWithGoogle()}>Google로 계속하기</button>:<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px'}}><button className="tc-action" disabled={busy} onClick={()=>void uploadCloud()}>이 기기 → 클라우드</button><button className="tc-action secondary" disabled={busy} onClick={()=>void restoreCloud()}>클라우드 → 이 기기</button><button className="tc-action secondary" disabled={busy} onClick={()=>void inspectCloud()}>상태 새로고침</button><button className="tc-action secondary" disabled={busy} onClick={()=>void logout()}>로그아웃</button></div>}
   </section>
   <section className="tc-panel" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'5px',alignItems:'center'}}><button className="tc-action secondary" onClick={download}>JSON 내보내기</button><><input ref={input} style={{display:'none'}} type="file" accept="application/json,.json" onChange={event=>void choose(event.target.files?.[0])}/><button className="tc-action danger" onClick={()=>input.current?.click()}>JSON 불러오기</button></></section>
   <div className="tc-floor-risk" role="status">{message||(!onlineConfigured?'다음 단계: .env에 Supabase Project URL과 Publishable Key를 설정하세요.':session?'클라우드 저장은 revision 충돌 시 자동 덮어쓰지 않습니다.':'게스트 플레이는 계속 localStorage에 저장됩니다.')}</div>
  </div>
 </Screen>;
}
