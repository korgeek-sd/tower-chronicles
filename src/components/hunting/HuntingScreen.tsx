import React from 'react';
import type {GameState} from '../../game/types';
import {HUNT_MAPS,huntingProgress,recoverVitality,VITALITY_INTERVAL,type HuntingState,type HuntMapId} from '../../game/hunting/model';
import {stats} from '../../game/engine/state';
import {assetUrl,playerGraphicFor} from '../../game/data/graphics';
import {EQUIPMENT_DEFINITIONS} from '../../game/data/equipment';
import {Glyph} from '../../ui/mobile';
type Props={game:GameState;hunting:HuntingState|null;now:number;busy:boolean;error?:string;nickname?:string;onHunt:(id:HuntMapId)=>void;onSettings:()=>void;onRetry?:()=>void};
function Hp({label,value,max}:{label:string;value:number;max:number}){
 return <div className="tc-hunt-hp"><div><span>HP</span><b>{Math.round(value).toLocaleString()} / {Math.round(max).toLocaleString()}</b></div><div role="progressbar" aria-label={label+' HP'} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><i style={{width:Math.max(0,Math.min(100,value/max*100))+'%'}}/></div></div>;
}
export function HuntingScreen({game,hunting,now,busy,error,nickname,onHunt,onRetry}:Props){
 const [selected,setSelected]=React.useState<HuntMapId>(hunting?.lastResult?.mapId??'plains');
 const destination=HUNT_MAPS.find(m=>m.id===selected)!;
 const [view,setView]=React.useState<'regions'|'result'>('regions');
 const pendingHunt=React.useRef(false);
 const previousResult=React.useRef(hunting?.lastResult);
 React.useEffect(()=>{
  if(pendingHunt.current&&hunting?.lastResult&&previousResult.current!==hunting.lastResult){pendingHunt.current=false;setView('result');}
  previousResult.current=hunting?.lastResult;
 },[hunting?.lastResult]);
 React.useEffect(()=>{if(error)pendingHunt.current=false;},[error]);
 function startHunt(id:HuntMapId=selected){if(busy||pendingHunt.current)return;previousResult.current=hunting?.lastResult;pendingHunt.current=true;onHunt(id);}
 const logDialog=React.useRef<HTMLDialogElement>(null);
 const state=hunting?recoverVitality(hunting,now):null,result=state?.lastResult,map=HUNT_MAPS.find(m=>m.id===result?.mapId),player=result?.player??stats(game);
 const seconds=state?Math.max(0,Math.ceil((VITALITY_INTERVAL-Math.max(0,now-state.recoveredAt))/1000)):0;
 const {level,exp,nextExp}=huntingProgress(state?.experience??0);
 const art=playerGraphicFor(game.cosmetics.selectedAppearanceId).image.idle;
 return <section className="tc-hunt" aria-label="즉시 사냥">
  <header className="tc-hunt-heading"><div><small>노바르 외곽</small><h1>{view==='result'?'사냥 결과':'사냥터'}</h1></div><span>Lv. {level}</span>{view==='result'&&<button onClick={()=>setView('regions')}>사냥터로 <span aria-hidden="true">›</span></button>}</header>
  <div className="tc-hunt-vitality tc-hunt-panel"><Glyph name="haste"/><strong>활력 <b>{state?.vitality??'—'}</b><small> / 100</small></strong><div className="tc-hunt-energy" role="progressbar" aria-label="활력" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state?.vitality??0}><i style={{width:(state?.vitality??0)+'%'}}/></div><span>{!state?'불러오는 중':state.vitality===100?'충전 완료':`회복 ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`}</span></div>
  <div className="tc-hunt-selection" hidden={view!=='regions'}>
  <nav className="tc-hunt-cards" aria-label="사냥 지역">
   {[...HUNT_MAPS].reverse().map((m,i)=><button key={m.id} className={'tc-hunt-card tc-feel-press '+(selected===m.id?'selected':'')} data-game-feel="press" aria-pressed={selected===m.id} disabled={busy} onClick={()=>setSelected(m.id)} style={{backgroundImage:`linear-gradient(90deg,rgba(10,12,10,.88),rgba(10,12,10,.15)),url(${assetUrl('assets/backgrounds/hunting/world-map.webp')})`,backgroundSize:'100% 100%,100% 500%',backgroundPosition:`center,center ${i*25}%`}}><span><strong>{m.name}</strong><small>추천 레벨 {m.recommendedLevel}</small></span><span className="tc-hunt-card-state" aria-hidden="true">{selected===m.id?'선택됨':'›'}</span></button>)}
  </nav>
  <section className="tc-hunt-destination tc-hunt-panel" aria-label="선택한 사냥터"><div><h2>{destination.name}</h2><p>추천 레벨 {destination.recommendedLevel}</p><small>경험치 {destination.exp} · 실버 {destination.silver.toLocaleString()}~{destination.silverMax.toLocaleString()} · 재료</small></div><button className="tc-hunt-enter tc-feel-press" data-game-feel="press" disabled={busy||!state||state.vitality<1||!!game.expedition} onClick={()=>startHunt()}>{busy?'사냥 중…':'입장하기'} <small>활력 1</small></button></section>
  <p className="tc-hunt-hint">{busy?'전투 결과를 확인하고 있습니다…':game.expedition?'진행 중인 원정을 마친 후 사냥할 수 있습니다.':state?.vitality===0?'활력이 부족합니다. 회복 후 다시 사냥하세요.':'지역을 선택하고 입장하면 즉시 사냥 결과가 표시됩니다.'}{state?.potions!==undefined&&<small className="tc-hunt-life-status">{`포션 ${state.potions.toLocaleString()} · `}{(['attack_food','defense_food','experience_food'] as const).filter(id=>(state.foodTurns?.[id]??0)>0).map(id=>`${id==='attack_food'?'공격':id==='defense_food'?'방어':'경험치'} ${state.foodTurns?.[id]}회`).join(' · ')||'음식 효과 없음'}</small>}</p>
  {error&&<div className="tc-hunt-error" role="alert">{error}{onRetry&&<button onClick={onRetry} disabled={busy}>다시 확인</button>}</div>}
  {result&&<button className="tc-hunt-log-button" onClick={()=>setView('result')}>최근 사냥 결과 <span>{result.outcome==='victory'?'승리':'패배'}</span></button>}
  </div>
  <section className="tc-hunt-result-page" aria-label="사냥 결과" hidden={view!=='result'}>
  <article className="tc-hunt-fighter tc-hunt-panel player"><div className="tc-hunt-art">{art&&<img src={assetUrl(art)} alt="탐사자"/>}</div><div className="tc-hunt-fighter-info"><h2>{nickname??'탐사자'}</h2><div className="tc-hunt-stats"><span>공격 <b>{Math.round(player.attack)}</b></span><span>방어 <b>{Math.round(player.defense)}</b></span></div><div className="tc-hunt-equipment">{(['weapon','armor'] as const).map(slot=>{const item=game.equipmentItems.find(i=>i.id===game.equipped[slot]);return <span key={slot}>{item?EQUIPMENT_DEFINITIONS[item.kind].name:slot==='weapon'?'무기 없음':'방어구 없음'}</span>;})}</div><Hp label="탐사자" value={state?.currentHp===null?player.hp:state?.currentHp??result?.playerHp??player.hp} max={player.hp}/></div></article>
  {result&&map?<><article className="tc-hunt-fighter tc-hunt-panel enemy"><div className="tc-hunt-art"><img src={assetUrl(`assets/monsters/${map.tower==='ore'?'iron-t1':'redfang'}/${map.monsterId}.png`)} alt={map.monsterName}/></div><div className="tc-hunt-fighter-info"><h2>{map.monsterName}</h2><div className="tc-hunt-stats"><span>공격 <b>{map.attack}</b></span><span>방어 <b>{map.defense}</b></span></div><Hp label={map.monsterName} value={result.monsterHp} max={map.hp}/></div></article>
  <div className={'tc-hunt-result tc-hunt-panel '+result.outcome} role="status" aria-live="polite"><h2>{result.outcome==='victory'?'승리!':'패배'}</h2><div>{result.outcome==='victory'?<><p>경험치 <b>+{result.exp}</b> · 실버 <b>+{result.silver}</b> · 숙련도 <b>+{result.mastery}</b></p><span>{map.materialName} × {result.materialCount}{result.potionsUsed!==undefined&&` · 포션 ${result.potionsUsed}개 사용`}</span></>:<p>획득 보상 없음 · 포션이 부족하면 우물에서 회복하세요.</p>}</div></div>
  <button className="tc-hunt-log-button tc-hunt-records-button" onClick={()=>logDialog.current?.showModal()}>전투 기록 보기 <span>총 {result.turns.length}턴 ›</span></button>
  <section className="tc-hunt-repeat-dock tc-hunt-panel" aria-label="다음 전투 사냥터" style={{backgroundImage:`linear-gradient(90deg,rgba(10,12,10,.55),rgba(10,12,10,.95)),url(${assetUrl('assets/backgrounds/hunting/world-map.webp')})`,backgroundSize:'100% 100%,100% 500%',backgroundPosition:`center,center ${(4-HUNT_MAPS.findIndex(m=>m.id===map.id))*25}%`}}><div><Glyph name="sword"/><strong>{map.name}</strong><small>추천 레벨 {map.recommendedLevel}</small></div><button className="tc-hunt-next tc-feel-press" data-game-feel="press" disabled={busy||!state||state.vitality<1||!!game.expedition} onClick={()=>startHunt(map.id)}><Glyph name="sword"/><strong>{busy?'전투 중…':'다음 전투'}</strong><small>활력 1 <span aria-hidden="true">›</span></small></button>{state?.vitality===0&&<p>활력이 부족합니다. 회복 후 다시 사냥하세요.</p>}{error&&<p role="alert">{error}</p>}</section>
  <dialog ref={logDialog} className="tc-hunt-log-dialog" aria-label="전투 기록"><div className="tc-hunt-log-heading"><h2>전투 기록</h2><button onClick={()=>logDialog.current?.close()}>닫기</button></div><div className="tc-hunt-log">{result.turns.map(t=><article className="tc-hunt-turn-card tc-hunt-panel" key={result.createdAt+':'+t.turn} aria-label={`Turn ${t.turn}`}><h3>Turn {t.turn}</h3><div className="tc-hunt-turn-actions">{t.lines.map((line,i)=>{const isPlayer=line.startsWith('탐사자');return <p className={'tc-hunt-action '+(isPlayer?'player':'enemy')} key={i}>{line.split(/(\d+(?= 피해))/).map((part,j)=>/^\d+$/.test(part)?<b className="tc-hunt-damage" key={j}>{part}</b>:<React.Fragment key={j}>{isPlayer?part.replace('탐사자',nickname??'탐사자'):part}</React.Fragment>)}</p>;})}</div><div className="tc-hunt-turn-health"><div className="player"><strong>{nickname??'탐사자'}</strong><Hp label={`Turn ${t.turn} 탐사자`} value={t.playerHp} max={player.hp}/></div><div className="enemy"><strong>{map.monsterName}</strong><Hp label={`Turn ${t.turn} ${map.monsterName}`} value={t.monsterHp} max={map.hp}/></div></div></article>)}</div></dialog></>:<div className="tc-hunt-empty tc-hunt-panel"><Glyph name="sword"/><h2>사냥할 지역을 선택하세요</h2><p>장비와 스킬을 준비하고 첫 전투 기록을 남겨보세요.</p></div>}
 </section>
 </section>;
}
