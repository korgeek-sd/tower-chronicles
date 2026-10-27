import React,{useEffect,useState} from 'react';
import type {GameState} from '../../game/types';
import {
 ASSOCIATION_SEAL_MAX_LEVEL,ASSOCIATION_SEAL_MAX_ROLLS,
 ASSOCIATION_SEAL_PROBABILITIES,ASSOCIATION_SEAL_RESET_COST,ASSOCIATION_SEAL_ROLL_COST,
 associationSealNextMilestone,associationSealReward,guardianSealReward,
} from '../../game/seal';
import type {CloudSaveRecord} from '../../online/cloudSave';
import type {GameplayLease} from '../../online/gameSession';
import {
 applyOnlineAssociationSealWallet,getOnlineSealState,resetOnlineSeal,rollOnlineSeal,
 type AssociationSealId,type OnlineAssociationSealState,
} from '../../online/seal';
import {Screen} from '../../ui/mobile';
import {useGameFeel} from '../../gameFeel/react/useGameFeel';
import './seal-collection.css';

const percent=(value:number)=>Number(value.toFixed(2)).toString()+'%';
const SEALED_SLOT_NUMBERS=[3,4] as const;
const SEAL_MILESTONES=[5,10,15,20,25,30] as const;
const SEALS=[
 {id:'association' as const,name:'전투 인장',subtitle:'기존 협회 인장 · 공격과 생존'},
 {id:'guardian' as const,name:'수호 인장',subtitle:'새로운 인장 · 체력과 방어'},
];
const rewardFor=(id:AssociationSealId,level:number)=>
 id==='guardian'?guardianSealReward(level):associationSealReward(level);

export function SealScreen({
 game,setGame,onlineLease,onServerRecord,
}:{
 game:GameState;
 setGame:React.Dispatch<React.SetStateAction<GameState>>;
 onlineLease?:GameplayLease|null;
 onServerRecord?:(record:CloudSaveRecord,message:string)=>void;
}){
 const [seals,setSeals]=useState<Partial<Record<AssociationSealId,OnlineAssociationSealState>>>({});
 const [selected,setSelected]=useState<AssociationSealId>('association');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [lastStep,setLastStep]=useState<number|null>(null);
 const [litNode,setLitNode]=useState<number|null>(null);
 const feel=useGameFeel();

 useEffect(()=>{
  if(!onlineLease){
   setSeals({});
   setMessage('Google 로그인 후 활성 플레이 세션에서 이용할 수 있습니다.');
   return;
  }
  let disposed=false;
  setBusy(true);setMessage('');
  void Promise.all([
   getOnlineSealState(onlineLease,'association'),
   getOnlineSealState(onlineLease,'guardian'),
  ]).then(([combat,guardian])=>{
   if(disposed)return;
   setSeals({association:combat,guardian});
   setGame(current=>applyOnlineAssociationSealWallet(current,combat));
  }).catch(error=>{
   if(!disposed)setMessage(error instanceof Error?error.message:'협회 인장 상태를 불러오지 못했습니다.');
  }).finally(()=>{if(!disposed)setBusy(false);});
  return()=>{disposed=true;};
 },[onlineLease?.leaseId,onlineLease?.generation]);

 const state=seals[selected]??null;
 const level=state?.level??0,rolls=state?.rollsUsed??0;
 const gold=state?.gold??seals.association?.gold??seals.guardian?.gold??game.market.gold;
 const reward=state??rewardFor(selected,level);
 const nextMilestone=associationSealNextMilestone(level);
 const nextLevel=Math.min(ASSOCIATION_SEAL_MAX_LEVEL,level+1);
 const nextReward=rewardFor(selected,nextLevel);
 const completed=level>=ASSOCIATION_SEAL_MAX_LEVEL;
 const canRoll=!!onlineLease&&!!state&&!busy&&!game.expedition&&!completed&&rolls<ASSOCIATION_SEAL_MAX_ROLLS&&gold>=ASSOCIATION_SEAL_ROLL_COST;
 const canReset=!!onlineLease&&!!state&&!busy&&!game.expedition&&!completed&&gold>=ASSOCIATION_SEAL_RESET_COST;
 const activeNodes=Math.floor(level/5);
 const sealName=SEALS.find(item=>item.id===selected)!.name;

 function switchSeal(id:AssociationSealId){
  if(busy||selected===id)return;
  setSelected(id);setLastStep(null);setLitNode(null);setMessage('');
 }

 async function roll(){
  if(!onlineLease||!canRoll)return;
  const sealId=selected;
  feel.play('seal.roll.start');
  setBusy(true);setMessage('');setLastStep(null);setLitNode(null);
  try{
   const result=await rollOnlineSeal(onlineLease,sealId);
   setSeals(previous=>({
    ...previous,
    [sealId]:result.state,
    // The wallet is shared, so the other seal's displayed Gold must update too.
    [sealId==='association'?'guardian':'association']:previous[sealId==='association'?'guardian':'association']
      ?{...previous[sealId==='association'?'guardian':'association']!,gold:result.state.gold}:undefined,
   }));
   setLastStep(result.step);
   const beforeNodes=Math.floor(result.beforeLevel/5);
   const afterNodes=Math.floor(result.afterLevel/5);
   setLitNode(afterNodes>beforeNodes?afterNodes-1:null);
   if(!result.replayed)feel.play('seal.roll.result',{step:result.step});
   setMessage(result.afterLevel>=ASSOCIATION_SEAL_MAX_LEVEL
    ?sealName+' 최고 단계를 완성했습니다.'
    :sealName+' · +'+result.step+'단계 · '+result.beforeLevel+' → '+result.afterLevel);
   if(onServerRecord)onServerRecord(result.record,'협회 인장 주조 결과를 서버에 저장했습니다.');
   else setGame(result.record.payload);
  }catch(error){
   feel.play('ui.error');
   setMessage(error instanceof Error?error.message:'협회 인장 주조에 실패했습니다.');
  }finally{setBusy(false);}
 }

 async function reset(){
  if(!onlineLease||!canReset)return;
  const sealId=selected;
  if(!window.confirm(sealName+' '+level+'단계와 주조 횟수를 초기화하고 '+ASSOCIATION_SEAL_RESET_COST.toLocaleString()+' Gold로 재주조하시겠습니까? 다른 인장은 유지됩니다.'))return;
  setBusy(true);setMessage('');setLastStep(null);setLitNode(null);
  try{
   const result=await resetOnlineSeal(onlineLease,sealId);
   setSeals(previous=>({
    ...previous,[sealId]:result.state,
    [sealId==='association'?'guardian':'association']:previous[sealId==='association'?'guardian':'association']
      ?{...previous[sealId==='association'?'guardian':'association']!,gold:result.state.gold}:undefined,
   }));
   if(!result.replayed)feel.play('seal.reset');
   setMessage(sealName+' 재주조 완료 · 누적 '+result.state.resetCount+'회');
   if(onServerRecord)onServerRecord(result.record,'협회 인장 재주조를 서버에 저장했습니다.');
   else setGame(result.record.payload);
  }catch(error){
   feel.play('ui.error');
   setMessage(error instanceof Error?error.message:'협회 인장 재주조에 실패했습니다.');
  }finally{setBusy(false);}
 }

 if(!onlineLease)return <Screen eyebrow="NOVAR ASSOCIATION" title="협회 인장" meta={<span>SERVER ONLY</span>}>
  <div className="tc-seal-locked">
   <div className="tc-seal-lockmark" aria-hidden="true"><i/><span>印</span></div>
   <h2>협회 인장 제단</h2>
   <p>전투 인장과 수호 인장은 서버에 각각 저장됩니다. Google 로그인 후 활성 플레이 세션에서 이용할 수 있습니다.</p>
   <div><span><small>주조</small><b>{ASSOCIATION_SEAL_ROLL_COST} Gold</b></span><span><small>재주조</small><b>{ASSOCIATION_SEAL_RESET_COST.toLocaleString()} Gold</b></span><span><small>최대</small><b>30단계</b></span></div>
  </div>
 </Screen>;

 return <Screen eyebrow="NOVAR ASSOCIATION" title="협회 인장" meta={<span className="tc-seal-wallet">GOLD <b>{gold.toLocaleString()}</b></span>}>
  <div className={'tc-seal tc-seal-multi'+(selected==='guardian'?' tc-seal-guardian':'')+(busy?' is-working':'')+(completed?' is-complete':'')+' tc-seal-tier-'+Math.floor(level/5)}>
   <nav className="tc-seal-selector" aria-label="협회 인장 선택">
    {SEALS.map(item=><button key={item.id} type="button"
      className={'tc-seal-slot '+(item.id==='guardian'?'guardian':'combat')+(selected===item.id?' is-selected':'')}
      onClick={()=>switchSeal(item.id)} disabled={busy||!seals[item.id]}
      aria-pressed={selected===item.id}
      aria-label={item.name+' 선택'}>
      <span className={'tc-seal-slot-emblem tc-seal-art '+item.id} aria-hidden="true"/>
      <strong>{item.name}</strong><small className="tc-seal-slot-level"><span>각인</span><b>{seals[item.id]?.level?.toString().padStart(2,'0')??'–'}</b><span>/30</span></small>
    </button>)}
    {SEALED_SLOT_NUMBERS.map(n=><div key={n} className="tc-seal-slot sealed" aria-label={'제'+n+'의 인장 봉인'}>
      <span className={'tc-seal-locked-art tc-seal-art sealed-'+n} aria-hidden="true"/>
      <strong>봉인된 인장</strong><small>제{n}의 인장</small>
    </div>)}
   </nav>
   <div className="tc-seal-selection-label" role="status" aria-live="polite"><span>{sealName}</span><small title={message||undefined}>{message||(game.expedition?'원정 중에는 인장을 주조할 수 없습니다.':SEALS.find(item=>item.id===selected)!.subtitle)}</small></div>
   <div className="tc-seal-stage">
    <section className="tc-seal-altar" aria-label={sealName+' 주조 제단'}>
     <div className="tc-seal-stage-number"><span>현재 인장 단계</span><strong>{level.toString().padStart(2,'0')} <span>/ 30</span></strong></div>
     <div className={'tc-seal-wheel '+(busy?'is-casting ':'')+(lastStep?'tc-seal-result-'+lastStep:'')}
      style={{'--seal-progress':(level / ASSOCIATION_SEAL_MAX_LEVEL * 100)+'%'} as React.CSSProperties}
      aria-label={sealName+' 각인 '+level+'단계, 최대 30단계'}>
      <div className="tc-seal-progress-arc" aria-hidden="true"/>
      <div className="tc-seal-rune-ring" aria-hidden="true"/>
      {SEAL_MILESTONES.map((milestone,index)=><i
       className={'tc-seal-node '+(index<activeNodes?'active':'')+(litNode===index?' just-lit':'')}
       style={{'--i':index} as React.CSSProperties} key={milestone} aria-hidden="true"><span>{String(milestone).padStart(2,'0')}</span></i>)}
      <div className="tc-seal-core" aria-hidden="true">
       <span className={'tc-seal-core-art tc-seal-art '+selected}/>
      </div>
      {lastStep&&<div className={'tc-seal-flare '+selected} aria-hidden="true"><i className="layer-1"/>{lastStep>=2&&<i className="layer-2"/>}</div>}
      <div className="tc-seal-rank-cartouche" aria-hidden="true">
       <div className="tc-seal-engraved-level" key={selected+'-'+level}>
        <strong>{level.toString().padStart(2,'0')}</strong><small>/30</small>
       </div>
      </div>
     </div>
     <div className="tc-seal-altar-copy"><small>ASSOCIATION SEAL</small>
      <b>{completed?'완성된 '+sealName:level===0?'미주조 '+sealName:level+'단계 '+sealName}</b>
     </div>
    </section>
    <aside className="tc-seal-status">
     <header><div className="tc-seal-badge" aria-hidden="true"><span className={'tc-seal-badge-art tc-seal-art '+selected}/></div>
      <div><small>현재 단계</small><strong>{level} / {ASSOCIATION_SEAL_MAX_LEVEL}</strong></div>
      <div><small>주조 횟수</small><strong>{rolls} / {ASSOCIATION_SEAL_MAX_ROLLS}</strong></div></header>
     <h3>{sealName} 효과</h3>
     <dl className="tc-seal-effects">
      <div><dt><i>♥</i> 최대 체력</dt><dd>+{percent(reward.hpPercent)}</dd></div>
      {selected==='association'&&<div><dt><i>⚔</i> 공격력</dt><dd>+{percent(reward.attackPercent)}</dd></div>}
      <div><dt><i>◆</i> 방어력</dt><dd>+{percent(reward.defensePercent)}</dd></div>
     </dl>
     {!completed&&<div className="tc-seal-next"><small>다음 강화 · {nextLevel}단계 <span className="tc-seal-milestone-label">다음 각인 {nextMilestone}단계</span></small>
      <b>HP +{percent(nextReward.hpPercent)} · {selected==='guardian'?'DEF':'ATK/DEF'} +{percent(nextReward.defensePercent)}</b></div>}
     <div className="tc-seal-meta"><span>누적 재주조 <b>{state?.resetCount??0}회</b></span><span>보유 Gold <b>{gold.toLocaleString()}</b></span></div>
    </aside>
   </div>
   <section className="tc-seal-prob" aria-label="주조 결과 확률">
    <header><span>주조 결과 확률</span><small>서버 독립 판정 · 하락/파괴 없음</small></header>
    <div>{ASSOCIATION_SEAL_PROBABILITIES.map((item,index)=><span className={'p'+item.step+(lastStep===item.step?' hit':'')} key={item.step}>
     <i>{index===0?'◇':index===1?'◆':'✦'}</i><b>+{item.step}</b><strong>{item.rate}%</strong>
    </span>)}</div>
   </section>
   <div className="tc-seal-actions">
    <button type="button" className="tc-seal-roll tc-feel-press" data-game-feel="press" disabled={!canRoll} onClick={()=>void roll()}>
     <span>{busy?'주조 중…':completed?'최고 단계 달성':rolls>=ASSOCIATION_SEAL_MAX_ROLLS?'20회 주조 완료':'인장 주조'}</span>
     <small>{ASSOCIATION_SEAL_ROLL_COST.toLocaleString()} Gold</small>
    </button>
    <button type="button" className="tc-seal-reset tc-feel-press" data-game-feel="press" title="언제든지 재주조할 수 있습니다." disabled={!canReset} onClick={()=>void reset()}>
     <span>재주조</span><small>{ASSOCIATION_SEAL_RESET_COST.toLocaleString()} Gold</small>
    </button>
   </div>

  </div>
 </Screen>;
}
