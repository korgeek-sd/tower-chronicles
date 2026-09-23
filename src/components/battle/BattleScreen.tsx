import React,{useState} from 'react';
import type {ActiveEffect,GameState,Potion} from '../../game/types';
import {TOWERS,POTIONS,SKILLS,generalPotionIds,WEAPONS,GEAR_MASTERY_NAMES} from '../../game/data/config';
import {EVENT_BALANCE} from '../../game/events/selector';
import {stats,weaponOf} from '../../game/engine/state';
import {activeShield,EFFECTS} from '../../game/engine/effects';
import {canPlayerAct,canUseSkill,canUsePotion} from '../../game/engine/combat';
import {skillTurnsLeft} from '../../game/engine/turns';
import {bossIdFor} from '../../game/engine/bossTracking';
import {preparedMonsterSkill} from '../../game/engine/monsterAi';
import {reactivePreparedSkill} from '../../game/engine/reactions';
import {resolvePlayerCombatKit} from '../../game/jobs/service';
import {titleById} from '../../game/data/cosmetics';
import {BattleScene} from './BattleScene';
import {BattleDialog,BattleEffects,BattleVitals} from './BattlePanels';
import {ExpeditionLootPanel} from '../ExpeditionLoot';

type Props={game:GameState;onBasicAttack:()=>void;onSkill:(id:string)=>void;onPotion:(potion:Potion)=>void;onFlee:()=>void;onHome:()=>void;onRevival:(use:boolean)=>void};
type Sheet='menu'|'loot'|'log'|'potions'|'skills'|null;
const skillArt:Record<string,string>={heavy:'sword',execute:'dagger',guard:'armor',quick:'boots'};
const format=(value:number)=>value.toLocaleString('ko-KR');
function Art({name,area='inventory'}:{name:string;area?:string}){return <img src={'./assets/ui/'+area+'/'+name+'.png'} alt="" draggable={false}/>;}

export function BattleScreen({game,onBasicAttack,onSkill,onPotion,onFlee,onHome,onRevival}:Props){
  const e=game.expedition!,st=stats(game,e.equipment),weapon=weaponOf(game,e.equipment);
  const [sheet,setSheet]=useState<Sheet>(null),[inspected,setInspected]=useState<ActiveEffect|null>(null);
  const playerTurn=canPlayerAct(game),prepared=preparedMonsterSkill(e.monster,e.monsterRuntime);
  const monsterReactive=reactivePreparedSkill(e,'monster'),playerReactive=reactivePreparedSkill(e,'player');
  const playerShield=activeShield(e,'player'),monsterShield=activeShield(e,'monster');
  const skillIds=resolvePlayerCombatKit(game).activeSkillIds;
  const potionCount=generalPotionIds.reduce((sum,id)=>sum+e.bag[id],0);
  const boss=!!e.events.activeBossId,tracking=!!bossIdFor(e.tower,e.floor);
  const title=titleById(game.cosmetics.selectedTitleId||'')?.name;
  const inspectEffect=(effect:ActiveEffect)=>{setSheet(null);setInspected(effect);};
  const openSheet=(value:Sheet)=>{setInspected(null);setSheet(value);};
  const skillReason=(id:string)=>{
    const skill=SKILLS.find(candidate=>candidate.id===id);
    if(!skill)return '준비 중';
    const turns=skillTurnsLeft(e,id);
    if(turns>0)return turns+'턴 대기';
    if(!e.jobSnapshotId&&!skill.weapons.includes(weapon))return '무기 불일치';
    if(!e.jobSnapshotId&&!game.learned.includes(id))return '미습득';
    if(!canUseSkill(game,id)&&playerTurn)return skill.condition==='enemyLow'?'적 HP 35% 이하':skill.condition==='selfLow'?'내 HP 70% 이하':'사용 불가';
    if(!playerTurn)return '적 행동 중';
    return skill.effect==='damage'?'공격력 '+Math.round(skill.value*100)+'%':skill.effect==='guard'?'받는 피해 −40%':'추가 효과 없음';
  };
  const currentStatus=e.pendingRevival?'회생 선택 대기':playerTurn?'내 턴':e.phase==='MONSTER_TURN'?'적의 턴':'전투 종료';
  return <div className="battle-screen expedition-battle">
    <div className="expedition-heading">
      <div className="expedition-location"><Art name="towers" area="navigation"/><div><small>노바르 · 원정 기록</small><h1>{TOWERS[e.tower].name}</h1></div></div>
      <span className="expedition-floor"><b>{e.floor}</b> / 10층</span>
      <button className="combat-icon-button" aria-label="전투 메뉴" onClick={()=>openSheet('menu')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
    </div>
    <div className="expedition-purse" aria-label="영구 보유 화폐"><span><Art name="13-silver-icon" area="pixel-v1"/><b>{format(game.silver)}</b><small>Silver</small></span><span><Art name="gold" area="navigation"/><b>{format(game.market.gold)}</b><small>Gold</small></span><small>보관함</small></div>

    <div className="encounter-frame">
      <BattleVitals name={e.monster.name} current={e.monster.currentHp} max={e.monster.hp} enemy shield={monsterShield} title={boss?'BOSS · 심층의 주인':'ENCOUNTER · 조우'}>
        <div className="enemy-statline"><span>공격 {Math.round(e.monster.attack)} · 방어 {Math.round(e.monster.defense)}</span><span>{boss?'보스 전투':'일반 전투'}</span></div>
        <BattleEffects effects={e.monsterEffects} onInspect={inspectEffect}/>
      </BattleVitals>
      {(prepared||monsterReactive)&&<div className="combat-intent" role="status">
          {prepared&&<div><span className="intent-mark">!</span><span><b>강공 준비 · {prepared.name}</b><small>다음 적 행동에 발동합니다</small></span></div>}
          {monsterReactive&&<div><span className="intent-mark">↶</span><span><b>반격 준비 · {monsterReactive.prepare.name}</b><small>직접 공격을 받으면 반응합니다</small></span></div>}
      </div>}
      <div className="encounter-art">
        <BattleScene expedition={e} playerMaxHp={st.hp} appearanceId={game.cosmetics.selectedAppearanceId} titleName={title}/>
        <div className="encounter-caption"><span>{boss?'심층 보스와 대치 중':'철과 돌 사이, 발소리가 멎는다.'}</span><span>{e.kills}마리 처치</span></div>
      </div>
      {tracking&&<div className="encounter-tracking"><span>{boss?'보스와 조우했습니다':'보스 흔적'}</span><progress aria-label="보스 추적도" value={e.bossTracking.progress} max={EVENT_BALANCE.bossMaxProgress}/><b>{e.bossTracking.progress} / {EVENT_BALANCE.bossMaxProgress}</b></div>}
    </div>

    <div className="combat-console">
      <BattleVitals name={title?'「'+title+'」 모험가':'모험가'} current={e.hp} max={st.hp} shield={playerShield}>
        <div className="player-meta"><span>{WEAPONS[weapon].name} 장착</span><span className={'combat-turn '+(playerTurn?'is-ready':'')} role="status"><i/>{currentStatus}</span></div>
        <BattleEffects effects={e.playerEffects} onInspect={inspectEffect}/>
        {playerReactive&&<p className="player-response">반응 준비 · {playerReactive.prepare.name}</p>}
      </BattleVitals>
      <div className="combat-action-heading"><span>{playerTurn?'이번 턴의 행동을 선택하세요':'적의 행동을 기다리는 중'}</span><button onClick={()=>openSheet('skills')}>스킬 정보 <span>ⓘ</span></button></div>
      <div className="combat-actions">
        <button className="combat-action basic-action" disabled={!playerTurn} onClick={onBasicAttack} aria-label="기본 공격"><Art name={weapon}/><strong>기본 공격</strong><small>{weapon==='bow'?'2회 타격':'1회 타격'}</small></button>
        {skillIds.map((id,index)=>{
          const skill=SKILLS.find(candidate=>candidate.id===id),turns=skill?skillTurnsLeft(e,skill.id):0;
          return <button className="combat-action" key={index} disabled={!skill||!canUseSkill(game,id)} onClick={()=>skill&&onSkill(skill.id)} aria-label={(skill?.name??'미구현 스킬')+', '+skillReason(id)}>
            {skill?<Art name={skillArt[skill.id]??'attack'}/>:<span className="empty-action">◇</span>}
            {turns>0&&<span className="combat-cooldown">{turns}<small>턴</small></span>}
            <strong>{skill?.name??'미구현'}</strong><small>{skillReason(id)}</small>
          </button>;
        })}
      </div>
      <div className="combat-utilities">
        <button onClick={()=>openSheet('potions')} aria-label="전투 아이템"><Art name="health"/><span>포션 <b>{potionCount}</b></span></button>
        <button onClick={()=>openSheet('loot')} aria-label="원정 전리품"><Art name="inventory" area="navigation"/><span>전리품 <b>+{format(e.loot.silver)}</b></span></button>
        <button className="combat-flee" disabled={!playerTurn} onClick={onFlee} aria-label="도망가기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H4v16h6M9 12h12m-5-5 5 5-5 5"/></svg><span>도망<small>적 행동 후 귀환</small></span></button>
      </div>
      <button className="combat-log-peek" onClick={()=>openSheet('log')} aria-label="전체 전투 기록"><span className="log-label">기록</span><span>{game.logs.at(-1)||'원정을 시작했습니다.'}</span><b>›</b></button>
    </div>

    {sheet&&!e.pendingRevival&&<BattleDialog title={sheet==='menu'?'원정 메뉴':sheet==='loot'?'이번 원정 전리품':sheet==='log'?'전투 기록':sheet==='potions'?'원정 포션':'전투 스킬'} onClose={()=>setSheet(null)}>
      {sheet==='menu'&&<><p>{TOWERS[e.tower].name} · {e.floor}층 · {e.kills}마리 처치</p><button className="dialog-primary" onClick={onHome}>거점 / 장비 / 스킬 관리</button><p className="dialog-muted">화면을 이동해도 원정은 유지됩니다. 전리품은 살아서 귀환해야 보관됩니다.</p><button className="dialog-row" onClick={()=>setSheet('loot')}>원정 전리품 <span>›</span></button><button className="dialog-row" onClick={()=>setSheet('log')}>전체 전투 기록 <span>›</span></button><details><summary>장비 숙련도</summary>{Object.entries(game.gearMastery).map(([id,m])=><p key={id}>{GEAR_MASTERY_NAMES[id as keyof typeof GEAR_MASTERY_NAMES]} · T{m.unlockedTier} · {m.progress}</p>)}</details></>}
      {sheet==='loot'&&<ExpeditionLootPanel expedition={e}/>}
      {sheet==='log'&&<div className="combat-full-log" role="log">{game.logs.map((line,index)=><p key={index}><span>{String(index+1).padStart(2,'0')}</span>{line}</p>)}</div>}
      {sheet==='potions'&&<><p className="dialog-muted">사용하면 행동 1회를 소비합니다. 창을 여닫는 동안에는 행동을 소비하지 않습니다.</p>{generalPotionIds.map(id=><button className="combat-potion-choice" key={id} disabled={!canUsePotion(game,id)} onClick={()=>{setSheet(null);onPotion(id);}}><Art name={id}/><span><strong>{POTIONS[id].name} 포션</strong><small>최대 HP의 {Math.round(POTIONS[id].healRatio*100)}% 회복{!playerTurn?' · 내 턴에 사용':e.hp>=st.hp?' · HP가 가득 찼습니다':e.bag[id]===0?' · 보유 수량 없음':''}</small></span><b>{e.bag[id]}개</b></button>)}<p className="dialog-muted">회생 포션 {e.bag.revival}개 · 치명 피해를 받으면 사용 여부를 선택합니다.</p></>}
      {sheet==='skills'&&<><p className="dialog-muted">행동 버튼을 누르면 즉시 사용합니다. 스킬 대기 시간은 내 턴을 기준으로 감소합니다.</p>{skillIds.map((id,index)=>{const skill=SKILLS.find(candidate=>candidate.id===id);return <div className="combat-skill-detail" key={index}><h3>{skill?.name??'미구현 스킬'}</h3><p>{skill?.effect==='guard'?'4턴 동안 받는 피해가 40% 감소합니다.':skill?.description??'이 직업의 전투 스킬은 아직 준비 중입니다.'}</p><small>{skill?'재사용 대기 '+skill.cooldown+'턴 · ':''}{skillReason(id)}</small></div>;})}</>}
    </BattleDialog>}
    {inspected&&!e.pendingRevival&&<BattleDialog title={EFFECTS[inspected.effectId]?.name??inspected.effectId} onClose={()=>setInspected(null)}><p>{EFFECTS[inspected.effectId]?.description??'적용 중인 효과입니다.'}</p><p>{inspected.stackCount}중첩 · 확인 시점 기준 {inspected.remainingDuration}턴 남음</p></BattleDialog>}
    {e.pendingRevival&&<BattleDialog title="아직, 돌아갈 수 있습니다"><p>치명상을 입었습니다. 회생 포션으로 최대 HP의 30%를 회복하고 전투를 이어갈 수 있습니다.</p><p>회생 포션 <b>{e.bag.revival}개</b></p><button className="dialog-primary" onClick={()=>onRevival(true)}>회생 포션 사용</button><button className="dialog-danger" onClick={()=>onRevival(false)}>사용하지 않고 원정 종료</button></BattleDialog>}
  </div>;
}



