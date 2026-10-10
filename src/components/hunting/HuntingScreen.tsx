import {HUNT_MONSTERS} from '../../game/hunting/encounters';
import {monsterSkillDescription} from '../../game/hunting/monsterSkills';
import {useGameFeel} from '../../gameFeel/react/useGameFeel';
import {readGameFeelPreferences} from '../../gameFeel/preferences';
import React from 'react';
import type {GameState} from '../../game/types';
import {HUNT_MAPS,huntingProgress,huntingLevel,recoverVitality,VITALITY_INTERVAL,type HuntingState,type HuntMapId} from '../../game/hunting/model';
import {stats} from '../../game/engine/state';
import {assetUrl,playerGraphicFor} from '../../game/data/graphics';
import {equipmentItemName,EQUIPMENT_DEFINITIONS} from '../../game/data/equipment';
import {Glyph} from '../../ui/mobile';
type Props={game:GameState;hunting:HuntingState|null;now:number;busy:boolean;error?:string;nickname?:string;onHunt:(id:HuntMapId)=>void;onSettings:()=>void;onRetry?:()=>void;previewAppearance?:boolean};
function Hp({label,value,max}:{label:string;value:number;max:number}){
 return <div className="tc-hunt-hp"><div><span>HP</span><b>{Math.round(value).toLocaleString()} / {Math.round(max).toLocaleString()}</b></div><div role="progressbar" aria-label={label+' HP'} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><i style={{width:Math.max(0,Math.min(100,value/max*100))+'%'}}/></div></div>;
}
export function HuntingScreen({game,hunting,now,busy,error,nickname,onHunt,onRetry,previewAppearance}:Props){
 const feel=useGameFeel();
 const [submitting,setSubmitting]=React.useState(false),[feedbackRevision,setFeedbackRevision]=React.useState(0);
 const huntingNow=busy||submitting;
 const motionOff=readGameFeelPreferences();
 const [selected,setSelected]=React.useState<HuntMapId>(hunting?.lastResult?.mapId??'plains');
 const destination=HUNT_MAPS.find(m=>m.id===selected)!;
 const [view,setView]=React.useState<'regions'|'result'>('regions');
 const pendingHunt=React.useRef(false);
 const previousResult=React.useRef(hunting?.lastResult);
 React.useEffect(()=>{
  if(pendingHunt.current&&hunting?.lastResult&&previousResult.current!==hunting.lastResult){pendingHunt.current=false;setSubmitting(false);setFeedbackRevision(v=>v+1);setView('result');feel.play('hunt.result',{outcome:hunting.lastResult.outcome,grade:hunting.lastResult.equipment?.grade});}
  previousResult.current=hunting?.lastResult;
 },[hunting?.lastResult,feel]);
 React.useEffect(()=>{if(error){pendingHunt.current=false;setSubmitting(false);}},[error]);
 function startHunt(id:HuntMapId=selected){if(huntingNow||pendingHunt.current||!hunting||hunting.vitality<1||game.expedition)return;previousResult.current=hunting?.lastResult;pendingHunt.current=true;setSubmitting(true);feel.play('hunt.start');onHunt(id);}
 const logDialog=React.useRef<HTMLDialogElement>(null);
 const state=hunting?recoverVitality(hunting,now):null,result=state?.lastResult,map=HUNT_MAPS.find(m=>m.id===result?.mapId),player=result?.player??stats(game);
 const enemy=result?.monster??{...HUNT_MONSTERS[map?.id??'plains'][0],hp:map?.hp??1,attack:map?.attack??0,defense:map?.defense??0};
 const resultKey=result?.requestId??`${result?.createdAt}:${enemy.id}`;
 const seconds=state?Math.max(0,Math.ceil((VITALITY_INTERVAL-Math.max(0,now-state.recoveredAt))/1000)):0;
 const {level,exp,nextExp}=huntingProgress(state?.experience??0);
 const previewMode=previewAppearance??(typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('artPreview')==='grave-hound');
 const previewJob='assets/characters/preview/grave_hound_job_reference.jpg';
 const previewHound=HUNT_MONSTERS.plains[0];
 const art=previewMode?previewJob:playerGraphicFor(game.cosmetics.selectedAppearanceId).image.idle;
 return <section className={'tc-hunt'+(motionOff?' tc-hunt-motion-off':'')} aria-label="즉시 사냥" aria-busy={huntingNow} data-hunt-revision={feedbackRevision}>
  <header className="tc-hunt-heading"><div><small>노바르 외곽</small><h1>{view==='result'?'사냥 결과':'사냥터'}</h1></div><span>Lv. {level}</span>{view==='result'&&<button onClick={()=>setView('regions')}>사냥터로 <span aria-hidden="true">›</span></button>}</header>
  <div className="tc-hunt-vitality tc-hunt-panel"><Glyph name="haste"/><strong>활력 <b>{state?.vitality.toLocaleString()??'—'}</b><small>{state&&state.vitality>100?' (추가 지급)':' / 100'}</small></strong><div className="tc-hunt-energy" role="progressbar" aria-label="활력" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,state?.vitality??0)}><i style={{width:Math.min(100,state?.vitality??0)+'%'}}/></div><span>{!state?'불러오는 중':state.vitality>100?'추가 지급 활력 사용 중':state.vitality===100?'충전 완료':`회복 ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`}</span></div>
  <div className="tc-hunt-selection" hidden={view!=='regions'}>
  {previewMode&&<section className="tc-hunt-art-preview" aria-label="무덤파는 들개 · 직업 외형 비교">
    <div className="tc-hunt-art-preview-heading"><div><strong>외형 비교 미리보기</strong><small>실제 사냥 UI 크기로 두 이미지를 확인하세요.</small></div><a href="./">일반 화면</a></div>
    <div className="tc-hunt-art-preview-grid">
      <article className="tc-hunt-fighter tc-hunt-panel player"><div className="tc-hunt-art"><img src={assetUrl(previewJob)} alt="참고 직업 외형"/></div><div className="tc-hunt-fighter-info"><h2>직업 외형</h2><small>제공해주신 여성 검사 이미지</small></div></article>
      <article className="tc-hunt-fighter tc-hunt-panel enemy"><div className="tc-hunt-art"><img src={assetUrl(previewHound.image)} alt={previewHound.name}/></div><div className="tc-hunt-fighter-info"><h2>{previewHound.name}</h2><small>실제 외곽 평야 등장 몬스터</small></div></article>
    </div>
    <p>외형 비교 전용입니다. 캐릭터 외형 설정이나 보상·사냥 확률은 변경하지 않습니다. 사냥을 진행하면 몬스터 10종 중 하나가 등장합니다.</p>
  </section>}
  <nav className="tc-hunt-cards" aria-label="사냥 지역">
   {[...HUNT_MAPS].reverse().map((m,i)=><button key={m.id} className={'tc-hunt-card tc-feel-press '+(selected===m.id?'selected':'')} data-game-feel="press" aria-pressed={selected===m.id} disabled={huntingNow} onClick={()=>setSelected(m.id)} style={{backgroundImage:`linear-gradient(90deg,rgba(10,12,10,.88),rgba(10,12,10,.15)),url(${assetUrl('assets/backgrounds/hunting/world-map.webp')})`,backgroundSize:'100% 100%,100% 500%',backgroundPosition:`center,center ${i*25}%`}}><span><strong>{m.name}</strong><small>추천 레벨 {m.recommendedLevel}</small></span><span className="tc-hunt-card-state" aria-hidden="true">{selected===m.id?'선택됨':'›'}</span></button>)}
  </nav>
  <section className="tc-hunt-destination tc-hunt-panel" aria-label="선택한 사냥터"><div><h2>{destination.name}</h2><p>추천 레벨 {destination.recommendedLevel}</p><small>경험치 {destination.exp} · 실버 {destination.silver.toLocaleString()}~{destination.silverMax.toLocaleString()}</small></div><button className="tc-hunt-enter tc-feel-press" data-game-feel="press" disabled={huntingNow||!state||state.vitality<1||!!game.expedition} onClick={()=>startHunt()}>{huntingNow?'사냥 중…':'입장하기'} <small>활력 1</small></button></section>
  <p className="tc-hunt-hint">{huntingNow?'전투 결과를 확인하고 있습니다…':game.expedition?'진행 중인 원정을 마친 후 사냥할 수 있습니다.':state?.vitality===0?'활력이 부족합니다. 회복 후 다시 사냥하세요.':'지역을 선택하고 입장하면 즉시 사냥 결과가 표시됩니다.'}{state?.potions!==undefined&&<small className="tc-hunt-life-status">{`포션 ${state.potions.toLocaleString()} · `}{(['attack_food','defense_food','experience_food'] as const).filter(id=>(state.foodTurns?.[id]??0)>0).map(id=>`${id==='attack_food'?'공격':id==='defense_food'?'방어':'경험치'} ${state.foodTurns?.[id]}회`).join(' · ')||'음식 효과 없음'}</small>}</p>
  {error&&<div className="tc-hunt-error" role="alert">{error}{onRetry&&<button onClick={onRetry} disabled={huntingNow}>다시 확인</button>}</div>}
  {result&&<button className="tc-hunt-log-button" onClick={()=>setView('result')}>최근 사냥 결과 <span>{result.outcome==='victory'?'승리':'패배'}</span></button>}
  </div>
  <section className="tc-hunt-result-page" aria-label="사냥 결과" hidden={view!=='result'}>
  <article className="tc-hunt-fighter tc-hunt-panel player"><div className="tc-hunt-art">{art&&<img src={assetUrl(art)} alt="탐사자"/>}</div><div className="tc-hunt-fighter-info"><h2>{nickname??'탐사자'}</h2><div className="tc-hunt-stats"><span>공격 <b>{Math.round(player.attack)}</b></span><span>방어 <b>{Math.round(player.defense)}</b></span></div><div className="tc-hunt-equipment">{(['weapon','armor'] as const).map(slot=>{const item=game.equipmentItems.find(i=>i.id===game.equipped[slot]);return <span key={slot}>{item?EQUIPMENT_DEFINITIONS[item.kind].name:slot==='weapon'?'무기 없음':'방어구 없음'}</span>;})}</div><Hp label="탐사자" value={state?.currentHp===null?player.hp:state?.currentHp??result?.playerHp??player.hp} max={player.hp}/></div></article>
  {result&&map?<><article key={resultKey} data-monster-id={enemy.id} className={'tc-hunt-fighter tc-hunt-panel enemy'+(feedbackRevision?' tc-hunt-arrived':'')}><div className="tc-hunt-art"><img src={assetUrl(enemy.image)} alt={enemy.name}/></div>{huntingNow&&<div className="tc-hunt-tracking" role="status"><Glyph name="sword"/><span>새 몬스터 추적 중…</span></div>}{!huntingNow&&feedbackRevision>0&&<i className="tc-hunt-slash" aria-hidden="true"/>}<div className="tc-hunt-fighter-info"><h2>{enemy.name}</h2><div className="tc-hunt-stats"><span>공격 <b>{enemy.attack}</b></span><span>방어 <b>{enemy.defense}</b></span></div>{result.monster?.skills&&<div className="tc-hunt-monster-skill"><strong>몬스터 스킬</strong>{result.monster.skills.map((skill,i)=><small key={i}>{i+1}. {skill.name} · {monsterSkillDescription(skill)}</small>)}</div>}<Hp label={enemy.name} value={result.monsterHp} max={enemy.hp}/></div></article>
  <div key={resultKey+':rewards'} className={'tc-hunt-result tc-hunt-panel '+result.outcome+(feedbackRevision?' tc-hunt-reward-arrived':'')} role="status" aria-live="polite"><h2>{result.outcome==='victory'?'승리!':'패배'}</h2>{result.outcome==='victory'&&state&&huntingLevel(Math.max(0,state.experience-result.exp))<huntingLevel(state.experience)&&<p className="tc-hunt-level-up">레벨 업! 스탯 포인트 +{huntingLevel(state.experience)-huntingLevel(Math.max(0,state.experience-result.exp))}</p>}<div>{result.outcome==='victory'?<><p>경험치 <b className="tc-hunt-value">+{result.exp.toLocaleString()}</b> · 실버 <b className="tc-hunt-value">+{result.silver.toLocaleString()}</b> · 숙련도 <b>+{result.mastery}</b></p>{(result.equipment||result.potionsUsed!==undefined)&&<span>{result.equipment&&<b className="tc-hunt-loot" data-grade={result.equipment.grade}>장비 획득 · {equipmentItemName(result.equipment)}</b>}{result.equipment&&result.potionsUsed!==undefined&&" · "}{result.potionsUsed!==undefined&&`포션 ${result.potionsUsed}개 사용`}</span>}</>:<p>획득 보상 없음 · 포션이 부족하면 우물에서 회복하세요.</p>}</div></div>
  <button className="tc-hunt-log-button tc-hunt-records-button" onClick={()=>logDialog.current?.showModal()}>전투 기록 보기 <span>총 {result.turns.length}턴 ›</span></button>
  <section className="tc-hunt-repeat-dock tc-hunt-panel" aria-label="다음 전투 사냥터" style={{backgroundImage:`linear-gradient(90deg,rgba(10,12,10,.55),rgba(10,12,10,.95)),url(${assetUrl('assets/backgrounds/hunting/world-map.webp')})`,backgroundSize:'100% 100%,100% 500%',backgroundPosition:`center,center ${(4-HUNT_MAPS.findIndex(m=>m.id===map.id))*25}%`}}><div><Glyph name="sword"/><strong>{map.name}</strong><small>추천 레벨 {map.recommendedLevel}</small></div><button className={'tc-hunt-next tc-feel-press'+(huntingNow?' tc-hunt-working':'')} aria-busy={huntingNow} data-game-feel="press" disabled={huntingNow||!state||state.vitality<1||!!game.expedition} onClick={()=>startHunt(map.id)}><Glyph name="sword"/><strong>{huntingNow?'사냥 중…':'다음 전투'}</strong><small>활력 1 <span aria-hidden="true">›</span></small></button>{state?.vitality===0&&<p>활력이 부족합니다. 회복 후 다시 사냥하세요.</p>}{error&&<p role="alert">{error}</p>}</section>
  <dialog ref={logDialog} className="tc-hunt-log-dialog" aria-label="전투 기록"><div className="tc-hunt-log-heading"><h2>전투 기록</h2><button onClick={()=>logDialog.current?.close()}>닫기</button></div><div className="tc-hunt-log">{result.turns.map(t=><article className="tc-hunt-turn-card tc-hunt-panel" key={result.createdAt+':'+t.turn} aria-label={`Turn ${t.turn}`}><h3>Turn {t.turn}</h3><div className="tc-hunt-turn-actions">{t.lines.map((line,i)=>{const isPlayer=line.startsWith('탐사자');return <p className={'tc-hunt-action '+(isPlayer?'player':'enemy')} key={i}>{line.split(/(\d+(?= 피해))/).map((part,j)=>/^\d+$/.test(part)?<b className="tc-hunt-damage" key={j}>{part}</b>:<React.Fragment key={j}>{isPlayer?part.replace('탐사자',nickname??'탐사자'):part}</React.Fragment>)}</p>;})}</div><div className="tc-hunt-turn-health"><div className="player"><strong>{nickname??'탐사자'}</strong><Hp label={`Turn ${t.turn} 탐사자`} value={t.playerHp} max={player.hp}/></div><div className="enemy"><strong>{enemy.name}</strong><Hp label={`Turn ${t.turn} ${enemy.name}`} value={t.monsterHp} max={enemy.hp}/></div></div></article>)}</div></dialog></>:<div className="tc-hunt-empty tc-hunt-panel"><Glyph name="sword"/><h2>사냥할 지역을 선택하세요</h2><p>장비와 스킬을 준비하고 첫 전투 기록을 남겨보세요.</p></div>}
 </section>
 </section>;
}
