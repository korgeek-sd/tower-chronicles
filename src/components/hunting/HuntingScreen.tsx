import {HUNT_MONSTERS} from '../../game/hunting/encounters';
import {useGameFeel} from '../../gameFeel/react/useGameFeel';
import {readGameFeelPreferences} from '../../gameFeel/preferences';
import React from 'react';
import type {GameState} from '../../game/types';
import {HUNT_MAPS,huntingProgress,huntingLevel,recoverVitality,VITALITY_INTERVAL,type HuntingState,type HuntMapId} from '../../game/hunting/model';
import {stats} from '../../game/engine/state';
import {assetUrl,playerGraphicForJob} from '../../game/data/graphics';
import {equipmentItemName,EQUIPMENT_DEFINITIONS,EQUIPMENT_GRADES,EQUIPMENT_GRADE_NAMES} from '../../game/data/equipment';
import {HUNT_EQUIPMENT_RATES} from '../../game/hunting/equipmentDrops';
import {Glyph} from '../../ui/mobile';
import {HuntingCombatLog} from './HuntingCombatLog';
import {HuntingVitality} from './HuntingVitality';
type Props={game:GameState;hunting:HuntingState|null;now:number;busy:boolean;error?:string;nickname?:string;onHunt:(id:HuntMapId)=>void;onSettings:()=>void;onRetry?:()=>void;previewAppearance?:boolean;historyScope?:string};
function Hp({label,value,max}:{label:string;value:number;max:number}){
 return <div className="tc-hunt-hp"><div><span>HP</span><b>{Math.round(value).toLocaleString()} / {Math.round(max).toLocaleString()}</b></div><div role="progressbar" aria-label={label+' HP'} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><i style={{width:Math.max(0,Math.min(100,value/max*100))+'%'}}/></div></div>;
}
/** Hunting has no MP economy yet. Accept optional server MP values without inventing a resource balance. */
function Mp({label,value,max}:{label:string;value?:number|null;max?:number|null}){
 const available=typeof value==='number'&&Number.isFinite(value)&&typeof max==='number'&&Number.isFinite(max)&&max>0;
 const capacity=available?Math.max(1,Math.round(max)):100;
 const current=available?Math.min(capacity,Math.max(0,Math.round(value))):0;
 return <div className={'tc-hunt-mp'+(available?'':' tc-hunt-mp-unavailable')}><div><span>MP</span><b>{available?current.toLocaleString()+' / '+capacity.toLocaleString():'미사용'}</b></div><div role="progressbar" aria-label={label+' MP'} aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={current} aria-valuetext={available?undefined:'마나 시스템 미적용'}><i style={{width:(current/capacity*100)+'%'}}/></div></div>;
}
export function HuntingScreen({game,hunting,now,busy,error,nickname,onHunt,onRetry,onSettings,previewAppearance,historyScope='guest'}:Props){
 const feel=useGameFeel();
 const [submitting,setSubmitting]=React.useState(false),[feedbackRevision,setFeedbackRevision]=React.useState(0);
 const huntingNow=busy||submitting;
 const motionOff=readGameFeelPreferences();
 const [selected,setSelected]=React.useState<HuntMapId>(hunting?.lastResult?.mapId??'plains');
 const [expanded,setExpanded]=React.useState<HuntMapId|null>(hunting?.lastResult?.mapId??'plains');
 const manuallySelected=React.useRef(false);
 React.useEffect(()=>{
  if(!manuallySelected.current&&hunting?.lastResult?.mapId){
   setSelected(hunting.lastResult.mapId);
   setExpanded(hunting.lastResult.mapId);
  }
 },[hunting?.lastResult?.mapId]);
 const destination=HUNT_MAPS.find(m=>m.id===selected)!;
 const [view,setView]=React.useState<'regions'|'result'>('regions');
 const [previewOpen,setPreviewOpen]=React.useState(()=>typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('artPreview')==='grave-hound');
 const pendingHunt=React.useRef(false);
 const previousResult=React.useRef(hunting?.lastResult);
 const experienceBeforeHunt=React.useRef(hunting?.experience??0);
 React.useEffect(()=>{
  if(pendingHunt.current&&hunting?.lastResult&&previousResult.current!==hunting.lastResult){pendingHunt.current=false;setSubmitting(false);setFeedbackRevision(v=>v+1);setView('result');feel.play('hunt.result',{outcome:hunting.lastResult.outcome,grade:hunting.lastResult.equipment?.grade,leveledUp:huntingLevel(hunting.experience)>huntingLevel(experienceBeforeHunt.current)});}
  previousResult.current=hunting?.lastResult;
 },[hunting?.lastResult,feel]);
 React.useEffect(()=>{if(error){pendingHunt.current=false;setSubmitting(false);}},[error]);
 function startHunt(id:HuntMapId=selected){if(huntingNow||pendingHunt.current||!hunting||hunting.vitality<1||game.expedition)return;previousResult.current=hunting?.lastResult;experienceBeforeHunt.current=hunting.experience;pendingHunt.current=true;setSubmitting(true);feel.play('hunt.start');onHunt(id);}
 const regionDialog=React.useRef<HTMLDialogElement>(null);
 const state=hunting?recoverVitality(hunting,now):null,result=state?.lastResult,map=HUNT_MAPS.find(m=>m.id===result?.mapId),player=result?.player??stats(game);
 const enemy=result?.monster??{...HUNT_MONSTERS[map?.id??'plains'][0],hp:map?.hp??1,attack:map?.attack??0,defense:map?.defense??0};
 const resultKey=result?.requestId??`${result?.createdAt}:${enemy.id}`;
 const seconds=state?Math.max(0,Math.ceil((VITALITY_INTERVAL-Math.max(0,now-state.recoveredAt))/1000)):0;
 const {level,exp,nextExp}=huntingProgress(state?.experience??0);
 const previewMode=previewAppearance??previewOpen;
 const entryStatus=huntingNow?'사냥 중…':!state?'불러오는 중':game.expedition?'원정 진행 중':state.vitality<1?'활력 부족':'입장 가능';
 const previewJob='assets/characters/preview/grave_hound_job_reference.jpg';
 const previewHound=HUNT_MONSTERS.plains[0];
 const regionDescriptions:Record<HuntMapId,string>={
  plains:'노바르 외곽의 황량한 평원',forest:'그늘진 숲에 기이한 생물들이 서식합니다.',
  mine:'버려진 광갱에 생물들이 숨어 있습니다.',fortress:'몰락한 성채에 전장의 잔재가 남아 있습니다.',
  ruins:'오래된 유적 깊은 곳의 봉인이 흔들립니다.'
 };
 // Normal hunting displays the selected cosmetic first; starter appearance uses job art.
 // Temporary in-battle style match only for the grave-digging hound: keep all other job appearances unchanged.
 const art=(previewMode||result?.monster?.id==='grave_digger_hound')?previewJob:playerGraphicForJob(game.currentJobId,game.cosmetics.selectedAppearanceId).image.idle;
 // Older saved results may lack image or use stale image paths; prefer current catalog art by ID.
 const activeMonster=Object.values(HUNT_MONSTERS).flat().find(m=>m.id===enemy.id);
 const enemyArt=enemy.id==='grave_digger_hound'
  ?assetUrl('assets/monsters/new/plains/grave_digger_hound.png')
  :assetUrl(activeMonster?.image??enemy.image??HUNT_MONSTERS.plains[0].image);
 return <section className={'tc-hunt'+(motionOff?' tc-hunt-motion-off':'')} data-view={view} data-art-preview={previewMode} aria-label="즉시 사냥" aria-busy={huntingNow} data-hunt-revision={feedbackRevision}>
  <header className="tc-hunt-heading"><div><small>노바르 외곽</small><h1>{view==='result'?'사냥 기록':'사냥터'}</h1></div><span className="tc-hunt-level">Lv. {level}</span><button type="button" className="tc-hunt-config-toggle" onClick={onSettings}>전투 세팅</button>{view==='regions'&&<button type="button" className="tc-hunt-preview-toggle" aria-pressed={previewMode} onClick={()=>setPreviewOpen(value=>!value)}>{previewMode?'비교 닫기':'외형 비교'}</button>}{view==='result'&&<button className="tc-hunt-back" onClick={()=>setView('regions')}>사냥터로 <span aria-hidden="true">›</span></button>}</header>
  {view==='result'&&<HuntingVitality hunting={hunting} now={now}/>}
  <div className="tc-hunt-vitality tc-hunt-panel"><Glyph name="haste"/><strong>활력 <b>{state?.vitality.toLocaleString()??'—'}</b><small>{state&&state.vitality>100?' (추가 지급)':' / 100'}</small></strong><div className="tc-hunt-energy" role="progressbar" aria-label="활력" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,state?.vitality??0)}><i style={{width:Math.min(100,state?.vitality??0)+'%'}}/></div><span>{!state?'불러오는 중':state.vitality>100?'추가 지급 활력 사용 중':state.vitality===100?'충전 완료':`회복 ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`}</span></div>
  {previewMode&&view==='regions'&&<section className="tc-hunt-art-preview" aria-label="무덤파는 들개 · 직업 외형 비교">
    <div className="tc-hunt-art-preview-heading"><div><strong>외형 비교 미리보기</strong><small>실제 사냥 UI 크기로 두 이미지를 확인하세요.</small></div><a href="./">일반 화면</a></div>
    <div className="tc-hunt-art-preview-grid">
      <article className="tc-hunt-fighter tc-hunt-panel player"><div className="tc-hunt-art"><img src={assetUrl(previewJob)} alt="참고 직업 외형"/></div><div className="tc-hunt-fighter-info"><h2>직업 외형</h2><small>제공해주신 여성 검사 이미지</small></div></article>
      <article className="tc-hunt-fighter tc-hunt-panel enemy" aria-label={previewHound.name+' 몬스터 정보'}><div className="tc-hunt-art"><img src={assetUrl("assets/monsters/new/plains/grave_digger_hound.png")} alt={previewHound.name}/></div><div className="tc-hunt-fighter-info"><h2>{previewHound.name}</h2><div className="tc-hunt-stats"><span>공격 <b>{previewHound.attack}</b></span><span>방어 <b>{previewHound.defense}</b></span></div><Hp label={previewHound.name+' 미리보기'} value={previewHound.hp} max={previewHound.hp}/><Mp label={previewHound.name+' 미리보기'}/><small>외곽 평야 · 기본 능력치</small></div></article>
    </div>
    <p>외형 비교 전용입니다. 캐릭터 외형 설정이나 보상·사냥 확률은 변경하지 않습니다. 사냥을 진행하면 몬스터 10종 중 하나가 등장합니다.</p>
  </section>}
  <div className="tc-hunt-selection tc-hunt-selection-accordion" hidden={view!=='regions'}>
   <nav className="tc-hunt-accordion" aria-label="사냥 지역">
    {HUNT_MAPS.map((m,i)=>{
     const opened=expanded===m.id;
     const monster=HUNT_MONSTERS[m.id][0];
     const backdrop=assetUrl('assets/backgrounds/hunting/world-map.webp');
     const backdropStyle={backgroundImage:`linear-gradient(90deg,rgba(10,13,20,.92),rgba(11,15,24,.54)),url("${backdrop}")`,backgroundSize:'100% 100%,100% 500%',backgroundPosition:`center,center ${(4-i)*25}%`};
     const dropChance=HUNT_EQUIPMENT_RATES[m.id].reduce((sum,rate)=>sum+rate,0)/10000;
     return <article key={m.id} className={'tc-hunt-accordion-card'+(opened?' is-open':'')}>
      <button type="button" className="tc-hunt-accordion-toggle tc-feel-press" disabled={huntingNow} aria-expanded={opened} aria-controls={'tc-hunt-region-'+m.id} aria-label={m.name+' 사냥터 '+(opened?'접기':'펼치기')} data-game-feel="press" onClick={()=>{
       manuallySelected.current=true;
       setSelected(m.id);
       setExpanded(current=>current===m.id?null:m.id);
      }} style={backdropStyle}>
       <span className="tc-hunt-region-symbol" aria-hidden="true">{i===0?'♧':i===1?'♠':i===2?'⚒':i===3?'♜':'◇'}</span>
       <span className="tc-hunt-accordion-title"><strong>{m.name}</strong><small>권장 레벨 Lv.{m.recommendedLevel.replace('–','~')}</small></span>
       <span className="tc-hunt-accordion-chevron" aria-hidden="true">{opened?'⌃':'⌄'}</span>
      </button>
      {opened&&<div id={'tc-hunt-region-'+m.id} className="tc-hunt-accordion-panel">
       <div className="tc-hunt-accordion-scene" style={backdropStyle}>
        <img src={assetUrl(monster.image)} alt={monster.name+' 대표 몬스터'} loading="eager"/>
        <div className="tc-hunt-accordion-scene-copy"><strong>대표 몬스터 · {monster.name}</strong><span>{regionDescriptions[m.id]}</span></div>
       </div>
       <div className="tc-hunt-accordion-info">
        <div><span>등장 몬스터</span><strong>{HUNT_MONSTERS[m.id].length}종</strong></div>
        <div><span>기본 경험치</span><strong>{m.exp.toLocaleString()}</strong></div>
        <div><span>기본 실버</span><strong>{m.silver.toLocaleString()}~{m.silverMax.toLocaleString()}</strong></div>
        <div><span>주요 재료</span><strong>{m.materialName}</strong></div>
        <div className="tc-hunt-accordion-gear"><span>장비 드롭</span><strong>승리 시 {dropChance.toFixed(2)}%</strong></div>
       </div>
       <div className="tc-hunt-accordion-actions">
        <button type="button" className="tc-hunt-accordion-info-button" onClick={()=>{setSelected(m.id);regionDialog.current?.showModal();}}>몬스터·드롭 정보</button>
        <button type="button" className="tc-hunt-accordion-enter tc-feel-press" data-game-feel="press" disabled={huntingNow||!state||state.vitality<1||!!game.expedition} onClick={()=>{setSelected(m.id);startHunt(m.id);}}><strong>{huntingNow?'사냥 중…':'즉시 사냥'}</strong><small>활력 1 소모</small></button>
       </div>
      </div>}
     </article>;
    })}
   </nav>
   {error&&<div className="tc-hunt-error" role="alert">{error}{onRetry&&<button onClick={onRetry} disabled={huntingNow}>다시 확인</button>}</div>}
   <div className="tc-hunt-accordion-bottom">
    <span>{huntingNow?'전투 결과를 확인하고 있습니다…':game.expedition?'원정 진행 중':!state?'사냥 상태 불러오는 중':state.vitality===0?'활력 회복 후 사냥 가능':'지역 선택 후 즉시 자동전투'}</span>
    {result&&<button type="button" className="tc-hunt-log-button" onClick={()=>setView('result')}>최근 사냥 결과 · {result.outcome==='victory'?'승리':'패배'}</button>}
   </div>
  </div>
  <dialog ref={regionDialog} className="tc-hunt-region-dialog" aria-label="사냥터 상세 정보">
   <header><h2>{destination.name}</h2><button type="button" onClick={()=>regionDialog.current?.close()}>닫기</button></header>
   <div className="tc-hunt-region-details">
    <section><h3>등장 몬스터 · {HUNT_MONSTERS[selected].length}종</h3><ul>{HUNT_MONSTERS[selected].map(monster=><li key={monster.id}>{monster.name}</li>)}</ul></section>
    <section><h3>장비 드롭 · 승리 1회 기준</h3><dl>{EQUIPMENT_GRADES.map((grade,index)=><div key={grade}><dt>{EQUIPMENT_GRADE_NAMES[grade]}</dt><dd>{HUNT_EQUIPMENT_RATES[selected][index]/10000}%</dd></div>)}</dl><p>해당 등급의 장비 9종 중 하나가 무작위로 나옵니다. 추천 레벨은 입장 제한이 아닙니다.</p></section>
   </div>
  </dialog>
  <section className="tc-hunt-result-page" aria-label="사냥 결과" hidden={view!=='result'}>
  <article className="tc-hunt-fighter tc-hunt-panel player"><div className="tc-hunt-art">{art&&art!=='assets/player/default.png'?<img src={assetUrl(art)} alt="탐사자"/>:<div className="tc-hunt-art-placeholder"><Glyph name="sword"/><span>외형 미선택</span></div>}</div><div className="tc-hunt-fighter-info"><h2>{nickname??'탐사자'}</h2><div className="tc-hunt-stats"><span>공격 <b>{Math.round(player.attack)}</b></span><span>방어 <b>{Math.round(player.defense)}</b></span></div><div className="tc-hunt-equipment">{(['weapon','armor'] as const).map(slot=>{const item=game.equipmentItems.find(i=>i.id===game.equipped[slot]);return <span key={slot}>{item?EQUIPMENT_DEFINITIONS[item.kind].name:slot==='weapon'?'무기 없음':'방어구 없음'}</span>;})}</div><Hp label="탐사자" value={state?.currentHp===null?player.hp:state?.currentHp??result?.playerHp??player.hp} max={player.hp}/><Mp label="탐사자" value={state?.currentMp??result?.playerMp} max={state?.maxMp??result?.playerMaxMp}/></div></article>
  {result&&map?<><article key={resultKey} data-monster-id={enemy.id} className={'tc-hunt-fighter tc-hunt-panel enemy'+(feedbackRevision?' tc-hunt-arrived':'')}><div className="tc-hunt-art"><img src={enemyArt} alt={enemy.name}/></div>{huntingNow&&<div className="tc-hunt-tracking" role="status"><Glyph name="sword"/><span>새 몬스터 추적 중…</span></div>}{!huntingNow&&feedbackRevision>0&&<i className="tc-hunt-slash" aria-hidden="true"/>}<div className="tc-hunt-fighter-info"><div className="tc-hunt-monster-title"><h2>{enemy.name}</h2></div><div className="tc-hunt-stats"><span>공격 <b>{enemy.attack}</b></span><span>방어 <b>{enemy.defense}</b></span></div><Hp label={enemy.name} value={result.monsterHp} max={enemy.hp}/><Mp label={enemy.name} value={result.monsterMp} max={result.monsterMaxMp}/></div></article>
  <HuntingCombatLog key={historyScope} result={result} nickname={nickname} active={view==='result'}/>
  <section className="tc-hunt-repeat-dock tc-hunt-panel" aria-label="다음 전투 사냥터" style={{backgroundImage:`linear-gradient(90deg,rgba(10,12,10,.55),rgba(10,12,10,.95)),url(${assetUrl('assets/backgrounds/hunting/world-map.webp')})`,backgroundSize:'100% 100%,100% 500%',backgroundPosition:`center,center ${(4-HUNT_MAPS.findIndex(m=>m.id===map.id))*25}%`}}><div><Glyph name="sword"/><strong>{map.name}</strong><small>추천 레벨 {map.recommendedLevel}</small></div><button className={'tc-hunt-next tc-feel-press'+(huntingNow?' tc-hunt-working':'')} aria-busy={huntingNow} data-game-feel="press" disabled={huntingNow||!state||state.vitality<1||!!game.expedition} onClick={()=>startHunt(map.id)}><Glyph name="sword"/><strong>{huntingNow?'사냥 중…':'다음 전투'}</strong><small>활력 1 <span aria-hidden="true">›</span></small></button>{state?.vitality===0&&<p>활력이 부족합니다. 회복 후 다시 사냥하세요.</p>}{error&&<p role="alert">{error}</p>}</section>
</>:<div className="tc-hunt-empty tc-hunt-panel"><Glyph name="sword"/><h2>사냥할 지역을 선택하세요</h2><p>장비와 스킬을 준비하고 첫 전투 기록을 남겨보세요.</p></div>}
 </section>
 </section>;
}
