import React from 'react';import type {VillageWarFront,VillageWarStageOneState,VillageWarStageRequest} from '../../online/villageWar';import './village-war-stage-one.css';
export function VillageWarDeploymentPanel({state,userId,busy,pending,error,onPlace,onRemove,onClaim,onRetry,onRefresh,now=state.serverNow}:{state:VillageWarStageOneState;userId:string|null;busy:boolean;pending:VillageWarStageRequest|null;error:string;onPlace:(front:VillageWarFront)=>void;onRemove:(front:VillageWarFront)=>void;onClaim:(front:VillageWarFront)=>void;onRetry:()=>void;onRefresh:()=>void;now?:number}){
 const phase=state.battleStartsAt&&state.battleEndsAt&&state.deploymentStartsAt?(now<Date.parse(state.deploymentStartsAt)?'WAITING':now<Date.parse(state.battleStartsAt)?'DEPLOYMENT':now<Date.parse(state.battleEndsAt)?'BATTLE':'ENDED'):state.phase;
 const owner=!!state.myAssociationId&&state.myAssociationId===state.ownerAssociationId;const locked=busy||!!pending;const waiting=Math.max(0,Math.ceil((Date.parse(state.nextAttackAt??'')-now)/1000))||0;
 const deadline=phase==='DEPLOYMENT'?state.battleStartsAt:phase==='BATTLE'?state.battleEndsAt:state.deploymentStartsAt;const seconds=deadline?Math.max(0,Math.ceil((Date.parse(deadline)-now)/1000)):null;
 return <section className="tc-village-stage" aria-label="공성전 수비 배치와 점령"><header><div><small>공성전 1차 검증</small><h2>{phase==='DEPLOYMENT'?'수비 배치':phase==='BATTLE'?'전선 점령':phase==='ENDED'?'전쟁 시간 종료':'배치 시작 대기'}</h2></div><b>{seconds===null?'—':Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')}</b></header>
 <p className="tc-village-stage-summary">도전권 {state.tickets??0}장 · {state.myDefendingFront?'수비 중':waiting?`공격 대기 ${waiting}초`:'수비 배치 없음'}</p>
 <div className="tc-village-stage-fronts">{state.fronts.map(f=><article key={f.frontId}><div><b>{f.frontId}전선</b><strong>{f.associationName??'중립 · 빈 전선'}</strong><small>{f.defenderUserId?`${f.defenderUserId===userId?'내 캐릭터':f.defenderName??'수비자'} · HP ${f.hp??'—'} / ${f.maxHp??'—'}`:'수비자 없음'}</small></div>
 {phase==='DEPLOYMENT'&&owner&&!f.defenderUserId&&<button disabled={locked||!!state.myDefendingFront} onClick={()=>onPlace(f)}>내 캐릭터 배치</button>}
 {phase==='DEPLOYMENT'&&owner&&state.myRole==='LEADER'&&f.defenderUserId&&<button disabled={locked} onClick={()=>onRemove(f)}>배치 해제</button>}
 {phase==='BATTLE'&&!f.defenderUserId&&<button disabled={locked||!state.canAttack||!!state.myDefendingFront||waiting>0||(state.tickets??0)<1} onClick={()=>onClaim(f)}>빈 전선 점령<small>도전권 1장</small></button>}
 {phase==='BATTLE'&&f.defenderUserId&&<button disabled>자동 PvP 연결 전</button>}
 </article>)}</div>
 <footer>{error&&<p role="alert">{error}</p>}{pending&&<p role="status">이전 요청 결과를 확인해야 합니다.</p>}<div>{pending&&<button disabled={busy} onClick={onRetry}>요청 결과 재확인</button>}<button disabled={busy} onClick={onRefresh}>전황 새로고침</button></div><small>자동 PvP·점수 정산 연결 전 내부 검증 단계입니다.</small></footer>
 </section>;
}
