import React,{useEffect,useRef,useState} from 'react';
import type {CombatEvent,Expedition} from '../../game/types';
import {assetUrl,graphicFor,playerGraphicFor,SCENE_CONFIG} from '../../game/data/graphics';
import {damageBetween,encounterKey,imageState,monsterHud,playerVitalBetween} from './presentation';
import {BattleVfxCanvas,type BattleVfxHandle} from './BattleVfxCanvas';

function useImage(path?:string){
 const [ready,setReady]=useState<string|null>(null);
 useEffect(()=>{setReady(null);if(!path)return;let active=true;const img=new Image();img.onload=()=>{if(active)setReady(path);};img.onerror=()=>{if(active)setReady(null);};img.src=assetUrl(path);return()=>{active=false;img.onload=null;img.onerror=null;};},[path]);
 return !!path&&ready===path;
}

type Impact='normal'|'critical'|null;
type Motion='basic'|'skill'|'monster'|null;
export type BattleActionCue={id:number;kind:'basic'|'skill'};

export function PlayerLayer({impact,motion,appearanceId,anchorRef}:{impact:Impact;motion:Motion;appearanceId:string;anchorRef:React.RefObject<HTMLDivElement|null>}){
 const graphic=playerGraphicFor(appearanceId),fallback=playerGraphicFor('default'),ready=useImage(graphic.image.idle),fallbackReady=useImage(fallback.image.idle),d=graphic.display,src=ready?graphic.image.idle:fallbackReady?fallback.image.idle:undefined;
 const className='player-figure'+(impact?' is-hit tc-combat-impact-'+impact:'')+(impact==='critical'?' is-critical':'');
 const placementClass='player-placement'+(motion==='basic'?' tc-combat-player-basic':motion==='skill'?' tc-combat-player-skill':'');
 return <div ref={anchorRef} className={placementClass} style={{'--player-scale':d.scale,'--player-x':d.offsetX+'%','--player-y':d.offsetY+'%'} as React.CSSProperties}><div className={className}>{src?<img src={assetUrl(src)} alt="모험가"/>:<div className="fighter-placeholder player-placeholder"><span aria-hidden="true">♙</span></div>}</div></div>;
}

export function MonsterLayer({expedition,impact,motion,anchorRef}:{expedition:Expedition;impact:Impact;motion:Motion;anchorRef:React.RefObject<HTMLDivElement|null>}){
 const hit=!!impact,graphic=graphicFor(expedition.tower,expedition.monster),idleReady=useImage(graphic?.image.idle),hitReady=useImage(graphic?.image.hit),state=imageState(hit,idleReady,hitReady),display=graphic?.display??{scale:1,offsetX:0,offsetY:0},src=state==='hit'?graphic?.image.hit:graphic?.image.idle;
 const className='monster-figure'+(impact?' is-hit tc-combat-impact-'+impact:'')+(impact==='critical'?' is-critical':'');
 return <div ref={anchorRef} className={'monster-placement'+(motion==='monster'?' tc-combat-monster-attack':'')} style={{'--monster-scale':display.scale,'--monster-x':display.offsetX+'%','--monster-y':display.offsetY+'%'} as React.CSSProperties}><div className={className}>{state!=='placeholder'&&src?<img src={assetUrl(src)} alt={expedition.monster.name}/>:<div className="fighter-placeholder monster-placeholder"><span aria-hidden="true">♟</span></div>}</div></div>;
}

type Floating={id:number;kind:'monster-damage'|'player-damage'|'player-heal'|'monster-shield-float'|'player-shield-float';amount:number;critical?:boolean;hit?:string};
export function FloatingLayer({events}:{events:Floating[]}){
 return <div className="damage-layer" aria-hidden="true">{events.map(e=><span key={e.id} className={'floating-number '+e.kind+(e.critical?' critical':'')}>{e.hit&&<small>{e.hit}</small>}{e.kind.endsWith('shield-float')?'보호막 ':e.kind==='player-heal'?'+':'-'}{Math.ceil(e.amount)}{e.critical&&<b>치명타</b>}</span>)}</div>;
}

function StatusPips({count}:{count:number}){return <div className="tc-hud-pips" aria-hidden="true">{[0,1,2,3].map(i=><i key={i} className={i<count?'active':''}/>)}</div>;}

function CombatHud({expedition,playerMaxHp,titleName}:{expedition:Expedition;playerMaxHp:number;titleName?:string}){
 const monster=monsterHud(expedition.monster),playerPercent=Math.max(0,Math.min(100,expedition.hp/playerMaxHp*100)),playerPips=Math.min(4,expedition.playerEffects.length+(expedition.reactivePrepared.player?1:0)),monsterPips=Math.min(4,expedition.monsterEffects.length+(expedition.reactivePrepared.monster?1:0));
 return <div className="combat-hud">
  <div className="fighter-hud monster-hud"><strong>{monster.name}</strong><span>{Math.ceil(monster.current)} / {monster.max}</span><div className="hp enemy" role="progressbar" aria-label={monster.name+' HP'} aria-valuenow={monster.current} aria-valuemin={0} aria-valuemax={monster.max}><div style={{width:monster.percent+'%'}}/></div><StatusPips count={monsterPips}/><small className="tc-hud-level">Lv {expedition.floor}</small></div>
  <div className="fighter-hud player-hud"><strong>{titleName&&<small className="title-tag">「{titleName}」</small>}모험가</strong><span>{Math.ceil(expedition.hp)} / {playerMaxHp}</span><div className="hp" role="progressbar" aria-label="플레이어 HP" aria-valuenow={Math.max(0,expedition.hp)} aria-valuemin={0} aria-valuemax={playerMaxHp}><div style={{width:playerPercent+'%'}}/></div><StatusPips count={playerPips}/><small className="tc-hud-level">Lv {expedition.playerTurn}</small></div>
 </div>;
}

function Encounter({expedition,combatEvents,playerMaxHp,appearanceId,titleName,speed=1,showDamage=true,actionCue}:{expedition:Expedition;combatEvents:CombatEvent[];playerMaxHp:number;appearanceId:string;titleName?:string;speed?:number;showDamage?:boolean;actionCue?:BattleActionCue|null}){
 const previous=useRef(expedition),previousEventId=useRef(combatEvents.at(-1)?.id??0),seq=useRef(0),timers=useRef<ReturnType<typeof setTimeout>[]>([]);
 const playerAnchor=useRef<HTMLDivElement|null>(null),monsterAnchor=useRef<HTMLDivElement|null>(null),vfxRef=useRef<BattleVfxHandle|null>(null);
 const [monsterImpact,setMonsterImpact]=useState<Impact>(null),[playerImpact,setPlayerImpact]=useState<Impact>(null),[events,setEvents]=useState<Floating[]>([]);
 const [playerMotion,setPlayerMotion]=useState<Motion>(null),[monsterMotion,setMonsterMotion]=useState<Motion>(null);

 const schedule=(fn:()=>void,ms:number)=>{
  const timer=setTimeout(()=>{timers.current=timers.current.filter(t=>t!==timer);fn();},ms);
  timers.current.push(timer);return timer;
 };

 useEffect(()=>{
  if(!actionCue)return;
  const rate=Math.min(2,Math.max(.75,speed||1)),duration=Math.round((actionCue.kind==='skill'?240:170)/rate);
  setPlayerMotion(actionCue.kind);
  vfxRef.current?.cuePlayerAction(actionCue.kind,speed);
  schedule(()=>setPlayerMotion(null),duration);
 },[actionCue?.id,speed]);

 useEffect(()=>{
  const before=previous.current,monsterDamage=damageBetween(before,expedition),playerEvent=playerVitalBetween(before,expedition),direct=combatEvents.filter(event=>event.id>previousEventId.current);
  previous.current=expedition;previousEventId.current=combatEvents.at(-1)?.id??previousEventId.current;
  const additions:Floating[]=[];
  for(const event of direct){
   const hit=event.hitCount>1?event.hitIndex+'타':undefined;
   vfxRef.current?.playEvent(event,speed);
   if(event.absorbedByShield>0)additions.push({id:++seq.current,kind:event.target==='monster'?'monster-shield-float':'player-shield-float',amount:event.absorbedByShield,critical:event.critical&&event.hpDamage===0,hit});
   if(event.hpDamage>0)additions.push({id:++seq.current,kind:event.target==='monster'?'monster-damage':'player-damage',amount:event.hpDamage,critical:event.critical,hit});
  }
  if(!direct.length&&monsterDamage)additions.push({id:++seq.current,kind:'monster-damage',amount:monsterDamage});
  if(playerEvent?.kind==='heal'){additions.push({id:++seq.current,kind:'player-heal',amount:playerEvent.amount});vfxRef.current?.playHeal(speed);}
  else if(!direct.length&&playerEvent?.kind==='damage')additions.push({id:++seq.current,kind:'player-damage',amount:playerEvent.amount});
  if(expedition.hp<=0&&before.hp>0)vfxRef.current?.playDeath(speed);

  if(monsterDamage||direct.some(event=>event.target==='monster'))setMonsterImpact(direct.some(event=>event.target==='monster'&&event.critical&&event.hpDamage>0)?'critical':'normal');
  if(playerEvent?.kind==='damage'||direct.some(event=>event.target==='player'))setPlayerImpact(direct.some(event=>event.target==='player'&&event.critical&&event.hpDamage>0)?'critical':'normal');
  if(direct.some(event=>event.attacker==='monster')){
   setMonsterMotion('monster');
   schedule(()=>setMonsterMotion(null),Math.round(180/Math.min(2,Math.max(.75,speed||1))));
  }

  if(additions.length)setEvents(x=>showDamage?[...x,...additions].slice(-SCENE_CONFIG.maxDamageLabels):[]);
  const rate=speed>0?speed:1,hitMs=Math.round(SCENE_CONFIG.hitDurationMs/rate),dmgMs=Math.round(SCENE_CONFIG.damageDurationMs/rate),pulse=seq.current;
  if(monsterImpact!==null||playerImpact!==null||direct.length||monsterDamage||playerEvent?.kind==='damage')schedule(()=>{if(seq.current===pulse){setMonsterImpact(null);setPlayerImpact(null);}},hitMs);
  for(const item of additions)schedule(()=>setEvents(x=>x.filter(e=>e.id!==item.id)),dmgMs);
 },[expedition,combatEvents,speed,showDamage]);

 useEffect(()=>()=>{timers.current.forEach(clearTimeout);vfxRef.current?.cancel();},[]);

 return <>
  <div className={'combat-stage '+(expedition.spawnAt?'defeated':'')}>
   <PlayerLayer impact={playerImpact} motion={playerMotion} appearanceId={appearanceId} anchorRef={playerAnchor}/>
   <MonsterLayer expedition={expedition} impact={monsterImpact} motion={monsterMotion} anchorRef={monsterAnchor}/>
   <FloatingLayer events={events}/>
  </div>
  <BattleVfxCanvas ref={vfxRef} playerRef={playerAnchor} monsterRef={monsterAnchor}/>
  <CombatHud expedition={expedition} playerMaxHp={playerMaxHp} titleName={titleName}/>
 </>;
}

export function BattleScene({expedition,combatEvents,playerMaxHp,appearanceId,titleName,speed=1,showDamage=true,actionCue}:{expedition:Expedition;combatEvents:CombatEvent[];playerMaxHp:number;appearanceId:string;titleName?:string;speed?:number;showDamage?:boolean;actionCue?:BattleActionCue|null}){
 return <section className="battle-scene" aria-label="전투 그래픽" style={{'--hit-duration':Math.round(SCENE_CONFIG.hitDurationMs/(speed>0?speed:1))+'ms','--damage-duration':Math.round(SCENE_CONFIG.damageDurationMs/(speed>0?speed:1))+'ms'} as React.CSSProperties}><Encounter key={encounterKey(expedition)} expedition={expedition} combatEvents={combatEvents} playerMaxHp={playerMaxHp} appearanceId={appearanceId} titleName={titleName} speed={speed} showDamage={showDamage} actionCue={actionCue}/></section>;
}
