import React from 'react';
import type {ExpeditionResult} from '../../game/types';
import {TOWERS} from '../../game/data/config';
import {duration} from '../ExpeditionLoot';
import {ScreenHeader} from '../mobile/ScreenHeader';
import './expedition-mobile.css';

function sumNested(record:Record<string,number[]>){
  return Object.values(record).reduce((total,values)=>total+values.reduce((sum,value)=>sum+value,0),0);
}

export function ExpeditionResultScreen({result,notice,onInventory,onNextExpedition}:{
  result:ExpeditionResult|null;
  notice:string;
  onInventory:()=>void;
  onNextExpedition:()=>void;
}){
  if(!result){
    return <section className="expedition-result-screen">
      <ScreenHeader title="원정 기록" meta="정산할 기록이 없습니다"/>
      <div className="expedition-result-empty">{notice||'원정 기록이 없습니다.'}</div>
      <button type="button" className="game-button primary" onClick={onNextExpedition}>다음 원정 준비</button>
    </section>;
  }

  const dead=result.outcome==='dead';
  const materials=sumNested(result.loot.materials);
  const tickets=sumNested(result.loot.tickets);
  return <section className={'expedition-result-screen '+(dead?'failed':'returned')} aria-label="원정 결과">
    <ScreenHeader
      title={dead?'원정 실패':'안전 귀환'}
      meta={TOWERS[result.tower].name+' · '+result.floor+'F'}
    />

    <div className="expedition-result-seal" aria-hidden="true">{dead?'×':'✓'}</div>
    <strong className="expedition-result-title">{dead?'회수에 실패했습니다':'전리품이 보관함에 확정되었습니다'}</strong>
    <p className="expedition-result-copy">{dead
      ?'이번 원정에서 획득한 임시 전리품과 남은 원정 포션을 잃었습니다.'
      :'탑에서 확보한 전리품과 남은 원정 포션이 영구 보관함으로 이동했습니다.'}</p>

    <div className="expedition-result-stats">
      <span><small>시간</small><b>{duration(result.time)}</b></span>
      <span><small>처치</small><b>{result.kills}</b></span>
      <span><small>Silver</small><b>{dead?'손실':'+'+result.loot.silver.toLocaleString()}</b></span>
      <span><small>재료</small><b>{dead?'손실':materials+'개'}</b></span>
      <span><small>입장권</small><b>{dead?'—':tickets+'장'}</b></span>
      <span><small>도달층</small><b>{result.floor}F</b></span>
    </div>

    <div className="expedition-result-actions">
      <button type="button" className="game-button primary" onClick={onInventory}>영구 보관함 확인</button>
      <button type="button" className="game-button secondary" onClick={onNextExpedition}>다음 원정 준비</button>
    </div>
  </section>;
}
