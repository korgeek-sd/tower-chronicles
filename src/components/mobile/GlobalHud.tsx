import React from 'react';
import type {GameState} from '../../game/types';

export function GlobalHud({game,onHome,onPremium}:{
  game:GameState;
  onHome?:()=>void;
  onPremium:()=>void;
}){
  const active=game.goldenRecorder.expiresAt!=null&&game.goldenRecorder.expiresAt>Date.now();
  return <header className="global-hud">
    <button type="button" className="global-hud-brand" onClick={onHome} aria-label="거점으로">
      <span aria-hidden="true">♜</span>
      <span>탑의 기록<small>TOWER CHRONICLES</small></span>
    </button>
    <div className="global-hud-currencies" aria-label="보유 재화">
      <span><b>Silver</b> {game.silver.toLocaleString()}</span>
      <span><b>Gold</b> {game.market.gold.toLocaleString()}</span>
    </div>
    <button type="button" className={'global-hud-premium '+(active?'active':'')} onClick={onPremium}>
      황금기록자
      <small>{active?'활성':'미등록'}</small>
    </button>
  </header>;
}
