import React,{useEffect,useMemo,useState} from 'react';
import type {Tower} from '../../game/types';
import {TOWERS,towerIds} from '../../game/data/config';
import type {GameplayLease} from '../../online/gameSession';
import {
 applyOccupationDuelAction,
 donateOccupationTickets,
 getOccupationState,
 joinOccupationFront,
 placeOccupationBid,
 subscribeOccupationRealtime,
 type OccupationFront,
 type OnlineOccupationState,
} from '../../online/occupation';
import {Glyph,Meter,Screen,Segments} from '../../ui/mobile';

type Tab='status'|'merit'|'battle';
const tabs=[['status','점령 현황'],['merit','원정 공적'],['battle','전선']] as const;
const fronts:[OccupationFront,string][]=[['LEFT','좌측 전선'],['CENTER','중앙 전선'],['RIGHT','우측 전선']];
const fmt=(value:string)=>new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
const phaseName=(phase:OnlineOccupationState['window']['phase'])=>phase==='BIDDING'?'공개 입찰':phase==='LOCKED'?'입찰 마감':phase==='BATTLE'?'점령전 진행':'정산 완료';
const remain=(target:string,now:number)=>{
 const ms=Math.max(0,new Date(target).getTime()-now),total=Math.ceil(ms/1000),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;
 return h>0?h+'시간 '+m+'분':m>0?m+'분 '+s+'초':s+'초';
};

export function OccupationScreen({onlineLease}:{onlineLease?:GameplayLease|null}){
 const [state,setState]=useState<OnlineOccupationState|null>(null);
 const [tab,setTab]=useState<Tab>('status');
 const [tower,setTower]=useState<Tower>('ore');
 const [floor,setFloor]=useState(1);
 const [donation,setDonation]=useState('1');
 const [bid,setBid]=useState('10');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [now,setNow]=useState(Date.now());

 const refresh=async()=>{
  if(!onlineLease)return;
  try{setState(await getOccupationState(onlineLease));setError('');}
  catch(e){setError(e instanceof Error?e.message:'점령전 상태를 불러오지 못했습니다.');}
 };

 useEffect(()=>{
  if(!onlineLease){setState(null);return;}
  let disposed=false;
  void getOccupationState(onlineLease).then(next=>{if(!disposed)setState(next);}).catch(e=>{if(!disposed)setError(e instanceof Error?e.message:'점령전 상태를 불러오지 못했습니다.');});
  const unsubscribe=subscribeOccupationRealtime(()=>{if(!disposed)void refresh();});
  const id=window.setInterval(()=>setNow(Date.now()),1000);
  return()=>{disposed=true;unsubscribe();window.clearInterval(id);};
 },[onlineLease?.leaseId,onlineLease?.generation]);

 const act=async(fn:()=>Promise<OnlineOccupationState>)=>{
  setBusy(true);setError('');
  try{setState(await fn());}
  catch(e){setError(e instanceof Error?e.message:'점령전 요청을 처리하지 못했습니다.');}
  finally{setBusy(false);}
 };

 const selectedTower=state?.towers.find(entry=>entry.tower===tower)??null;
 const merit=state?.merit[tower]??0;
 const bids=useMemo(()=>state?.bids.filter(entry=>entry.tower===tower)??[],[state,tower]);
 const lead=bids[0]??null;
 const mine=bids.find(entry=>entry.mine)??null;
 const match=state?.matches.find(entry=>entry.tower===tower)??null;
 const myGroup=state?.identity?.groupKey??null;
 const mySide=match&&myGroup?(match.attackerGroupKey===myGroup?'ATTACKER':match.defenderGroupKey===myGroup?'DEFENDER':null):null;
 const q=/^\d+$/.test(donation)?Number(donation):0;
 const amount=/^\d+$/.test(bid)?Number(bid):0;
 const canBid=!!state?.identity&&state.identity.role==='LEADER'&&state.window.phase==='BIDDING'&&amount>=10&&amount<=100&&amount<=merit&&!busy&&selectedTower?.ownerGroupKey!==state.identity.groupKey;
 const nextAt=state?.window.phase==='BIDDING'?state.window.bidClosesAt:state?.window.phase==='LOCKED'?state.window.battleStartsAt:state?.window.phase==='BATTLE'?state.window.battleEndsAt:state?.window.nextCycleAt;

 if(!onlineLease)return <Screen eyebrow="OCCUPATION WAR" title="점령전"><div className="tc-floor-risk">점령전은 Google 로그인과 활성 플레이 세션이 필요합니다.</div></Screen>;
 if(!state)return <Screen eyebrow="OCCUPATION WAR" title="점령전"><div className="tc-floor-risk">{error||'점령전 서버 상태를 불러오고 있습니다.'}</div></Screen>;

 const duel=state.duel;
 const myTurn=!!duel&&duel.currentActor===state.userId;
 const amAttacker=!!duel&&duel.attackerUserId===state.userId;
 const myHp=duel?(amAttacker?duel.attackerHp:duel.defenderHp):0;
 const enemyHp=duel?(amAttacker?duel.defenderHp:duel.attackerHp):0;
 const duelMax=Math.max(1,myHp,enemyHp);

 return <Screen eyebrow="OCCUPATION WAR / NOVAR" title="점령전" meta={<span>{phaseName(state.window.phase)}</span>}>
  <div className="tc-occupation">
   <section className="tc-occupation-clock">
    <div><small>이번 주</small><b>{state.window.cycleKey}</b></div>
    <div><small>{state.window.phase==='BIDDING'?'입찰 마감':state.window.phase==='LOCKED'?'전투 시작':state.window.phase==='BATTLE'?'전투 종료':'다음 입찰'}</small><b>{nextAt?remain(nextAt,now):'—'}</b></div>
    <span>{nextAt?fmt(nextAt):'—'} KST</span>
   </section>
   <Segments items={tabs} value={tab} onChange={setTab} label="점령전 메뉴"/>

   {tab==='status'&&<div className="tc-occupation-towers">
    {towerIds.map(id=>{
     const t=state.towers.find(entry=>entry.tower===id),top=state.bids.find(entry=>entry.tower===id),m=state.matches.find(entry=>entry.tower===id);
     return <button key={id} className={tower===id?'active':''} onClick={()=>setTower(id)}>
      <Glyph name="towers"/>
      <span><small>{TOWERS[id].name}</small><b>{t?.ownerGroupName||'미점령'}</b><em>{m?m.attackerGroupName+' 도전':top?'입찰 1위 '+top.groupName+' · '+top.totalMerit+' 공적':'도전자 없음'}</em></span>
      <i>›</i>
     </button>;
    })}
    <section className="tc-occupation-summary">
     <small>선택한 탑</small><h2>{TOWERS[tower].name}</h2>
     <div className="tc-stat-grid">
      <div className="tc-stat"><small>점령 원정단</small><b>{selectedTower?.ownerGroupName||'없음'}</b></div>
      <div className="tc-stat"><small>내 공적</small><b>{merit}</b></div>
      <div className="tc-stat"><small>공개 입찰 1위</small><b>{lead?lead.totalMerit:'—'}</b></div>
      <div className="tc-stat"><small>내 누적 입찰</small><b>{mine?.totalMerit??0}</b></div>
     </div>
    </section>
   </div>}

   {tab==='merit'&&<div className="tc-occupation-merit">
    {!state.identity&&<div className="tc-floor-risk">원정단 가입 후 입장권을 원정 공적으로 전환하고 공개 입찰에 참여할 수 있습니다.</div>}
    <section className="tc-panel strong">
     <div className="tc-panel-title"><b>원정 공적</b><small>{state.identity?.groupName??'원정단 없음'}</small></div>
     <div className="tc-occupation-merit-grid">{towerIds.map(id=><button key={id} className={tower===id?'active':''} onClick={()=>setTower(id)}><small>{TOWERS[id].name}</small><b>{state.merit[id]??0}</b><span>공적</span></button>)}</div>
    </section>
    <section className="tc-panel">
     <div className="tc-panel-title"><b>입장권 기부</b><small>1장 = 해당 탑 공적 1</small></div>
     <div className="tc-occupation-formrow">
      <select value={tower} onChange={e=>setTower(e.target.value as Tower)}>{towerIds.map(id=><option key={id} value={id}>{TOWERS[id].name}</option>)}</select>
      <select value={floor} onChange={e=>setFloor(Number(e.target.value))}>{Array.from({length:10},(_,i)=><option value={i+1} key={i+1}>{i+1}F 입장권</option>)}</select>
      <input inputMode="numeric" value={donation} onChange={e=>setDonation(e.target.value.replace(/\D/g,''))}/>
      <button disabled={!state.identity||q<1||busy} onClick={()=>void act(()=>donateOccupationTickets(onlineLease,{tower,floor,quantity:q}))}>기부</button>
     </div>
    </section>
    <section className="tc-panel">
     <div className="tc-panel-title"><b>공개 입찰</b><small>월 00:00 ~ 금 22:00 · 30분 쿨다운</small></div>
     <div className="tc-occupation-bidhead"><span>{TOWERS[tower].name}</span><b>{merit} 공적 보유</b></div>
     <div className="tc-occupation-bidlist">
      {bids.slice(0,4).map((entry,index)=><div key={entry.groupKey}><i>{index+1}</i><span><b>{entry.groupName}</b><small>{entry.mine?'내 원정단 · ':''}{entry.status}</small></span><strong>{entry.totalMerit}</strong></div>)}
      {!bids.length&&<p>아직 입찰한 원정단이 없습니다.</p>}
     </div>
     <div className="tc-occupation-formrow compact">
      <input inputMode="numeric" value={bid} onChange={e=>setBid(e.target.value.replace(/\D/g,''))} min={10} max={100}/>
      <span>공적</span>
      <button disabled={!canBid} onClick={()=>void act(()=>placeOccupationBid(onlineLease,tower,amount))}>입찰</button>
     </div>
     <small className="tc-occupation-note">한 번에 10~100 공적 · 취소 불가 · 낙찰 100% 소모 · 패배 50% 반환 · 동률은 먼저 도달한 원정단 우선</small>
    </section>
   </div>}

   {tab==='battle'&&<div className="tc-occupation-battle">
    {state.window.phase!=='BATTLE'&&<div className="tc-floor-risk">점령전 전투는 토요일 22:00~22:30 KST에 진행됩니다.</div>}
    <div className="tc-occupation-matchselect">{state.matches.map(entry=><button key={entry.matchId} className={tower===entry.tower?'active':''} onClick={()=>setTower(entry.tower)}><b>{TOWERS[entry.tower].name}</b><small>{entry.attackerGroupName} VS {entry.defenderGroupName||'무주공산'}</small></button>)}</div>
    {match?<section className="tc-occupation-fronts">
     <div className="tc-occupation-versus"><span>{match.attackerGroupName}</span><b>VS</b><span>{match.defenderGroupName||'방어 원정단 없음'}</span></div>
     {fronts.map(([front,label])=>{
      const score=match.fronts.find(row=>row.front===front);
      return <article key={front}>
       <div><small>{front}</small><b>{label}</b><span>{score?.attackerWins??0} : {score?.defenderWins??0}</span></div>
       <button disabled={state.window.phase!=='BATTLE'||!mySide||busy||!!duel} onClick={()=>void act(()=>joinOccupationFront(onlineLease,tower,front))}>{duel?.front===front?'대결 중':'자동 매칭'}</button>
      </article>;
     })}
     <div className="tc-floor-risk">{mySide?'내 원정단: '+(mySide==='ATTACKER'?'공격':'방어')+' 측 · 전선을 선택하면 상대를 서버가 자동 매칭합니다.':'이번 탑 점령전 참가 원정단이 아닙니다.'}</div>
    </section>:<div className="tc-market-v2-empty">이번 주 선택한 탑의 점령전 대진이 없습니다.</div>}

    {duel&&<section className="tc-occupation-duel">
     <div className="tc-panel-title"><b>{duel.front} 전선 · 1:1 교대 전투</b><small>{myTurn?'내 차례':'상대 차례'}</small></div>
     <div className="tc-occupation-hp"><div><span>나</span><Meter value={myHp} max={duelMax}/><b>{myHp}</b></div><div><span>상대</span><Meter value={enemyHp} max={duelMax}/><b>{enemyHp}</b></div></div>
     <div className="tc-occupation-actions">
      <button disabled={!myTurn||busy} onClick={()=>void act(()=>applyOccupationDuelAction(onlineLease,duel.duelId,duel.actionNonce+1,'BASIC'))}>기본 공격</button>
      <button disabled={!myTurn||busy} onClick={()=>void act(()=>applyOccupationDuelAction(onlineLease,duel.duelId,duel.actionNonce+1,'GUARD'))}>방어 태세</button>
     </div>
    </section>}
   </div>}

   {error&&<div className="tc-floor-risk">{error}</div>}
  </div>
 </Screen>;
}
