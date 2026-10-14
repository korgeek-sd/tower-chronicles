import React from 'react';
import {SKILL_TREE_CATALOG} from '../../game/skills/catalog';
const skillNames:Record<string,string>={...Object.fromEntries(SKILL_TREE_CATALOG.map(s=>[s.id,s.name])),heavy:'강타',guard:'방어',quick:'속공'};
const displayLine=(line:string)=>line.replace(/\b[a-z][a-z0-9_]*\b/g,id=>skillNames[id]??id);
import type {VillageWarCombatResult as CombatResult} from '../../online/villageWar';
import './village-war-stage-one.css';
export function VillageWarCombatResult({battle,onClose}:{battle:CombatResult;onClose:()=>void}){
 return <section className="tc-village-combat-result" aria-label="공성전 자동전투 결과">
  <header><small>자동전투 · {battle.turns.length}턴</small><h2>{battle.outcome==='CAPTURE'?'전선 점령 성공':'수비자 방어 성공'}</h2></header>
  <div className="tc-village-combat-vitals">
   <article><b>{battle.attackerName}</b><span>공격자</span><p>HP {battle.attackerHp} / {battle.attackerMaxHp}</p><progress aria-label="공격자 HP" value={battle.attackerHp} max={battle.attackerMaxHp}/><p>MP {battle.attackerMp} / {battle.attackerMaxMp}</p><progress aria-label="공격자 MP" value={battle.attackerMp} max={battle.attackerMaxMp}/></article>
   <article><b>{battle.defenderName}</b><span>수비자</span><p>HP {battle.defenderHp} / {battle.defenderMaxHp}</p><progress aria-label="수비자 HP" value={battle.defenderHp} max={battle.defenderMaxHp}/><p>MP {battle.defenderMp} / {battle.defenderMaxMp}</p><progress aria-label="수비자 MP" value={battle.defenderMp} max={battle.defenderMaxMp}/></article>
  </div>
  <p>{battle.outcome==='CAPTURE'?'내 캐릭터가 HP·MP 전회복 후 새 수비자로 배치되었습니다.':'수비자의 남은 HP·MP가 다음 전투에 유지됩니다.'}{battle.defenderReward?' 수비자 도전권 +1':''}</p>
  <ol className="tc-village-combat-log" aria-label="턴별 전투 기록">{battle.turns.map(t=><li key={t.turn}><b>{t.turn}턴</b>{t.lines.map((line,i)=><span key={i}>{displayLine(line)}</span>)}</li>)}</ol>
  <button className="tc-feel-press" onClick={onClose}>전선으로 돌아가기</button>
 </section>;
}
