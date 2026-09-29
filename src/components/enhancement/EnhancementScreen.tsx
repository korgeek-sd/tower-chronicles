import React,{useEffect,useMemo,useRef,useState} from 'react';
import type {EquipmentItem,GameState} from '../../game/types';
import {enhanceEquipmentV2} from '../../game/engine/equipmentEnhancementV2';
import {
 EQUIPMENT_DEFINITIONS,
 EQUIPMENT_GRADES,
 EQUIPMENT_GRADE_NAMES,
 equipmentItemName,
 equipmentItemSlot,
} from '../../game/data/equipment';
import {equipmentEnhancementAttemptView,equipmentEnhancementPreviewRows} from './presentation';
import {marketItemIdForEquipment} from '../../game/market/marketService';
import type {MarketIntent} from '../market/marketNavigation';
import {Glyph,Pager,Screen} from '../../ui/mobile';
import type {GameplayLease} from '../../online/gameSession';
import {enhanceOnlineEquipment,type ServerEnhancementOutcome} from '../../online/economy';
import {useGameFeel} from '../../gameFeel/react/useGameFeel';
import type {EnhancementFeelOutcome} from '../../gameFeel/types';

const PAGE_SIZE=5;
const pct=(n:number)=>Math.round(n*1000)/10+'%';
const signed=(current:string,next:string)=>{
 const a=Number(current),b=Number(next);
 if(!Number.isFinite(a)||!Number.isFinite(b))return '';
 const d=Math.round((b-a)*10)/10;
 return d>0?'+'+d:d===0?'0':String(d);
};
const feelOutcome=(outcome:ServerEnhancementOutcome):EnhancementFeelOutcome=>outcome==='FAIL_DESTROYED'?'FAIL_DESTROY':outcome;

function iconFor(item:EquipmentItem){
 const definition=EQUIPMENT_DEFINITIONS[item.kind];
 if('weaponFamily' in definition&&definition.weaponFamily)return definition.weaponFamily;
 const slot=equipmentItemSlot(item);
 return slot==='helmet'||slot==='armor'||slot==='gloves'?'armor':
  slot==='boots'?'boots':
  slot==='necklace'||slot==='ring'?'accessory':slot;
}

export function EnhancementScreen({
 game,setGame,onlineLease,onBack,initialSelectedId,onInitialSelectedConsumed,onMarket,
}:{
 game:GameState;
 setGame:React.Dispatch<React.SetStateAction<GameState>>;
 onlineLease?:GameplayLease|null;
 onBack:()=>void;
 initialSelectedId?:string|null;
 onInitialSelectedConsumed?:()=>void;
 onMarket?:(intent:MarketIntent)=>void;
}){
 const feel=useGameFeel();
 const [enhanceFx,setEnhanceFx]=useState<'attempt'|'success'|'keep'|'downgrade'|'destroy'|null>(null);
 const enhanceFxTimer=useRef<number|null>(null);
 const triggerEnhanceFx=(kind:'attempt'|'success'|'keep'|'downgrade'|'destroy')=>{
  if(enhanceFxTimer.current!==null)window.clearTimeout(enhanceFxTimer.current);
  setEnhanceFx(kind);
  enhanceFxTimer.current=window.setTimeout(()=>{setEnhanceFx(null);enhanceFxTimer.current=null;},kind==='destroy'?760:560);
 };
 useEffect(()=>()=>{if(enhanceFxTimer.current!==null)window.clearTimeout(enhanceFxTimer.current);},[]);

 const [selectedId,setSelectedId]=useState<string|null>(null),[confirm,setConfirm]=useState(false),[page,setPage]=useState(0),[busy,setBusy]=useState(false);
 const items=useMemo(()=>game.equipmentItems.slice().sort((a,b)=>
  Number(Object.values(game.equipped).includes(b.id))-Number(Object.values(game.equipped).includes(a.id))||
  EQUIPMENT_GRADES.indexOf(b.grade)-EQUIPMENT_GRADES.indexOf(a.grade)||
  b.enhancement-a.enhancement||
  equipmentItemName(a).localeCompare(equipmentItemName(b),'ko')
 ),[game.equipmentItems,game.equipped]);
 const pages=Math.max(1,Math.ceil(items.length/PAGE_SIZE)),safe=Math.min(page,pages-1),shown=items.slice(safe*PAGE_SIZE,safe*PAGE_SIZE+PAGE_SIZE),selected=items.find(i=>i.id===selectedId)??shown[0]??null;

 useEffect(()=>{
  if(!initialSelectedId)return;
  const index=items.findIndex(item=>item.id===initialSelectedId);
  if(index>=0){setSelectedId(initialSelectedId);setPage(Math.floor(index/PAGE_SIZE));}
  onInitialSelectedConsumed?.();
 },[initialSelectedId]);
 useEffect(()=>{if(selectedId&&!game.equipmentItems.some(item=>item.id===selectedId)){setSelectedId(null);setConfirm(false);}},[game.equipmentItems,selectedId]);

 const view=selected?equipmentEnhancementAttemptView(game,selected):null,q=view?.quote??null,rows=selected?equipmentEnhancementPreviewRows(selected):[];
 const marketId=selected?marketItemIdForEquipment(selected):null;
 const isEquipped=!!selected&&Object.values(game.equipped).includes(selected.id);
 const riskLevel=!q?'none':q.failDestroyRate>0?'destroy':q.failDowngradeRate>0?'downgrade':'safe';
 const enhanceNotice=(outcome:ServerEnhancementOutcome,name:string)=>outcome==='SUCCESS'?'강화 성공! '+name:outcome==='FAIL_KEEP'?'강화 실패. '+name+'의 강화 단계가 유지됩니다.':outcome==='FAIL_DOWNGRADE'?'강화 실패. '+name+'의 강화 단계가 하락했습니다.':'강화 실패. '+name+' 장비가 파괴되었습니다.';

 const openMarket=()=>{
  if(!selected||!marketId||!onMarket)return;
  onMarket({itemId:marketId,enhancementItemId:selected.id,sourceName:equipmentItemName(selected)});
 };

 const confirmEnhancement=async()=>{
  if(!selected||!q||!view?.canAttempt)return;
  feel.play('enhancement.attempt');
  triggerEnhanceFx('attempt');
  if(!onlineLease){
   setGame(current=>{
    const before=current.equipmentItems.find(item=>item.id===selected.id);
    const next=enhanceEquipmentV2(current,selected.id);
    const after=next.equipmentItems.find(item=>item.id===selected.id);
    const outcome:ServerEnhancementOutcome=!after?'FAIL_DESTROYED':!before?'FAIL_KEEP':after.enhancement>before.enhancement?'SUCCESS':after.enhancement<before.enhancement?'FAIL_DOWNGRADE':'FAIL_KEEP';
    const mapped=feelOutcome(outcome);
    feel.play('enhancement.result',{outcome:mapped});
    triggerEnhanceFx(mapped==='SUCCESS'?'success':mapped==='FAIL_KEEP'?'keep':mapped==='FAIL_DOWNGRADE'?'downgrade':'destroy');
    return next;
   });
   setConfirm(false);
   return;
  }

  setBusy(true);
  try{
   const result=await enhanceOnlineEquipment(onlineLease,selected.id);
   const after=result.record.payload.equipmentItems.find(item=>item.id===selected.id);
   const displayName=after?equipmentItemName(after):equipmentItemName(selected);
   setGame({...result.record.payload,notice:enhanceNotice(result.outcome,displayName)});
   const mapped=feelOutcome(result.outcome);
   feel.play('enhancement.result',{outcome:feelOutcome(result.outcome)});
   triggerEnhanceFx(mapped==='SUCCESS'?'success':mapped==='FAIL_KEEP'?'keep':mapped==='FAIL_DOWNGRADE'?'downgrade':'destroy');
   setConfirm(false);
  }catch(error){
   feel.play('ui.error');
   setGame(s=>({...s,notice:error instanceof Error?error.message:'서버 강화 요청에 실패했습니다.'}));
   setConfirm(false);
  }finally{setBusy(false);}
 };

 return <Screen eyebrow="NOVAR FORGE / ENHANCEMENT" title="장비 강화" meta={<button className="tc-action secondary slim tc-forge-back" onClick={onBack}>‹ 보관함</button>} className="tc-enhancement-screen">
  <div className="tc-forge">
   <aside className="tc-forge-rail" aria-label="강화 장비 목록">
    <header><div><small>FORGE INVENTORY</small><b>강화 대상</b></div><span>{items.length}종</span></header>
    <div className="tc-forge-list">{shown.map(item=>{
     const equipped=Object.values(game.equipped).includes(item.id);
     return <button key={item.id} className={'tc-forge-item grade-'+item.grade} aria-pressed={selected?.id===item.id} onClick={()=>{setSelectedId(item.id);setConfirm(false);}}>
      <span className="tc-forge-item-icon"><Glyph name={iconFor(item)}/></span>
      <span className="tc-forge-item-copy"><b>{EQUIPMENT_DEFINITIONS[item.kind].name}</b><small>{EQUIPMENT_GRADE_NAMES[item.grade]} · +{item.enhancement}{equipped?' · 장착':''}</small></span>
      <strong>+{item.enhancement}</strong>
     </button>;
    })}{Array.from({length:Math.max(0,PAGE_SIZE-shown.length)},(_,i)=><div className="tc-forge-item empty" key={'forge-empty-'+i}/>)}</div>
    <Pager page={safe} count={pages} onChange={p=>{setPage(p);setSelectedId(null);setConfirm(false);}}/>
   </aside>

   <section className={'tc-forge-workbench '+(enhanceFx?'tc-enhance-feel-'+enhanceFx:'')}>
    {selected&&view?<>
     <header className="tc-forge-title">
      <div><small>ENHANCEMENT RECORD</small><b>{EQUIPMENT_DEFINITIONS[selected.kind].name}</b><span>{EQUIPMENT_GRADE_NAMES[selected.grade]}{isEquipped?' · 현재 장착':''}</span></div>
      <span className={'tc-forge-grade grade-'+selected.grade}>{EQUIPMENT_GRADE_NAMES[selected.grade]}</span>
     </header>

     <div className="tc-forge-focus">
      <div className={'tc-forge-sigil grade-'+selected.grade}><Glyph name={iconFor(selected)}/><span>+{selected.enhancement}</span></div>
      <div className="tc-forge-level">
       <small>강화 단계</small>
       <div><b>+{q?.current??selected.enhancement}</b>{q?<><i>→</i><strong>+{q.target}</strong></>:<em>MAX</em>}</div>
       <p>{q?'성공하면 동일 장비의 다음 강화 단계로 상승합니다.':'현재 장비는 더 이상 강화할 수 없습니다.'}</p>
      </div>
     </div>

     <div className="tc-forge-stats">
      <div className="tc-forge-stat-head"><span>능력치</span><span>현재</span><span>성공 시</span><span>변화</span></div>
      {rows.slice(0,3).map(r=><div className="tc-forge-stat-row" key={r.label}><span>{r.label}</span><b>{r.current}</b><strong>{r.next}</strong><em>{signed(r.current,r.next)}</em></div>)}
      {!rows.length&&<div className="tc-forge-stat-empty">{selected.enhancement>=10?'최대 강화 단계입니다.':'변화하는 기본 능력치가 없습니다.'}</div>}
     </div>

     {q?<>
      <div className={'tc-forge-risk risk-'+riskLevel}>
       <div className="tc-forge-risk-head"><span><small>ENHANCEMENT ODDS</small><b>강화 결과 확률</b></span><em>{riskLevel==='destroy'?'파괴 위험':riskLevel==='downgrade'?'하락 위험':'안전 구간'}</em></div>
       <div className="tc-forge-rates" aria-label="강화 결과 확률">
        <span className="success"><small>성공</small><b>{pct(q.successRate)}</b></span>
        <span className="keep"><small>유지</small><b>{pct(q.failKeepRate)}</b></span>
        <span className="downgrade"><small>하락</small><b>{pct(q.failDowngradeRate)}</b></span>
        <span className="destroy"><small>파괴</small><b>{pct(q.failDestroyRate)}</b></span>
       </div>
      </div>

      <div className="tc-forge-costs">
       <div className={game.silver>=q.silverCost?'enough':'short'}><Glyph name="market"/><span><small>Silver</small><b>{q.silverCost.toLocaleString()} S</b><em>보유 {game.silver.toLocaleString()} S</em></span></div>
       <div className={view.materialOwned>=q.stoneCost?'enough':'short'}><Glyph name="materials"/><span><small>강화석</small><b>{q.stoneCost}개</b><em>보유 {view.materialOwned.toLocaleString()}개</em></span></div>
      </div>

      <div className="tc-forge-actions">
       <button className="tc-forge-market tc-feel-press" data-game-feel="press" disabled={!marketId||!onMarket} onClick={openMarket}>시세 · 거래</button>
       <button className="tc-forge-submit tc-feel-press" data-game-feel="press" disabled={!view.canAttempt||busy} onClick={()=>setConfirm(true)}><small>비용 확인 완료</small><b>+{q.target} 강화 실행</b></button>
      </div>
      {view.reason&&<div className="tc-forge-reason">{view.reason}</div>}
     </>:<div className="tc-forge-max"><Glyph name="enhancement"/><b>+10 MAX</b><span>최대 강화 단계에 도달했습니다.</span>{marketId&&onMarket&&<button onClick={openMarket}>시세 · 거래</button>}</div>}
    </>:<div className="tc-forge-empty"><Glyph name="enhancement"/><b>강화할 장비가 없습니다.</b><small>원정에서 장비를 획득한 뒤 다시 확인하세요.</small></div>}
   </section>

   <div className="tc-forge-footnote"><b>강화 주의</b><span>Silver와 강화석은 결과와 관계없이 소모됩니다. 파괴 결과가 나오면 해당 장비는 영구 삭제됩니다.</span></div>
  </div>

  {confirm&&selected&&q&&view&&<div className="tc-modalback" onClick={()=>setConfirm(false)}><section className="tc-modal tc-forge-confirm" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}>
   <header><span className={'tc-forge-confirm-icon grade-'+selected.grade}><Glyph name={iconFor(selected)}/></span><div><small>FINAL CONFIRMATION</small><h2>강화 진행 확인</h2><b>{EQUIPMENT_GRADE_NAMES[selected.grade]} {EQUIPMENT_DEFINITIONS[selected.kind].name}</b></div></header>
   <div className="tc-forge-confirm-step"><span>+{q.current}</span><i>→</i><strong>+{q.target}</strong></div>
   <div className="tc-forge-confirm-cost"><span><small>Silver</small><b>{q.silverCost.toLocaleString()} S</b></span><span><small>강화석</small><b>{q.stoneCost}개</b></span></div>
   <div className="tc-forge-rates compact"><span className="success"><small>성공</small><b>{pct(q.successRate)}</b></span><span className="keep"><small>유지</small><b>{pct(q.failKeepRate)}</b></span><span className="downgrade"><small>하락</small><b>{pct(q.failDowngradeRate)}</b></span><span className="destroy"><small>파괴</small><b>{pct(q.failDestroyRate)}</b></span></div>
   {q.failDestroyRate>0&&<div className="tc-forge-confirm-danger"><b>파괴 가능성 {pct(q.failDestroyRate)}</b><span>파괴된 장비는 복구할 수 없습니다.</span></div>}
   <div className="tc-modal-actions"><button className="tc-action secondary" onClick={()=>setConfirm(false)}>취소</button><button className="tc-action danger tc-feel-press" data-game-feel="press" disabled={!view.canAttempt||busy} onClick={()=>void confirmEnhancement()}>{busy?'서버 판정 중':'강화 진행'}</button></div>
  </section></div>}
 </Screen>;
}
