import React,{useState} from 'react';
import type {VillageWarFront,VillageWarStageOneState,VillageWarStageRequest,VillageWarScore} from '../../online/villageWar';
import './village-war-stage-one.css';

type Props={
 state:VillageWarStageOneState;userId:string|null;busy:boolean;pending:VillageWarStageRequest|null;error:string;
 onPlace:(front:VillageWarFront)=>void;onRemove:(front:VillageWarFront)=>void;onClaim:(front:VillageWarFront)=>void;
 onAttack?:(front:VillageWarFront)=>void;onRetry:()=>void;onRefresh:()=>void;now?:number;
};
const left=(iso:string|undefined,now:number)=>{
 const time=iso?Date.parse(iso):NaN;
 if(!Number.isFinite(time))return '—';
 const seconds=Math.max(0,Math.ceil((time-now)/1000));
 return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
};
const ratio=(current:number|null,max:number|null)=>current===null||max===null||max<=0?null:Math.max(0,Math.min(100,Math.round(100*current/max)));
const clock=(date:string)=>{
 const stamp=Date.parse(date);
 return Number.isFinite(stamp)?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(stamp)):'—';
};
function Vital({name,current,max}:{name:'HP'|'MP';current:number|null;max:number|null}){
 const value=ratio(current,max);
 return <div className="tc-village-vital"><span>{name}</span><progress className={name.toLowerCase()} aria-label={'수비자 '+name+' '+(current??'—')+' / '+(max??'—')} max={100} value={value??0}/><b>{current===null||max===null?'—':current+' / '+max}</b></div>;
}
function FrontButton({front,selected,onSelect,myGuild,phase,canDeploy}:{front:VillageWarFront;selected:boolean;onSelect:()=>void;myGuild:string|null|undefined;phase:string;canDeploy:boolean}){
 const occupied=!!front.defenderUserId,ours=!!myGuild&&front.associationId===myGuild,percentage=ratio(front.hp,front.maxHp);
 return <button type="button" className={'tc-village-lane '+(selected?'is-selected ':'')+(occupied?(ours?'is-ours':'is-enemy'):'is-empty')} aria-pressed={selected} aria-label={'제'+front.frontId+'전선 · '+(front.associationName??(phase==='BATTLE'?'빈 전선 점령':phase==='DEPLOYMENT'&&canDeploy?'내 캐릭터 배치':'중립'))} onClick={onSelect}>
  <b>{front.frontId}<small>전선</small></b>
  <span className="tc-village-lane-guild">{occupied?(ours?'우리 길드':front.associationName??'점령 중'):'중립'}</span>
  <span className="tc-village-lane-track"><i style={{width:(percentage??0)+'%'}}/></span>
 </button>;
}
function Scores({scores,myGuild}:{scores:VillageWarScore[];myGuild:string|null|undefined}){
 return <div className="tc-village-leaderboard" aria-label="실시간 원정단 점수">
  {scores.length? scores.slice(0,3).map((score,index)=><div className={'tc-village-rank '+(score.associationId===myGuild?'is-my-guild':'')} key={score.associationId}>
   <small>{index+1}위 · {score.fronts}전선</small><b title={score.associationName??'원정단'}>{score.associationName??'원정단'}</b><strong>{Number(score.points).toFixed(2)}<em>점</em></strong>
  </div>):<p className="tc-village-no-scores">전선 점령이 시작되면 길드별 점수가 표시됩니다.</p>}
 </div>;
}
export function VillageWarDeploymentPanel({state,userId,busy,pending,error,onPlace,onRemove,onClaim,onAttack,onRetry,onRefresh,now=state.serverNow}:Props){
 const [selection,setSelection]=useState(1),[overlay,setOverlay]=useState<'scores'|'records'|null>(null);
 const phase=state.settledAt?'ENDED':state.battleStartsAt&&state.battleEndsAt&&state.deploymentStartsAt?
  (now<Date.parse(state.deploymentStartsAt)?'WAITING':now<Date.parse(state.battleStartsAt)?'DEPLOYMENT':now<Date.parse(state.battleEndsAt)?'BATTLE':'ENDED'):state.phase;
 const selected=state.fronts.find(front=>front.frontId===selection)??state.fronts[0];
 const scores=state.scores??[],records=state.recentBattles??[];
 const owner=!!state.myAssociationId&&state.myAssociationId===state.ownerAssociationId;
 const locked=busy||!!pending;
 const cooldown=state.nextAttackAt?Math.max(0,Math.ceil((Date.parse(state.nextAttackAt)-now)/1000))||0:0;
 const canAct=phase==='BATTLE'&&!locked&&!!state.canAttack&&!state.myDefendingFront&&cooldown===0&&(state.tickets??0)>=1;
 const settled=phase==='ENDED';
 const deadline=phase==='DEPLOYMENT'?state.battleStartsAt:phase==='BATTLE'?state.battleEndsAt:state.deploymentStartsAt;
 const winner=state.scores?.find(s=>s.associationId===state.winnerAssociationId)?.associationName??'원정단';
 const isOurs=!!selected&&!!state.myAssociationId&&selected.associationId===state.myAssociationId;
 const isDefender=!!selected?.defenderUserId;
 const ownsPlacement=!!selected&&owner&&phase==='DEPLOYMENT';
 const status=state.myDefendingFront?'현재 수비 중':cooldown>0?'공격 대기 '+cooldown+'초':(state.tickets??0)<1?'도전권 부족':'공격 가능';
 const actionText=phase==='DEPLOYMENT'?(ownsPlacement?(isDefender?'배치 해제':'내 캐릭터 배치'):'수비 배치 대기'):
  phase==='BATTLE'?(isDefender?(isOurs?'우리 길드 수비 중':state.stageTwo?'즉시 전투':'자동 PvP 연결 전'):'빈 전선 점령'):
  settled?'종료된 전쟁':'전쟁 시작 대기';
 const actionAllowed=!!selected&&(phase==='DEPLOYMENT'?ownsPlacement&&(isDefender?state.myRole==='LEADER':!state.myDefendingFront)&&!locked:
  phase==='BATTLE'&&canAct&&(!isDefender||!!state.stageTwo&&!isOurs&&!!onAttack));
 const act=()=>{if(!selected||!actionAllowed)return;
  if(phase==='DEPLOYMENT')isDefender?onRemove(selected):onPlace(selected);
  else if(phase==='BATTLE')isDefender?onAttack?.(selected):onClaim(selected);
 };
 const actionHint=phase==='DEPLOYMENT'?'시작 전 5분 동안만 편성 가능':phase==='BATTLE'?'도전권 1장 · 개인 대기 30초': '전쟁 종료 후에는 공격할 수 없습니다';
 const title=phase==='DEPLOYMENT'?'수비 배치':phase==='BATTLE'?'전선 쟁탈전':settled?(state.winnerAssociationId?winner+' 승리':'전쟁 종료 · 소유권 유지'):'전쟁 준비';
 return <section className="tc-village-stage tc-village-stage-v3" aria-label="5전선 공성전 실시간 전황">
  <header className="tc-village-war-head">
   <div><small>GUILD SIEGE · FIVE FRONTS</small><h2>{title}</h2></div>
   <div className="tc-village-war-timer"><small>{phase==='DEPLOYMENT'?'전쟁 시작':phase==='BATTLE'?'전쟁 종료':settled?'종료':'배치 시작'}</small><strong>{settled?'종료':left(deadline,now)}</strong></div>
  </header>
  <div className="tc-village-war-score-head">
   <b>길드별 점수</b><span>전선당 분당 1점 · 150점 선착순</span>
   <button type="button" onClick={()=>setOverlay('scores')}>전체 순위</button>
  </div>
  <Scores scores={scores} myGuild={state.myAssociationId}/>
  <nav className="tc-village-lanes" aria-label="공성전 5개 전선 선택">
   {state.fronts.map(front=><FrontButton key={front.frontId} front={front} selected={selected?.frontId===front.frontId} onSelect={()=>setSelection(front.frontId)} myGuild={state.myAssociationId} phase={phase} canDeploy={owner}/>)}
  </nav>
  {selected?<section className="tc-village-selected-front" aria-label={'제'+selected.frontId+'전선 현황'}>
   <div className="tc-village-selected-head">
    <div><small>제{selected.frontId}전선 · {isDefender?(isOurs?'아군 수비':'적군 수비'):'미점령'}</small>
     <h3>{selected.associationName??'중립 전선'}</h3>
     <p>수비자 <b>{selected.defenderUserId?(selected.defenderUserId===userId?'내 캐릭터':selected.defenderName??'수비자'):'없음'}</b></p>
    </div>
    <div className={'tc-village-shield '+(isDefender?(isOurs?'ally':'foe'):'neutral')} aria-hidden="true">◇</div>
   </div>
   <div className="tc-village-selected-vitals">
    {isDefender?<><Vital name="HP" current={selected.hp} max={selected.maxHp}/><Vital name="MP" current={selected.mp} max={selected.maxMp}/></>:
     <p>비어 있는 전선입니다. 전쟁 중 도전권 1장으로 즉시 점령할 수 있습니다.</p>}
   </div>
   <div className="tc-village-selected-action">
    <button type="button" className="tc-village-primary tc-feel-press" disabled={!actionAllowed} onClick={act}>
     {actionText}<small>{actionHint}</small>
    </button>
   </div>
  </section>:<div className="tc-village-no-front">전선 정보를 확인하는 중입니다.</div>}
  <div className="tc-village-war-feed">
   <div className="tc-village-war-feed-head"><b>전투 기록</b><button type="button" onClick={()=>setOverlay('records')}>전체 보기{records.length?' ('+records.length+')':''}</button></div>
   {records.length?<div className="tc-village-mini-records">{records.slice(0,2).map(r=><p key={r.battleId}><time>{clock(r.createdAt)}</time><b>{r.frontId}전선</b><span>{r.attackerName} → {r.defenderName} · {r.outcome==='CAPTURE'?'점령 성공':'수비 성공'}</span></p>)}</div>:
    <p className="tc-village-empty-records">아직 진행된 전투가 없습니다.</p>}
  </div>
  <footer className="tc-village-war-footer">
   <span>도전권 <b>{state.tickets??0}</b>장 · {status}</span>
   <div>{pending&&<button type="button" disabled={busy} onClick={onRetry}>요청 재확인</button>}<button type="button" disabled={busy} onClick={onRefresh}>새로고침</button></div>
   {(error||pending)&&<p role={error?'alert':'status'}>{error||'이전 요청의 결과를 확인해야 합니다. 새 공격은 실행하지 않습니다.'}</p>}
  </footer>
  {overlay&&<div className="tc-village-dialog-backdrop" onClick={()=>setOverlay(null)}>
   <section role="dialog" aria-modal="true" aria-label={overlay==='scores'?'전체 원정단 순위':'공성전 전체 전투 기록'} className="tc-village-dialog" onClick={event=>event.stopPropagation()}>
    <header><div><small>GUILD SIEGE</small><h3>{overlay==='scores'?'전체 원정단 순위':'전투 기록'}</h3></div><button type="button" onClick={()=>setOverlay(null)}>닫기</button></header>
    {overlay==='scores'?<div className="tc-village-dialog-list">{scores.length?scores.map((s,i)=><div className="tc-village-dialog-score" key={s.associationId}>
     <b>{i+1}위</b><span>{s.associationName??'원정단'}</span><small>{s.fronts}전선</small><strong>{Number(s.points).toFixed(2)}점</strong>
    </div>):<p>현재 집계된 길드 점수가 없습니다.</p>}</div>:
    <ol className="tc-village-dialog-list tc-village-dialog-records">{records.length?records.map(r=><li key={r.battleId}>
     <time>{clock(r.createdAt)}</time><div><b>제{r.frontId}전선 · {r.outcome==='CAPTURE'?'점령 성공':'수비 성공'}</b><p>{r.attackerName} → {r.defenderName}</p><small>수비자 잔여 HP {r.defenderHp}{r.defenderReward?' · 수비 도전권 +1':''}</small></div>
    </li>):<li>아직 진행된 전투가 없습니다.</li>}</ol>}
   </section>
  </div>}
 </section>;
}
