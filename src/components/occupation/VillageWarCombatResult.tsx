import React from 'react';
import {SKILL_TREE_CATALOG} from '../../game/skills/catalog';
import type {VillageWarCombatResult as CombatResult} from '../../online/villageWar';
import './village-war-stage-one.css';

const skillNames:Record<string,string>={
 ...Object.fromEntries(SKILL_TREE_CATALOG.map(skill=>[skill.id,skill.name])),
 heavy:'강타',guard:'방어',quick:'속공'
};
const displayLine=(line:string)=>line.replace(/\b[a-z][a-z0-9_]*\b/g,id=>skillNames[id]??id);
const percent=(current:number,max:number)=>max>0?Math.max(0,Math.min(100,Math.round(100*current/max))):0;
function Fighter({name,kind,hp,maxHp,mp,maxMp,art}:{name:string;kind:'attacker'|'defender';hp:number;maxHp:number;mp:number;maxMp:number;art?:string}){
 return <article className={'tc-village-result-fighter '+kind}>
  <div className="tc-village-result-art">{art?<img src={art} alt="" loading="lazy"/>:<span aria-hidden="true">◇</span>}</div>
  <div className="tc-village-result-name"><small>{kind==='attacker'?'공격자':'수비자'}</small><b>{name}</b></div>
  <div className="tc-village-result-vitals">
   <div><span>HP</span><progress className="hp" aria-label={(kind==='attacker'?'공격자':'수비자')+' HP'} value={percent(hp,maxHp)} max="100"/><b>{hp}/{maxHp}</b></div>
   <div><span>MP</span><progress className="mp" aria-label={(kind==='attacker'?'공격자':'수비자')+' MP'} value={percent(mp,maxMp)} max="100"/><b>{mp}/{maxMp}</b></div>
  </div>
 </article>;
}
export function VillageWarCombatResult({battle,onClose,attackerArt}:{battle:CombatResult;onClose:()=>void;attackerArt?:string}){
 const capture=battle.outcome==='CAPTURE';
 return <section className="tc-village-combat-result tc-village-combat-result-v3" aria-label="공성전 자동전투 결과">
  <header className="tc-village-result-header">
   <small>5전선 공성전 · 자동전투 {battle.turns.length}턴</small>
   <h2>{capture?'전선 점령 성공':'수비자 방어 성공'}</h2>
   <p>{capture?'수비자를 쓰러뜨리고 전선을 확보했습니다.':'수비자가 전선을 지켜냈습니다.'}</p>
  </header>
  <div className="tc-village-result-arena">
   <Fighter name={battle.attackerName} kind="attacker" hp={battle.attackerHp} maxHp={battle.attackerMaxHp} mp={battle.attackerMp} maxMp={battle.attackerMaxMp} art={attackerArt}/>
   <strong className="tc-village-result-vs" aria-hidden="true">VS</strong>
   <Fighter name={battle.defenderName} kind="defender" hp={battle.defenderHp} maxHp={battle.defenderMaxHp} mp={battle.defenderMp} maxMp={battle.defenderMaxMp}/>
  </div>
  <p className="tc-village-result-outcome" role="status">
   {capture?'새 수비자 HP·MP 전회복 · 해당 전선 점령':'수비자 남은 HP·MP 유지 · 다음 공격에 반영'}
   {battle.defenderReward?' · 수비자 도전권 +1':''}
  </p>
  <div className="tc-village-result-log-head"><b>전투 진행 기록</b><span>총 {battle.turns.length}턴</span></div>
  <ol className="tc-village-combat-log" aria-label="턴별 전투 기록">{battle.turns.map(turn=><li key={turn.turn}>
   <b>{turn.turn}턴</b><div>{turn.lines.map((line,i)=><span key={i}>{displayLine(line)}</span>)}</div>
  </li>)}</ol>
  <button type="button" className="tc-village-result-back tc-feel-press" onClick={onClose}>전선으로 돌아가기</button>
 </section>;
}
