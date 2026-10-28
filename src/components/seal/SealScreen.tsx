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
import {SealSpriteIcon} from './SealSprite';
import {SealArtwork} from './SealArtwork';
import './seal-relic.css';
import './seal-reference.css';

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
 const [rollCount,setRollCount]=useState(1);
 const [litNode,setLitNode]=useState<number|null>(null);
 const [visualMode,setVisualMode]=useState<'idle'|'forge'|'reset'>('idle');
 const [visualSequence,setVisualSequence]=useState(0);
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
 const remainingRolls=Math.max(0,ASSOCIATION_SEAL_MAX_ROLLS-rolls);
 const affordableRolls=Math.floor(gold/ASSOCIATION_SEAL_ROLL_COST);
 const maxSelectableRolls=Math.max(1,Math.min(remainingRolls,affordableRolls));
 const selectedRolls=Math.min(rollCount,maxSelectableRolls);
 const canRoll=!!onlineLease&&!!state&&!busy&&!game.expedition&&!completed&&remainingRolls>0&&affordableRolls>0;
 const canReset=!!onlineLease&&!!state&&!busy&&!game.expedition&&!completed&&gold>=ASSOCIATION_SEAL_RESET_COST;
 const activeNodes=Math.floor(level/5);
 const sealName=SEALS.find(item=>item.id===selected)!.name;

 function switchSeal(id:AssociationSealId){
  if(busy||selected===id)return;
  setSelected(id);setLastStep(null);setLitNode(null);setMessage('');setRollCount(1);
  setVisualMode('idle');setVisualSequence(value=>value+1);
 }

 async function roll(){
  if(!onlineLease||!canRoll)return;
  const sealId=selected;
  const beginningLevel=level;
  let processed=0;
  let finalLevel=level;
  let lastResultStep:1|2|3=1;
  feel.play('seal.roll.start');
  setBusy(true);setMessage('');setLastStep(null);setLitNode(null);
  try{
   // There is no bulk RPC. Each forge is a distinct authoritative server action.
   for(let index=0;index<selectedRolls;index++){
    const result=await rollOnlineSeal(onlineLease,sealId);
    processed++;
    finalLevel=result.afterLevel;
    lastResultStep=result.step;
    setSeals(previous=>({
     ...previous,
     [sealId]:result.state,
     [sealId==='association'?'guardian':'association']:previous[sealId==='association'?'guardian':'association']
       ?{...previous[sealId==='association'?'guardian':'association']!,gold:result.state.gold}:undefined,
    }));
    const beforeNodes=Math.floor(result.beforeLevel/5);
    const afterNodes=Math.floor(result.afterLevel/5);
    setLitNode(afterNodes>beforeNodes?afterNodes-1:null);
    if(onServerRecord)onServerRecord(result.record,'협회 인장 주조 결과를 서버에 저장했습니다.');
    else setGame(result.record.payload);
    if(result.afterLevel>=ASSOCIATION_SEAL_MAX_LEVEL)break;
   }
   setLastStep(lastResultStep);
   setVisualMode('forge');setVisualSequence(value=>value+1);
   feel.play('seal.roll.result',{step:lastResultStep});
   setMessage(finalLevel>=ASSOCIATION_SEAL_MAX_LEVEL
    ?sealName+' 최고 30단계 완성 · '+processed+'회 주조'
    :sealName+' · '+processed+'회 주조 · '+beginningLevel+' → '+finalLevel+'단계');
  }catch(error){
   feel.play('ui.error');
   const reason=error instanceof Error?error.message:'인장 주조에 실패했습니다.';
   setMessage(processed>0?processed+'회 완료 후 중단 · '+reason:reason);
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
   if(!result.replayed){
    setVisualMode('reset');setVisualSequence(value=>value+1);
    feel.play('seal.reset');
   }
   setMessage(sealName+' 재주조 완료 · 누적 '+result.state.resetCount+'회');
   if(onServerRecord)onServerRecord(result.record,'협회 인장 재주조를 서버에 저장했습니다.');
   else setGame(result.record.payload);
  }catch(error){
   feel.play('ui.error');
   setMessage(error instanceof Error?error.message:'협회 인장 재주조에 실패했습니다.');
  }finally{setBusy(false);}
 }

 if(!onlineLease)return <Screen className="tc-seal-reference-screen" eyebrow="NOVAR ASSOCIATION" title="협회 인장" meta={<span>SERVER ONLY</span>}>
  <div className="tc-insignia-locked">
   <SealSpriteIcon variant="sealed-3" className="tc-insignia-lock-art"/>
   <h2>봉인된 각인의 서</h2>
   <p>협회 인장은 서버에 저장됩니다. Google 계정으로 로그인하고 활성 플레이 세션을 시작해야 주조할 수 있습니다.</p>
   <small>주조 {ASSOCIATION_SEAL_ROLL_COST.toLocaleString()} G · 재주조 {ASSOCIATION_SEAL_RESET_COST.toLocaleString()} G</small>
  </div>
 </Screen>;

 return <Screen className="tc-seal-reference-screen" eyebrow="NOVAR ASSOCIATION" title="협회 인장" meta={<span className="tc-seal-wallet">GOLD <b>{gold.toLocaleString()}</b></span>}>
  <div className="tc-insignia-board" data-seal={selected}>
   <nav className="tc-insignia-tabs" aria-label="인장 선택">
    {SEALS.map(item=><button key={item.id} type="button" className="tc-insignia-tab"
      data-active={selected===item.id} aria-pressed={selected===item.id}
      aria-label={item.name+' 선택'} onClick={()=>switchSeal(item.id)} disabled={busy||!seals[item.id]}>
      <span className="tc-insignia-tab-icon"><SealSpriteIcon variant={item.id} level={seals[item.id]?.level??0}/></span>
      <b>{item.name}</b><small>{seals[item.id]?.level??'–'} / 30</small>
     </button>)}
    {SEALED_SLOT_NUMBERS.map(n=><div className="tc-insignia-tab is-sealed" key={n} aria-label={'제'+n+'의 봉인된 인장'}>
      <span className="tc-insignia-tab-icon"><SealSpriteIcon variant={n===3?'sealed-3':'sealed-4'}/></span>
      <b>봉인된 인장</b><small>제{n}인장</small>
     </div>)}
   </nav>

   <section className="tc-insignia-main" aria-label={sealName+' 각인 상태'}>
    <div className="tc-insignia-main-body">
     <div className="tc-insignia-relic" data-result={lastStep!==null}
       style={{'--relic-progress':(level/ASSOCIATION_SEAL_MAX_LEVEL*100)+'%'} as React.CSSProperties}
       aria-label={sealName+' '+level+'단계'}>
      <SealArtwork variant={selected} level={level} mode={visualMode} sequence={visualSequence}/>
     </div>
     <div className="tc-insignia-readout">
      <small className="tc-insignia-kicker">현재 단계</small>
      <h2>{sealName}</h2>
      <div className="tc-insignia-level" aria-label={'현재 '+level+'단계 / 최대 30단계'}>
       <strong>{String(level).padStart(2,'0')}</strong><span>/ 30</span>
      </div>
      <div className="tc-insignia-uses">주조 {rolls} / {ASSOCIATION_SEAL_MAX_ROLLS}회</div>
     </div>
    </div>
    <p className="tc-insignia-status" role="status" aria-live="polite" title={message||undefined}>
     {message||(game.expedition?'원정 중에는 주조할 수 없습니다.':completed?'최고 단계 각인 완료':'다음 각인 '+nextMilestone+'단계 · HP +'+percent(nextReward.hpPercent))}
    </p>
    <div className="tc-insignia-milestones" aria-label="각인 이정표">
     {SEAL_MILESTONES.map((milestone,index)=><div className="tc-insignia-milestone"
       data-lit={index<activeNodes} data-new={litNode===index} key={milestone}
       aria-label={milestone+'단계 '+(milestone<=level?'달성':'미달성')}>
       <span aria-hidden="true"><SealSpriteIcon milestone={milestone} active={index<activeNodes}/></span><b>{String(milestone).padStart(2,'0')}</b>
      </div>)}
    </div>
   </section>

   <section className="tc-insignia-stats" data-columns={selected==='guardian'?'2':'3'} aria-label={sealName+' 적용 능력치'}>
    <div className="tc-insignia-stat"><small>최대 체력</small><b>+{percent(reward.hpPercent)}</b></div>
    {selected==='association'&&<div className="tc-insignia-stat"><small>공격력</small><b>+{percent(reward.attackPercent)}</b></div>}
    <div className="tc-insignia-stat"><small>방어력</small><b>+{percent(reward.defensePercent)}</b></div>
   </section>

   <section className="tc-insignia-probability" aria-label="주조 결과 확률">
    <header><strong>주조 결과 확률</strong><small>하락 · 파괴 없음</small></header>
    <div className="tc-insignia-rates">
     {ASSOCIATION_SEAL_PROBABILITIES.map(item=><div className="tc-insignia-rate"
       data-hit={lastStep===item.step} key={item.step}><b>+{item.step}</b><strong>{item.rate}%</strong></div>)}
    </div>
   </section>

   <div className="tc-insignia-controls">
    <div className="tc-insignia-quantity" aria-label="주조 횟수 선택">
     <div className="tc-insignia-quantity-caption"><strong>주조 횟수</strong><small>잔여 {remainingRolls} / {ASSOCIATION_SEAL_MAX_ROLLS}</small></div>
     <div className="tc-insignia-stepper">
      <button type="button" aria-label="주조 횟수 1 감소" disabled={busy||selectedRolls<=1}
       onClick={()=>setRollCount(value=>Math.max(1,value-1))}>−</button>
      <output aria-live="polite">{selectedRolls}</output>
      <button type="button" aria-label="주조 횟수 1 증가"
       disabled={busy||selectedRolls>=maxSelectableRolls||!canRoll}
       onClick={()=>setRollCount(value=>Math.min(maxSelectableRolls,value+1))}>+</button>
     </div>
     <div className="tc-insignia-presets">
      {[1,10,20].map(count=><button key={count} type="button"
       aria-pressed={selectedRolls===Math.min(count,maxSelectableRolls)} disabled={busy||!canRoll}
       onClick={()=>setRollCount(Math.min(count,maxSelectableRolls))}>{count}</button>)}
     </div>
     <select className="tc-insignia-quick-count" aria-label="빠른 주조 횟수 선택"
      value={selectedRolls} disabled={busy||!canRoll}
      onChange={event=>setRollCount(Math.min(Number(event.target.value),maxSelectableRolls))}>
      {!([1,10,20].includes(selectedRolls))&&<option value={selectedRolls}>{selectedRolls}회</option>}
      {[1,10,20].map(count=><option key={count} value={count}>{count}회</option>)}
     </select>
    </div>
    <div className="tc-insignia-actions">
     <button type="button" className="tc-insignia-roll tc-seal-roll tc-feel-press" data-game-feel="press"
      disabled={!canRoll} onClick={()=>void roll()}>
      <b>{busy?'주조 중…':completed?'각인 완성':rolls>=ASSOCIATION_SEAL_MAX_ROLLS?'20회 소진':'인장 주조'}</b>
      <small>{(selectedRolls*ASSOCIATION_SEAL_ROLL_COST).toLocaleString()} Gold · {selectedRolls}회</small>
     </button>
     <button type="button" className="tc-insignia-reset tc-seal-reset tc-feel-press" data-game-feel="press"
      title="언제든지 재주조할 수 있습니다." disabled={!canReset} onClick={()=>void reset()}>
      <b>재주조</b><small>{ASSOCIATION_SEAL_RESET_COST.toLocaleString()} Gold</small>
     </button>
    </div>
   </div>
  </div>
 </Screen>;
}
