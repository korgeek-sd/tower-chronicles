import React,{memo,useEffect,useRef,useState} from 'react';
import type {CombatEvent,Expedition} from '../../game/types';
import {assetUrl,backgroundFor,graphicFor,playerGraphicFor,SCENE_CONFIG} from '../../game/data/graphics';
import {damageBetween,encounterKey,imageState,monsterHud,playerVitalBetween} from './presentation';

function useImage(path?:string){
  const [ready,setReady]=useState<string|null>(null);
  useEffect(()=>{setReady(null);if(!path)return;let active=true;const img=new Image();
    img.onload=()=>{if(active)setReady(path);};img.onerror=()=>{if(active)setReady(null);};img.src=assetUrl(path);
    return()=>{active=false;img.onload=null;img.onerror=null;};
  },[path]);
  return !!path&&ready===path;
}
export const BackgroundLayer=memo(function BackgroundLayer({path}:{path:string}){
  const ready=useImage(path);
  return <div className="scene-background" aria-hidden="true">{ready&&<img src={assetUrl(path)} alt=""/>}<div className="scene-vignette"/></div>;
});
export function PlayerLayer({hit,appearanceId}:{hit:boolean;appearanceId:string}){
  const graphic=playerGraphicFor(appearanceId),fallback=playerGraphicFor('default'),ready=useImage(graphic.image.idle),fallbackReady=useImage(fallback.image.idle),d=graphic.display,src=ready?graphic.image.idle:fallbackReady?fallback.image.idle:undefined;
  return <div className="player-placement" style={{'--player-scale':d.scale,'--player-x':d.offsetX+'%','--player-y':d.offsetY+'%'} as React.CSSProperties}><div className={hit?'player-figure is-hit':'player-figure'}>{src?<img src={assetUrl(src)} alt="모험가"/>:<div className="fighter-placeholder player-placeholder"><span aria-hidden="true">♙</span><small>플레이어 이미지 준비 중</small></div>}</div></div>;
}
export function MonsterLayer({expedition,hit}:{expedition:Expedition;hit:boolean}){
  const graphic=graphicFor(expedition.tower,expedition.monster),idleReady=useImage(graphic?.image.idle),hitReady=useImage(graphic?.image.hit);
  const state=imageState(hit,idleReady,hitReady),display=graphic?.display??{scale:1,offsetX:0,offsetY:0},src=state==='hit'?graphic?.image.hit:graphic?.image.idle;
  return <div className="monster-placement" style={{'--monster-scale':display.scale,'--monster-x':display.offsetX+'%','--monster-y':display.offsetY+'%'} as React.CSSProperties}><div className={hit?'monster-figure is-hit':'monster-figure'}>{state!=='placeholder'&&src?<img src={assetUrl(src)} alt={expedition.monster.name}/>:<div className="fighter-placeholder monster-placeholder"><span aria-hidden="true">♟</span><small>몬스터 이미지 준비 중</small></div>}</div></div>;
}
type Floating={id:number;kind:'monster-damage'|'player-damage'|'player-heal'|'monster-shield-float'|'player-shield-float';amount:number;critical?:boolean;hit?:string};
export function FloatingLayer({events}:{events:Floating[]}){
  return <div className="damage-layer" aria-hidden="true">{events.map(e=><span key={e.id} className={'floating-number '+e.kind+(e.critical?' critical':'')}>{e.hit&&<small>{e.hit}</small>}{e.kind.endsWith('shield-float')?'보호막 ':e.kind==='player-heal'?'+':'-'}{Math.ceil(e.amount)}{e.critical&&<b>치명타!</b>}</span>)}</div>;
}
function CombatHud({expedition,playerMaxHp,titleName}:{expedition:Expedition;playerMaxHp:number;titleName?:string}){
  const monster=monsterHud(expedition.monster),playerPercent=Math.max(0,Math.min(100,expedition.hp/playerMaxHp*100));
  return <div className="combat-hud"><div className="fighter-hud player-hud"><strong>{titleName&&<small className="title-tag">「{titleName}」</small>}모험가</strong><span>{Math.ceil(expedition.hp)} / {playerMaxHp}</span><div className="hp" role="progressbar" aria-label="플레이어 HP" aria-valuenow={Math.max(0,expedition.hp)} aria-valuemin={0} aria-valuemax={playerMaxHp}><div style={{width:playerPercent+'%'}}/></div></div><div className="fighter-hud monster-hud"><strong>{monster.name}</strong><span>{Math.ceil(monster.current)} / {monster.max}</span><div className="hp enemy" role="progressbar" aria-label={monster.name+' HP'} aria-valuenow={monster.current} aria-valuemin={0} aria-valuemax={monster.max}><div style={{width:monster.percent+'%'}}/></div></div></div>;
}
function Encounter({expedition,combatEvents,playerMaxHp,appearanceId,titleName}:{expedition:Expedition;combatEvents:CombatEvent[];playerMaxHp:number;appearanceId:string;titleName?:string}){
  const previous=useRef(expedition),previousEventId=useRef(combatEvents.at(-1)?.id??0),seq=useRef(0),timers=useRef<ReturnType<typeof setTimeout>[]>([]);
  const [monsterHit,setMonsterHit]=useState(false),[playerHit,setPlayerHit]=useState(false),[events,setEvents]=useState<Floating[]>([]);
  useEffect(()=>{const before=previous.current,monsterDamage=damageBetween(before,expedition),playerEvent=playerVitalBetween(before,expedition),direct=combatEvents.filter(event=>event.id>previousEventId.current);previous.current=expedition;previousEventId.current=combatEvents.at(-1)?.id??previousEventId.current;
    const additions:Floating[]=[];for(const event of direct){const hit=event.hitCount>1?`${event.hitIndex}타`:undefined;if(event.absorbedByShield>0)additions.push({id:++seq.current,kind:event.target==='monster'?'monster-shield-float':'player-shield-float',amount:event.absorbedByShield,critical:event.critical&&event.hpDamage===0,hit});if(event.hpDamage>0)additions.push({id:++seq.current,kind:event.target==='monster'?'monster-damage':'player-damage',amount:event.hpDamage,critical:event.critical,hit});}if(!direct.length&&monsterDamage)additions.push({id:++seq.current,kind:'monster-damage',amount:monsterDamage});if(playerEvent?.kind==='heal')additions.push({id:++seq.current,kind:'player-heal',amount:playerEvent.amount});else if(!direct.length&&playerEvent?.kind==='damage')additions.push({id:++seq.current,kind:'player-damage',amount:playerEvent.amount});if(!additions.length)return;
    if(monsterDamage||direct.some(event=>event.target==='monster'))setMonsterHit(true);if(playerEvent?.kind==='damage'||direct.some(event=>event.target==='player'))setPlayerHit(true);setEvents(x=>[...x,...additions].slice(-SCENE_CONFIG.maxDamageLabels));const pulse=seq.current;
    const schedule=(fn:()=>void,ms:number)=>{const timer=setTimeout(()=>{timers.current=timers.current.filter(t=>t!==timer);fn();},ms);timers.current.push(timer);};
    schedule(()=>{if(seq.current===pulse){setMonsterHit(false);setPlayerHit(false);}},SCENE_CONFIG.hitDurationMs);
    for(const item of additions)schedule(()=>setEvents(x=>x.filter(e=>e.id!==item.id)),SCENE_CONFIG.damageDurationMs);
  },[expedition,combatEvents]);
  useEffect(()=>()=>timers.current.forEach(clearTimeout),[]);
  return <><div className={'combat-stage '+(expedition.spawnAt?'defeated':'')}><PlayerLayer hit={playerHit} appearanceId={appearanceId}/><MonsterLayer expedition={expedition} hit={monsterHit}/><FloatingLayer events={events}/></div><CombatHud expedition={expedition} playerMaxHp={playerMaxHp} titleName={titleName}/></>;
}
export function BattleScene({expedition,combatEvents,playerMaxHp,appearanceId,titleName}:{expedition:Expedition;combatEvents:CombatEvent[];playerMaxHp:number;appearanceId:string;titleName?:string}){
  return <section className="battle-scene" aria-label="전투 그래픽" style={{'--hit-duration':SCENE_CONFIG.hitDurationMs+'ms','--damage-duration':SCENE_CONFIG.damageDurationMs+'ms'} as React.CSSProperties}><BackgroundLayer path={backgroundFor(expedition.tower,expedition.floor)}/><div className="scene-status">{expedition.phase==='PLAYER_TURN'?'내 턴 · 행동을 선택하세요':expedition.phase==='MONSTER_TURN'?'적이 행동합니다.':'전투 결과를 처리합니다.'}</div><Encounter key={encounterKey(expedition)} expedition={expedition} combatEvents={combatEvents} playerMaxHp={playerMaxHp} appearanceId={appearanceId} titleName={titleName}/></section>;
}

