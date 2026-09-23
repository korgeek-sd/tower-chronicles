import React from 'react';
import type {MonsterCombatIntel} from './combatIntel';

const kindLabel:Record<string,string>={damage:'공격',charge:'준비 공격',reactive_prepare:'반격 준비',effect:'상태 효과'};

export function MonsterSkillPanel({intel,onClose}:{intel:MonsterCombatIntel;onClose:()=>void}){
  return <section className="monster-skill-panel" aria-label="적 전투 정보">
    <div><h2>적 전투 정보</h2><button type="button" onClick={onClose} aria-label="적 정보 닫기">×</button></div>
    <p className="monster-skill-note">확정된 준비 행동만 경고합니다. 사용 가능 표시는 다음 행동을 예측하지 않습니다.</p>
    {intel.shield&&<div className="monster-shield-detail"><b>⬢ {intel.shield.name}</b><span>{intel.shield.shieldCurrent??intel.shield.shieldHits}{intel.shield.shieldMax!==undefined?' / '+intel.shield.shieldMax:''}</span><small>{intel.shield.turns}턴</small></div>}
    <div className="monster-skill-list">
      {intel.skills.length?intel.skills.map(skill=><article key={skill.id}>
        <div><strong>{skill.name}</strong><span>{kindLabel[skill.kind]??skill.kind}</span></div>
        <p>{skill.description}</p>
        <small>기본 대기 {skill.cooldown}턴 · {skill.ready?'현재 사용 가능':'남은 대기 '+skill.cooldownRemaining+'턴'}</small>
      </article>):<p>확인 가능한 고유 스킬이 없습니다.</p>}
    </div>
  </section>;
}
