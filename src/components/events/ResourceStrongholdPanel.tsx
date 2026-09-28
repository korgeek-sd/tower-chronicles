import React from 'react';
import type {ResourceStrongholdServerState} from '../../online/resourceStronghold';

type Props={
 state:ResourceStrongholdServerState|null;now:number;busy:boolean;error?:string;
 onRefresh:()=>void;onRequest:()=>void;onRespond:(response:'DEFEND'|'ABANDON')=>void;
 onAction:(action:'BASIC'|'GUARD')=>void;onAbandon:()=>void;onClose:()=>void;
};
const seconds=(value:string|undefined,now:number)=>value?Math.max(0,Math.ceil((new Date(value).getTime()-now)/1000)):0;

export function ResourceStrongholdPanel({state,now,busy,error,onRefresh,onRequest,onRespond,onAction,onAbandon,onClose}:Props){
 if(!state)return <aside className="tc-stronghold-pvp" aria-label="자원거점 쟁탈">
  <div className="tc-stronghold-pvp-head"><strong>자원거점</strong><div><button disabled={busy} onClick={onRefresh}>상태 확인</button><button onClick={onClose}>나가기</button></div></div>
 </aside>;
 const sh=state.stronghold,contest=state.contest,decisionEndsAt=contest?.decision_ends_at,decision=seconds(decisionEndsAt,now),turn=seconds(contest?.turn_ends_at??undefined,now),actionNonce=contest?.action_nonce??0;
 return <aside className="tc-stronghold-pvp" aria-label="자원거점 쟁탈">
  <div className="tc-stronghold-pvp-head"><strong>자원거점</strong><div><button disabled={busy} onClick={onRefresh}>새로고침</button><button onClick={onClose}>나가기</button></div></div>
  {!sh?<><p>현재 이 층의 공용 거점은 비어 있습니다.</p><button disabled={busy} onClick={onRequest}>점령</button></>:
   <><p>{sh.status==='CONTESTED'?'쟁탈 진행 중':'점령 진행 중'} · 남은 {seconds(sh.captureEndsAt,now)}초</p>
    {state.role==='OWNER'&&contest?.status==='PENDING'&&<div><p>30초 선택 · {decision}초</p><button disabled={busy} onClick={()=>onRespond('DEFEND')}>방어</button><button disabled={busy} onClick={()=>onRespond('ABANDON')}>포기</button></div>}
    {(state.role==='CHALLENGER'||state.role==='OWNER')&&contest?.status==='FIGHTING'&&<div><p>개입전 #{actionNonce+1} · 점령자 HP {contest.owner_hp} / 도전자 HP {contest.challenger_hp} · 행동 {turn}초 (시간 초과 시 자동 처리)</p><button disabled={busy} onClick={()=>onAction('BASIC')}>공격</button><button disabled={busy} onClick={()=>onAction('GUARD')}>방어 태세</button></div>}
    {state.role==='OBSERVER'&&<button disabled={busy||sh.status==='CONTESTED'} onClick={onRequest}>쟁탈</button>}
    {state.role==='QUEUED'&&<p>동시요청 대기 중입니다.</p>}
    {state.role==='OWNER'&&!contest&&<button disabled={busy} onClick={onAbandon}>점령 포기</button>}
   </>}
  {error&&<p className="error" role="alert">{error}</p>}
 </aside>;
}
