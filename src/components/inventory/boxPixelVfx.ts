/** Cosmetic pixel VFX; no gameplay randomness. */
export const BOX_PARTICLE_CELL=8;
export const BOX_PARTICLE_COUNT=16;
export const BOX_PARTICLE_COLORS=[0xe1c6a0,0xa3d979,0x70bdff,0xba8afa,0xffd76b] as const;
const counts=[[6,2,0],[8,2,0],[10,3,0],[12,3,0],[14,4,0]] as const;
type Kind='light'|'debris'|'spark'|'leak'|'dust'|'ember';
export interface PixelMote {kind:Kind;tile:number;x:number;y:number;vx:number;vy:number;gravity:number;delay:number;life:number;size:number;tint:number;spin:number;}
export interface MotePose {x:number;y:number;alpha:number;size:number;rotation:number;}
const clamp=(n:number)=>Math.min(1,Math.max(0,n));
export function makeBoxMotes(rank:number):PixelMote[]{
 const level=Math.min(4,Math.max(0,Math.floor(rank))),tone=BOX_PARTICLE_COLORS[level],result:PixelMote[]=[];
 let seed=991+level*137;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const add=(kind:Kind,n:number)=>{
  for(let i=0;i<n;i++){
   const start=random();
   const debris=kind==='debris'||kind==='dust';
   const tile=debris?6+Math.floor(random()*6):kind==='spark'?12+Math.floor(random()*4):Math.floor(random()*6);
   const tint=debris?0xffffff:random()<.23?0xfff3c0:tone;
   const m:PixelMote={kind,tile,x:-8+(random()-.5)*20,y:-16+(random()-.5)*8,
    vx:(random()-.5)*(debris?48:25),vy:-(debris?65+random()*40:135+random()*65),gravity:kind==='debris'?220:0,
    delay:start*.26,life:kind==='debris'?.28+random()*.16:.38+random()*.22,
    size:debris?1.1:.85+random()*.45,tint,spin:kind==='debris'?(random()<.5?-1:1)*2:0};
   if(kind==='leak'){m.x=-8+(random()-.5)*25;m.vx=(random()-.5)*8;m.vy=-16-random()*22;m.gravity=0;m.life=.35+random()*.23;m.delay=start;m.size=.85;}
   if(kind==='dust'){m.x=(random()-.5)*68;m.y=78;m.vx=(random()-.5)*16;m.vy=-8-random()*12;m.gravity=75;m.delay=start*.07;m.life=.18+random()*.13;m.size=.85;m.tint=0xa99577;m.spin=0;}
   if(kind==='ember'){m.vx=(random()-.5)*14;m.vy=-55-random()*40;m.gravity=0;m.delay=.38+random()*.20;m.life=.34+random()*.23;m.size=.75;}
   result.push(m);
  }
 };
 add('dust',4);add('leak',3+level);
 add('light',counts[level][0]);add('debris',counts[level][1]);add('spark',counts[level][2]);add('ember',3+level);
 return result;
}
export function boxMotePose(m:PixelMote,seconds:number,charge:number,burst:number,pressure:number):MotePose|null{
 let t=0,alpha=1;
 if(m.kind==='dust'){t=seconds-.38-m.delay;}
 else if(m.kind==='leak'){
  if(seconds<charge||seconds>=burst)return null;
  t=((seconds-charge+m.delay*m.life)%m.life+m.life)%m.life;
  alpha=clamp(pressure)*Math.min(1,(burst-seconds)*8);
 }else{t=seconds-burst-.22-m.delay;}
 if(t<0||t>=m.life)return null;
 const f=t/m.life,fade=Math.min(1,f*9)*Math.pow(1-f,.8);
 const rotation=m.spin?Math.round(m.spin*t/(Math.PI/2))*(Math.PI/2):0;
 return {x:m.x+m.vx*t,y:m.y+m.vy*t+.5*m.gravity*t*t,alpha:alpha*fade,
  size:m.size*(m.kind==='spark'?.6+.5*Math.sin(f*Math.PI):1),rotation};
}

/** Central plume is the primary effect, not an outward particle explosion. */
export const PLUME_WIDTH=32;
export const PLUME_HEIGHT=64;
export const PLUME_FRAMES=16;
export const PLUME_START=.20;
export const PLUME_DURATION=.92;
export function boxPlumePose(elapsed:number,rank:number){
 const t=elapsed-PLUME_START;
 if(t<0||t>=PLUME_DURATION)return null;
 const f=t/PLUME_DURATION,frame=Math.min(PLUME_FRAMES-1,Math.floor(f*PLUME_FRAMES));
 const tail=1-clamp((f-.67)/.33);
 return {frame,alpha:Math.min(1,t/.07)*tail,scaleX:1.65+rank*.12,scaleY:1.85+rank*.13};
}
