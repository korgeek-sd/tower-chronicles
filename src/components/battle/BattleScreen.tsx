import {getJobCombatDefinition} from '../../game/jobs/framework';
import {combatRuntime} from '../../game/engine/battleLifecycle';
import {resourceCost} from '../../game/engine/combatResource';
import {isSilenced,isRooted} from '../../game/engine/effects';
import React,{useEffect,useRef,useState} from 'react';
import type {EquipmentItem,GameState,Potion} from '../../game/types';
import {EVENT_BALANCE} from '../../game/events/selector';
import {TOWERS,POTIONS,generalPotionIds,SKILLS} from '../../game/data/config';
import {EQUIPMENT_DEFINITIONS,EQUIPMENT_GRADE_NAMES} from '../../game/data/equipment';
import {assetUrl} from '../../game/data/graphics';
import {lootTotals} from '../../game/engine/loot';
import {stats,weaponOf} from '../../game/engine/state';
import {combatAudioEnabled,setCombatAudioEnabled,unlockCombatAudio} from './combatAudio';
import {playerRecoveryDelay} from './battleVfxTimeline';
import {BattleScene,type BattleActionCue} from './BattleScene';
import {titleById} from '../../game/data/cosmetics';
import {bossIdFor} from '../../game/engine/bossTracking';
import {skillTurnsLeft} from '../../game/engine/turns';
import {canPlayerAct,canUseSkill,canUsePotion} from '../../game/engine/combat';
import {resolvePlayerCombatKit} from '../../game/jobs/service';
import {skillVisualAssetFor} from '../../game/jobs/skillVisualAssets';
import {monsterCombatIntel} from './combatIntel';
import {loadPrefs,savePrefs,SPEEDS} from './prefs';
import type {BattlePrefs} from './prefs';
import {Glyph} from '../../ui/mobile';
import {strongholdRemainingMs} from '../../game/events/resourceStronghold';
import {useGameFeel} from '../../gameFeel/react/useGameFeel';

type Props={game:GameState;now?:number;onBasicAttack:()=>void;onSkill:(id:string)=>void;onPotion:(potion:Potion)=>void;onFlee:()=>void;onHome:()=>void;onRevival:(use:boolean)=>void;onAbandonStronghold?:()=>void};
const glyph:Record<string,string>={heavy:'sword',execute:'attack',guard:'defense',quick:'haste'};

export function BattleScreen({game,now,onSkill,onPotion,onFlee,onHome,onRevival,onAbandonStronghold}:Props){
 const e=game.expedition!,st=stats(game,e.equipment),weapon=weaponOf(game,e.equipment);
 const feel=useGameFeel();
 const lastFeelEvent=useRef(0),lastHp=useRef(e.hp),actionCueSeq=useRef(0);
 const [soundEnabled,setSoundEnabled]=useState(combatAudioEnabled);
 const [actionCue,setActionCue]=useState<BattleActionCue|null>(null);
 const recoveryEventId=useRef(game.combatEvents?.at(-1)?.id??0),recoveryTimer=useRef<ReturnType<typeof setTimeout>|null>(null),recoveringRef=useRef(false);
 const [recovering,setRecovering]=useState(false);
 const cuePlayerAction=(kind:BattleActionCue['kind'],action:()=>void)=>{if(recoveringRef.current)return;setActionCue({id:++actionCueSeq.current,kind});action();};
 useEffect(()=>{
  const fresh=(game.combatEvents??[]).filter(event=>event.id>lastFeelEvent.current);
  for(const event of fresh){
   if(event.absorbedByShield>0)feel.play('combat.guard');
   if(event.hpDamage<=0)continue;
   if(event.target==='monster')feel.play(event.critical?'combat.critical-hit':'combat.basic-hit');
   else feel.play('combat.player-damaged',{intensity:event.critical?'strong':'normal'});
  }
  if(fresh.length)lastFeelEvent.current=fresh.at(-1)!.id;
  if(e.hp>lastHp.current)feel.play('combat.heal');
  if(e.hp<=0&&lastHp.current>0)feel.play('combat.death');
  lastHp.current=e.hp;
 },[game.combatEvents,e.hp,feel]);
 const [panel,setPanel]=useState<'menu'|'items'|'enemy'|'loot'|null>(null);
 const equipmentLoot=e.loot.equipment??[],lootSummary=lootTotals(e.loot),enhancementStones=Math.max(0,Math.trunc(e.loot.items.enhancement_stone??0));
 const [dropToast,setDropToast]=useState<EquipmentItem|null>(null);
 const seenEquipmentIds=useRef(new Set(equipmentLoot.map(item=>item.id))),dropToastTimer=useRef<number|null>(null);
 const equipmentSignature=equipmentLoot.map(item=>item.id).join('|');
 useEffect(()=>{
  const fresh=equipmentLoot.filter(item=>!seenEquipmentIds.current.has(item.id));
  for(const item of equipmentLoot)seenEquipmentIds.current.add(item.id);
  const newest=fresh.at(-1);
  if(!newest)return;
  setDropToast(newest);
  if(dropToastTimer.current!==null)window.clearTimeout(dropToastTimer.current);
  dropToastTimer.current=window.setTimeout(()=>{setDropToast(null);dropToastTimer.current=null;},2400);
 },[equipmentSignature]);
 useEffect(()=>()=>{if(dropToastTimer.current!==null)window.clearTimeout(dropToastTimer.current);},[]);
 const intel=monsterCombatIntel(e),playerTurn=canPlayerAct(game),skillIds=resolvePlayerCombatKit(game).activeSkillIds;
 const [prefs,setPrefs]=useState<BattlePrefs>(loadPrefs);
 useEffect(()=>{
  const fresh=(game.combatEvents??[]).filter(event=>event.id>recoveryEventId.current);
  recoveryEventId.current=game.combatEvents?.at(-1)?.id??recoveryEventId.current;
  const delay=playerRecoveryDelay(fresh,prefs.speed);
  if(!delay)return;
  if(recoveryTimer.current!==null)clearTimeout(recoveryTimer.current);
  recoveringRef.current=true;setRecovering(true);
  recoveryTimer.current=setTimeout(()=>{recoveringRef.current=false;setRecovering(false);recoveryTimer.current=null;},delay);
 },[game.combatEvents,prefs.speed]);
 useEffect(()=>()=>{if(recoveryTimer.current!==null)clearTimeout(recoveryTimer.current);},[]);
 const updatePrefs=(next:BattlePrefs)=>{setPrefs(next);savePrefs(next);};
 const speedIndex=Math.max(0,SPEEDS.findIndex(v=>v===prefs.speed));
 const cycleSpeed=()=>updatePrefs({...prefs,speed:SPEEDS[(speedIndex+1)%SPEEDS.length]});
 const bossFloor=!!bossIdFor(e.tower,e.floor),trace=bossFloor?Math.round(e.bossTracking.progress/EVENT_BALANCE.bossMaxProgress*100):0;
 const intent=intel.intent.kind!=='NONE'?intel.intent:null;
 const stronghold=e.events.stronghold?.status==='ACTIVE'?e.events.stronghold:null;
 const strongholdMs=stronghold?strongholdRemainingMs(stronghold,now??Date.now()):0;
 const strongholdTime=String(Math.floor(strongholdMs/60_000)).padStart(2,'0')+':'+String(Math.floor(strongholdMs%60_000/1000)).padStart(2,'0');

 const skillSlots=Array.from({length:3},(_,i)=>skillIds[i]??'');
 const skillCards=skillSlots.map((id,i)=>{
  const jobSkill=id?getJobCombatDefinition(e.jobRuntime.jobId)?.skills.find(s=>s.id===id):undefined,skill=jobSkill??(id?SKILLS.find(s=>s.id===id):undefined),turns=skill?skillTurnsLeft(e,skill.id):0,mismatch=!!skill&&'weapons' in skill&&!skill.weapons.includes(weapon)&&!e.jobSnapshotId;
  const cost=jobSkill?.resource?.kind==='SPENDER'?resourceCost(e,jobSkill.resource):0;
  const reason=!skill?'빈 슬롯':isSilenced(e,'player')?'침묵':mismatch?'무기 불일치':turns?turns+'턴 대기':cost===null?'자원 부족':cost?cost+'칸 소비':'사용 가능';
  const skillArt=skill?skillVisualAssetFor(skill.id):null;
  return <button type="button" disabled={recovering||!skill||!canUseSkill(game,id)} className="tc-ref-card tc-feel-press" data-game-feel="press" key={i} onClick={()=>skill&&cuePlayerAction('skill',()=>onSkill(skill.id))}>
   <span className="tc-ref-card-art">{skillArt?<img className="tc-skill-art" src={assetUrl(skillArt)} alt="" aria-hidden="true" draggable={false} style={{width:'100%',height:'100%',objectFit:'contain',imageRendering:'pixelated',pointerEvents:'none'}}/>:<Glyph name={glyph[id]??'skills'}/>} {turns>0&&<b>{turns}</b>}</span>
   <strong>{skill?.name||'미구현'}</strong>
   <small>{reason}</small>
  </button>;
 });

 return <div className="tc-battle tc-battle-reference" onPointerDownCapture={unlockCombatAudio} onKeyDownCapture={unlockCombatAudio}>
  <div className="tc-battle-ornament top" aria-hidden="true"/>
  <div className="tc-battle-ornament bottom" aria-hidden="true"/>
  <div className="tc-battle-scene"><BattleScene expedition={e} combatEvents={game.combatEvents??[]} playerMaxHp={st.hp} appearanceId={game.cosmetics.selectedAppearanceId} titleName={titleById(game.cosmetics.selectedTitleId||'')?.name} speed={prefs.speed} showDamage={prefs.damageNumbers} weapon={weapon} actionCue={actionCue}/></div>

  <header className="tc-ref-top">
   <div className="tc-ref-metrics">
    <div><span>◇</span><b>{e.loot.silver.toLocaleString()}</b><small>원정 Silver</small></div>
    <div><span>†</span><b>{e.kills}</b><small>처치</small></div>
    <div><span>◉</span><b>{bossFloor?trace+'%':e.floor<=2?'SAFE':'—'}</b><small>{bossFloor?'보스 흔적':'위험도'}</small></div>
   </div>
   <div className="tc-ref-floor"><span>{TOWERS[e.tower].name}</span><b>{e.floor}F <i>/ 10F</i></b></div>
   <button className="tc-ref-menu" onClick={()=>setPanel(panel==='menu'?null:'menu')} aria-label="전투 메뉴" aria-expanded={panel==='menu'}><i/><i/><i/></button>
  </header>

  <button className="tc-ref-loot-entry tc-feel-press" data-game-feel="press" onClick={()=>setPanel('loot')} aria-label="원정 전리품 보기"><span>전리품</span><b>{lootSummary.equipment}</b><small>장비 · 재료 {lootSummary.materials}</small></button>

  {dropToast&&<div className={'tc-equipment-drop-toast grade-'+dropToast.grade} role="status" aria-live="polite"><small>특템 획득</small><b>{EQUIPMENT_GRADE_NAMES[dropToast.grade]} {EQUIPMENT_DEFINITIONS[dropToast.kind].name}</b><span>+{dropToast.enhancement} · 안전 귀환 시 보관함 확정</span></div>}

  {intent&&<div className="tc-ref-intent" role="alert"><b>{intent.kind==='CHARGE'?'강공격 준비':'반격 준비'}</b><span>{intent.skillName}</span></div>}


  <div className="tc-ref-actions">
   {skillCards}
   <button className="tc-ref-card tc-feel-press" data-game-feel="press" disabled={recovering||!playerTurn} onClick={()=>setPanel('items')}><span className="tc-ref-card-art"><Glyph name="potions"/></span><strong>포션</strong><small>아이템</small></button>
   <button type="button" className="tc-ref-card tc-feel-press" data-game-feel="press" disabled={recovering||!playerTurn||isRooted(e,'player')} onClick={onFlee} aria-label="귀환 시도"><span className="tc-ref-card-art"><Glyph name="tickets"/></span><strong>귀환</strong><small>{isRooted(e,'player')?'속박':'거점'}</small></button>
  </div>

  <div className="tc-ref-turn">{e.phase==='PLAYER_TURN'?'행동을 선택하세요':e.phase==='MONSTER_TURN'?'적이 행동합니다':'전투 결과 처리 중'}</div>

  {panel&&<section className="tc-bpanel tc-ref-panel" aria-label="전투 보조 패널">
   <div className="tc-bpanel-head"><h2>{panel==='menu'?'원정 기록':panel==='items'?'원정 포션':panel==='loot'?'원정 전리품':'적 전투 정보'}</h2><button onClick={()=>setPanel(null)}>×</button></div>
   {panel==='menu'&&<><div className="tc-stat-grid"><div className="tc-stat"><small>Silver</small><b>{e.loot.silver.toLocaleString()}</b></div><div className="tc-stat"><small>처치</small><b>{e.kills}</b></div><div className="tc-stat"><small>공격</small><b>{Math.round(st.attack)}</b></div><div className="tc-stat"><small>방어</small><b>{Math.round(st.defense)}</b></div></div>{stronghold&&<div className="tc-floor-risk"><b>자원거점 점령 중 · {strongholdTime}</b><br/>포기하면 거점 보상은 사라지고 현재 원정 전리품만 안전 귀환합니다.<br/><button className="tc-action danger slim" disabled={!playerTurn||!onAbandonStronghold} onClick={()=>{if(onAbandonStronghold&&window.confirm('자원거점을 포기하고 현재 전리품을 가지고 귀환하시겠습니까?'))onAbandonStronghold();}}>거점을 포기하고 귀환</button></div>}<div className="tc-blog">{game.logs.slice(-5).map((line,i)=><div key={i}>{line}</div>)}{Array.from({length:Math.max(0,5-Math.min(5,game.logs.length))},(_,i)=><div key={'l'+i}/>)}</div><div className="tc-bprefs"><button onClick={onHome}>거점</button><button aria-pressed={soundEnabled} onClick={()=>{const next=!soundEnabled;setSoundEnabled(next);setCombatAudioEnabled(next);if(next)unlockCombatAudio();}}>타격음 {soundEnabled?'ON':'OFF'}</button><button onClick={cycleSpeed}>속도 ×{prefs.speed}</button><button onClick={()=>updatePrefs({...prefs,damageNumbers:!prefs.damageNumbers})}>피해 {prefs.damageNumbers?'ON':'OFF'}</button><button onClick={()=>setPanel('enemy')}>적 정보</button></div></>}
   {panel==='items'&&<><div className="tc-floor-risk">회복 포션 {combatRuntime(e).healingPotionUses}/5회 사용 · 회생 포션 ×{e.bag.revival} · 치명상 시 별도 선택</div><div className="tc-job-list">{generalPotionIds.map(p=><article className="tc-job" key={p}><div><b>{POTIONS[p].name}</b><small>{POTIONS[p].description}</small></div><button className="tc-feel-press" data-game-feel="press" disabled={!canUsePotion(game,p)} onClick={()=>{setPanel(null);onPotion(p);}}>{e.bag[p]}개</button></article>)}</div><div/></>}
   {panel==='loot'&&<div className="tc-loot-panel-body"><div className="tc-loot-temporary"><b>안전 귀환 전 임시 보관</b><span>아직 내 재산이 아닙니다. 사망하면 이번 원정 전리품을 잃습니다.</span></div><div className="tc-loot-summary-grid"><div><small>Silver</small><b>{e.loot.silver.toLocaleString()}</b></div><div><small>재료</small><b>{lootSummary.materials}</b></div><div><small>장비</small><b>{lootSummary.equipment}</b></div><div><small>강화석</small><b>{enhancementStones}</b></div></div><div className="tc-loot-equipment-list">{equipmentLoot.length?equipmentLoot.slice(-4).reverse().map(item=><article className={'tc-loot-equipment-card grade-'+item.grade} key={item.id}><span>{EQUIPMENT_GRADE_NAMES[item.grade]}</span><div><b>{EQUIPMENT_DEFINITIONS[item.kind].name}</b><small>+{item.enhancement} · 안전 귀환 시 보관함 저장</small></div></article>):<div className="tc-loot-empty">아직 획득한 장비가 없습니다.</div>}</div><div className="tc-loot-panel-foot"><span>입장권 {lootSummary.tickets} · 스킬북 {lootSummary.skillBooks}</span><button className="tc-action secondary" onClick={()=>setPanel(null)}>전투로 돌아가기</button></div></div>}
   {panel==='enemy'&&<><div className="tc-floor-risk">확정된 준비 행동과 현재 효과만 표시합니다.</div><div className="tc-skill-list">{intel.effects.slice(0,2).map(effect=><article key={effect.id}><strong>{effect.name}</strong><p>{effect.description}</p></article>)}{intel.skills.slice(0,3).map(skill=><article key={skill.id}><strong>{skill.name}</strong><p>{skill.description}</p><small>{skill.ready?'사용 가능':'대기 '+skill.cooldownRemaining+'턴'}</small></article>)}</div><button className="tc-action secondary" onClick={()=>setPanel(null)}>전투로 돌아가기</button></>}
  </section>}

  {e.pendingRevival&&<div className="tc-modalback"><section className="tc-modal"><h2>치명상을 입었습니다</h2><p>회생 포션 1개를 사용하면 최대 HP의 30%로 현재 전투를 이어갑니다. 보유 {e.bag.revival}개.</p><div className="tc-modal-actions"><button className="tc-action secondary" onClick={()=>onRevival(false)}>원정 종료</button><button className="tc-action" onClick={()=>onRevival(true)}>회생 포션 사용</button></div></section></div>}
 </div>;
}
