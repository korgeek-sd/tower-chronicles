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

type Props={game:GameState;onBasicAttack:()=>void;onSkill:(id:string)=>void;onPotion:(potion:Potion)=>void;onFlee:()=>void;onHome:()=>void;onRevival:(use:boolean)=>void};
const glyph:Record<string,string>={heavy:'sword',execute:'attack',guard:'defense',quick:'haste'};
export function BattleScreen({game,onBasicAttack,onSkill,onPotion,onFlee,onHome,onRevival}:Props){
 const e=game.expedition!,st=stats(game,e.equipment),weapon=weaponOf(game,e.equipment),[panel,setPanel]=useState<'menu'|'items'|'enemy'|null>(null),playerReactive=reactivePreparedSkill(e,'player'),playerShield=activeShield(e,'player'),intel=monsterCombatIntel(e),buffs=e.playerEffects,playerTurn=canPlayerAct(game),skillIds=resolvePlayerCombatKit(game).activeSkillIds,[prefs,setPrefs]=useState<BattlePrefs>(loadPrefs);
 const updatePrefs=(next:BattlePrefs)=>{setPrefs(next);savePrefs(next);};
 const cards=skillIds.map((id,i)=>{const skill=SKILLS.find(s=>s.id===id),turns=skill?skillTurnsLeft(e,skill.id):0,mismatch=!!skill&&!skill.weapons.includes(weapon)&&!e.jobSnapshotId;return <button type="button" disabled={!skill||!canUseSkill(game,id||'')} className="tc-baction" key={i} onClick={()=>skill&&onSkill(skill.id)}><Glyph name={glyph[id]??'skills'}/><div><strong>{skill?.name||'미구현'}</strong><small>{mismatch?'무기 불일치':turns?turns+'턴 대기':'사용 가능'}</small></div></button>;});
 const intent=intel.intent.kind!=='NONE'?intel.intent:null;
 return <div className="tc-battle">
  <div className="tc-battle-scene"><BattleScene expedition={e} combatEvents={game.combatEvents??[]} playerMaxHp={st.hp} appearanceId={game.cosmetics.selectedAppearanceId} titleName={titleById(game.cosmetics.selectedTitleId||'')?.name} speed={prefs.speed} showDamage={prefs.damageNumbers}/></div>
  <div className="tc-bhud top"><div className="tc-btitle"><small>{TOWERS[e.tower].name} · {e.floor}F / 10F</small><b>{e.floor<=2?'SAFE 구간':e.floor<=5?'경쟁 구간':'보스 구간'} · {e.kills}체 처치</b></div><button className="tc-bmenu" onClick={()=>setPanel(panel==='menu'?null:'menu')} aria-label="전투 메뉴">☰</button></div>
  {intent&&<div className="tc-b-intent" role="alert"><b>{intent.kind==='CHARGE'?'강공격 준비':'반격 준비'}</b>{intent.skillName}{intent.description&&<small> · {intent.description}</small>}</div>}
  <div className="tc-b-effects">{playerShield&&<span>내 보호막 {effectText(playerShield)}</span>}{intel.shield&&<span>적 보호막 {intel.shield.shieldCurrent??intel.shield.shieldHits}</span>}{buffs.slice(0,2).map(x=><span key={x.instanceId} title={EFFECTS[x.effectId]?.description}>{effectText(x)}</span>)}{playerReactive&&<span>반응 준비 {playerReactive.prepare.name}</span>}</div>
  <div className="tc-b-state">{e.phase==='PLAYER_TURN'?'내 턴 · 행동 선택':e.phase==='MONSTER_TURN'?'적의 턴':'전투 종료'}{bossIdFor(e.tower,e.floor)?' · 흔적 '+e.bossTracking.progress+'/'+EVENT_BALANCE.bossMaxProgress:''}</div>
  <div className="tc-bactions">
   <button className="tc-baction" disabled={!playerTurn} onClick={onBasicAttack}><Glyph name={weapon}/><div><strong>기본 공격</strong><small>{WEAPONS[weapon].name}</small></div></button>
   {cards}
   <button className="tc-baction" disabled={!playerTurn} onClick={()=>setPanel('items')}><Glyph name="potions"/><div><strong>아이템</strong><small>포션 선택</small></div></button>
   <button className="tc-baction" disabled={!playerTurn} onClick={onFlee}><Glyph name="tickets"/><div><strong>귀환 시도</strong><small>적 행동 후 이탈</small></div></button>
  </div>
  {panel&&<section className="tc-bpanel" aria-label="전투 보조 패널">
   <div className="tc-bpanel-head"><h2>{panel==='menu'?'원정 기록':panel==='items'?'원정 포션':'적 전투 정보'}</h2><button onClick={()=>setPanel(null)}>×</button></div>
   {panel==='menu'&&<><div className="tc-stat-grid"><div className="tc-stat"><small>Silver</small><b>{e.loot.silver.toLocaleString()}</b></div><div className="tc-stat"><small>처치</small><b>{e.kills}</b></div><div className="tc-stat"><small>공격</small><b>{Math.round(st.attack)}</b></div><div className="tc-stat"><small>방어</small><b>{Math.round(st.defense)}</b></div></div><div className="tc-blog">{game.logs.slice(-5).map((line,i)=><div key={i}>{line}</div>)}{Array.from({length:Math.max(0,5-Math.min(5,game.logs.length))},(_,i)=><div key={'l'+i}/>)}</div><div className="tc-bprefs"><button onClick={onHome}>거점</button>{SPEEDS.slice(0,2).map(v=><button key={v} disabled={prefs.speed===v} onClick={()=>updatePrefs({...prefs,speed:v})}>{v}배</button>)}<button onClick={()=>updatePrefs({...prefs,damageNumbers:!prefs.damageNumbers})}>피해 {prefs.damageNumbers?'ON':'OFF'}</button></div></>}
   {panel==='items'&&<><div className="tc-floor-risk">회생 포션 ×{e.bag.revival} · 치명상 시 별도 선택</div><div className="tc-job-list">{generalPotionIds.map(p=><article className="tc-job" key={p}><div><b>{POTIONS[p].name}</b><small>{POTIONS[p].description}</small></div><button disabled={!canUsePotion(game,p)} onClick={()=>{setPanel(null);onPotion(p);}}>{e.bag[p]}개</button></article>)}</div><div/></>}
   {panel==='enemy'&&<><div className="tc-floor-risk">확정된 준비 행동만 경고합니다. 사용 가능 표시는 다음 행동 예측이 아닙니다.</div><div className="tc-skill-list">{intel.skills.slice(0,3).map(skill=><article key={skill.id}><strong>{skill.name}</strong><p>{skill.description}</p><small>{skill.ready?'사용 가능':'대기 '+skill.cooldownRemaining+'턴'}</small></article>)}</div><button className="tc-action secondary" onClick={()=>setPanel(null)}>전투로 돌아가기</button></>}
   {panel==='menu'&&<button className="tc-action secondary" onClick={()=>setPanel('enemy')}>적 전투 정보 보기</button>}
  </section>}
  {e.pendingRevival&&<div className="tc-modalback"><section className="tc-modal"><h2>치명상을 입었습니다</h2><p>회생 포션 1개를 사용하면 최대 HP의 30%로 현재 전투를 이어갑니다. 보유 {e.bag.revival}개.</p><div className="tc-modal-actions"><button className="tc-action secondary" onClick={()=>onRevival(false)}>원정 종료</button><button className="tc-action" onClick={()=>onRevival(true)}>회생 포션 사용</button></div></section></div>}
 </div>;
}
