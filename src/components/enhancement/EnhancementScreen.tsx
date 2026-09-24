import React,{useEffect,useMemo,useState} from 'react';
import type {GameState,Item} from '../../game/types';
import {enhanceEquipment} from '../../game/engine/enhancement';
import {itemName} from '../../game/engine/state';
import {enhancementAttemptView,enhancementPreviewRows} from './presentation';
import {Glyph,Pager,Screen} from '../../ui/mobile';

const PAGE_SIZE=5;
const pct=(n:number)=>Math.round(n*100)+'%';
const iconFor=(item:Item)=>item.kind==='armor'?'armor':item.kind==='boots'?'boots':['sword','bow','dagger','staff'].includes(item.kind)?item.kind:'accessory';

export function EnhancementScreen({game,setGame,onBack}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;onBack:()=>void}){
 const [selectedId,setSelectedId]=useState<string|null>(null),[confirm,setConfirm]=useState(false),[page,setPage]=useState(0);
 const items=useMemo(()=>game.items.slice().sort((a,b)=>Number(Object.values(game.equipped).includes(b.id))-Number(Object.values(game.equipped).includes(a.id))||b.tier-a.tier||b.enhancement-a.enhancement||a.id.localeCompare(b.id)),[game.items,game.equipped]);
 const pages=Math.max(1,Math.ceil(items.length/PAGE_SIZE)),safe=Math.min(page,pages-1),shown=items.slice(safe*PAGE_SIZE,safe*PAGE_SIZE+PAGE_SIZE),selected=items.find(i=>i.id===selectedId)??shown[0]??null;
 useEffect(()=>{if(selectedId&&!game.items.some(item=>item.id===selectedId)){setSelectedId(null);setConfirm(false);}},[game.items,selectedId]);
 const view=selected?enhancementAttemptView(game,selected):null,q=view?.quote??null,rows=selected?enhancementPreviewRows(selected):[];
 return <Screen eyebrow="WORKSHOP / ENHANCEMENT" title="장비 강화" meta={<button className="tc-action secondary slim" onClick={onBack}>제작으로</button>}>
  <div className="tc-enhance">
   <div className="tc-enhance-body">
    <div className="tc-enhance-list">{shown.map(item=><button key={item.id} className="tc-enhance-item" aria-pressed={selected?.id===item.id} onClick={()=>setSelectedId(item.id)}><Glyph name={iconFor(item)}/><b>{itemName(item)}</b><small>T{item.tier} · +{item.enhancement}{Object.values(game.equipped).includes(item.id)?' · 장착':''}</small></button>)}{Array.from({length:Math.max(0,PAGE_SIZE-shown.length)},(_,i)=><div className="tc-enhance-item" key={'e'+i}/>)}</div>
    <section className="tc-enhance-preview">{selected&&view?<><div className="tc-panel-title"><h2>{itemName(selected)}</h2><small>{q?('+'+q.current+' → +'+q.target):'강화 불가'}</small></div><div>{rows.slice(0,3).map(r=><div className="tc-order-total" key={r.label}><span>{r.label}</span><b>{r.current} → {r.next}</b></div>)}</div>{q&&<><div className="tc-rates"><span>성공<b>{pct(q.successRate)}</b></span><span>유지<b>{pct(q.failKeepRate)}</b></span><span>하락<b>{pct(q.failDowngradeRate)}</b></span><span className="destroy">파괴<b>{pct(q.failDestroyRate)}</b></span></div><div className="tc-costs"><div><small>Silver</small><b>{q.silverCost.toLocaleString()} S</b></div><div><small>{view.materialName}</small><b>{q.materialCost}개</b></div></div>{q.failDestroyRate>0?<div className="tc-enhance-warning">파괴 결과가 나오면 장비가 영구 삭제됩니다.</div>:<span/>}<button className="tc-action" disabled={!view.canAttempt} onClick={()=>setConfirm(true)}>+{q.target} 강화 시도</button></>}</>:<p>강화할 장비가 없습니다.</p>}</section>
   </div>
   <Pager page={safe} count={pages} onChange={setPage}/>
   <div className="tc-floor-risk">성공·유지·하락·파괴 확률과 비용은 기존 강화 엔진 값을 그대로 표시합니다.</div>
  </div>
  {confirm&&selected&&q&&view&&<div className="tc-modalback" onClick={()=>setConfirm(false)}><section className="tc-modal" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><h2>강화 진행 확인</h2><p><b>{itemName(selected)}</b><br/>+{q.current} → +{q.target}</p><div className="tc-rates"><span>성공<b>{pct(q.successRate)}</b></span><span>유지<b>{pct(q.failKeepRate)}</b></span><span>하락<b>{pct(q.failDowngradeRate)}</b></span><span className="destroy">파괴<b>{pct(q.failDestroyRate)}</b></span></div><p>{q.silverCost.toLocaleString()} Silver · {view.materialName} {q.materialCost}개가 결과와 관계없이 소모됩니다.</p><div className="tc-modal-actions"><button className="tc-action secondary" onClick={()=>setConfirm(false)}>취소</button><button className="tc-action danger" disabled={!view.canAttempt} onClick={()=>{setGame(s=>enhanceEquipment(s,selected.id));setConfirm(false);}}>강화 진행</button></div></section></div>}
 </Screen>;
}
