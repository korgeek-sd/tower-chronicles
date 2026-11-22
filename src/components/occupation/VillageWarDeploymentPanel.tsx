import React,{useState} from 'react';
import {GuildEmblem,type GuildEmblemData} from '../association/GuildEmblem';
import {assetUrl} from '../../game/data/graphics';
import type {VillageWarFront,VillageWarStageOneState,VillageWarStageRequest} from '../../online/villageWar';
import './village-war-stage-one.css';

type Props={
 townName?:string;townKind?:'farm'|'herb'|'city';ownArt?:string;preview?:boolean;emblems?:Record<string,GuildEmblemData>;
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
const guildColors=['#7e9ebf','#b46861','#8a79af','#769975','#b99b62','#8b8993'];
function guildColor(id:string|null|undefined,myGuild:string|null|undefined){
 if(!id)return '#85817a';
 if(id===myGuild)return guildColors[0];
 let h=0;for(const ch of id)h=(h*31+ch.charCodeAt(0))>>>0;
 return guildColors[1+h%(guildColors.length-1)];
}
function Banner({color,empty=false,emblem}:{color:string;empty?:boolean;emblem?:GuildEmblemData|null}){
 return <svg className="tc-siege-banner" viewBox="0 0 38 49" aria-hidden="true" focusable="false"><path d="M2 3H36M5 5H33V34L19 46L5 34Z" fill={color} fillOpacity=".28" stroke={color} strokeWidth="1.5"/><path d="M7 7H31V33L19 43L7 33Z" fill="none" stroke="#cfb589" strokeOpacity=".35"/>{empty?<path d="M11 13L27 29M27 13L11 29" stroke={color} strokeWidth="3"/>:emblem?<g transform="translate(2 6)"><GuildEmblem value={emblem} size={34}/></g>:<path d="M19 10L22 18L29 19L24 25L25 34L19 30L13 34L14 25L9 19L16 18Z" fill={color}/>}</svg>;
}
function MiniVital({label,value}:{label:'HP'|'MP';value:number|null}){
 return <span className={'tc-siege-mini-vital '+label.toLowerCase()}><small>{label}</small><span className="tc-siege-track"><i style={{width:(value??0)+'%'}}/></span><em>{value===null?'—':value+'%'}</em></span>;
}
function Fatigue({wins,empty=false,detail=false}:{wins:number;empty?:boolean;detail?:boolean}){
 return <div className={'tc-siege-fatigue'+(wins>=20&&!empty?' exhausted':'')}><span>피로도</span><span className="tc-siege-fatigue-track" role="progressbar" aria-label="연속 수비 피로도" aria-valuemin={0} aria-valuemax={20} aria-valuenow={Math.min(wins,20)}>{Array.from({length:detail?20:5},(_,i)=><i key={i} className={i<(detail?wins:Math.ceil(wins/4))&&!empty?'filled':''}/>)}</span><b>{empty?'—':wins+'/20'}</b></div>;
}
function FrontButton({front,selected,onSelect,myGuild,phase,canDeploy,userId,canAct,emblem}:{front:VillageWarFront;selected:boolean;onSelect:()=>void;myGuild:string|null|undefined;phase:string;canDeploy:boolean;userId:string|null;canAct:boolean;emblem?:GuildEmblemData|null}){
 const occupied=!!front.defenderUserId,ours=!!myGuild&&front.associationId===myGuild,wins=front.defenseWins??0;
 const color=guildColor(front.associationId,myGuild);
 const status=!occupied?'빈 전선':front.defenderUserId===userId?'내 수비':wins>=20?'탈진 위험':ours?'아군 수비':canAct?'공격 가능':'적군 수비';
 return <button type="button" data-front-id={front.frontId} className={'tc-village-lane '+(selected?'is-selected ':'')+(occupied?(ours?'is-ours':'is-enemy'):'is-empty')+(occupied&&wins>=20?' is-exhausted':'')} aria-pressed={selected} aria-label={'제'+front.frontId+'전선 · '+(front.associationName??(phase==='BATTLE'?'빈 전선 점령':phase==='DEPLOYMENT'&&canDeploy?'내 캐릭터 배치':'중립'))} onClick={onSelect}>
  <span className="tc-siege-card-head"><b>제{front.frontId}전선</b><small className="tc-siege-tag">{status}</small></span>
  <span className="tc-siege-card-owner"><Banner color={color} empty={!occupied} emblem={emblem}/><span><strong style={{color}}>{front.associationName??(occupied?'점령 중':'미점령')}</strong><small>{occupied?(front.defenderUserId===userId?'내 캐릭터':front.defenderName??'수비자'):'수비자 없음'}</small></span></span>
  <MiniVital label="HP" value={ratio(front.hp,front.maxHp)}/>
  <Fatigue wins={wins} empty={!occupied}/>
 </button>;
}
export function VillageWarDeploymentPanel({townName='영지',townKind='city',ownArt,preview=false,emblems={},state,userId,busy,pending,error,onPlace,onRemove,onClaim,onAttack,onRetry,onRefresh,now=state.serverNow}:Props){
 const [selection,setSelection]=useState(preview?3:1),[overlay,setOverlay]=useState<'scores'|'records'|'rules'|'notice'|null>(null);
 const phase=state.settledAt?'ENDED':state.battleStartsAt&&state.battleEndsAt&&state.deploymentStartsAt?
  (now<Date.parse(state.deploymentStartsAt)?'WAITING':now<Date.parse(state.battleStartsAt)?'DEPLOYMENT':now<Date.parse(state.battleEndsAt)?'BATTLE':'ENDED'):state.phase;
 const selected=state.fronts.find(front=>front.frontId===selection)??state.fronts[0];
 const scores=state.scores??[],records=state.recentBattles??[];
 const lead=scores[0],recent=records[0];
 const owner=!!state.myAssociationId&&state.myAssociationId===state.ownerAssociationId;
 const locked=busy||!!pending;
 const cooldown=state.nextAttackAt?Math.max(0,Math.ceil((Date.parse(state.nextAttackAt)-now)/1000))||0:0;
 const canAct=phase==='BATTLE'&&!locked&&!!state.canAttack&&!state.myDefendingFront&&cooldown===0&&(state.tickets??0)>=1;
 const settled=phase==='ENDED';
 const deadline=phase==='DEPLOYMENT'?state.battleStartsAt:phase==='BATTLE'?state.battleEndsAt:state.deploymentStartsAt;
 const winner=state.scores?.find(s=>s.associationId===state.winnerAssociationId)?.associationName??'원정단';
 const isOurs=!!selected&&!!state.myAssociationId&&selected.associationId===state.myAssociationId;
 const isDefender=!!selected?.defenderUserId;
 const cooling=phase==='BATTLE'&&cooldown>0&&!!selected&&(!isDefender||!isOurs);
 const cooldownElapsed=30-Math.min(30,cooldown);
 const cooldownProgress=Math.round(cooldownElapsed/30*100);
 const ownsPlacement=!!selected&&owner&&phase==='DEPLOYMENT';
 const status=preview?'시연 모드':phase!=='BATTLE'?(phase==='DEPLOYMENT'?'수비 배치':'전쟁 대기'):state.myDefendingFront?'현재 수비 중':!state.canAttack?'선전포고 필요':cooldown>0?'공격 대기 '+cooldown+'초':(state.tickets??0)<1?'도전권 부족':'공격 가능';
 const actionText=cooling?`재공격까지 ${cooldown}초`:phase==='DEPLOYMENT'?(ownsPlacement?(isDefender?(state.myRole==='LEADER'?'배치 해제':'수비 배치 완료'):'내 캐릭터 배치'):'수비 배치 대기'):
  phase==='BATTLE'?(isDefender&&isOurs?'우리 길드 수비 중':state.myDefendingFront?'수비 중':!state.canAttack?'선전포고 필요':(state.tickets??0)<1?'도전권 부족':isDefender?(state.stageTwo?'공격':'자동 PvP 연결 전'):'빈 전선 점령'):
  settled?'종료된 전쟁':'전쟁 시작 대기';
 const actionAllowed=!!selected&&(phase==='DEPLOYMENT'?ownsPlacement&&(isDefender?state.myRole==='LEADER':!state.myDefendingFront)&&!locked:
  phase==='BATTLE'&&canAct&&(!isDefender||!!state.stageTwo&&!isOurs&&!!onAttack));
 const act=()=>{if(!selected||!actionAllowed)return;
  if(phase==='DEPLOYMENT')isDefender?onRemove(selected):onPlace(selected);
  else if(phase==='BATTLE')isDefender?onAttack?.(selected):onClaim(selected);
 };
 const actionHint=cooling?'대기 시간이 끝나면 다시 공격할 수 있습니다':phase==='DEPLOYMENT'?'시작 전 5분 동안만 편성 가능':phase==='BATTLE'?(state.myDefendingFront?'다른 전선 수비 중에는 공격할 수 없습니다':isOurs?'같은 원정단은 공격할 수 없습니다':!state.canAttack?'선전포고 또는 방어 자격 필요':(state.tickets??0)<1?'도전권이 부족합니다':'즉시 전투 · 도전권 1장 · 개인 대기 30초'):'전쟁 시작 전 또는 종료 후에는 공격할 수 없습니다';
 const title=phase==='DEPLOYMENT'?'수비 배치':phase==='BATTLE'?'점령전 진행 중':settled?(state.winnerAssociationId?winner+' 승리':'전쟁 종료 · 소유권 유지'):'전쟁 준비';
 const landscape=townKind==='city'?'assets/backgrounds/hub/novar-moonlit-v3.webp':'assets/backgrounds/gathering/'+townKind+'.webp';
 const selectedColor=guildColor(selected?.associationId,state.myAssociationId);
 return <section className="tc-village-stage tc-village-stage-v3 tc-siege-v4 tc-siege-v5" aria-label="5전선 공성전 실시간 전황">
  <header className="tc-village-war-head tc-siege-hero" style={{backgroundImage:'linear-gradient(90deg,#11141be8,#11141b80),url('+assetUrl(landscape)+')'}}>
   <div className="tc-siege-hero-title"><h2>점령전 · {townName}</h2><small>{title}{preview?' · 시연 데이터':''}</small></div>
   <button type="button" className="tc-siege-help" onClick={()=>setOverlay('rules')} aria-label="점령전 규칙">?</button>
  </header>
  <div className="tc-siege-summary"><div><small>승리 조건</small><strong title="전선당 분당 1점 · 150점 선착순">150점 선취</strong></div><div><small>{phase==='DEPLOYMENT'?'전쟁 시작':phase==='BATTLE'?'남은 시간':settled?'종료':'배치 시작'}</small><strong>{settled?'종료':left(deadline,now)}</strong></div><div><small>도전권</small><strong>{(state.tickets??0).toLocaleString()}장</strong></div></div>
  <div className="tc-siege-front-label"><b>전선 현황</b><span>{status}</span></div>
  <nav className="tc-village-lanes" aria-label="공성전 5개 전선 선택">
   {state.fronts.map(front=><FrontButton key={front.frontId} front={front} selected={selected?.frontId===front.frontId} onSelect={()=>setSelection(front.frontId)} myGuild={state.myAssociationId} phase={phase} canDeploy={owner} userId={userId} canAct={canAct} emblem={front.associationId?emblems[front.associationId]:undefined}/>)}
  </nav>
  {selected?<section className="tc-village-selected-front" aria-label={'제'+selected.frontId+'전선 현황'}>
   <div className="tc-siege-detail-title"><h3>제{selected.frontId}전선</h3>{isDefender&&(selected.defenseWins??0)>=20?<span className="tc-siege-warning" role="status">탈진 패배 확률 30%</span>:<span>제{selected.frontId}전선 · {isDefender?(isOurs?'아군 수비':'적군 수비'):'미점령'}</span>}</div>
   <div className="tc-siege-detail-body">
    <div className="tc-siege-detail-art" style={{backgroundImage:'linear-gradient(0deg,#10131af5,#10131a66),url('+assetUrl(landscape)+')'}}>
     {isDefender&&selected.defenderUserId===userId&&ownArt?<img src={ownArt} alt="내 캐릭터"/>:<Banner color={selectedColor} empty={!isDefender} emblem={selected.associationId?emblems[selected.associationId]:undefined}/>}
    </div>
    <div className="tc-siege-detail-info"><small>점령 원정단</small><h3 style={{color:selectedColor}}>{selected.associationName??'중립 전선'}</h3>
     <p>수비자 <b>{selected.defenderUserId?(selected.defenderUserId===userId?'내 캐릭터':selected.defenderName??'수비자'):'없음'}</b></p>
     {isDefender?<><Vital name="HP" current={selected.hp} max={selected.maxHp}/><Vital name="MP" current={selected.mp} max={selected.maxMp}/><Fatigue wins={selected.defenseWins??0} detail/></>:<p>비어 있는 전선입니다. 전쟁 중 도전권 1장으로 점령할 수 있습니다.</p>}
    </div>
   </div>
   <div className="tc-village-selected-action">
    <button type="button" className={"tc-village-primary tc-feel-press"+(cooling?" is-cooling":"")+(!isDefender?" is-claim":"")} disabled={!actionAllowed} onClick={act}>
     <span className="tc-village-primary-label">{actionText}</span><small>{actionHint}</small>
     {cooling&&<span className="tc-village-cooldown-track" role="progressbar" aria-label="공격 대기 진행률" aria-valuemin={0} aria-valuemax={30} aria-valuenow={cooldownElapsed}><i style={{width:cooldownProgress+"%"}}/></span>}
    </button>
   </div>
  </section>:<div className="tc-village-no-front">전선 정보를 확인하는 중입니다.</div>}
  <div className="tc-siege-bottom" aria-label="전황 요약 및 상세 보기">
   <button type="button" className="tc-siege-quick-link" onClick={()=>setOverlay('scores')} aria-label="원정단 점수 현황 전체 순위 보기">
    <b>원정단 순위</b><span>{lead?(lead.associationName??'원정단')+' '+Number(lead.points).toFixed(2)+'점':'집계 대기'}</span>
   </button>
   <button type="button" className="tc-siege-quick-link" onClick={()=>setOverlay('records')} aria-label="최근 전투 기록 전체 보기">
    <b>전투 기록</b><span>{recent?clock(recent.createdAt)+' '+recent.attackerName+' → '+recent.defenderName:'기록 없음'}</span>
   </button>
  </div>
  <footer className="tc-village-war-footer">
   <span>도전권 <b>{state.tickets??0}</b>장 · {status}</span>
   <div>{pending&&<button type="button" disabled={busy} onClick={onRetry}>요청 재확인</button>}<button type="button" disabled={busy} onClick={onRefresh}>새로고침</button></div>
   {(error||pending)&&<button type="button" className="tc-siege-notice" role={error?'alert':'status'} onClick={()=>setOverlay('notice')}>{error?'오류 안내 보기':'요청 상태 확인'}</button>}
  </footer>
  {overlay&&<div className="tc-village-dialog-backdrop" onClick={()=>setOverlay(null)}>
   <section role="dialog" aria-modal="true" aria-label={overlay==='notice'?'요청 상태 안내':overlay==='rules'?'점령전 규칙':overlay==='scores'?'전체 원정단 순위':'공성전 전체 전투 기록'} className="tc-village-dialog" onClick={event=>event.stopPropagation()}>
    <header><div><small>GUILD SIEGE</small><h3>{overlay==='notice'?'요청 상태 안내':overlay==='rules'?'점령전 규칙':overlay==='scores'?'전체 원정단 순위':'전투 기록'}</h3></div><button type="button" onClick={()=>setOverlay(null)}>닫기</button></header>
    {overlay==='notice'?<div className="tc-village-dialog-list tc-siege-rules"><p role={error?'alert':'status'}>{error||'이전 요청의 결과를 확인해야 합니다. 새 공격은 실행하지 않습니다.'}</p></div>:overlay==='rules'?<div className="tc-village-dialog-list tc-siege-rules"><p>토요일 21:55–22:00 수비 배치, 22:00–23:00 점령전</p><p>전선당 분당 1점 · 150점 선취 시 승리. 시간 종료 시 서버 점수로 승패 결정.</p><p>공격 도전권 1장 · 공격 또는 수비 패배 후 30초 대기 · 모든 영지에서 한 전선만 수비 가능.</p><p>20회 정상 수비 이후 정상 승리도 30% 확률로 탈진 패배. 재점령 시 피로도 초기화.</p><p>최종 수비 성공 시 30% 확률로 도전권 1장 획득.</p></div>:overlay==='scores'?<div className="tc-village-dialog-list">{scores.length?scores.map((s,i)=><div className="tc-village-dialog-score" key={s.associationId}>
     <b>{i+1}위</b><span>{s.associationName??'원정단'}</span><small>{s.fronts}전선</small><strong>{Number(s.points).toFixed(2)}점</strong>
    </div>):<p>현재 집계된 길드 점수가 없습니다.</p>}</div>:
    <ol className="tc-village-dialog-list tc-village-dialog-records">{records.length?records.map(r=><li key={r.battleId}>
     <time>{clock(r.createdAt)}</time><div><b>제{r.frontId}전선 · {r.outcome==='CAPTURE'?'점령 성공':'수비 성공'}</b><p>{r.attackerName} → {r.defenderName}</p><small>수비자 잔여 HP {r.defenderHp}{r.defenderReward?' · 수비 도전권 +1':''}</small></div>
    </li>):<li>아직 진행된 전투가 없습니다.</li>}</ol>}
   </section>
  </div>}
 </section>;
}
