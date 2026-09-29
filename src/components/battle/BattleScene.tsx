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

type Floating={id:number;kind:'monster-damage'|'player-damage'|'player-heal'|'monster-shield-float'|'player-shield-float';target:'player'|'monster';amount:number;critical?:boolean;hit?:string;lane?:number};

function DamageDigits({amount,prefix}:{amount:number;prefix:string}){
 const chars=String(Math.max(0,Math.ceil(amount))).split('');
 return <span className="tc-damage-digits"><i className="tc-damage-sign">{prefix}</i>{chars.map((char,index)=><i key={index} className="tc-damage-digit" style={{'--digit-index':index} as React.CSSProperties}>{char}</i>)}</span>;
}

export function FloatingLayer({events}:{events:Floating[]}){
 return <div className="damage-layer" aria-hidden="true">{events.map(e=>{
  const shield=e.kind.endsWith('shield-float'),heal=e.kind==='player-heal',prefix=shield?'':heal?'+':'-';
  return <span key={e.id} className={'floating-number target-'+e.target+' '+e.kind+(e.critical?' critical':'')} style={{'--damage-lane':e.lane??0} as React.CSSProperties}>
   {e.hit&&<small className="tc-damage-hit">{e.hit}</small>}
   {shield&&<small className="tc-damage-shield-label">보호막</small>}
   <DamageDigits amount={e.amount} prefix={prefix}/>
   {e.critical&&<b>CRITICAL</b>}
  </span>;
 })}</div>;
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
 const hitAnimations=useRef<{player:Animation|null;monster:Animation|null}>({player:null,monster:null});
 const [monsterImpact,setMonsterImpact]=useState<Impact>(null),[playerImpact,setPlayerImpact]=useState<Impact>(null),[events,setEvents]=useState<Floating[]>([]);
 const [playerMotion,setPlayerMotion]=useState<Motion>(null),[monsterMotion,setMonsterMotion]=useState<Motion>(null);

 const schedule=(fn:()=>void,ms:number)=>{
  const timer=setTimeout(()=>{timers.current=timers.current.filter(t=>t!==timer);fn();},ms);
  timers.current.push(timer);return timer;
 };

 const shakeTarget=(target:'player'|'monster',critical:boolean)=>{
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  const placement=target==='player'?playerAnchor.current:monsterAnchor.current;
  const figure=placement?.querySelector<HTMLElement>(target==='player'?'.player-figure':'.monster-figure');
  if(!figure?.animate)return;
  hitAnimations.current[target]?.cancel();
  const rate=Math.min(2,Math.max(.75,speed||1)),amp=critical?7:4,duration=Math.round((critical?190:130)/rate);
  hitAnimations.current[target]=figure.animate([
   {transform:'translate(0,0)'},
   {transform:'translate('+(target==='player'?-amp:amp)+'px,-1px)',offset:.2},
   {transform:'translate('+(target==='player'?amp*.8:-amp*.8)+'px,1px)',offset:.42},
   {transform:'translate('+(target==='player'?-amp*.45:amp*.45)+'px,0)',offset:.68},
   {transform:'translate(0,0)'}
  ],{duration,easing:'cubic-bezier(.2,.72,.2,1)'});
 };

 const addFloating=(item:Floating,delay:number,duration:number)=>{
  schedule(()=>{
   if(showDamage)setEvents(current=>[...current,item].slice(-SCENE_CONFIG.maxDamageLabels));
   schedule(()=>setEvents(current=>current.filter(value=>value.id!==item.id)),duration);
  },delay);
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
  const rate=Math.min(2,Math.max(.75,speed||1)),hitMs=Math.round(SCENE_CONFIG.hitDurationMs/rate),dmgMs=Math.round(SCENE_CONFIG.damageDurationMs/rate),hitGap=Math.round(78/rate);
  let touchedMonster=false,touchedPlayer=false,monsterCritical=false,playerCritical=false;

  for(const event of direct){
   const delay=event.hitCount>1?Math.max(0,event.hitIndex-1)*hitGap:0,hit=event.hitCount>1?event.hitIndex+'타':undefined,lane=(event.hitIndex-1)%3;
   schedule(()=>{
    vfxRef.current?.playEvent(event,speed);
    if(event.hpDamage>0)shakeTarget(event.target,event.critical);
   },delay);
   if(event.absorbedByShield>0)addFloating({id:++seq.current,kind:event.target==='monster'?'monster-shield-float':'player-shield-float',target:event.target,amount:event.absorbedByShield,critical:event.critical&&event.hpDamage===0,hit,lane},delay,dmgMs);
   if(event.hpDamage>0)addFloating({id:++seq.current,kind:event.target==='monster'?'monster-damage':'player-damage',target:event.target,amount:event.hpDamage,critical:event.critical,hit,lane},delay,dmgMs);
   if(event.target==='monster'){touchedMonster=true;monsterCritical=monsterCritical||(event.critical&&event.hpDamage>0);}
   else{touchedPlayer=true;playerCritical=playerCritical||(event.critical&&event.hpDamage>0);}
  }

  // Older/fallback damage sources still receive the same shake + particle language.
  if(!direct.length&&monsterDamage>0){
   touchedMonster=true;
   schedule(()=>{vfxRef.current?.playDamage('monster',false,speed);shakeTarget('monster',false);},0);
   addFloating({id:++seq.current,kind:'monster-damage',target:'monster',amount:monsterDamage,lane:0},0,dmgMs);
  }
  if(playerEvent?.kind==='heal'){
   addFloating({id:++seq.current,kind:'player-heal',target:'player',amount:playerEvent.amount,lane:0},0,dmgMs);
   vfxRef.current?.playHeal(speed);
  }else if(!direct.length&&playerEvent?.kind==='damage'){
   touchedPlayer=true;
   schedule(()=>{vfxRef.current?.playDamage('player',false,speed);shakeTarget('player',false);},0);
   addFloating({id:++seq.current,kind:'player-damage',target:'player',amount:playerEvent.amount,lane:0},0,dmgMs);
  }
  if(expedition.hp<=0&&before.hp>0)vfxRef.current?.playDeath(speed);

  if(touchedMonster)setMonsterImpact(monsterCritical?'critical':'normal');
  if(touchedPlayer)setPlayerImpact(playerCritical?'critical':'normal');
  if(direct.some(event=>event.attacker==='monster')){
   setMonsterMotion('monster');
   schedule(()=>setMonsterMotion(null),Math.round(180/rate));
  }

  const pulse=seq.current;
  if(touchedMonster||touchedPlayer)schedule(()=>{if(seq.current===pulse){setMonsterImpact(null);setPlayerImpact(null);}},hitMs+Math.max(0,direct.length-1)*hitGap);
 },[expedition,combatEvents,speed,showDamage]);
 useEffect(()=>()=>{timers.current.forEach(clearTimeout);hitAnimations.current.player?.cancel();hitAnimations.current.monster?.cancel();vfxRef.current?.cancel();},[]);

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
