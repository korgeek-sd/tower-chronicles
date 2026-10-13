import React from 'react';
import {recoverVitality,VITALITY_CAP,VITALITY_INTERVAL,type HuntingState} from '../../game/hunting/model';

export function HuntingVitality({hunting,now}:{hunting:HuntingState|null;now:number}){
 const state=hunting?recoverVitality(hunting,now):null;
 const seconds=state?Math.max(0,Math.ceil((VITALITY_INTERVAL-Math.max(0,now-state.recoveredAt))/1000)):0;
 const bonus=!!state&&state.vitality>VITALITY_CAP,full=!!state&&state.vitality===VITALITY_CAP;
 return <aside className="tc-hunt-vitality-strip tc-hunt-panel" aria-label="활력 및 다음 회복" data-empty={state?.vitality===0}>
  <div><small>남은 활력</small><strong>{state?.vitality.toLocaleString()??'—'}<span>{bonus?'추가 지급':state?' / 100':''}</span></strong></div>
  <div className="tc-hunt-vitality-clock"><small>{bonus?'자연 회복 대기':full?'자연 회복':'다음 회복 +1'}</small><strong>{!state?'불러오는 중':bonus?'100 미만부터 회복':full?'충전 완료':`${seconds}초 후`}</strong></div>
 </aside>;
}
