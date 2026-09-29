import React,{forwardRef,useEffect,useImperativeHandle,useRef} from 'react';
import type {EnhancementFeelOutcome} from '../../gameFeel/types';
import {
 ENHANCEMENT_ATTEMPT_MIN_MS,
 ENHANCEMENT_VFX_SPECS,
 enhancementNow,
 enhancementVfxProgress,
} from './enhancementVfxTimeline';

type ParticleKind='spark'|'ember'|'shard'|'smoke';
type Particle={kind:ParticleKind;x:number;y:number;vx:number;vy:number;life:number;maxLife:number;size:number;rotation:number;spin:number;tone:string};
type Scene=
 |{kind:'idle'}
 |{kind:'attempt';startedAt:number;seed:number}
 |{kind:'result';outcome:EnhancementFeelOutcome;startedAt:number;current:number;target:number;particles:Particle[]};

export type EnhancementVfxHandle={
 playAttempt:()=>number;
 playResult:(outcome:EnhancementFeelOutcome,current:number,target:number)=>void;
 cancel:()=>void;
};

type Props={anchorRef:React.RefObject<HTMLElement|null>};
const TAU=Math.PI*2;
const clamp=(n:number,a=0,b=1)=>Math.min(b,Math.max(a,n));
const easeOutCubic=(t:number)=>1-Math.pow(1-clamp(t),3);
const easeOutBack=(t:number)=>{const x=clamp(t),c=1.70158;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2);};

function mulberry(seed:number){
 let a=seed|0;
 return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
}

function makeParticles(outcome:EnhancementFeelOutcome,count:number,cx:number,cy:number,seed:number):Particle[]{
 const rnd=mulberry(seed),particles:Particle[]=[];
 for(let i=0;i<count;i++){
  const angle=rnd()*TAU;
  if(outcome==='SUCCESS'){
   const speed=58+rnd()*92;
   particles.push({kind:'spark',x:cx,y:cy,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:0,maxLife:.42+rnd()*.28,size:1.2+rnd()*2.1,rotation:angle,spin:(rnd()-.5)*8,tone:rnd()>.34?'#e7c778':'#9d6d36'});
  }else if(outcome==='FAIL_KEEP'){
   const speed=18+rnd()*35;
   particles.push({kind:'smoke',x:cx+(rnd()-.5)*8,y:cy+(rnd()-.5)*6,vx:Math.cos(angle)*speed*.4,vy:-10-rnd()*18,life:0,maxLife:.3+rnd()*.18,size:2+rnd()*3,rotation:0,spin:0,tone:'#9b8d74'});
  }else if(outcome==='FAIL_DOWNGRADE'){
   const speed=35+rnd()*50;
   particles.push({kind:rnd()>.25?'ember':'smoke',x:cx+(rnd()-.5)*10,y:cy,vx:Math.cos(angle)*speed*.55,vy:26+rnd()*58,life:0,maxLife:.36+rnd()*.24,size:1.5+rnd()*2.5,rotation:angle,spin:(rnd()-.5)*6,tone:rnd()>.35?'#a9533d':'#6e4434'});
  }else{
   const shard=rnd()>.28,speed=72+rnd()*120;
   particles.push({kind:shard?'shard':'smoke',x:cx+(rnd()-.5)*6,y:cy+(rnd()-.5)*6,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-(shard?20:0),life:0,maxLife:shard?.48+rnd()*.32:.55+rnd()*.35,size:shard?2+rnd()*4:4+rnd()*7,rotation:angle,spin:(rnd()-.5)*12,tone:shard?(rnd()>.45?'#c46a4e':'#624034'):'#5e5044'});
  }
 }
 return particles;
}

export const EnhancementVfxCanvas=forwardRef<EnhancementVfxHandle,Props>(function EnhancementVfxCanvas({anchorRef},ref){
 const canvasRef=useRef<HTMLCanvasElement|null>(null);
 const sceneRef=useRef<Scene>({kind:'idle'});
 const frameRef=useRef<number|null>(null);
 const lastRef=useRef(0);
 const reducedRef=useRef(false);
 const sizeRef=useRef({w:1,h:1,dpr:1});

 const anchor=()=>{
  const canvas=canvasRef.current,el=anchorRef.current;
  if(!canvas||!el)return{x:sizeRef.current.w*.5,y:sizeRef.current.h*.28};
  const a=el.getBoundingClientRect(),c=canvas.getBoundingClientRect();
  return{x:a.left-c.left+a.width/2,y:a.top-c.top+a.height/2};
 };

 const draw=()=>{
  frameRef.current=null;
  const canvas=canvasRef.current;
  if(!canvas)return;
  const {w,h,dpr}=sizeRef.current,ctx=canvas.getContext('2d');
  if(!ctx)return;
  const now=enhancementNow(),dt=Math.min(.034,Math.max(0,(now-lastRef.current)/1000));lastRef.current=now;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);
  const scene=sceneRef.current;
  if(scene.kind==='idle')return;
  const p=anchor();

  if(scene.kind==='attempt'){
   const elapsed=now-scene.startedAt,charge=clamp(elapsed/ENHANCEMENT_ATTEMPT_MIN_MS),pulse=(Math.sin(elapsed*.025)+1)*.5;
   const radius=32-13*easeOutCubic(charge)+pulse*1.5;
   ctx.save();ctx.translate(p.x,p.y);
   ctx.strokeStyle='rgba(211,163,84,'+(0.24+charge*.42)+')';ctx.lineWidth=1;
   ctx.beginPath();ctx.arc(0,0,radius,0,TAU);ctx.stroke();
   ctx.rotate(elapsed*.0024);
   for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(radius+2,0);ctx.lineTo(radius+8,0);ctx.stroke();}
   const rnd=mulberry(scene.seed),motes=reducedRef.current?4:12;
   for(let i=0;i<motes;i++){
    const a=(i/motes)*TAU+rnd()*.2,from=56+rnd()*22,to=10+rnd()*5,r=from+(to-from)*easeOutCubic(charge);
    ctx.globalAlpha=.25+.7*charge;ctx.fillStyle=i%3===0?'#f0cc7c':'#a56b35';ctx.fillRect(Math.cos(a)*r-1,Math.sin(a)*r-1,2,2);
   }
   ctx.globalAlpha=.16+.2*pulse;ctx.fillStyle='#f0be63';ctx.beginPath();ctx.arc(0,0,9+3*pulse,0,TAU);ctx.fill();ctx.restore();
   frameRef.current=requestAnimationFrame(draw);return;
  }

  const spec=ENHANCEMENT_VFX_SPECS[scene.outcome],elapsed=now-scene.startedAt;
  if(elapsed>=spec.duration){sceneRef.current={kind:'idle'};return;}
  const progress=enhancementVfxProgress(scene.outcome,elapsed),hold=elapsed<spec.holdMs;
  const shakeActive=!reducedRef.current&&elapsed<spec.shakeMs,shakeFall=shakeActive?1-elapsed/spec.shakeMs:0;
  const sx=shakeActive?(Math.sin(elapsed*.31)+Math.sin(elapsed*.73))*.5*spec.shakePx*shakeFall:0;
  const sy=shakeActive?Math.cos(elapsed*.47)*spec.shakePx*.55*shakeFall:0;
  ctx.save();ctx.translate(sx,sy);

  const flashAlpha=hold?1-elapsed/spec.holdMs:Math.max(0,.35-progress*1.8);
  if(flashAlpha>0){
   const radius=30+easeOutCubic(progress)*52,gradient=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,radius);
   const core=scene.outcome==='SUCCESS'?'244,208,126':scene.outcome==='FAIL_KEEP'?'180,167,140':scene.outcome==='FAIL_DOWNGRADE'?'173,84,58':'230,119,78';
   gradient.addColorStop(0,'rgba('+core+','+(flashAlpha*.72)+')');gradient.addColorStop(.28,'rgba('+core+','+(flashAlpha*.28)+')');gradient.addColorStop(1,'rgba('+core+',0)');
   ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
  }

  if(scene.outcome==='SUCCESS'){
   for(let r=0;r<spec.rings;r++){const t=clamp(progress*1.25-r*.08),rr=18+72*easeOutCubic(t);ctx.globalAlpha=(1-t)*(.8-r*.18);ctx.strokeStyle=r?'#9d743c':'#e3bd6c';ctx.lineWidth=r?1:1.5;ctx.beginPath();ctx.arc(p.x,p.y,rr,0,TAU);ctx.stroke();}
   ctx.globalAlpha=1-clamp((progress-.48)/.52);ctx.strokeStyle='#d7a957';ctx.lineWidth=1;
   for(let i=0;i<8;i++){const a=i*TAU/8,inner=15+progress*24,outer=28+progress*58;ctx.beginPath();ctx.moveTo(p.x+Math.cos(a)*inner,p.y+Math.sin(a)*inner);ctx.lineTo(p.x+Math.cos(a)*outer,p.y+Math.sin(a)*outer);ctx.stroke();}
  }else if(scene.outcome==='FAIL_KEEP'){
   ctx.globalAlpha=(1-progress)*.55;ctx.strokeStyle='#91846d';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,18+28*easeOutCubic(progress),0,TAU);ctx.stroke();
  }else if(scene.outcome==='FAIL_DOWNGRADE'){
   ctx.globalAlpha=(1-progress)*.7;ctx.strokeStyle='#9f543f';ctx.lineWidth=1.4;const y=p.y+8+progress*30;
   ctx.beginPath();ctx.moveTo(p.x,y-18);ctx.lineTo(p.x,y);ctx.lineTo(p.x-5,y-6);ctx.moveTo(p.x,y);ctx.lineTo(p.x+5,y-6);ctx.stroke();
  }else{
   ctx.globalAlpha=(1-progress)*.85;ctx.strokeStyle='#a85242';ctx.lineWidth=1.2;const crack=18+progress*25;
   for(let i=0;i<6;i++){const a=i*TAU/6+.18;ctx.beginPath();ctx.moveTo(p.x+Math.cos(a)*4,p.y+Math.sin(a)*4);ctx.lineTo(p.x+Math.cos(a)*crack,p.y+Math.sin(a)*crack);ctx.lineTo(p.x+Math.cos(a+.13)*(crack+7),p.y+Math.sin(a+.13)*(crack+7));ctx.stroke();}
  }

  if(!hold&&!reducedRef.current){
   for(const particle of scene.particles){
    if(particle.life>=particle.maxLife)continue;
    particle.life+=dt;particle.x+=particle.vx*dt;particle.y+=particle.vy*dt;particle.rotation+=particle.spin*dt;
    if(particle.kind==='ember'||particle.kind==='shard')particle.vy+=95*dt;
    particle.vx*=Math.pow(.985,dt*60);
    const q=clamp(particle.life/particle.maxLife),alpha=1-q;
    ctx.save();ctx.translate(particle.x,particle.y);ctx.rotate(particle.rotation);ctx.globalAlpha=alpha;
    if(particle.kind==='smoke'){ctx.fillStyle=particle.tone;ctx.globalAlpha=alpha*.25;ctx.beginPath();ctx.arc(0,0,particle.size*(1+q*1.6),0,TAU);ctx.fill();}
    else if(particle.kind==='shard'){ctx.fillStyle=particle.tone;ctx.beginPath();ctx.moveTo(-particle.size,particle.size*.4);ctx.lineTo(particle.size,-particle.size*.6);ctx.lineTo(particle.size*.35,particle.size);ctx.closePath();ctx.fill();}
    else{ctx.fillStyle=particle.tone;ctx.fillRect(-particle.size*.5,-particle.size*.5,particle.size,particle.kind==='spark'?particle.size*2:particle.size);}
    ctx.restore();
   }
  }

  const labelStart=hold?0:clamp((elapsed-spec.holdMs)/110),labelFade=clamp((spec.duration-elapsed)/180);
  if(labelStart>0){
   const scale=.82+.18*easeOutBack(labelStart);
   ctx.save();ctx.translate(p.x,p.y+54);ctx.scale(scale,scale);ctx.globalAlpha=Math.min(labelStart,labelFade);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 12px Georgia, serif';
   const label=scene.outcome==='SUCCESS'?('+'+scene.target+' 강화 성공'):scene.outcome==='FAIL_KEEP'?('+'+scene.current+' 유지'):scene.outcome==='FAIL_DOWNGRADE'?('+'+scene.target+' 단계 하락'):'장비 파괴';
   ctx.fillStyle=scene.outcome==='SUCCESS'?'#f0cf88':scene.outcome==='FAIL_KEEP'?'#b7ab95':scene.outcome==='FAIL_DOWNGRADE'?'#c98976':'#e29a82';ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=4;ctx.fillText(label,0,0);ctx.restore();
  }

  ctx.restore();frameRef.current=requestAnimationFrame(draw);
 };

 const ensureFrame=()=>{if(frameRef.current===null)frameRef.current=requestAnimationFrame(draw);};
 const playAttempt=()=>{const startedAt=enhancementNow();sceneRef.current={kind:'attempt',startedAt,seed:Math.floor(startedAt)%2147483647};lastRef.current=startedAt;ensureFrame();return startedAt;};
 const playResult=(outcome:EnhancementFeelOutcome,current:number,target:number)=>{const startedAt=enhancementNow(),p=anchor(),spec=ENHANCEMENT_VFX_SPECS[outcome];sceneRef.current={kind:'result',outcome,startedAt,current,target,particles:reducedRef.current?[]:makeParticles(outcome,spec.particles,p.x,p.y,Math.floor(startedAt))};lastRef.current=startedAt;ensureFrame();};
 const cancel=()=>{sceneRef.current={kind:'idle'};const canvas=canvasRef.current;if(canvas){const ctx=canvas.getContext('2d');ctx?.clearRect(0,0,canvas.width,canvas.height);}};

 useImperativeHandle(ref,()=>({playAttempt,playResult,cancel}));

 useEffect(()=>{
  reducedRef.current=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const canvas=canvasRef.current;if(!canvas)return;
  const resize=()=>{const rect=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);sizeRef.current={w:Math.max(1,rect.width),h:Math.max(1,rect.height),dpr};canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));};
  resize();
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;observer?.observe(canvas);window.addEventListener('resize',resize);
  return()=>{observer?.disconnect();window.removeEventListener('resize',resize);if(frameRef.current!==null)cancelAnimationFrame(frameRef.current);frameRef.current=null;};
 },[]);

 return <canvas ref={canvasRef} className="tc-forge-vfx-canvas" aria-hidden="true"/>;
});
