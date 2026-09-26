import React,{useEffect,useRef,useState} from 'react';
import type {GameState} from '../game/types';
import {APP_VERSION,createRepository} from '../storage/repository';
import type {StoragePort} from '../storage/repository';
import {Screen} from '../ui/mobile';
import {onlineConfigured} from '../online/config';
import {signInWithGoogle,type OnlineSession} from '../online/auth';
import type {CloudSyncStatus} from '../online/cloudSync';
import {loadSystemMonitoring,type SystemMonitoring} from '../online/monitoring';

const MAX_IMPORT_BYTES=5*1024*1024;

export function SaveManagement({game,storage,onImported,session,syncStatus,syncRevision,syncMessage,onLogout}:{game:GameState;storage:StoragePort;onImported:(state:GameState)=>void;session:OnlineSession|null;syncStatus:CloudSyncStatus;syncRevision:number|null;syncMessage:string;onLogout:()=>Promise<void>}){
 const input=useRef<HTMLInputElement>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [monitor,setMonitor]=useState<SystemMonitoring|null>(null);
 useEffect(()=>{
  if(!session){setMonitor(null);return;}
  let disposed=false;
  const load=async()=>{try{const next=await loadSystemMonitoring();if(!disposed)setMonitor(next);}catch(error){if(!disposed&&error instanceof Error&&error.message!=='MONITORING_FORBIDDEN')setMessage('서버 모니터링 상태를 불러오지 못했습니다.');}};
  void load();
  const id=window.setInterval(()=>void load(),60_000);
  return()=>{disposed=true;window.clearInterval(id);};
 },[session?.userId]);

 function download(){try{const raw=createRepository(storage).exportSave(game),blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='tower-chronicles-v'+APP_VERSION+'-'+new Date().toISOString().slice(0,10)+'.json';link.click();URL.revokeObjectURL(url);setMessage('저장 파일을 내보냈습니다.');}catch(error){setMessage(error instanceof Error?error.message:'저장 파일을 내보내지 못했습니다.');}}

 async function choose(file:File|undefined){if(!file)return;try{if(file.size>MAX_IMPORT_BYTES)throw Error('저장 파일은 5MB 이하여야 합니다.');const suffix=session?' 불러온 진행 상황은 Google 계정에도 자동 동기화됩니다.':'';if(!window.confirm('현재 진행 상황을 백업한 뒤 선택한 저장 파일로 교체할까요?'+suffix))return;const raw=await file.text();const next=createRepository(storage).importSave(raw);onImported(next);setMessage(session?'저장 파일을 불러왔습니다. 클라우드 자동 동기화를 시작합니다.':'저장 파일을 안전하게 불러왔습니다.');}catch(error){setMessage(error instanceof Error?error.message:'저장 파일을 불러오지 못했습니다.');}finally{if(input.current)input.current.value='';}}

 async function logout(){setBusy(true);try{await onLogout();setMessage('로그아웃했습니다. 로컬 저장은 유지됩니다.');}finally{setBusy(false);}}

 const stateLabel=syncStatus==='syncing'?'동기화 중':syncStatus==='synced'?'자동 동기화 정상':syncStatus==='error'?'동기화 확인 필요':'로컬 저장';
 const accountLine=session?(session.email??'로그인 사용자')+(syncRevision?' · revision '+syncRevision:''):'Google 로그인 시 계정의 진행 상황이 자동으로 연결됩니다.';

 const latest=monitor?.latest,monitorSeverity=latest?.severity??'NORMAL';
 const metric=(value:number|string|undefined,suffix='')=>value===undefined?'—':Number(value).toLocaleString(undefined,{maximumFractionDigits:1})+suffix;

 return <Screen eyebrow="SAVE / CLOUD" title="저장 관리" meta={<span>v{APP_VERSION}</span>}>
  <div style={{height:'100%',display:'grid',gridTemplateRows:monitor?'1.05fr .95fr .7fr auto':'1.25fr 1fr auto',gap:'6px'}}>
   <section className="tc-panel strong" style={{display:'grid',alignContent:'center',gap:'7px'}}>
    <div><small className="tc-kicker">CLOUD SYNC</small><h2 style={{margin:'3px 0 4px',fontSize:'13px'}}>{session?'Google 계정 자동 동기화':'클라우드 계정'}</h2><p style={{margin:0,fontSize:'8px',color:'var(--muted)'}}>{!onlineConfigured?'Supabase 공개 설정이 아직 없습니다.':accountLine}</p></div>
    {session?<><div className="tc-floor-risk" role="status"><b>{stateLabel}</b> · {syncMessage}</div><p style={{margin:0,fontSize:'8px',color:'var(--muted)'}}>플레이 변경은 자동 저장되고, 기기 전환·앱 복귀·네트워크 복구 시 서버의 최신 revision을 확인합니다.</p><button className="tc-action secondary" disabled={busy} onClick={()=>void logout()}>로그아웃</button></>:<button className="tc-action" disabled={!onlineConfigured||busy} onClick={()=>signInWithGoogle()}>Google로 계속하기</button>}
   </section>
   {monitor&&latest&&<section className="tc-panel" style={{display:'grid',gridTemplateRows:'auto 1fr',gap:'5px'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span><small className="tc-kicker">SERVER MONITOR</small> <b style={{fontSize:'9px'}}>{monitorSeverity==='NORMAL'?'정상':monitorSeverity==='WARNING'?'주의':'위험'}</b></span><small style={{fontSize:'7px',color:'var(--muted)'}}>{new Date(latest.captured_at).toLocaleTimeString()}</small></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'4px',textAlign:'center'}}>
     <div><small>DB/분</small><b style={{display:'block',fontSize:'10px'}}>{metric(latest.db_calls_per_min)}</b></div>
     <div><small>RT/분</small><b style={{display:'block',fontSize:'10px'}}>{metric(latest.realtime_messages_per_min)}</b></div>
     <div><small>WS</small><b style={{display:'block',fontSize:'10px'}}>{metric(latest.websocket_connections)}</b></div>
     <div><small>저장/분</small><b style={{display:'block',fontSize:'10px'}}>{metric(latest.save_writes_per_min)}</b></div>
    </div>
    {monitor.activeAlerts.length>0&&<div className="tc-floor-risk"><b>{monitor.activeAlerts.length}개 지표 급증 감지</b> · 최근 15분 기준치와 절대 임계치를 초과했습니다.</div>}
   </section>}
   <section className="tc-panel" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'5px',alignItems:'center'}}><button className="tc-action secondary" onClick={download}>JSON 내보내기</button><><input ref={input} style={{display:'none'}} type="file" accept="application/json,.json" onChange={event=>void choose(event.target.files?.[0])}/><button className="tc-action danger" onClick={()=>input.current?.click()}>JSON 불러오기</button></></section>
   <div className="tc-floor-risk" role="status">{message||(!onlineConfigured?'다음 단계: .env에 Supabase Project URL과 Publishable Key를 설정하세요.':session?'수동 업로드/복구 없이 Google 계정과 자동 동기화됩니다.':'게스트 플레이는 localStorage에만 저장됩니다.')}</div>
  </div>
 </Screen>;
}
