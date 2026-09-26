import React from 'react';
import type {GameSessionPhase} from '../online/gameSession';

export function GameSessionGate({phase,activePlatform,heartbeatAt,message,onTakeover,onRetry,onLogout}:{phase:GameSessionPhase;activePlatform:string|null;heartbeatAt:string|null;message:string;onTakeover:()=>void;onRetry:()=>void;onLogout:()=>void}){
 if(phase==='guest'||phase==='active')return null;
 const locked=phase==='locked';
 const taking=phase==='taking-over';
 const handoff=phase==='handoff';
 const title=phase==='acquiring'?'플레이 세션 확인 중':locked?'다른 기기에서 플레이 중':taking?'이 기기에서 이어오는 중':handoff?'다른 기기로 전환 중':'플레이 세션 연결 확인 필요';
 const recent=heartbeatAt?new Date(heartbeatAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):null;
 return <div style={{position:'fixed',inset:0,zIndex:5000,display:'grid',placeItems:'center',padding:'18px',background:'rgba(12,10,8,.96)'}}>
  <section className="tc-panel strong" role="dialog" aria-modal="true" style={{width:'min(420px,100%)',display:'grid',gap:'10px',padding:'18px'}}>
   <small className="tc-kicker">ACTIVE SESSION</small>
   <h2 style={{margin:0,fontSize:'18px'}}>{title}</h2>
   <p style={{margin:0,fontSize:'10px',lineHeight:1.6,color:'var(--muted)'}}>{message}</p>
   {activePlatform&&<div className="tc-floor-risk"><b>{activePlatform}</b>{recent?' · 최근 연결 '+recent:''}</div>}
   {locked&&<button className="tc-action" onClick={onTakeover}>이 기기에서 이어하기</button>}
   {phase==='error'&&<button className="tc-action" onClick={onRetry}>다시 확인</button>}
   {(locked||phase==='error')&&<button className="tc-action secondary" onClick={onLogout}>로그아웃</button>}
   {(phase==='acquiring'||taking||handoff)&&<div className="tc-floor-risk" role="status">잠시 후 자동으로 처리됩니다.</div>}
  </section>
 </div>;
}
