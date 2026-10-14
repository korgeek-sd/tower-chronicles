import React from 'react';
import type {VillageWarFront,VillageWarStageOneState,VillageWarStageRequest} from '../../online/villageWar';
import './village-war-stage-one.css';
export function VillageWarDeploymentPanel({state,userId,busy,pending,error,onPlace,onRemove,onClaim,onAttack,onRetry,onRefresh,now=state.serverNow}:{state:VillageWarStageOneState;userId:string|null;busy:boolean;pending:VillageWarStageRequest|null;error:string;onPlace:(front:VillageWarFront)=>void;onRemove:(front:VillageWarFront)=>void;onClaim:(front:VillageWarFront)=>void;onAttack?:(front:VillageWarFront)=>void;onRetry:()=>void;onRefresh:()=>void;now?:number}){
 const phase=state.settledAt?'ENDED':state.battleStartsAt&&state.battleEndsAt&&state.deploymentStartsAt?(now<Date.parse(state.deploymentStartsAt)?'WAITING':now<Date.parse(state.battleStartsAt)?'DEPLOYMENT':now<Date.parse(state.battleEndsAt)?'BATTLE':'ENDED'):state.phase;
 const owner=!!state.myAssociationId&&state.myAssociationId===state.ownerAssociationId;
 const locked=busy||!!pending,waiting=Math.max(0,Math.ceil((Date.parse(state.nextAttackAt??'')-now)/1000))||0;
 const attackDisabled=locked||!state.canAttack||!!state.myDefendingFront||waiting>0||(state.tickets??0)<1;
 const deadline=phase==='DEPLOYMENT'?state.battleStartsAt:phase==='BATTLE'?state.battleEndsAt:state.deploymentStartsAt;
 const seconds=deadline?Math.max(0,Math.ceil((Date.parse(deadline)-now)/1000)):null;
 const winner=state.scores?.find(s=>s.associationId===state.winnerAssociationId)?.associationName??'원정단';
 return <section className="tc-village-stage" aria-label="공성전 수비 배치와 점령">
  <header><div><small>{state.stageTwo?'5전선 영지 공성전':'공성전 1차 검증'}</small><h2>{phase==='DEPLOYMENT'?'수비 배치':phase==='BATTLE'?'전선 점령':phase==='ENDED'?state.winnerAssociationId?`${winner} 승리`:'전쟁 종료 · 소유권 유지':'배치 시작 대기'}</h2></div><b>{phase==='ENDED'?'종료':seconds===null?'—':Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')}</b></header>
  <div className="tc-village-stage-status"><p className="tc-village-stage-summary">도전권 {state.tickets??0}장 · {state.myDefendingFront?'수비 중':waiting?`공격 대기 ${waiting}초`:'공격 가능'}</p>
  {state.stageTwo&&<div className="tc-village-scores" aria-label="원정단 점수">{state.scores?.length?state.scores.map(s=><span key={s.associationId}><b>{s.associationName??'원정단'}</b> {Number(s.points).toFixed(2)}점 · {s.fronts}전선</span>):<span>아직 점령 점수가 없습니다</span>}<small>전선당 분당 1점 · 150점 선착순 승리</small></div>}</div>
  <div className="tc-village-stage-fronts">{state.fronts.map(f=><article key={f.frontId}><div><b>{f.frontId}전선</b><strong>{f.associationName??'중립 · 빈 전선'}</strong><small>{f.defenderUserId?`${f.defenderUserId===userId?'내 캐릭터':f.defenderName??'수비자'} · HP ${f.hp??'—'} / ${f.maxHp??'—'}`:'수비자 없음'}</small>{state.stageTwo&&f.defenderUserId&&<small>MP {f.mp??'—'} / {f.maxMp??'—'}</small>}</div>
   {phase==='DEPLOYMENT'&&owner&&!f.defenderUserId&&<button disabled={locked||!!state.myDefendingFront} onClick={()=>onPlace(f)}>내 캐릭터 배치</button>}
   {phase==='DEPLOYMENT'&&owner&&state.myRole==='LEADER'&&f.defenderUserId&&<button disabled={locked} onClick={()=>onRemove(f)}>배치 해제</button>}
   {phase==='BATTLE'&&!f.defenderUserId&&<button disabled={attackDisabled} onClick={()=>onClaim(f)}>빈 전선 점령<small>도전권 1장</small></button>}
   {phase==='BATTLE'&&f.defenderUserId&&(state.stageTwo?<button className="tc-feel-press" disabled={attackDisabled||f.associationId===state.myAssociationId||!onAttack} onClick={()=>onAttack?.(f)}>{f.associationId===state.myAssociationId?'우리 전선':'즉시 전투'}<small>도전권 1장</small></button>:<button disabled>자동 PvP 연결 전</button>)}
  </article>)}</div>
  <footer>{error&&<p role="alert">{error}</p>}{pending&&<p role="status">이전 요청 결과를 확인해야 합니다.</p>}
   {state.stageTwo&&!!state.recentBattles?.length&&<details className="tc-village-records"><summary>최근 전투 기록 ({state.recentBattles.length})</summary><ol>{state.recentBattles.map(r=><li key={r.battleId}>{r.frontId}전선 · {r.attackerName} → {r.defenderName} · {r.outcome==='CAPTURE'?'점령':'수비 성공'}{r.defenderReward?' · 수비 도전권 +1':''}</li>)}</ol></details>}
   <div>{pending&&<button disabled={busy} onClick={onRetry}>요청 결과 재확인</button>}<button disabled={busy} onClick={onRefresh}>전황 새로고침</button></div>
   <small>{state.stageTwo?'공격 30초 대기 · 수비 HP·MP 유지 · 최대 100턴':'자동 PvP·점수 정산 연결 전 내부 검증 단계입니다.'}</small>
  </footer>
 </section>;
}
