import React,{useMemo,useState} from 'react';
import type {Field,GameState,Potion,CraftJob} from '../../game/types';
import {CONFIG,EQUIPMENT,FIELDS,PASSIVES,POTION_CRAFTING,POTIONS,TOWERS,WEAPONS,potionIds} from '../../game/data/config';
import {itemName} from '../../game/engine/state';
import {
  GOLDEN_RECORDER_CRAFT_QUEUE_LIMIT,
  cancelCraft,
  claimAllCraft,
  claimCraft,
  cost,
  discount,
  materialFor,
  startCraft,
} from '../../game/engine/crafting';
import {getGoldenRecorderBenefits,isGoldenRecorderActive} from '../../game/premium/goldenRecorder';
import './workshop.css';

type Props={
  game:GameState;
  setGame:React.Dispatch<React.SetStateAction<GameState>>;
  now:number;
  onEnhancement:()=>void;
  onMastery:()=>void;
};

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const timeLeft=(ms:number)=>{const total=Math.max(0,Math.ceil(ms/1000)),m=Math.floor(total/60),s=total%60;return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;};
const clock=(n:number|null)=>n===null?'—':new Date(n).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});

function jobLabel(job:CraftJob){
  if(potionIds.includes(job.kind as Potion))return `${POTIONS[job.kind as Potion].name} 포션 ×${job.quantity}`;
  return itemName({id:'preview',kind:job.kind,tier:job.tier,enhancement:0});
}

function recipeDescription(kind:string,tier:number,field:Field){
  if(kind in WEAPONS)return WEAPONS[kind as keyof typeof WEAPONS].description;
  if(kind in PASSIVES)return PASSIVES[kind as keyof typeof PASSIVES].description;
  if(field==='alchemy')return POTIONS[kind as Potion].description;
  if(kind==='armor')return `최대 HP +${EQUIPMENT.armor.hp*tier} · 방어 +${EQUIPMENT.armor.defense*tier}`;
  return `최대 HP +${EQUIPMENT.boots.hp*tier} · 공격속도 +${(EQUIPMENT.boots.speed*tier).toFixed(1)}`;
}

function ActiveCraft({job,now,onCancel}:{job:CraftJob;now:number;onCancel:()=>void}){
  const started=job.startedAt??job.queuedAt,end=job.completesAt??started+job.durationMs;
  const progress=clamp((now-started)/Math.max(1,job.durationMs),0,1);
  return <section className="workshop-block workshop-active" aria-label="현재 제작">
    <div className="workshop-block-title"><div><small>ACTIVE WORK ORDER</small><h2>현재 제작</h2></div><span className="workshop-state live">작업 중</span></div>
    <div className="workshop-active-grid">
      <div className="workshop-item-mark" aria-hidden="true">⚒</div>
      <div className="workshop-active-copy"><strong>{jobLabel(job)}</strong><small>{FIELDS[job.field]} · T{job.tier} · {TOWERS[materialFor(job.field)].material} {job.consumedMaterials}개</small></div>
      <b className="workshop-countdown">{timeLeft(end-now)}</b>
    </div>
    <div className="workshop-progress" aria-label={`제작 진행률 ${Math.round(progress*100)}%`}><i style={{width:`${progress*100}%`}}/></div>
    <div className="workshop-timing"><span>완료 예정 <b>{clock(end)}</b></span><span>진행 <b>{Math.round(progress*100)}%</b></span></div>
    <button className="workshop-cancel" onClick={onCancel}>제작 취소</button>
  </section>;
}

function CraftQueue({jobs,active,now,onCancel}:{jobs:CraftJob[];active:CraftJob|null;now:number;onCancel:(job:CraftJob)=>void}){
  if(!jobs.length)return null;
  let cursor=active?.completesAt??now;
  return <section className="workshop-block workshop-queue">
    <div className="workshop-block-title"><div><small>QUEUED ORDERS</small><h2>제작 대기열</h2></div><span>{jobs.length} / {GOLDEN_RECORDER_CRAFT_QUEUE_LIMIT}</span></div>
    <div className="workshop-queue-list">{jobs.map((job,index)=>{
      const start=Math.max(now,cursor),end=start+job.durationMs;cursor=end;
      return <article key={job.jobId}>
        <b className="workshop-order-no">{String(index+1).padStart(2,'0')}</b>
        <div><strong>{jobLabel(job)}</strong><small>{FIELDS[job.field]} · 예상 시작 {timeLeft(start-now)} 후 · 완료 {clock(end)}</small></div>
        <button onClick={()=>onCancel(job)}>취소</button>
      </article>;
    })}</div>
  </section>;
}

function CompletedCrafts({jobs,onClaim,onClaimAll}:{jobs:CraftJob[];onClaim:(job:CraftJob)=>void;onClaimAll:()=>void}){
  if(!jobs.length)return null;
  return <section className="workshop-block workshop-completed">
    <div className="workshop-block-title"><div><small>READY FOR COLLECTION</small><h2>제작 완료</h2></div><span className="workshop-state ready">{jobs.length}개 수령 대기</span></div>
    <div className="workshop-completed-list">{jobs.map(job=><article key={job.jobId}>
      <span className="workshop-ready-mark" aria-hidden="true">✓</span>
      <div><strong>{jobLabel(job)}</strong><small>{FIELDS[job.field]} · T{job.tier}</small></div>
      <button className="primary" onClick={()=>onClaim(job)}>수령</button>
    </article>)}</div>
    {jobs.length>1&&<button className="workshop-claim-all" onClick={onClaimAll}>완료품 모두 수령</button>}
  </section>;
}

export function WorkshopScreen({game,setGame,now,onEnhancement,onMastery}:Props){
  const [field,setField]=useState<Field>('weapon'),[tier,setTier]=useState(1),[cancelTarget,setCancelTarget]=useState<CraftJob|null>(null);
  const goldenActive=isGoldenRecorderActive(game,now),golden=getGoldenRecorderBenefits(game,now);
  const active=game.crafting.jobs.find(job=>job.status==='CRAFTING')??null;
  const queued=game.crafting.jobs.filter(job=>job.status==='QUEUED').sort((a,b)=>a.queuedAt-b.queuedAt);
  const completed=game.crafting.jobs.filter(job=>job.status==='COMPLETED_UNCLAIMED');
  const recipes=useMemo(()=>field==='weapon'?Object.keys(WEAPONS):field==='armor'?['armor','boots']:field==='accessory'?Object.keys(PASSIVES):potionIds.filter(p=>p!=='revival'&&POTIONS[p].tier===tier),[field,tier]);
  const mastery=game.mastery[field],material=materialFor(field),materialName=TOWERS[material].material;
  const masteryDiscount=discount(mastery.crafts),totalDiscount=masteryDiscount+golden.craftingMaterialReductionBonus;
  const queueFull=goldenActive&&queued.length>=GOLDEN_RECORDER_CRAFT_QUEUE_LIMIT;

  return <section className="workshop-screen">
    <header className="screen-compact-header">
      <div><small>ASSOCIATION WORKSHOP / 05</small><h1>모험가의 공방</h1><p>원정에서 확보한 재료를 장비와 소모품으로 가공합니다.</p></div>
      <div className="workshop-header-actions"><button onClick={onEnhancement}>장비 강화</button><button onClick={onMastery}>숙련도</button></div>
    </header>

    {completed.length>0&&<CompletedCrafts jobs={completed} onClaim={job=>setGame(s=>claimCraft(s,job.jobId,Date.now()))} onClaimAll={()=>setGame(s=>claimAllCraft(s,Date.now()))}/>}
    {active&&<ActiveCraft job={active} now={now} onCancel={()=>setCancelTarget(active)}/>}
    <CraftQueue jobs={queued} active={active} now={now} onCancel={setCancelTarget}/>

    {!active&&completed.length===0&&<section className="workshop-idle">
      <span aria-hidden="true">⚒</span><div><strong>작업대가 비어 있습니다.</strong><small>제작 분야와 티어를 선택해 새 작업을 시작하세요.</small></div>
    </section>}

    <section className="workshop-catalog">
      <div className="workshop-field-tabs" role="tablist" aria-label="제작 분야">
        {(Object.keys(FIELDS) as Field[]).map(f=><button key={f} role="tab" aria-selected={field===f} onClick={()=>{setField(f);setTier(1);}}>
          <span aria-hidden="true">{f==='weapon'?'⚔':f==='armor'?'⬡':f==='accessory'?'◇':'⚗'}</span>{FIELDS[f].replace(' 제작','')}
        </button>)}
      </div>

      <div className="workshop-tier-strip" aria-label="제작 티어">
        {[1,2,3,4,5].map(t=><button key={t} className={tier===t?'selected':''} disabled={t>mastery.unlocked} onClick={()=>setTier(t)}><b>T{t}</b><small>{t>mastery.unlocked?'잠김':t===mastery.unlocked&&t<5?'현재':'해금'}</small></button>)}
      </div>

      <section className="workshop-ledger">
        <div className="workshop-ledger-main"><small>{materialName} 보유</small><strong>{game.materials[material][tier-1].toLocaleString()}개</strong></div>
        <div><small>제작 숙련</small><strong>{mastery.unlocked<5?`${mastery.progress} / ${CONFIG.masteryRequired}`:'MAX'}</strong></div>
        <div><small>재료 절감</small><strong>{Math.round(totalDiscount*100)}%</strong></div>
      </section>

      <div className="workshop-mastery-track">
        <div><span>{FIELDS[field]} · T{mastery.unlocked} 자격</span><b>총 제작 {mastery.crafts}회</b></div>
        <div className="workshop-progress"><i style={{width:`${mastery.unlocked===5?100:mastery.progress/CONFIG.masteryRequired*100}%`}}/></div>
        <small>{mastery.unlocked<5?`현재 최고 티어 T${mastery.unlocked} 제작만 T${mastery.unlocked+1} 자격 진척도를 올립니다.`:'모든 제작 티어가 해금되었습니다.'}</small>
      </div>

      {goldenActive&&<div className="workshop-premium-note"><b>황금기록자 적용 중</b><span>재료 추가 절감 {Math.round(golden.craftingMaterialReductionBonus*100)}% · 제작 대기열 {queued.length}/{GOLDEN_RECORDER_CRAFT_QUEUE_LIMIT}</span></div>}
      {!!game.expedition&&<div className="workshop-expedition-lock">원정 진행 중 · 안전 귀환 후 새 제작을 시작할 수 있습니다.</div>}
      {!goldenActive&&active&&<div className="workshop-queue-lock">현재 제작이 완료된 후 새 작업을 시작할 수 있습니다.</div>}
      {queueFull&&<div className="workshop-queue-lock">제작 대기열이 가득 찼습니다.</div>}

      <div className="workshop-recipe-list">{recipes.map(kind=>{
        const amount=cost(game,field,tier,now),owned=game.materials[material][tier-1],potion=field==='alchemy';
        const title=potion?`${POTIONS[kind as Potion].name} 포션 ×${POTION_CRAFTING.generalBatch}`:itemName({id:'preview',kind,tier,enhancement:0});
        const blocked=!!game.expedition||tier>mastery.unlocked||owned<amount||(!goldenActive&&!!active)||queueFull;
        return <article className={'workshop-recipe '+(owned<amount?'insufficient':'')} key={kind}>
          <div className="workshop-recipe-icon" aria-hidden="true">{potion?'⚗':kind in WEAPONS?'⚔':kind in PASSIVES?'◇':'⬡'}</div>
          <div className="workshop-recipe-copy"><small>T{tier} · {FIELDS[field]}</small><h2>{title}</h2><p>{recipeDescription(kind,tier,field)}</p>
            <div className="workshop-material-line"><span>{materialName}</span><b>보유 {owned} / 필요 {amount}</b>{owned<amount&&<em>재료 부족</em>}</div>
          </div>
          <button className="workshop-craft-button" disabled={blocked} onClick={()=>setGame(s=>startCraft(s,kind,tier,potion?POTION_CRAFTING.generalBatch:1,Date.now()))}>{active&&goldenActive?'대기열 추가':'제작 시작'}</button>
        </article>;
      })}</div>
    </section>

    {cancelTarget&&<div className="workshop-modal" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="craft-cancel-title">
      <small>WORK ORDER CANCELLATION</small><h2 id="craft-cancel-title">제작을 취소하시겠습니까?</h2><strong>{jobLabel(cancelTarget)}</strong>
      <div className="workshop-refund"><span>반환 예정</span><b>{TOWERS[materialFor(cancelTarget.field)].material} ×{cancelTarget.consumedMaterials}</b></div>
      <p>현재 규칙에서는 제작 진행도와 관계없이 소비한 제작 자원이 반환됩니다.</p>
      <div><button onClick={()=>setCancelTarget(null)}>계속 제작</button><button className="danger-button" onClick={()=>{setGame(s=>cancelCraft(s,cancelTarget.jobId,Date.now()));setCancelTarget(null);}}>제작 취소</button></div>
    </section></div>}
  </section>;
}
