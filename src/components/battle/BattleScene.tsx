import React,{memo,useEffect,useState} from 'react';
import type {Expedition} from '../../game/types';
import {assetUrl,backgroundFor,graphicFor,playerGraphicFor,SCENE_CONFIG} from '../../game/data/graphics';
import {imageState,monsterHud} from './presentation';
import type {BattleFxPlaybackEvent,BattleFxShake} from './battleFxPresentation';

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

function latestShake(events:BattleFxPlaybackEvent[]):BattleFxPlaybackEvent|undefined {
  return [...events].reverse().find(event=>event.shake);
}
function shakeClass(shake?:BattleFxShake){return shake?' is-hit shake-'+shake:'';}

function ActorFxLayer({events}:{events:BattleFxPlaybackEvent[]}){
  return <div className="actor-fx-layer" aria-hidden="true">{events.map(event=><React.Fragment key={event.playbackId}>
    <span className={'impact-fx impact-'+event.impact}/>
    {event.label&&<span className={'floating-number fx-label '+(event.kind==='HEAL'?'heal':event.kind==='ARMOR_BREAK'?'break':'damage')}>{event.label}</span>}
  </React.Fragment>)}</div>;
}

export function PlayerLayer({events,appearanceId}:{events:BattleFxPlaybackEvent[];appearanceId:string}){
  const graphic=playerGraphicFor(appearanceId),fallback=playerGraphicFor('default'),ready=useImage(graphic.image.idle),fallbackReady=useImage(fallback.image.idle),d=graphic.display,src=ready?graphic.image.idle:fallbackReady?fallback.image.idle:undefined,hit=latestShake(events);
  return <div className="player-placement" style={{'--player-scale':d.scale,'--player-x':d.offsetX+'%','--player-y':d.offsetY+'%'} as React.CSSProperties}>
    <div key={hit?.playbackId??'player-idle'} className={'player-figure'+shakeClass(hit?.shake)}>{src?<img src={assetUrl(src)} alt="모험가"/>:<div className="fighter-placeholder player-placeholder"><span aria-hidden="true">♙</span><small>플레이어 이미지 준비 중</small></div>}</div>
    <ActorFxLayer events={events}/>
  </div>;
}
export function MonsterLayer({expedition,events}:{expedition:Expedition;events:BattleFxPlaybackEvent[]}){
  const graphic=graphicFor(expedition.tower,expedition.monster),idleReady=useImage(graphic?.image.idle),hitReady=useImage(graphic?.image.hit),hit=latestShake(events);
  const state=imageState(!!hit,idleReady,hitReady),display=graphic?.display??{scale:1,offsetX:0,offsetY:0},src=state==='hit'?graphic?.image.hit:graphic?.image.idle;
  return <div className="monster-placement" style={{'--monster-scale':display.scale,'--monster-x':display.offsetX+'%','--monster-y':display.offsetY+'%'} as React.CSSProperties}>
    <div key={hit?.playbackId??'monster-idle'} className={'monster-figure'+shakeClass(hit?.shake)}>{state!=='placeholder'&&src?<img src={assetUrl(src)} alt={expedition.monster.name}/>:<div className="fighter-placeholder monster-placeholder"><span aria-hidden="true">♟</span><small>몬스터 이미지 준비 중</small></div>}</div>
    <ActorFxLayer events={events}/>
  </div>;
}
function CombatHud({expedition,playerMaxHp,titleName}:{expedition:Expedition;playerMaxHp:number;titleName?:string}){
  const monster=monsterHud(expedition.monster),playerPercent=Math.max(0,Math.min(100,expedition.hp/playerMaxHp*100));
  return <div className="combat-hud"><div className="fighter-hud player-hud"><strong>{titleName&&<small className="title-tag">「{titleName}」</small>}모험가</strong><span>{Math.ceil(expedition.hp)} / {playerMaxHp}</span><div className="hp" role="progressbar" aria-label="플레이어 HP" aria-valuenow={Math.max(0,expedition.hp)} aria-valuemin={0} aria-valuemax={playerMaxHp}><div style={{width:playerPercent+'%'}}/></div></div><div className="fighter-hud monster-hud"><strong>{monster.name}</strong><span>{Math.ceil(monster.current)} / {monster.max}</span><div className="hp enemy" role="progressbar" aria-label={monster.name+' HP'} aria-valuenow={monster.current} aria-valuemin={0} aria-valuemax={monster.max}><div style={{width:monster.percent+'%'}}/></div></div></div>;
}
function Encounter({expedition,playerMaxHp,appearanceId,titleName,fxEvents}:{expedition:Expedition;playerMaxHp:number;appearanceId:string;titleName?:string;fxEvents:BattleFxPlaybackEvent[]}){
  const playerEvents=fxEvents.filter(event=>event.target==='player'),monsterEvents=fxEvents.filter(event=>event.target==='monster');
  return <><div className={'combat-stage '+(expedition.spawnAt?'defeated':'')}><PlayerLayer events={playerEvents} appearanceId={appearanceId}/><MonsterLayer expedition={expedition} events={monsterEvents}/></div><CombatHud expedition={expedition} playerMaxHp={playerMaxHp} titleName={titleName}/></>;
}
export function BattleScene({expedition,playerMaxHp,appearanceId,titleName,fxEvents}:{expedition:Expedition;playerMaxHp:number;appearanceId:string;titleName?:string;fxEvents:BattleFxPlaybackEvent[]}){
  return <section className="battle-scene" aria-label="전투 그래픽" style={{'--hit-duration':SCENE_CONFIG.hitDurationMs+'ms','--damage-duration':SCENE_CONFIG.damageDurationMs+'ms'} as React.CSSProperties}><BackgroundLayer path={backgroundFor(expedition.tower,expedition.floor)}/><div className="scene-status">{expedition.phase==='PLAYER_TURN'?'내 턴 · 행동을 선택하세요':expedition.phase==='MONSTER_TURN'?'적이 행동합니다.':'전투 결과를 처리합니다.'}</div><Encounter expedition={expedition} playerMaxHp={playerMaxHp} appearanceId={appearanceId} titleName={titleName} fxEvents={fxEvents}/></section>;
}
