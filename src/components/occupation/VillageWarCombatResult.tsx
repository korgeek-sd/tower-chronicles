import React,{useEffect,useRef,useState} from 'react';
import {GuildEmblem,type GuildEmblemData} from '../association/GuildEmblem';
import {SKILL_TREE_CATALOG} from '../../game/skills/catalog';
import {assetUrl} from '../../game/data/graphics';
import type {VillageWarCombatResult as CombatResult} from '../../online/villageWar';
import './village-war-result-modal.css';

const skillNames:Record<string,string>={
 ...Object.fromEntries(SKILL_TREE_CATALOG.map(skill=>[skill.id,skill.name])),
 heavy:'강타',guard:'방어',quick:'속공'
};
const displayLine=(line:string)=>line.replace(/\b[a-z][a-z0-9_]*\b/g,id=>skillNames[id]??id);
const percent=(current:number,max:number)=>max>0?Math.max(0,Math.min(100,Math.round(100*current/max))):0;
function Fighter({name,kind,hp,maxHp,mp,maxMp,art}:{name:string;kind:'attacker'|'defender';hp:number;maxHp:number;mp:number;maxMp:number;art?:string}){
 return <article className={'tc-war-result-fighter '+kind}>
  <div className="tc-war-result-fighter-title"><span>{kind==='attacker'?'⚔':'◆'}</span><b>{kind==='attacker'?'공격자':'수비자'}</b></div>
  <div className="tc-war-result-fighter-body">
   <div className="tc-war-result-portrait">{<img src={art??assetUrl('assets/player/default.png')} alt="" loading="eager"/>}</div>
   <div className="tc-war-result-fighter-data">
    <strong title={name}>{name}</strong>
    <div className="tc-war-result-meter"><span>HP</span><progress className="hp" aria-label={(kind==='attacker'?'공격자':'수비자')+' HP'} value={percent(hp,maxHp)} max={100}/><small>{Math.round(hp).toLocaleString()} / {Math.round(maxHp).toLocaleString()}</small></div>
    <div className="tc-war-result-meter"><span>MP</span><progress className="mp" aria-label={(kind==='attacker'?'공격자':'수비자')+' MP'} value={percent(mp,maxMp)} max={100}/><small>{Math.round(mp).toLocaleString()} / {Math.round(maxMp).toLocaleString()}</small></div>
   </div>
  </div>
 </article>;
}
export function VillageWarCombatResult({battle,onClose,attackerArt,frontId,preview=false,emblem=null}:{battle:CombatResult;onClose:()=>void;attackerArt?:string;frontId?:number|null;preview?:boolean;emblem?:GuildEmblemData|null}){
 const [allLogs,setAllLogs]=useState(false);
 const closeRef=useRef<HTMLButtonElement>(null);
 const previousFocus=useRef<HTMLElement|null>(null);
 const capture=battle.outcome==='CAPTURE';
 const visibleTurns=battle.turns.slice(-4);
 useEffect(()=>{
  previousFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  closeRef.current?.focus();
  return()=>{previousFocus.current?.focus();};
 },[]);
 const handleKeys=(event:React.KeyboardEvent<HTMLElement>)=>{
  if(event.key==='Escape'){event.stopPropagation();allLogs?setAllLogs(false):onClose();}
  if(event.key!=='Tab')return;
  const root=event.currentTarget;
  const focusables=Array.from(root.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
  if(focusables.length===0)return;
  const first=focusables[0],last=focusables[focusables.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 };
 return <div className="tc-war-result-backdrop" role="presentation" data-war-result-preview={preview}>
  <section className={'tc-village-combat-result tc-war-result-dialog'+(capture?' is-capture':' is-defended')} role="dialog" aria-modal="true" aria-label="공성전 자동전투 결과" onKeyDown={handleKeys}>
   <div className="tc-war-result-head">
    <span className="tc-war-result-ornament" aria-hidden="true">◆</span>
    <h2>자동전투 결과</h2>
    <button type="button" ref={closeRef} className="tc-war-result-close" onClick={onClose} aria-label="전투 결과 닫기">×</button>
   </div>
   <div className="tc-war-result-splash">
    <div className="tc-war-result-crest" aria-hidden="true">{emblem?<GuildEmblem value={emblem} size={66}/>:<span>♜</span>}</div>
    <h3>{capture?'전선 점령 성공':'수비자 방어 성공'}</h3>
    <p>{battle.fatigueDefeat?'수비자가 탈진하여 전선을 확보했습니다.':capture?'수비자를 쓰러뜨리고 전선을 확보했습니다.':'수비자가 전선을 지켜냈습니다.'}</p>
    {frontId!=null&&<small>제{frontId}전선 · 자동전투 {battle.turns.length}턴</small>}
    {preview&&<span className="tc-war-result-sample">UI 시연 · 실제 전투 및 도전권 변경 없음</span>}
   </div>
   <div className="tc-war-result-fighters">
    <Fighter name={battle.attackerName} kind="attacker" hp={battle.attackerHp} maxHp={battle.attackerMaxHp} mp={battle.attackerMp} maxMp={battle.attackerMaxMp} art={attackerArt}/>
    <span className="tc-war-result-vs" aria-hidden="true">VS</span>
    <Fighter name={battle.defenderName} kind="defender" hp={battle.defenderHp} maxHp={battle.defenderMaxHp} mp={battle.defenderMp} maxMp={battle.defenderMaxMp}/>
   </div>
   <div className="tc-war-result-summary" role="status">
    {capture?'새 수비자 HP·MP 전회복 · 피로도 0/20':'수비자 남은 HP·MP 유지 · 다음 공격에 반영'}
    {battle.fatigueDefeat&&<span className="tc-war-result-fatigue"> · 피로도에 따른 탈진 패배</span>}
    {battle.defenderReward>0&&' · 수비자 도전권 +1'}
   </div>
   <div className="tc-war-result-records">
    <div className="tc-war-result-log-head"><b>전투 진행 기록</b><span>총 {battle.turns.length}턴</span></div>
    <ol className="tc-war-result-log-preview" aria-label="최근 전투 턴 기록">
     {visibleTurns.map(turn=><li key={turn.turn}><b>{turn.turn}턴</b><span>{turn.lines.map(displayLine).join(' · ')}</span></li>)}
     {visibleTurns.length===0&&<li>기록된 전투 턴이 없습니다.</li>}
    </ol>
   </div>
   <div className="tc-war-result-actions">
    <button type="button" className="tc-village-result-back tc-feel-press" onClick={onClose}>전선으로 돌아가기</button>
    <button type="button" className="tc-war-result-details" aria-expanded={allLogs} onClick={()=>setAllLogs(true)}>상세 기록</button>
   </div>
   {allLogs&&<div className="tc-war-result-log-overlay">
    <div className="tc-war-result-log-panel" role="region" aria-label="전체 턴별 전투 기록">
     <div className="tc-war-result-log-head"><b>전체 전투 진행 기록</b><button type="button" onClick={()=>setAllLogs(false)}>닫기</button></div>
     <ol className="tc-village-combat-log" aria-label="턴별 전투 기록">{battle.turns.map(turn=><li key={turn.turn}><b>{turn.turn}턴</b><div>{turn.lines.map((line,i)=><span key={i}>{displayLine(line)}</span>)}</div></li>)}</ol>
    </div>
   </div>}
  </section>
 </div>;
}
