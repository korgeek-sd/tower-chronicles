import {EVENT_BALANCE} from '../../game/events/selector';
import {isBossFloor} from '../../game/data/graphics';
import React,{useState} from 'react';
import type {GameState,Potion} from '../../game/types';
import {TOWERS,tierOf,POTIONS,potionIds,generalPotionIds,WEAPONS,SKILLS,GEAR_MASTERY_NAMES} from '../../game/data/config';
import {stats,weaponOf} from '../../game/engine/state';
import {BattleScene} from './BattleScene';
import {ExpeditionLootPanel} from '../ExpeditionLoot';
import {titleById} from '../../game/data/cosmetics';
import {bossIdFor} from '../../game/engine/bossTracking';
import {skillTurnsLeft} from '../../game/engine/turns';
import {canPlayerAct,canUseSkill,canUsePotion} from '../../game/engine/combat';
import {activeShield,EFFECTS} from '../../game/engine/effects';
import {resolvePlayerCombatKit} from '../../game/jobs/service';
import {preparedMonsterSkill} from '../../game/engine/monsterAi';
import {reactivePreparedSkill} from '../../game/engine/reactions';
import type {BattleFxPlaybackEvent} from './battleFxPresentation';

type Props={game:GameState;onBasicAttack:()=>void;onSkill:(id:string)=>void;onPotion:(potion:Potion)=>void;onFlee:()=>void;onHome:()=>void;onRevival:(use:boolean)=>void;fxEvents:BattleFxPlaybackEvent[];presentationBusy:boolean};
const art:Record<string,string>={heavy:'skill-heavy',execute:'skill-execute',guard:'skill-guard',quick:'skill-quick'};
export function BattleScreen({game,onBasicAttack,onSkill,onPotion,onFlee,onHome,onRevival,fxEvents,presentationBusy}:Props){
 const e=game.expedition!,st=stats(game,e.equipment),weapon=weaponOf(game,e.equipment),[menu,setMenu]=useState(false),[itemsOpen,setItemsOpen]=useState(false),prepared=preparedMonsterSkill(e.monster,e.monsterRuntime),monsterReactive=reactivePreparedSkill(e,'monster'),playerReactive=reactivePreparedSkill(e,'player'),playerShield=activeShield(e,'player'),monsterShield=activeShield(e,'monster');
 const buffs=e.playerEffects,playerTurn=canPlayerAct(game)&&!presentationBusy,skillIds=resolvePlayerCombatKit(game).activeSkillIds;
 const cards=skillIds.map((id,i)=>{const skill=SKILLS.find(s=>s.id===id),turns=skill?skillTurnsLeft(e,skill.id):0,mismatch=!!skill&&!skill.weapons.includes(weapon)&&!e.jobSnapshotId;return <button type="button" disabled={!skill||!canUseSkill(game,id||'')} className={'battle-card art-'+(id||'empty')+(mismatch?' unavailable':'')} key={i} onClick={()=>skill&&onSkill(skill.id)} aria-label={`${skill?.name||'미구현 스킬'}, ${turns}턴 대기`}><div className="card-art">{skill?<img src={`./assets/ui/inventory/${art[skill.id]}.svg?v=2`} alt={`${skill.name} 아이콘`}/>:<span>◇</span>}<span className="turn-badge" title="내 플레이어 턴 기준 남은 턴">⌛ {turns}</span></div><strong>{skill?.name||'전투 키트 미구현'}</strong><small>{mismatch?'무기 불일치':skill?.effect==='damage'?'직접 사용':skill?'자신 강화':'미장착'}</small></button>;});
 return <div className="battle-screen immersive-battle">
  <BattleScene expedition={e} playerMaxHp={st.hp} appearanceId={game.cosmetics.selectedAppearanceId} titleName={titleById(game.cosmetics.selectedTitleId||'')?.name} fxEvents={fxEvents}/>
  <div className="battle-topbar"><div className="battle-currency"><span>◈</span><b>{game.silver.toLocaleString()}</b><small>Silver</small></div><div className="battle-currency gold"><img className="currency-art" src="./assets/ui/navigation/gold.png" alt=""/><b>{game.market.gold.toLocaleString()}</b><small>Gold</small></div><button className="battle-menu-toggle" onClick={()=>setMenu(!menu)} aria-label="전투 메뉴" aria-expanded={menu}>☰</button></div>
  <div className="battle-location"><img className="navigation-art" src="./assets/ui/navigation/towers.png" alt=""/><h1>{TOWERS[e.tower].name}</h1><b>{e.floor}F <small>/ 10F · {e.floor<=2?'SAFE · PK 불가':e.floor<=5?'PK 가능':'보스 구간'}</small></b></div>
  <div className="battle-route" aria-label={`현재 ${e.floor}층`}><div>{Array.from({length:10},(_,i)=>{const floor=i+1;return <i key={floor} className={i===e.floor-1?'current':i<e.floor-1?'passed':''}>{floor>=6?'♜':'◆'}</i>;})}</div><p>{e.floor<=2?'SAFE · PK 불가':e.floor<=5?'일반 경쟁 구간 · PK 가능':'보스 구간 · 일반 탐사 및 보스 조우'}</p></div>
  <aside className="enemy-facts"><small>적 능력</small><span>⚔ {Math.round(e.monster.attack)} <em>공격</em></span><span>⬡ {Math.round(e.monster.defense)} <em>방어</em></span></aside>
  {(playerShield||monsterShield)&&<div className="shield-status" aria-label="보호막 상태">{playerShield&&<span className="player-shield"><b>⬢ 내 보호막</b>{playerShield.currentShield} / {EFFECTS[playerShield.effectId]?.shieldAmount}</span>}{monsterShield&&<span className="monster-shield"><b>⬢ 적 보호막</b>{monsterShield.currentShield} / {EFFECTS[monsterShield.effectId]?.shieldAmount}</span>}</div>}
  {e.monsterEffects.length>0&&<div className="monster-effects" aria-label="몬스터 효과">{e.monsterEffects.map(effect=><span key={effect.instanceId} title={`${EFFECTS[effect.effectId]?.name||effect.effectId} · ${effect.remainingDuration}턴 · ${effect.stackCount}중첩`}>{EFFECTS[effect.effectId]?.name||effect.effectId}{effect.currentShield!==undefined?' '+effect.currentShield:''}{effect.stackCount>1?' ×'+effect.stackCount:''}</span>)}</div>}
  <div className="player-effects" aria-label="플레이어 효과">{buffs.length?buffs.map(effect=><span key={effect.instanceId} title={`${EFFECTS[effect.effectId]?.name||effect.effectId} · ${effect.remainingDuration}턴 · ${effect.stackCount}중첩`}>{EFFECTS[effect.effectId]?.name||effect.effectId}{effect.currentShield!==undefined?' '+effect.currentShield:''}{effect.stackCount>1?' ×'+effect.stackCount:''} · {effect.remainingDuration}턴</span>):<small>{WEAPONS[weapon].name} 장착 · 효과 없음</small>}</div>
  {(prepared||monsterReactive)&&<div className="monster-prepared" role="alert">{prepared&&<span><b>⚠ 강공 준비</b>{prepared.name}</span>}{monsterReactive&&<span><b>⚠ 반격 준비</b>{monsterReactive.prepare.name}</span>}</div>}
  {playerReactive&&<div className="player-reactive" role="status"><b>반응 준비</b><span>{playerReactive.prepare.name}</span></div>}
  <div className="battle-state-line" role="status">{e.phase==='PLAYER_TURN'?'내 턴 · 행동을 선택하세요':e.phase==='MONSTER_TURN'?'적의 턴':e.bossTracking.pendingBossId?'보스 조우 선택':'전투 종료'} · {e.kills}마리 처치</div>
  {bossIdFor(e.tower,e.floor)&&<div className="battle-boss-progress">보스 흔적 <b>{e.bossTracking.progress+' / '+EVENT_BALANCE.bossMaxProgress}</b><progress value={e.bossTracking.progress} max={EVENT_BALANCE.bossMaxProgress}/></div>}
  <div className="battle-deck"><button type="button" className="battle-card art-heavy" disabled={!playerTurn} onClick={onBasicAttack} aria-label="기본 공격"><div className="card-art"><img src="./assets/ui/inventory/sword-t1.png" alt=""/></div><strong>기본 공격</strong><small>{weapon==='bow'?'2회 타격':'직접 사용'}</small></button>{cards}<button type="button" className="battle-card art-health" disabled={!playerTurn} onClick={()=>setItemsOpen(true)} aria-expanded={itemsOpen} aria-label="전투 아이템"><div className="card-art"><span>⚗</span></div><strong>아이템</strong><small>포션 선택</small></button><button type="button" className="battle-card art-empty" disabled={!playerTurn} onClick={onFlee} aria-label="도망가기"><div className="card-art"><span>⇥</span></div><strong>도망가기</strong><small>적 행동 후 귀환</small></button></div>
  {itemsOpen&&<section className="battle-item-panel" aria-label="전투 아이템"><div><h2>원정 포션</h2><button type="button" onClick={()=>setItemsOpen(false)} aria-label="아이템 패널 닫기">×</button></div><p>패널을 여닫는 것은 행동을 소비하지 않습니다.</p><p>회생 포션 ×{e.bag.revival} · 치명 피해 시 선택 가능</p>{generalPotionIds.map(p=><button type="button" key={p} disabled={!canUsePotion(game,p)} onClick={()=>{setItemsOpen(false);onPotion(p);}}><span>{POTIONS[p].icon} {POTIONS[p].name}</span><b>{e.bag[p]}개</b><small>{POTIONS[p].description}</small></button>)}</section>}
  {e.pendingRevival&&<div className="battle-dialog-backdrop" role="presentation"><section className="battle-encounter revival-dialog" role="dialog" aria-modal="true" aria-labelledby="revival-title"><h2 id="revival-title">치명상을 입었습니다</h2><p>회생 포션을 사용하면 1개를 소비하고 최대 HP의 30%로 현재 전투를 이어갑니다.</p><div className="mini-stats"><span>보유 <b>{e.bag.revival}개</b></span><span>회복 <b>최대 HP 30%</b></span></div><button className="primary" onClick={()=>onRevival(true)}>회생 포션 사용</button><button onClick={()=>onRevival(false)}>사용하지 않고 원정 종료</button></section></div>}
  <div className="battle-bottom"><span>─ ◇ ─ ⚒ ─ ◇ ─</span><p>더 깊이. 더 진실에.</p><button disabled={!playerTurn} onClick={onFlee}>⇥ 도망가기</button></div>
  {menu&&<section className="battle-drawer" aria-label="전투 메뉴"><div className="drawer-heading"><h2>원정 기록</h2><button onClick={()=>setMenu(false)} aria-label="전투 메뉴 닫기">×</button></div><button onClick={onHome}>거점 / 장비 / 스킬 관리 →</button><ExpeditionLootPanel expedition={e}/><h3>전투 기록</h3><div className="logs" role="log">{game.logs.map((line,i)=><div key={i}>{line}</div>)}</div><h3>원정 포션</h3>{potionIds.map(p=><p key={p}>{POTIONS[p].name} · {e.bag[p]}개</p>)}<details><summary>장비 숙련도</summary>{Object.entries(game.gearMastery).map(([id,m])=><p key={id}>{GEAR_MASTERY_NAMES[id as keyof typeof GEAR_MASTERY_NAMES]} · T{m.unlockedTier} · {m.progress}</p>)}</details><p>도망가면 적이 한 번 공격합니다. 생존 시 획득물을 정산하고 귀환합니다.</p><button disabled={!playerTurn} onClick={onFlee}>도망가기</button></section>}

 </div>;
}

