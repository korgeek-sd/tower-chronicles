import React from 'react';
import type {GameState,Tower} from '../../game/types';
import {TOWERS,towerIds} from '../../game/data/config';
import {ScreenHeader} from '../mobile/ScreenHeader';
import './expedition-mobile.css';

const TOWER_META:Record<Tower,{eyebrow:string;description:string}>={
  ore:{eyebrow:'WEAPON MATERIAL',description:'철광석을 회수하는 노바르의 대표 탐사 구역'},
  leather:{eyebrow:'ARMOR MATERIAL',description:'포식자와 사냥 의식의 흔적이 남은 성소'},
  gem:{eyebrow:'ACCESSORY MATERIAL',description:'수정과 빛이 굳어버린 고대의 첨탑'},
  kaleon:{eyebrow:'ALCHEMY MATERIAL',description:'대속과 치료의 교리가 변질된 녹빛 첨탑'},
};

export function TowerSelectScreen({game,onChooseTower}:{
  game:GameState;
  onChooseTower:(tower:Tower)=>void;
}){
  return <section className="tower-select-screen" aria-label="탑 선택">
    <ScreenHeader title="탑 선택" meta="원정할 탑을 선택하세요"/>
    <div className="tower-select-list">
      {towerIds.map(tower=>{
        const data=TOWERS[tower];
        const enabled=tower==='ore';
        const highest=game.exploration.highestReturned[tower];
        return <article className={'tower-select-card '+(enabled?'available':'locked')} key={tower}>
          <div className="tower-select-emblem" style={{'--tower-accent':data.color} as React.CSSProperties} aria-hidden="true">{data.icon}</div>
          <div className="tower-select-copy">
            <small>{TOWER_META[tower].eyebrow}</small>
            <strong>{data.name}</strong>
            <p>{TOWER_META[tower].description}</p>
            <div className="tower-select-meta">
              <span>{data.material}</span>
              <span>최고 귀환 {highest?highest+'F':'기록 없음'}</span>
            </div>
          </div>
          {enabled
            ?<button type="button" className="tower-select-enter" onClick={()=>onChooseTower(tower)}>
              <span>{game.tickets[tower][0]}장</span><b>선택</b>
            </button>
            :<div className="tower-select-soon" aria-label="준비 중">준비 중</div>}
        </article>;
      })}
    </div>
  </section>;
}
