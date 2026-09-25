import React,{useState} from 'react';
import type {GameState,Potion} from '../../game/types';
import {EVENT_BALANCE} from '../../game/events/selector';
import {TOWERS,POTIONS,generalPotionIds,WEAPONS,SKILLS} from '../../game/data/config';
import {stats,weaponOf} from '../../game/engine/state';
import {BattleScene} from './BattleScene';
import {titleById} from '../../game/data/cosmetics';
import {bossIdFor} from '../../game/engine/bossTracking';
import {skillTurnsLeft} from '../../game/engine/turns';
import {canPlayerAct,canUseSkill,canUsePotion} from '../../game/engine/combat';
import {activeShield,EFFECTS} from '../../game/engine/effects';
import {resolvePlayerCombatKit} from '../../game/jobs/service';
import {reactivePreparedSkill} from '../../game/engine/reactions';
import {effectText} from './presentation';
import {monsterCombatIntel} from './combatIntel';
import {loadPrefs,savePrefs,SPEEDS} from './prefs';
import type {BattlePrefs} from './prefs';
import {Glyph} from '../../ui/mobile';
import {strongholdRemainingMs} from '../../game/events/resourceStronghold';

type Props={game:GameState;now:number;onBasicAttack:()=>void;onSkill:(id:string)=>void;onPotion:(potion:Potion)=>void;onFlee:()=>void;onHome:()=>void;onRevival:(use:boolean)=>void;onAbandonStronghold:()=>void};
const glyph:Record<string,string>={heavy:'sword',execute:'attack',guard:'defense',quick:'haste'};

export function BattleScreen({game,now,onBasicAttack,onSkill,onPotion,onFlee,onHome,onRevival,onAbandonStronghold}:Props){
 const e=game.expedition!,st=stats(game,e.equipment),weapon=weaponOf(game,e.equipment);
 const [panel,setPanel]=useState<'menu'|'items'|'enemy'|null>(null);
 const playerReactive=reactivePreparedSkill(e,'player'),playerShield=activeShield(e,'player'),intel=monsterCombatIntel(e),buffs=e.playerEffects,playerTurn=canPlayerAct(game),skillIds=resolvePlayerCombatKit(game).activeSkillIds;
 const [prefs,setPrefs]=useState<BattlePrefs>(loadPrefs);
 const updatePrefs=(next:BattlePrefs)=>{setPrefs(next);savePrefs(next);};
 const speedIndex=Math.max(0,SPEEDS.findIndex(v=>v===prefs.speed));
 const cycleSpeed=()=>updatePrefs({...prefs,speed:SPEEDS[(speedIndex+1)%SPEEDS.length]});
 const bossFloor=!!bossIdFor(e.tower,e.floor),trace=bossFloor?Math.round(e.bossTracking.progress/EVENT_BALANCE.bossMaxProgress*100):0;
 const intent=intel.intent.kind!=='NONE'?intel.intent:null;
 const stronghold=e.events.stronghold?.status==='ACTIVE'?e.events.stronghold:null;
 const strongholdMs=stronghold?strongholdRemainingMs(stronghold,now):0;
 const strongholdTime=String(Math.floor(strongholdMs/60_000)).padStart(2,'0')+':'+String(Math.floor(strongholdMs%60_000/1000)).padStart(2,'0');

 const skillCards=skillIds.map((id,i)=>{
  const skill=SKILLS.find(s=>s.id===id),turns=skill?skillTurnsLeft(e,skill.id):0,mismatch=!!skill&&!skill.weapons.includes(weapon)&&!e.jobSnapshotId;
  return <button type="button" disabled={!skill||!canUseSkill(game,id||'')} className="tc-ref-card" key={i} onClick={()=>skill&&onSkill(skill.id)}>
   <span className="tc-ref-card-art"><Glyph name={glyph[id]??'skills'}/>{turns>0&&<b>{turns}</b>}</span>
   <strong>{skill?.name||'미구현'}</strong>
   <small>{mismatch?'무기 불일치':turns?turns+'턴 대기':'사용 가능'}</small>
  </button>;
 });

 return <div className="tc-battle tc-battle-reference">
  <div className="tc-battle-ornament top" aria-hidden="true"/>
  <div className="tc-battle-ornament bottom" aria-hidden="true"/>
  <div className="tc-battle-scene"><BattleScene expedition={e} combatEvents={game.combatEvents??[]} playerMaxHp={st.hp} appearanceId={game.cosmetics.selectedAppearanceId} titleName={titleById(game.cosmetics.selectedTitleId||'')?.name} speed={prefs.speed} showDamage={prefs.damageNumbers}/></div>

  <header className="tc-ref-top">
   <div className="tc-ref-metrics">
    <div><span>◇</span><b>{e.loot.silver.toLocaleString()}</b><small>원정 Silver</small></div>
    <div><span>†</span><b>{e.kills}</b><small>처치</small></div>
    <div><span>◉</span><b>{bossFloor?trace+'%':e.floor<=2?'SAFE':'—'}</b><small>{bossFloor?'보스 흔적':'위험도'}</small></div>
   </div>
   <div className="tc-ref-floor"><span>{TOWERS[e.tower].name}</span><b>{e.floor}F <i>/ 10F</i></b></div>
   <button className="tc-ref-menu" onClick={()=>setPanel(panel==='menu'?null:'menu')} aria-label="전투 메뉴" aria-expanded={panel==='menu'}><i/><i/><i/></button>
  </header>

  <button className="tc-ref-flee" disabled={!playerTurn} onClick={onFlee} aria-label="귀환 시도"><Glyph name="tickets"/><small>귀환</small></button>

  {intent&&<div className="tc-ref-intent" role="alert"><b>{intent.kind==='CHARGE'?'강공격 준비':'반격 준비'}</b><span>{intent.skillName}</span></div>}

  <div className="tc-ref-effects player">{playerShield&&<span title={effectText(playerShield)}>보호막</span>}{buffs.slice(0,3).map(x=><span key={x.instanceId} title={EFFECTS[x.effectId]?.description}>{effectText(x)}</span>)}{playerReactive&&<span>반응 준비</span>}</div>

  <div className="tc-ref-sidecontrols">
   <button onClick={()=>setPanel('enemy')} aria-label="적 전투 정보"><span>◎</span><small>정보</small></button>
   <button onClick={cycleSpeed} aria-label="전투 속도"><span>▶</span><small>×{prefs.speed}</small></button>
  </div>

  <div className="tc-ref-actions">
   <button className="tc-ref-card" disabled={!playerTurn} onClick={onBasicAttack}><span className="tc-ref-card-art"><Glyph name={weapon}/></span><strong>기본 공격</strong><small>{WEAPONS[weapon].name}</small></button>
   {skillCards}
   <button className="tc-ref-card" disabled={!playerTurn} onClick={()=>setPanel('items')}><span className="tc-ref-card-art"><Glyph name="potions"/></span><strong>아이템</strong><small>포션</small></button>
  </div>

  <div className="tc-ref-turn">{e.phase==='PLAYER_TURN'?'행동을 선택하세요':e.phase==='MONSTER_TURN'?'적이 행동합니다':'전투 결과 처리 중'}</div>

  {panel&&<section className="tc-bpanel tc-ref-panel" aria-label="전투 보조 패널">
   <div className="tc-bpanel-head"><h2>{panel==='menu'?'원정 기록':panel==='items'?'원정 포션':'적 전투 정보'}</h2><button onClick={()=>setPanel(null)}>×</button></div>
   {panel==='menu'&&<><div className="tc-stat-grid"><div className="tc-stat"><small>Silver</small><b>{e.loot.silver.toLocaleString()}</b></div><div className="tc-stat"><small>처치</small><b>{e.kills}</b></div><div className="tc-stat"><small>공격</small><b>{Math.round(st.attack)}</b></div><div className="tc-stat"><small>방어</small><b>{Math.round(st.defense)}</b></div></div>{stronghold&&<div className="tc-floor-risk"><b>자원거점 점령 중 · {strongholdTime}</b><br/>포기하면 거점 보상은 사라지고 현재 원정 전리품만 안전 귀환합니다.<br/><button className="tc-action danger slim" disabled={!playerTurn} onClick={()=>{if(window.confirm('자원거점을 포기하고 현재 전리품을 가지고 귀환하시겠습니까?'))onAbandonStronghold();}}>거점을 포기하고 귀환</button></div>}<div className="tc-blog">{game.logs.slice(-5).map((line,i)=><div key={i}>{line}</div>)}{Array.from({length:Math.max(0,5-Math.min(5,game.logs.length))},(_,i)=><div key={'l'+i}/>)}</div><div className="tc-bprefs"><button onClick={onHome}>거점</button><button onClick={cycleSpeed}>속도 ×{prefs.speed}</button><button onClick={()=>updatePrefs({...prefs,damageNumbers:!prefs.damageNumbers})}>피해 {prefs.damageNumbers?'ON':'OFF'}</button><button onClick={()=>setPanel('enemy')}>적 정보</button></div></>}
   {panel==='items'&&<><div className="tc-floor-risk">회생 포션 ×{e.bag.revival} · 치명상 시 별도 선택</div><div className="tc-job-list">{generalPotionIds.map(p=><article className="tc-job" key={p}><div><b>{POTIONS[p].name}</b><small>{POTIONS[p].description}</small></div><button disabled={!canUsePotion(game,p)} onClick={()=>{setPanel(null);onPotion(p);}}>{e.bag[p]}개</button></article>)}</div><div/></>}
   {panel==='enemy'&&<><div className="tc-floor-risk">확정된 준비 행동과 현재 효과만 표시합니다.</div><div className="tc-skill-list">{intel.effects.slice(0,2).map(effect=><article key={effect.id}><strong>{effect.name}</strong><p>{effect.description}</p></article>)}{intel.skills.slice(0,3).map(skill=><article key={skill.id}><strong>{skill.name}</strong><p>{skill.description}</p><small>{skill.ready?'사용 가능':'대기 '+skill.cooldownRemaining+'턴'}</small></article>)}</div><button className="tc-action secondary" onClick={()=>setPanel(null)}>전투로 돌아가기</button></>}
  </section>}

  {e.pendingRevival&&<div className="tc-modalback"><section className="tc-modal"><h2>치명상을 입었습니다</h2><p>회생 포션 1개를 사용하면 최대 HP의 30%로 현재 전투를 이어갑니다. 보유 {e.bag.revival}개.</p><div className="tc-modal-actions"><button className="tc-action secondary" onClick={()=>onRevival(false)}>원정 종료</button><button className="tc-action" onClick={()=>onRevival(true)}>회생 포션 사용</button></div></section></div>}
 </div>;
}