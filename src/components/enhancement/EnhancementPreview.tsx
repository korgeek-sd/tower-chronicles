import React from 'react';
import type {GameState,Item} from '../../game/types';
import {enhancementAttemptView,enhancementPreviewRows} from './presentation';

const pct=(value:number)=>Math.round(value*100)+'%';

export function EnhancementPreview({game,item,onAttempt}:{game:GameState;item:Item;onAttempt:()=>void}){
  const view=enhancementAttemptView(game,item),rows=enhancementPreviewRows(item),q=view.quote;
  return <section className="panel enhancement-preview">
    <div className="section-heading"><h2>강화 정보</h2><span className="badge">{q?('+'+q.current+' → +'+q.target):'강화 불가'}</span></div>
    {rows.length>0&&<div className="enhancement-stat-preview">{rows.map(row=><div key={row.label}><small>{row.label}</small><span>{row.current}</span><b>→ {row.next}</b></div>)}</div>}
    {q?<><div className="enhancement-rates">
      <span>성공 <b>{pct(q.successRate)}</b></span>
      <span>유지 <b>{pct(q.failKeepRate)}</b></span>
      <span>하락 <b>{pct(q.failDowngradeRate)}</b></span>
      <span className={q.failDestroyRate>0?'danger':''}>파괴 <b>{pct(q.failDestroyRate)}</b></span>
    </div>
    <div className="enhancement-cost">
      <div><small>Silver</small><strong>{q.silverCost.toLocaleString()} S</strong><span>보유 {game.silver.toLocaleString()} S</span></div>
      <div><small>{view.materialName}</small><strong>{q.materialCost.toLocaleString()}개</strong><span>보유 {view.materialOwned.toLocaleString()}개</span></div>
    </div>
    {q.failDestroyRate>0&&<div className="note danger">이 강화는 장비 파괴 가능성이 있습니다. 파괴되면 장비는 영구적으로 사라집니다.</div>}
    <p className="muted enhancement-rule-note">강화 결과와 관계없이 Silver와 재료가 소모됩니다. 하락은 정확히 1단계입니다.</p>
    <button className="primary" disabled={!view.canAttempt} onClick={onAttempt}>+{q.target} 강화 시도 <span>→</span></button>
    {!view.canAttempt&&<p className="danger">{view.reason}</p>}</>:<p className="muted">{view.reason}</p>}
  </section>;
}
