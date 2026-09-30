import React,{forwardRef,useEffect,useImperativeHandle,useRef} from 'react';
import type {CombatEvent} from '../../game/types';
import {battleImpactEnvelope,battleVfxNow,battleVfxTiming,type BattleVfxKind} from './battleVfxTimeline';

type Particle={x:number;y:number;vx:number;vy:number;life:number;maxLife:number;size:number;spin:number;rotation:number;tone:string;kind:'spark'|'dust'|'shard'|'mote'};
type Point={x:number;y:number};
type Effect={id:number;kind:BattleVfxKind;startedAt:number;duration:number;holdMs:number;shakePx:number;from:Point;to:Point;particles:Particle[];critical?:boolean};

export type BattleVfxHandle={
 cuePlayerAction:(kind:'basic'|'skill',speed:number)=>void;
 playEvent:(event:CombatEvent,speed:number)=>void;
 playDamage:(target:'player'|'monster',critical:boolean,speed:number)=>void;
 playHeal:(speed:number)=>void;
 playDeath:(speed:number)=>void;
 cancel:()=>void;
};

type Props={
 playerRef:React.RefObject<HTMLElement|null>;
 monsterRef:React.RefObject<HTMLElement|null>;
};

const TAU=Math.PI*2;
const clamp=(n:number,a=0,b=1)=>Math.min(b,Math.max(a,n));
const easeOutCubic=(t:number)=>1-Math.pow(1-clamp(t),3);

function rng(seed:number){
 let a=seed|0;
 return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
}

function particlesFor(kind:BattleVfxKind,count:number,p:Point,seed:number){
 const random=rng(seed),out:Particle[]=[];
 for(let i=0;i<count;i++){
  const a=random()*TAU;
  if(kind==='heal'){
   out.push({x:p.x+(random()-.5)*34,y:p.y+12+random()*20,vx:(random()-.5)*16,vy:-28-random()*46,life:0,maxLife:.42+random()*.36,size:1.3+random()*2.2,spin:0,rotation:0,tone:random()>.35?'#a9c886':'#d5c77b',kind:'mote'});
   continue;
  }
  if(kind==='death'){
   const speed=58+random()*95,shard=random()>.3;
   out.push({x:p.x+(random()-.5)*12,y:p.y+(random()-.5)*12,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-18,life:0,maxLife:.48+random()*.35,size:shard?2+random()*4:3+random()*5,spin:(random()-.5)*11,rotation:a,tone:shard?(random()>.45?'#9b5545':'#55423b'):'#716052',kind:shard?'shard':'dust'});
   continue;
  }
  if(kind==='guard'){
   const side=Math.cos(a)>0?1:-1;
   out.push({x:p.x+side*8,y:p.y+(random()-.5)*22,vx:side*(38+random()*65),vy:(random()-.5)*48,life:0,maxLife:.24+random()*.24,size:1+random()*2,spin:0,rotation:a,tone:random()>.4?'#a7c4c7':'#d1c59e',kind:'spark'});
   continue;
  }
  const critical=kind==='critical-hit',incoming=kind==='player-damaged';
  const speed=(critical?72:incoming?48:42)+random()*(critical?105:incoming?65:55);
  out.push({x:p.x,y:p.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:0,maxLife:(critical?.34:.25)+random()*(critical?.28:.22),size:1.5+random()*(critical?3.2:2.4),spin:(random()-.5)*8,rotation:a,tone:incoming?(random()>.35?'#b96250':'#754238'):critical?(random()>.3?'#f4d58d':'#c2873c'):(random()>.35?'#bdefff':'#438cd8'),kind:critical&&random()>.72?'shard':'mote'});
 }
 return out;
}

export const BattleVfxCanvas=forwardRef<BattleVfxHandle,Props>(function BattleVfxCanvas({playerRef,monsterRef},ref){
 const canvasRef=useRef<HTMLCanvasElement|null>(null);
 const effectsRef=useRef<Effect[]>([]);
 const frameRef=useRef<number|null>(null);
 const lastRef=useRef(0);
 const seqRef=useRef(0);
 const reducedRef=useRef(false);
 const sizeRef=useRef({w:1,h:1,dpr:1});

 const pointFor=(actor:'player'|'monster'):Point=>{
  const canvas=canvasRef.current,el=actor==='player'?playerRef.current:monsterRef.current;
  if(!canvas||!el)return actor==='player'?{x:sizeRef.current.w*.28,y:sizeRef.current.h*.62}:{x:sizeRef.current.w*.72,y:sizeRef.current.h*.35};
  const c=canvas.getBoundingClientRect(),r=el.getBoundingClientRect();
  return{x:r.left-c.left+r.width/2,y:r.top-c.top+r.height*.48};
 };

 const ensureFrame=()=>{if(frameRef.current===null)frameRef.current=requestAnimationFrame(draw);};

 const push=(kind:BattleVfxKind,from:Point,to:Point,speed:number,seed:number)=>{
  const timing=battleVfxTiming(kind,speed),count=reducedRef.current?0:timing.particles;
  const effect:Effect={id:++seqRef.current,kind,startedAt:battleVfxNow(),duration:timing.duration,holdMs:timing.holdMs,shakePx:timing.shakePx,from,to,particles:particlesFor(kind,count,to,seed)};
  effectsRef.current=[...effectsRef.current,effect].slice(-10);
  lastRef.current=battleVfxNow();
  ensureFrame();
 };

 const drawParticle=(ctx:CanvasRenderingContext2D,p:Particle,dt:number,hold:boolean)=>{
  if(!hold){
   p.life+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rotation+=p.spin*dt;
   if(p.kind==='shard'||p.kind==='dust')p.vy+=72*dt;
   p.vx*=Math.pow(.985,dt*60);
  }
  if(p.life>=p.maxLife)return;
  const t=clamp(p.life/p.maxLife),alpha=1-t;
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation);ctx.globalAlpha=alpha;
  if(p.kind==='dust'){ctx.fillStyle=p.tone;ctx.globalAlpha=alpha*.22;ctx.beginPath();ctx.arc(0,0,p.size*(1+t),0,TAU);ctx.fill();}
  else if(p.kind==='shard'){ctx.fillStyle=p.tone;ctx.beginPath();ctx.moveTo(-p.size,p.size*.35);ctx.lineTo(p.size,-p.size*.55);ctx.lineTo(p.size*.3,p.size);ctx.closePath();ctx.fill();}
  else if(p.kind==='mote'){ctx.fillStyle=p.tone;ctx.fillRect(-p.size*.5,-p.size*.5,p.size,p.size);ctx.globalAlpha*=.45;ctx.beginPath();ctx.arc(0,0,p.size*2.4,0,TAU);ctx.fill();}
  else{ctx.fillStyle=p.tone;ctx.fillRect(-p.size*.5,-p.size*.5,p.size,p.size*1.7);}
  ctx.restore();
 };

 const draw=()=>{
  frameRef.current=null;
  const canvas=canvasRef.current;if(!canvas)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const {w,h,dpr}=sizeRef.current,now=battleVfxNow(),dt=Math.min(.034,Math.max(0,(now-lastRef.current)/1000));lastRef.current=now;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const survivors:Effect[]=[];

  for(const effect of effectsRef.current){
   const elapsed=now-effect.startedAt;
   if(elapsed>=effect.duration)continue;
   survivors.push(effect);
   const t=clamp(elapsed/effect.duration),hold=false,impactT=clamp((elapsed-effect.holdMs)/Math.max(1,effect.duration-effect.holdMs));
   const critical=effect.kind==='critical-hit',negative=effect.kind==='player-damaged'||effect.kind==='death';
   const shake=!reducedRef.current&&effect.shakePx>0&&elapsed<Math.min(effect.duration,critical?150:effect.kind==='death'?240:110);
   const shakeFade=shake?1-elapsed/Math.min(effect.duration,critical?150:effect.kind==='death'?240:110):0;
   const sx=shake?(Math.sin(elapsed*.41)+Math.sin(elapsed*.79))*.5*effect.shakePx*shakeFade:0;
   const sy=shake?Math.cos(elapsed*.53)*effect.shakePx*.55*shakeFade:0;
   ctx.save();ctx.translate(sx,sy);

   if(effect.kind==='player-basic-cue'||effect.kind==='player-skill-cue'){
    const cue=easeOutCubic(t),dx=effect.to.x-effect.from.x,dy=effect.to.y-effect.from.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
    ctx.globalAlpha=(1-t)*(effect.kind==='player-skill-cue'?.72:.48);
    ctx.strokeStyle=effect.kind==='player-skill-cue'?'#d5b66c':'#b8a57d';ctx.lineWidth=effect.kind==='player-skill-cue'?2:1;
    ctx.beginPath();
    ctx.moveTo(effect.from.x+dx*.18,effect.from.y+dy*.18);
    ctx.quadraticCurveTo(effect.from.x+dx*.48+nx*18*(1-cue),effect.from.y+dy*.48+ny*18*(1-cue),effect.from.x+dx*(.38+.38*cue),effect.from.y+dy*(.38+.38*cue));
    ctx.stroke();
    if(effect.kind==='player-skill-cue'){
     ctx.globalAlpha=(1-t)*.3;ctx.beginPath();ctx.arc(effect.from.x,effect.from.y,18+20*cue,0,TAU);ctx.stroke();
    }
    for(const particle of effect.particles)drawParticle(ctx,particle,dt,false);
    ctx.restore();continue;
   }

   if(effect.kind==='heal'){
    const glow=1-clamp((t-.55)/.45);
    ctx.globalAlpha=glow*.32;ctx.strokeStyle='#9fb97d';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(effect.to.x,effect.to.y,18+42*easeOutCubic(t),0,TAU);ctx.stroke();
    ctx.globalAlpha=glow*.22;ctx.fillStyle='#aecb872b';ctx.beginPath();ctx.arc(effect.to.x,effect.to.y,24+18*t,0,TAU);ctx.fill();
    for(const particle of effect.particles)drawParticle(ctx,particle,dt,false);
    ctx.restore();continue;
   }

   if(effect.kind==='guard'){
    const fade=1-clamp((t-.62)/.38),r=24+22*easeOutCubic(t);
    ctx.globalAlpha=fade*.86;ctx.strokeStyle='#a7c4c7';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(effect.to.x,effect.to.y,r,-Math.PI*.72,Math.PI*.72);ctx.stroke();
    ctx.globalAlpha=fade*.35;ctx.strokeStyle='#dfd1a3';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(effect.to.x,effect.to.y,r+7,-Math.PI*.62,Math.PI*.62);ctx.stroke();
    for(const particle of effect.particles)drawParticle(ctx,particle,dt,hold);
    ctx.restore();continue;
   }

   // Contact-centred burst: white ignition, coloured body, radial fragments.
   // Playback speed changes visual time, never the authoritative battle clock.
   const burst=battleImpactEnvelope(elapsed*(critical?600:negative?450:360)/effect.duration,critical);
   const cx=effect.to.x,cy=effect.to.y;
   if(reducedRef.current){
    ctx.globalAlpha=Math.min(.25,burst.core);ctx.fillStyle='#fff4df';
    ctx.fillRect(cx-8,cy-8,16,16);
   }else{
    ctx.save();ctx.globalCompositeOperation='lighter';
    const rgb=critical?'255,92,24':negative?'235,80,55':'72,169,255';
    const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,burst.radius);
    glow.addColorStop(0,'rgba(255,255,235,'+burst.core+')');
    glow.addColorStop(.2,'rgba('+rgb+','+burst.flame*.8+')');
    glow.addColorStop(.65,'rgba('+rgb+','+burst.flame*.3+')');
    glow.addColorStop(1,'rgba('+rgb+',0)');
    ctx.fillStyle=glow;ctx.fillRect(cx-burst.radius,cy-burst.radius,burst.radius*2,burst.radius*2);
    ctx.globalAlpha=burst.flame*.9;
    for(let i=0;i<(critical?12:8);i++){
     const angle=i*TAU/(critical?12:8)+effect.id*.31;
     const inner=burst.radius*.18,outer=burst.radius*(i%2?.85:1.2);
     ctx.fillStyle=critical?(i%2?'#ff4b24':'#ffb740'):'#89d9ff';
     ctx.beginPath();
     ctx.moveTo(cx+Math.cos(angle-.055)*inner,cy+Math.sin(angle-.055)*inner);
     ctx.lineTo(cx+Math.cos(angle)*outer,cy+Math.sin(angle)*outer);
     ctx.lineTo(cx+Math.cos(angle+.055)*inner,cy+Math.sin(angle+.055)*inner);
     ctx.closePath();ctx.fill();
    }
    ctx.globalAlpha=burst.core;ctx.fillStyle='#fffdeb';
    const coreSize=(critical?24:12)*(1+burst.core);
    ctx.fillRect(cx-coreSize/2,cy-coreSize/2,coreSize,coreSize);
    ctx.restore();
   }

   if(effect.kind==='player-damaged'){
    const edge=Math.max(0,.22-t*.34);
    if(edge>0){const vg=ctx.createRadialGradient(w*.5,h*.5,Math.min(w,h)*.18,w*.5,h*.5,Math.max(w,h)*.72);vg.addColorStop(.45,'rgba(92,34,29,0)');vg.addColorStop(1,'rgba(92,34,29,'+edge+')');ctx.fillStyle=vg;ctx.fillRect(0,0,w,h);}
   }

   if(effect.kind==='death'){
    const deathFade=1-clamp((t-.62)/.38);
    ctx.globalAlpha=deathFade*.65;ctx.strokeStyle='#8f463c';ctx.lineWidth=1.5;
    for(let i=0;i<7;i++){const a=i*TAU/7+.16,inner=10,outer=26+70*easeOutCubic(t);ctx.beginPath();ctx.moveTo(effect.to.x+Math.cos(a)*inner,effect.to.y+Math.sin(a)*inner);ctx.lineTo(effect.to.x+Math.cos(a)*outer,effect.to.y+Math.sin(a)*outer);ctx.stroke();}
   }

   for(const particle of effect.particles)drawParticle(ctx,particle,dt,hold);
   ctx.restore();
  }

  effectsRef.current=survivors;
  if(survivors.length)frameRef.current=requestAnimationFrame(draw);
 };

 const cuePlayerAction=(kind:'basic'|'skill',speed:number)=>{
  const from=pointFor('player'),to=pointFor('monster'),vfxKind=kind==='skill'?'player-skill-cue':'player-basic-cue';
  push(vfxKind,from,to,speed,Math.floor(battleVfxNow())+kind.length);
 };

 const playEvent=(event:CombatEvent,speed:number)=>{
  const from=pointFor(event.attacker),to=pointFor(event.target),seed=Math.floor(battleVfxNow())+event.id*37;
  if(event.absorbedByShield>0)push('guard',from,to,speed,seed+11);
  if(event.hpDamage>0){
   const kind:BattleVfxKind=event.target==='player'?'player-damaged':event.critical?'critical-hit':'basic-hit';
   push(kind,from,to,speed,seed+23);
  }
 };

 const playDamage=(target:'player'|'monster',critical:boolean,speed:number)=>{
  const attacker=target==='player'?'monster':'player',from=pointFor(attacker),to=pointFor(target);
  const kind:BattleVfxKind=target==='player'?'player-damaged':critical?'critical-hit':'basic-hit';
  push(kind,from,to,speed,Math.floor(battleVfxNow())+(target==='player'?151:173));
 };

 const playHeal=(speed:number)=>{const p=pointFor('player');push('heal',p,p,speed,Math.floor(battleVfxNow())+71);};
 const playDeath=(speed:number)=>{const from=pointFor('monster'),to=pointFor('player');push('death',from,to,speed,Math.floor(battleVfxNow())+101);};
 const cancel=()=>{effectsRef.current=[];const canvas=canvasRef.current;if(canvas){const ctx=canvas.getContext('2d');ctx?.clearRect(0,0,canvas.width,canvas.height);}if(frameRef.current!==null)cancelAnimationFrame(frameRef.current);frameRef.current=null;};

 useImperativeHandle(ref,()=>({cuePlayerAction,playEvent,playDamage,playHeal,playDeath,cancel}));

 useEffect(()=>{
  reducedRef.current=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const canvas=canvasRef.current;if(!canvas)return;
  const resize=()=>{const rect=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);sizeRef.current={w:Math.max(1,rect.width),h:Math.max(1,rect.height),dpr};canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));};
  resize();
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;observer?.observe(canvas);window.addEventListener('resize',resize);
  return()=>{observer?.disconnect();window.removeEventListener('resize',resize);cancel();};
 },[]);

 return <canvas ref={canvasRef} className="tc-battle-vfx-canvas" aria-hidden="true"/>;
});
