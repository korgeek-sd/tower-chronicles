import React,{useState} from 'react';
import type {Field,GameState} from '../../game/types';
import {CONFIG,FIELDS,TOWERS} from '../../game/data/config';
import {discount,materialFor} from '../../game/engine/crafting';
import {ScreenHeader} from '../mobile/ScreenHeader';
import {SegmentTabs} from '../mobile/SegmentTabs';
import './craft-mobile.css';

const FIELD_ORDER:Field[]=['weapon','armor','accessory','alchemy'];

export function CraftMasteryScreen({game,onBack}:{
  game:GameState;
  onBack:()=>void;
}){
  const [field,setField]=useState<Field>('weapon');
  const mastery=game.mastery[field];
  const complete=mastery.unlocked>=5;
  const percent=complete?100:Math.min(100,mastery.progress/CONFIG.masteryRequired*100);
  const material=TOWERS[materialFor(field)].material;

  return <section className="craft-mastery-screen" aria-label="제작 숙련도">
    <ScreenHeader title="제작 숙련도" meta="현재 최고 등급 제작으로 다음 자격을 해금합니다" onBack={onBack}/>

    <SegmentTabs
      label="숙련 분야"
      items={FIELD_ORDER.map(value=>({value,label:FIELDS[value].replace(' 제작','')}))}
      value={field}
      onChange={setField}
    />

    <section className="craft-mastery-panel">
      <div className="craft-mastery-symbol" aria-hidden="true">
        {field==='weapon'?'⚒':field==='armor'?'▰':field==='accessory'?'◇':'✦'}
      </div>
      <div className="craft-mastery-heading">
        <small>{material} 계열</small>
        <h2>{FIELDS[field]}</h2>
        <strong>{mastery.unlocked}등급 해금</strong>
      </div>

      <div className="craft-mastery-path">
        {[1,2,3,4,5].map(grade=><div
          key={grade}
          className={grade<=mastery.unlocked?'unlocked':grade===mastery.unlocked+1?'next':'locked'}
        >
          <b>{grade}</b><small>{grade<=mastery.unlocked?'해금':grade===mastery.unlocked+1?'다음':'잠김'}</small>
        </div>)}
      </div>

      <div className="craft-mastery-progress">
        <div className="craft-mastery-progress-head">
          <span>{complete?'모든 제작 등급 해금':mastery.unlocked+'등급 제작 → '+(mastery.unlocked+1)+'등급 자격'}</span>
          <b>{complete?'완료':mastery.progress+' / '+CONFIG.masteryRequired}</b>
        </div>
        <div className="craft-mastery-bar" aria-label={'숙련 진행 '+Math.round(percent)+'%'}>
          <div style={{width:percent+'%'}}/>
        </div>
      </div>

      <div className="craft-mastery-stats">
        <span><small>현재 자격</small><b>{mastery.unlocked}등급</b></span>
        <span><small>총 제작</small><b>{mastery.crafts}회</b></span>
        <span><small>재료 절감</small><b>{Math.round(discount(mastery.crafts)*100)}%</b></span>
      </div>

      <p className="craft-mastery-rule">{complete
        ?'이 분야의 모든 제작 등급을 해금했습니다.'
        :'현재 최고 등급인 '+mastery.unlocked+'등급을 제작해야 다음 등급 진행도가 오릅니다. 낮은 등급 제작은 총 제작 횟수와 재료 절감에만 반영됩니다.'}</p>
    </section>
  </section>;
}
