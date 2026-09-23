import React from 'react';
import type {GameState,Item} from '../../game/types';
import {itemName} from '../../game/engine/state';
import {enhancementAttemptView} from './presentation';

const pct=(value:number)=>Math.round(value*100)+'%';

export function EnhancementConfirm({game,item,onCancel,onConfirm}:{game:GameState;item:Item;onCancel:()=>void;onConfirm:()=>void}){
  const view=enhancementAttemptView(game,item),q=view.quote;
  if(!q)return null;
  return <div className="enhancement-modal" onClick={onCancel}>
    <section className="panel" role="dialog" aria-modal="true" aria-labelledby="enhancement-confirm-title" onClick={e=>e.stopPropagation()}>
      <h2 id="enhancement-confirm-title">장비 강화 확인</h2>
      <p><strong>{itemName(item)}</strong></p>
      <p>+{q.current} → +{q.target} 강화에 도전합니다.</p>
      <div className="enhancement-confirm-rates">
        <span>성공 {pct(q.successRate)}</span><span>유지 {pct(q.failKeepRate)}</span>
        {q.failDowngradeRate>0&&<span>하락 {pct(q.failDowngradeRate)}</span>}
        {q.failDestroyRate>0&&<strong>파괴 {pct(q.failDestroyRate)}</strong>}
      </div>
      <p className="muted">{q.silverCost.toLocaleString()} Silver · {view.materialName} {q.materialCost}개 소모</p>
      {q.failDestroyRate>0&&<div className="note danger"><b>파괴 위험</b><br/>실패 결과에 따라 이 장비가 영구적으로 삭제될 수 있습니다.</div>}
      <div className="modal-actions"><button onClick={onCancel}>취소</button><button className="primary" disabled={!view.canAttempt} onClick={onConfirm}>강화 진행</button></div>
    </section>
  </div>;
}
