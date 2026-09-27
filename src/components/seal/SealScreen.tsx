import React,{useEffect,useMemo,useState} from 'react';
import type {GameState} from '../../game/types';
import {
 ASSOCIATION_SEAL_MAX_LEVEL,
 ASSOCIATION_SEAL_MAX_ROLLS,
 ASSOCIATION_SEAL_PROBABILITIES,
 ASSOCIATION_SEAL_RESET_COST,
 ASSOCIATION_SEAL_ROLL_COST,
 associationSealNextMilestone,
 associationSealReward,
 associationSealRoman,
} from '../../game/seal';
import type {CloudSaveRecord} from '../../online/cloudSave';
import type {GameplayLease} from '../../online/gameSession';
import {
 applyOnlineAssociationSealWallet,
 getOnlineAssociationSealState,
 resetOnlineAssociationSeal,
 rollOnlineAssociationSeal,
 type OnlineAssociationSealState,
} from '../../online/seal';
import {Screen} from '../../ui/mobile';

const percent=(value:number)=>Number(value.toFixed(2)).toString()+'%';

export function SealScreen({
 game,setGame,onlineLease,onServerRecord,
}:{
 game:GameState;
 setGame:React.Dispatch<React.SetStateAction<GameState>>;
 onlineLease?:GameplayLease|null;
 onServerRecord?:(record:CloudSaveRecord,message:string)=>void;
}){
 const [state,setState]=useState<OnlineAssociationSealState|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [lastStep,setLastStep]=useState<number|null>(null);

 useEffect(()=>{
  if(!onlineLease){
   setState(null);
   setMessage('Google 로그인 후 활성 플레이 세션에서 이용할 수 있습니다.');
   return;
  }
  let disposed=false;
  setBusy(true);setMessage('');
  void getOnlineAssociationSealState(onlineLease)
   .then(next=>{
    if(disposed)return;
    setState(next);
    setGame(current=>applyOnlineAssociationSealWallet(current,next));
   })
   .catch(error=>{if(!disposed)setMessage(error instanceof Error?error.message:'협회 인장 상태를 불러오지 못했습니다.');})
   .finally(()=>{if(!disposed)setBusy(false);});
  return()=>{disposed=true;};
 },[onlineLease?.leaseId,onlineLease?.generation]);

 const level=state?.level??0;
 const rolls=state?.rollsUsed??0;
 const gold=state?.gold??game.market.gold;
 const reward=state??associationSealReward(level);
 const nextMilestone=associationSealNextMilestone(level);
 const nextReward=associationSealReward(nextMilestone);
 const completed=level>=ASSOCIATION_SEAL_MAX_LEVEL;
 const canRoll=!!onlineLease&&!!state&&!busy&&!game.expedition&&!completed&&rolls<ASSOCIATION_SEAL_MAX_ROLLS&&gold>=ASSOCIATION_SEAL_ROLL_COST;
 const canReset=!!onlineLease&&!!state&&!busy&&!game.expedition&&!completed&&rolls>=ASSOCIATION_SEAL_MAX_ROLLS&&gold>=ASSOCIATION_SEAL_RESET_COST;
 const activeNodes=Math.min(10,Math.ceil(level/3));
 const nodeIndexes=useMemo(()=>Array.from({length:10},(_,index)=>index),[]);

 async function roll(){
  if(!onlineLease||!canRoll)return;
  setBusy(true);setMessage('');setLastStep(null);
  try{
   const result=await rollOnlineAssociationSeal(onlineLease);
   setState(result.state);
   setLastStep(result.step);
   const text='+'+result.step+' 단계 · '+result.beforeLevel+' → '+result.afterLevel;
   setMessage(result.afterLevel>=ASSOCIATION_SEAL_MAX_LEVEL?'최고 인장을 완성했습니다.':text);
   if(onServerRecord)onServerRecord(result.record,'협회 인장 주조 결과를 서버에 저장했습니다.');
   else setGame(result.record.payload);
  }catch(error){setMessage(error instanceof Error?error.message:'협회 인장 주조에 실패했습니다.');}
  finally{setBusy(false);}
 }

 async function reset(){
  if(!onlineLease||!canReset)return;
  if(!window.confirm('현재 '+level+'단계 인장을 초기화하고 '+ASSOCIATION_SEAL_RESET_COST.toLocaleString()+' Gold로 다시 주조하시겠습니까?'))return;
  setBusy(true);setMessage('');setLastStep(null);
  try{
   const result=await resetOnlineAssociationSeal(onlineLease);
   setState(result.state);
   setMessage('재주조 완료 · 누적 '+result.state.resetCount+'회');
   if(onServerRecord)onServerRecord(result.record,'협회 인장 재주조를 서버에 저장했습니다.');
   else setGame(result.record.payload);
  }catch(error){setMessage(error instanceof Error?error.message:'협회 인장 재주조에 실패했습니다.');}
  finally{setBusy(false);}
 }

 if(!onlineLease){
  return <Screen eyebrow="NOVAR ASSOCIATION" title="협회 인장" meta={<span>SERVER ONLY</span>}>
   <div className="tc-seal-locked">
    <div className="tc-seal-lockmark" aria-hidden="true"><i/><span>印</span></div>
    <h2>서버 권위 인장 주조</h2>
    <p>Gold를 사용하는 확률 주조는 서버에서만 판정합니다. Google 로그인 후 활성 플레이 세션에서 이용할 수 있습니다.</p>
    <div><span><small>주조</small><b>300 Gold</b></span><span><small>재주조</small><b>3,000 Gold</b></span><span><small>최대</small><b>30단계</b></span></div>
   </div>
  </Screen>;
 }

 return <Screen eyebrow="NOVAR ASSOCIATION" title="협회 인장" meta={<span className={completed?'tc-seal-complete':''}>{completed?'최고 인장':'주조 '+rolls+'/'+ASSOCIATION_SEAL_MAX_ROLLS}</span>}>
  <div className={'tc-seal'+(busy?' is-working':'')+(completed?' is-complete':'')}>
   <div className="tc-seal-stage">
    <section className="tc-seal-altar" aria-label="협회 인장 주조 제단">
     <div className="tc-seal-wheel">
      <div className="tc-seal-rune-ring" aria-hidden="true"/>
      {nodeIndexes.map(index=><i
       className={'tc-seal-node '+(index<activeNodes?'active':'')}
       style={{'--i':index} as React.CSSProperties}
       key={index}
       aria-hidden="true"
      ><span>{index+1}</span></i>)}
      <div className="tc-seal-core" aria-hidden="true">
       <i className="tc-seal-spire"/>
       <i className="tc-seal-wing left"/>
       <i className="tc-seal-wing right"/>
       <span>{completed?'MAX':associationSealRoman(level)}</span>
      </div>
     </div>
     <div className="tc-seal-altar-copy">
      <small>ASSOCIATION SEAL</small>
      <b>{completed?'완성된 협회 인장':level===0?'미주조 인장':level+'단계 협회 인장'}</b>
      <span>20회 안에 30단계를 완성하세요.</span>
     </div>
    </section>

    <aside className="tc-seal-status">
     <header>
      <div className="tc-seal-badge"><small>현재</small><b>{completed?'MAX':associationSealRoman(level)}</b></div>
      <div><small>현재 단계</small><strong>{level} / {ASSOCIATION_SEAL_MAX_LEVEL}</strong></div>
      <div><small>주조 횟수</small><strong>{rolls} / {ASSOCIATION_SEAL_MAX_ROLLS}</strong></div>
     </header>
     <h3>적용 중인 인장 효과</h3>
     <dl className="tc-seal-effects">
      <div><dt><i>♥</i> 최대 체력</dt><dd>+{percent(reward.hpPercent)}</dd></div>
      <div><dt><i>⚔</i> 공격력</dt><dd>+{percent(reward.attackPercent)}</dd></div>
      <div><dt><i>◆</i> 방어력</dt><dd>+{percent(reward.defensePercent)}</dd></div>
     </dl>
     {!completed&&<div className="tc-seal-next">
      <small>다음 이정표 · {nextMilestone}단계</small>
      <b>HP +{percent(nextReward.hpPercent)} · ATK/DEF +{percent(nextReward.attackPercent)}</b>
     </div>}
     <div className="tc-seal-meta"><span>누적 재주조 <b>{state?.resetCount??0}</b></span><span>보유 Gold <b>{gold.toLocaleString()}</b></span></div>
    </aside>
   </div>

   <section className="tc-seal-prob" aria-label="주조 결과 확률">
    <header><span>주조 결과</span><small>서버 독립 판정 · 하락/파괴 없음</small></header>
    <div>{ASSOCIATION_SEAL_PROBABILITIES.map((item,index)=><span className={'p'+item.step+(lastStep===item.step?' hit':'')} key={item.step}><i>{index===0?'◇':index===1?'◆':'✦'}</i><b>+{item.step}</b><strong>{item.rate}%</strong></span>)}</div>
   </section>

   <div className="tc-seal-actions">
    <button className="tc-seal-roll" disabled={!canRoll} onClick={()=>void roll()}>
     <span>{busy?'주조 중…':completed?'최고 단계 달성':rolls>=ASSOCIATION_SEAL_MAX_ROLLS?'20회 주조 완료':'인장 주조'}</span>
     <small>{ASSOCIATION_SEAL_ROLL_COST.toLocaleString()} Gold</small>
    </button>
    <button className="tc-seal-reset" disabled={!canReset} onClick={()=>void reset()}>
     <span>재주조</span>
     <small>{ASSOCIATION_SEAL_RESET_COST.toLocaleString()} Gold · 20회 완료 후</small>
    </button>
   </div>

   <div className="tc-seal-note" role="status">
    <span>{message||(game.expedition?'원정 중에는 인장을 주조할 수 없습니다.':completed?'30단계 효과가 온라인 전투 능력치에 적용됩니다.':rolls>=ASSOCIATION_SEAL_MAX_ROLLS?'현재 인장을 유지하거나 재주조할 수 있습니다.':'주조 결과는 +1 76% · +2 20% · +3 4%입니다.')}</span>
   </div>
  </div>
 </Screen>;
}
