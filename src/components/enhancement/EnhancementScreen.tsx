import React,{useEffect,useMemo,useRef,useState} from 'react';
import type {EquipmentItem,GameState} from '../../game/types';
import {enhanceEquipmentV2} from '../../game/engine/equipmentEnhancementV2';
import {
 EQUIPMENT_DEFINITIONS,
 EQUIPMENT_GRADES,
 equipmentItemName,
 equipmentItemSlot,
} from '../../game/data/equipment';
import {equipmentEnhancementAttemptView,equipmentEnhancementPreviewRows} from './presentation';
import {Glyph,Pager,Screen} from '../../ui/mobile';
import type {GameplayLease} from '../../online/gameSession';
import {enhanceOnlineEquipment,type ServerEnhancementOutcome} from '../../online/economy';
import {useGameFeel} from '../../gameFeel/react/useGameFeel';
import type {EnhancementFeelOutcome} from '../../gameFeel/types';

const PAGE_SIZE=5;
const pct=(n:number)=>Math.round(n*1000)/10+'%';
const feelOutcome=(outcome:ServerEnhancementOutcome):EnhancementFeelOutcome=>outcome==='FAIL_DESTROYED'?'FAIL_DESTROY':outcome;

function iconFor(item:EquipmentItem){
 const definition=EQUIPMENT_DEFINITIONS[item.kind];
 if(definition.weaponFamily)return definition.weaponFamily;
 const slot=equipmentItemSlot(item);
 return slot==='helmet'||slot==='armor'||slot==='gloves'?'armor':
  slot==='boots'?'boots':
  slot==='necklace'||slot==='ring'?'accessory':slot;
}

export function EnhancementScreen({game,setGame,onlineLease,onBack}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;onlineLease?:GameplayLease|null;onBack:()=>void}){
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
 useEffect(()=>{if(selectedId&&!game.equipmentItems.some(item=>item.id===selectedId)){setSelectedId(null);setConfirm(false);}},[game.equipmentItems,selectedId]);

 const view=selected?equipmentEnhancementAttemptView(game,selected):null,q=view?.quote??null,rows=selected?equipmentEnhancementPreviewRows(selected):[];
 const enhanceNotice=(outcome:ServerEnhancementOutcome,name:string)=>outcome==='SUCCESS'?'강화 성공! '+name:outcome==='FAIL_KEEP'?'강화 실패. '+name+'의 강화 단계가 유지됩니다.':outcome==='FAIL_DOWNGRADE'?'강화 실패. '+name+'의 강화 단계가 하락했습니다.':'강화 실패. '+name+' 장비가 파괴되었습니다.';

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

 return <Screen eyebrow="WORKSHOP / ENHANCEMENT" title="장비 강화" meta={<button className="tc-action secondary slim" onClick={onBack}>제작으로</button>}>
  <div className="tc-enhance">
   <div className="tc-enhance-body">
    <div className="tc-enhance-list">{shown.map(item=><button key={item.id} className="tc-enhance-item" aria-pressed={selected?.id===item.id} onClick={()=>setSelectedId(item.id)}><Glyph name={iconFor(item)}/><b>{equipmentItemName(item)}</b><small>{item.grade==='common'?'일반':item.grade==='uncommon'?'고급':item.grade==='rare'?'희귀':item.grade==='heroic'?'영웅':'전설'} · +{item.enhancement}{Object.values(game.equipped).includes(item.id)?' · 장착':''}</small></button>)}{Array.from({length:Math.max(0,PAGE_SIZE-shown.length)},(_,i)=><div className="tc-enhance-item" key={'e'+i}/>)}</div>
    <section className={'tc-enhance-preview '+(enhanceFx?'tc-enhance-feel-'+enhanceFx:'')}>{selected&&view?<><div className="tc-panel-title"><h2>{equipmentItemName(selected)}</h2><small>{q?('+'+q.current+' → +'+q.target):'강화 불가'}</small></div><div>{rows.slice(0,3).map(r=><div className="tc-order-total" key={r.label}><span>{r.label}</span><b>{r.current} → {r.next}</b></div>)}</div>{q&&<><div className="tc-rates"><span>성공<b>{pct(q.successRate)}</b></span><span>유지<b>{pct(q.failKeepRate)}</b></span><span>하락<b>{pct(q.failDowngradeRate)}</b></span><span className="destroy">파괴<b>{pct(q.failDestroyRate)}</b></span></div><div className="tc-costs"><div><small>Silver</small><b>{q.silverCost.toLocaleString()} S</b></div><div><small>강화석</small><b>{q.stoneCost}개 <i>/ {view.materialOwned.toLocaleString()}개 보유</i></b></div></div>{q.failDestroyRate>0?<div className="tc-enhance-warning">파괴 결과가 나오면 장비가 영구 삭제됩니다.</div>:<span/>}{view.reason&&<div className="tc-enhance-warning">{view.reason}</div>}<button className="tc-action tc-feel-press" data-game-feel="press" disabled={!view.canAttempt||busy} onClick={()=>setConfirm(true)}>+{q.target} 강화 시도</button></>}</>:<p>강화할 장비가 없습니다.</p>}</section>
   </div>
   <Pager page={safe} count={pages} onChange={setPage}/>
   <div className="tc-floor-risk">강화는 Silver와 강화석을 함께 소모하며, 실패해도 비용은 반환되지 않습니다.</div>
  </div>
  {confirm&&selected&&q&&view&&<div className="tc-modalback" onClick={()=>setConfirm(false)}><section className="tc-modal" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><h2>강화 진행 확인</h2><p><b>{equipmentItemName(selected)}</b><br/>+{q.current} → +{q.target}</p><div className="tc-rates"><span>성공<b>{pct(q.successRate)}</b></span><span>유지<b>{pct(q.failKeepRate)}</b></span><span>하락<b>{pct(q.failDowngradeRate)}</b></span><span className="destroy">파괴<b>{pct(q.failDestroyRate)}</b></span></div><p>{q.silverCost.toLocaleString()} Silver · 강화석 {q.stoneCost}개가 결과와 관계없이 소모됩니다.</p><div className="tc-modal-actions"><button className="tc-action secondary" onClick={()=>setConfirm(false)}>취소</button><button className="tc-action danger tc-feel-press" data-game-feel="press" disabled={!view.canAttempt||busy} onClick={()=>void confirmEnhancement()}>{busy?'서버 판정 중':'강화 진행'}</button></div></section></div>}
 </Screen>;
}
