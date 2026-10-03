import {loadSettings,reducedMotion} from '../../settings/preferences';
import React,{useEffect,useRef,useState} from 'react';
import type {CombatEvent,Expedition,Weapon} from '../../game/types';
import {assetUrl,graphicFor,playerGraphicFor,playerGraphicForJob,SCENE_CONFIG} from '../../game/data/graphics';
import {damageBetween,encounterKey,imageState,monsterHud,playerVitalBetween} from './presentation';
import {attackWindup,counterattackDelay,recoilFrames} from './battleVfxTimeline';
import {playCombatImpact,stopCombatAudio} from './combatAudio';
import {BattleVfxCanvas,type BattleVfxHandle} from './BattleVfxCanvas';

function useImage(path?:string){
 const [ready,setReady]=useState<string|null>(null);
 useEffect(()=>{setReady(null);if(!path)return;let active=true;const img=new Image();img.onload=()=>{if(active)setReady(path);};img.onerror=()=>{if(active)setReady(null);};img.src=assetUrl(path);return()=>{active=false;img.onload=null;img.onerror=null;};},[path]);
 return !!path&&ready===path;
}

type Impact='normal'|'critical'|null;
type Motion='basic'|'skill'|'monster'|null;
export type BattleActionCue={id:number;kind:'basic'|'skill'};

export function PlayerLayer({impact,motion,jobId,appearanceId,anchorRef}:{impact:Impact;motion:Motion;jobId:string|null;appearanceId:string;anchorRef:React.RefObject<HTMLDivElement|null>}){
 const graphic=playerGraphicForJob(jobId,appearanceId),fallback=playerGraphicFor(appearanceId),ready=useImage(graphic.image.idle),fallbackReady=useImage(fallback.image.idle),d=graphic.display,src=ready?graphic.image.idle:fallbackReady?fallback.image.idle:undefined;
 const className='player-figure'+(impact?' is-hit tc-combat-impact-'+impact:'')+(impact==='critical'?' is-critical':'');
 const placementClass='player-placement'+(motion==='basic'?' tc-combat-player-basic':motion==='skill'?' tc-combat-player-skill':'');
 return <div ref={anchorRef} className={placementClass} style={{'--player-scale':d.scale,'--player-x':d.offsetX+'%','--player-y':d.offsetY+'%'} as React.CSSProperties}><div className={className}>{src?<img src={assetUrl(src)} alt="모험가"/>:<div className="fighter-placeholder player-placeholder"><span aria-hidden="true">♙</span></div>}</div></div>;
}

export function MonsterLayer({expedition,impact,motion,anchorRef}:{expedition:Expedition;impact:Impact;motion:Motion;anchorRef:React.RefObject<HTMLDivElement|null>}){
 const hit=!!impact,graphic=graphicFor(expedition.tower,expedition.monster),idleReady=useImage(graphic?.image.idle),hitReady=useImage(graphic?.image.hit),state=imageState(hit,idleReady,hitReady),display=graphic?.display??{scale:1,offsetX:0,offsetY:0},src=state==='hit'?graphic?.image.hit:graphic?.image.idle;
 const className='monster-figure'+(impact?' is-hit tc-combat-impact-'+impact:'')+(impact==='critical'?' is-critical':'');
 return <div ref={anchorRef} className={'monster-placement'+(motion==='monster'?' tc-combat-monster-attack':'')} style={{'--monster-scale':display.scale,'--monster-x':display.offsetX+'%','--monster-y':display.offsetY+'%'} as React.CSSProperties}><div className={className}>{state!=='placeholder'&&src?<img src={assetUrl(src)} alt={expedition.monster.name}/>:<div className="fighter-placeholder monster-placeholder"><span aria-hidden="true">♟</span></div>}</div></div>;
}

type Floating={id:number;kind:'monster-damage'|'player-damage'|'player-heal'|'monster-heal'|'monster-shield-float'|'player-shield-float';target:'player'|'monster';amount:number;x:number;y:number;critical?:boolean;label?:string;hit?:string;lane?:number};

function DamageDigits({amount,prefix}:{amount:number;prefix:string}){
 const chars=String(Math.max(0,Math.ceil(amount))).split('');
 return <span className="tc-damage-digits"><i className="tc-damage-sign">{prefix}</i>{chars.map((char,index)=><i key={index} className="tc-damage-digit" style={{'--digit-index':index} as React.CSSProperties}>{char}</i>)}</span>;
}

export function FloatingLayer({events}:{events:Floating[]}){
 return <div className="damage-layer" aria-hidden="true">{events.map(e=>{
  const shield=e.kind.endsWith('shield-float'),heal=e.kind.endsWith('heal'),prefix=heal?'+':'';
  return <span key={e.id} className={'floating-number target-'+e.target+' '+e.kind+(e.critical?' critical':'')} style={{left:e.x,top:e.y,'--damage-lane':e.lane??0} as React.CSSProperties}>
   {e.hit&&<small className="tc-damage-hit">{e.hit}</small>}
   {shield&&<small className="tc-damage-shield-label">보호막</small>}
   {e.label?<b>{e.label}</b>:<DamageDigits amount={e.amount} prefix={prefix}/>}
   {e.critical&&<b>CRITICAL</b>}
  </span>;
 })}</div>;
}

function ResourcePips({count}:{count:number}){return <div className="tc-hud-pips" role="status" aria-label={'전투 자원 '+count+' / 4'}>{[0,1,2,3].map(i=><i key={i} className={i<count?'active':''}/>)}</div>;}

function HpTrack({percent,enemy=false,name,current,max}:{percent:number;enemy?:boolean;name:string;current:number;max:number}){
 return <div className={'hp'+(enemy?' enemy':'')} role="progressbar" aria-label={name+' HP'} aria-valuenow={Math.min(max,Math.max(0,current))} aria-valuemin={0} aria-valuemax={max}>
  <i className="tc-hp-loss" style={{width:percent+'%'}}/>
  <div style={{width:percent+'%'}}/>
 </div>;
}

function CombatHud({expedition,playerMaxHp,titleName}:{expedition:Expedition;playerMaxHp:number;titleName?:string}){
 const monster=monsterHud(expedition.monster),playerPercent=Math.max(0,Math.min(100,expedition.hp/playerMaxHp*100)),playerPips=Math.max(0,Math.min(4,expedition.jobRuntime.resource?.value??0));
 return <div className="combat-hud">
  <div className="fighter-hud monster-hud"><strong>{monster.name}</strong><span>{Math.ceil(monster.current)} / {monster.max}</span><HpTrack percent={monster.percent} enemy name={monster.name} current={monster.current} max={monster.max}/><small className="tc-hud-level">Lv {expedition.floor}</small></div>
  <div className="fighter-hud player-hud"><strong>{titleName&&<small className="title-tag">「{titleName}」</small>}모험가</strong><span>{Math.ceil(expedition.hp)} / {playerMaxHp}</span><HpTrack percent={playerPercent} name="플레이어" current={expedition.hp} max={playerMaxHp}/><ResourcePips count={playerPips}/><small className="tc-hud-level">Lv {expedition.playerTurn}</small></div>
 </div>;
}

function Encounter({expedition,combatEvents,playerMaxHp,appearanceId,titleName,speed=1,showDamage=true,weapon='sword',actionCue}:{expedition:Expedition;combatEvents:CombatEvent[];playerMaxHp:number;appearanceId:string;titleName?:string;speed?:number;showDamage?:boolean;weapon?:Weapon;actionCue?:BattleActionCue|null}){
 const previous=useRef(expedition),previousEventId=useRef(combatEvents.at(-1)?.id??0),seq=useRef(0),timers=useRef<ReturnType<typeof setTimeout>[]>([]);
 const stageRef=useRef<HTMLDivElement|null>(null),playerAnchor=useRef<HTMLDivElement|null>(null),monsterAnchor=useRef<HTMLDivElement|null>(null),vfxRef=useRef<BattleVfxHandle|null>(null);
 const hitAnimations=useRef<{player:Animation|null;monster:Animation|null}>({player:null,monster:null});
 const [monsterImpact,setMonsterImpact]=useState<Impact>(null),[playerImpact,setPlayerImpact]=useState<Impact>(null),[events,setEvents]=useState<Floating[]>([]);
 const [displayHp,setDisplayHp]=useState(expedition.hp),[displayMonsterHp,setDisplayMonsterHp]=useState(expedition.monster.currentHp);
 const [monsterDefeated,setMonsterDefeated]=useState(false);
 const [playerMotion,setPlayerMotion]=useState<Motion>(null),[monsterMotion,setMonsterMotion]=useState<Motion>(null);

 const schedule=(fn:()=>void,ms:number)=>{
  const timer=setTimeout(()=>{timers.current=timers.current.filter(t=>t!==timer);fn();},ms);
  timers.current.push(timer);return timer;
 };

 const shakeTarget=(target:'player'|'monster',critical:boolean)=>{
  if(!loadSettings().shake||reducedMotion())return;
  const placement=target==='player'?playerAnchor.current:monsterAnchor.current;
  const figure=placement?.querySelector<HTMLElement>(target==='player'?'.player-figure':'.monster-figure');
  if(!figure?.animate)return;
  hitAnimations.current[target]?.cancel();
  const recoil=recoilFrames(target,critical,speed);
  hitAnimations.current[target]=figure.animate(recoil.frames,{duration:recoil.duration,easing:'cubic-bezier(.18,.76,.2,1)'});
 };

 const damagePoint=(target:'player'|'monster',lane=0)=>{
  const stage=stageRef.current,placement=target==='player'?playerAnchor.current:monsterAnchor.current;
  if(!stage||!placement)return target==='player'?{x:96,y:330}:{x:280,y:170};
  const s=stage.getBoundingClientRect(),r=placement.getBoundingClientRect();
  const laneOffset=lane===1?-14:lane===2?14:0;
  return{
   x:r.left-s.left+r.width/2+laneOffset,
   y:r.top-s.top+Math.max(6,r.height*.08),
  };
 };

 const addFloating=(item:Omit<Floating,'x'|'y'>,delay:number,duration:number)=>{
  schedule(()=>{
   const point=damagePoint(item.target,item.lane??0),resolved:Floating={...item,...point};
   if(showDamage)setEvents(current=>[...current,resolved].slice(-SCENE_CONFIG.maxDamageLabels));
   schedule(()=>setEvents(current=>current.filter(value=>value.id!==resolved.id)),duration);
  },delay);
 };

 useEffect(()=>{
  if(!actionCue)return;
  vfxRef.current?.cuePlayerAction(actionCue.kind,speed);
 },[actionCue?.id,speed]);

 useEffect(()=>{
  const before=previous.current,monsterDamage=damageBetween(before,expedition),playerEvent=playerVitalBetween(before,expedition),fresh=combatEvents.filter(event=>event.id>previousEventId.current),direct=fresh.filter(event=>event.kind==='DIRECT_DAMAGE');
  previous.current=expedition;previousEventId.current=combatEvents.at(-1)?.id??previousEventId.current;
  const rate=Math.min(2,Math.max(.75,speed||1)),hitMs=Math.round(SCENE_CONFIG.hitDurationMs/rate),dmgMs=Math.round(SCENE_CONFIG.damageDurationMs/rate),hitGap=Math.round(78/rate);
  const windup=attackWindup(speed),hasPlayerHit=direct.some(e=>e.attacker==='player'),hasMonsterHit=direct.some(e=>e.attacker==='monster');
  const lastPlayerHit=windup+Math.max(0,...direct.filter(e=>e.attacker==='player').map(e=>e.hitIndex-1))*hitGap;
  const retaliationDelay=hasMonsterHit?(counterattackDelay(direct,speed)||windup):0;
  if(hasPlayerHit){
   setDisplayMonsterHp(expedition.monster.currentHp+direct.filter(e=>e.attacker==='player'&&e.target==='monster').reduce((sum,e)=>sum+e.hpDamage,0));
   schedule(()=>setDisplayMonsterHp(expedition.monster.currentHp),lastPlayerHit);
   setPlayerMotion(actionCue?.kind??'basic');
   schedule(()=>setPlayerMotion(null),Math.round(320/rate));
  }else setDisplayMonsterHp(expedition.monster.currentHp);
  if(expedition.monster.currentHp<=0&&before.monster.currentHp>0)schedule(()=>setMonsterDefeated(true),hasPlayerHit?lastPlayerHit:0);
  if(retaliationDelay){
   setDisplayHp(expedition.hp+direct.filter(e=>e.attacker==='monster'&&e.target==='player').reduce((sum,e)=>sum+e.hpDamage,0));
   schedule(()=>setDisplayHp(expedition.hp),retaliationDelay);
  }else setDisplayHp(expedition.hp);
  let touchedMonster=false,touchedPlayer=false,monsterCritical=false,playerCritical=false;

  for(const event of fresh.filter(event=>event.kind==='HEAL')){
   addFloating({id:++seq.current,kind:event.target==='player'?'player-heal':'monster-heal',target:event.target,amount:event.healing??0,critical:event.critical,lane:0},0,dmgMs);
   if(event.target==='player')vfxRef.current?.playHeal(speed);
  }
  for(const event of direct){
   const delay=(event.attacker==='monster'?retaliationDelay:windup)+(event.hitCount>1?Math.max(0,event.hitIndex-1)*hitGap:0),hit=event.origin==='REACTION'?'반격':event.hitCount>1?event.hitIndex+'타':undefined,lane=(event.hitIndex-1)%3;
   schedule(()=>{
    vfxRef.current?.playEvent(event,speed);
    if(event.hpDamage>0||event.absorbedByShield>0)playCombatImpact(event.attacker==='player'?(weapon??'sword'):'sword',event.critical,event.hpDamage===0,event.target==='monster'&&expedition.monster.currentHp<=0&&event.hitIndex===event.hitCount);
    if(event.hpDamage>0)shakeTarget(event.target,event.critical);
   },delay);
   if(event.outcome==='MISS'||event.outcome==='IMMUNE')addFloating({id:++seq.current,kind:event.target==='monster'?'monster-damage':'player-damage',target:event.target,amount:0,label:event.outcome==='MISS'?'MISS':'IMMUNE',hit:event.origin==='REACTION'?'반격':hit,lane},delay,dmgMs);
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
  if(playerEvent?.kind==='heal'&&!fresh.some(event=>event.kind==='HEAL'&&event.target==='player')){
   addFloating({id:++seq.current,kind:'player-heal',target:'player',amount:playerEvent.amount,lane:0},0,dmgMs);
   vfxRef.current?.playHeal(speed);
  }else if(!direct.length&&playerEvent?.kind==='damage'){
   touchedPlayer=true;
   schedule(()=>{vfxRef.current?.playDamage('player',false,speed);shakeTarget('player',false);},0);
   addFloating({id:++seq.current,kind:'player-damage',target:'player',amount:playerEvent.amount,lane:0},0,dmgMs);
  }
  if(expedition.hp<=0&&before.hp>0)schedule(()=>vfxRef.current?.playDeath(speed),retaliationDelay);

  if(touchedMonster)schedule(()=>setMonsterImpact(monsterCritical?'critical':'normal'),hasPlayerHit?windup:0);
  if(touchedPlayer)schedule(()=>setPlayerImpact(playerCritical?'critical':'normal'),retaliationDelay);
  if(direct.some(event=>event.attacker==='monster')){
   schedule(()=>setMonsterMotion('monster'),Math.max(0,retaliationDelay-windup));
   schedule(()=>setMonsterMotion(null),Math.max(0,retaliationDelay-windup)+Math.round(320/rate));
  }

  const pulse=seq.current;
  if(touchedMonster)schedule(()=>{if(seq.current===pulse)setMonsterImpact(null);},(hasPlayerHit?windup:0)+hitMs+Math.max(0,...direct.filter(e=>e.target==='monster').map(e=>e.hitIndex-1))*hitGap);
  if(touchedPlayer)schedule(()=>{if(seq.current===pulse)setPlayerImpact(null);},retaliationDelay+hitMs+Math.max(0,...direct.filter(e=>e.target==='player').map(e=>e.hitIndex-1))*hitGap);
 },[expedition,combatEvents,speed,showDamage]);
 useEffect(()=>()=>{timers.current.forEach(clearTimeout);hitAnimations.current.player?.cancel();hitAnimations.current.monster?.cancel();vfxRef.current?.cancel();stopCombatAudio();},[]);

 return <>
  <div ref={stageRef} className={'combat-stage'+(monsterDefeated?' tc-monster-defeated':'')} style={{'--action-duration':Math.round(320/Math.min(2,Math.max(.75,speed||1)))+'ms'} as React.CSSProperties}>
   <PlayerLayer impact={playerImpact} motion={playerMotion} jobId={expedition.jobSnapshotId} appearanceId={appearanceId} anchorRef={playerAnchor}/>
   <MonsterLayer expedition={expedition} impact={monsterImpact} motion={monsterMotion} anchorRef={monsterAnchor}/>
   <FloatingLayer events={events}/>
  </div>
  <BattleVfxCanvas ref={vfxRef} playerRef={playerAnchor} monsterRef={monsterAnchor} weapon={weapon}/>
  <CombatHud expedition={{...expedition,hp:displayHp,monster:{...expedition.monster,currentHp:displayMonsterHp}}} playerMaxHp={playerMaxHp} titleName={titleName}/>
 </>;
}

export function BattleScene({expedition,combatEvents,playerMaxHp,appearanceId,titleName,speed=1,showDamage=true,weapon='sword',actionCue}:{expedition:Expedition;combatEvents:CombatEvent[];playerMaxHp:number;appearanceId:string;titleName?:string;speed?:number;showDamage?:boolean;weapon?:Weapon;actionCue?:BattleActionCue|null}){
 return <section className="battle-scene" aria-label="전투 그래픽" style={{'--hit-duration':Math.round(SCENE_CONFIG.hitDurationMs/(speed>0?speed:1))+'ms','--damage-duration':Math.round(SCENE_CONFIG.damageDurationMs/(speed>0?speed:1))+'ms'} as React.CSSProperties}><Encounter key={encounterKey(expedition)} expedition={expedition} combatEvents={combatEvents} playerMaxHp={playerMaxHp} appearanceId={appearanceId} titleName={titleName} speed={speed} showDamage={showDamage} weapon={weapon} actionCue={actionCue}/></section>;
}
