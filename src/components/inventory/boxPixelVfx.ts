/** Particle-only chest VFX. Deterministic trajectories never affect loot. */
export const BOX_PARTICLE_CELL=8;
export const BOX_PARTICLE_COUNT=16;
export const BOX_PARTICLE_COLORS=[0xe1c6a0,0xa3d979,0x70bdff,0xba8afa,0xffd76b] as const;
const counts=[[18,3,0,6],[22,4,0,8],[27,5,1,10],[32,6,1,12],[38,7,1,14]] as const;
type Kind='light'|'debris'|'spark'|'leak'|'ember';
export interface PixelMote {kind:Kind;tile:number;x:number;y:number;vx:number;vy:number;gravity:number;delay:number;life:number;size:number;tint:number;spin:number;}
export interface MotePose {x:number;y:number;alpha:number;size:number;rotation:number;}
const clamp=(n:number)=>Math.min(1,Math.max(0,n));
export function makeBoxMotes(rank:number):PixelMote[]{
 const level=Math.min(4,Math.max(0,Math.floor(rank))),tone=BOX_PARTICLE_COLORS[level],result:PixelMote[]=[];
 let seed=491+level*137;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const pick=(tiles:readonly number[])=>tiles[Math.floor(random()*tiles.length)];
 const add=(kind:Kind,n:number)=>{
  for(let i=0;i<n;i++){
   const m:PixelMote={kind,tile:pick([2,3,4,5,6,7]),x:-8+(random()-.5)*46,y:-12+(random()-.5)*9,
    vx:(random()-.5)*70,vy:-(110+random()*85+level*6),gravity:0,
    delay:i%3*.085+random()*.065,life:.36+random()*.20,
    size:1.55+random()*.9,tint:random()<.24?0xfff3d4:tone,spin:0};
   if(kind==='leak'){m.tile=pick([0,1,4]);m.x=-8+(random()-.5)*40;m.vx=(random()-.5)*10;m.vy=-18-random()*23;m.delay=random();m.life=.35+random()*.2;m.size=1.5;}
   if(kind==='debris'){m.tile=pick([8,9,10,11]);m.vx=(random()-.5)*90;m.vy=-70-random()*55;m.gravity=230;m.life=.31+random()*.15;m.size=1.8;m.tint=tone;m.spin=(random()<.5?-1:1)*2;}
   if(kind==='spark'){m.tile=pick([12,13]);m.vx=(random()-.5)*18;m.vy=-60-random()*20;m.delay=.27;m.life=.18;m.size=1.4;}
   if(kind==='ember'){m.tile=pick([0,1,14,15]);m.vx=(random()-.5)*24;m.vy=-40-random()*37;m.delay=.42+random()*.20;m.life=.28+random()*.22;m.size=1.35;}
   result.push(m);
  }
 };
 add('leak',3+level);
 add('light',counts[level][0]);add('debris',counts[level][1]);add('spark',counts[level][2]);add('ember',counts[level][3]);
 return result;
}
export function boxMotePose(m:PixelMote,seconds:number,charge:number,burst:number,pressure:number):MotePose|null{
 let t=0,alpha=1;
 if(m.kind==='leak'){
  if(seconds<charge||seconds>=burst)return null;
  t=((seconds-charge+m.delay*m.life)%m.life+m.life)%m.life;
  alpha=clamp(pressure)*Math.min(1,(burst-seconds)*8)*.65;
 }else{t=seconds-burst-.20-m.delay;}
 if(t<0||t>=m.life)return null;
 const f=t/m.life,fade=Math.min(1,f*12)*Math.pow(1-f,.65);
 const drag=m.kind==='debris'?t:(1-Math.exp(-2.2*t))/2.2;
 const rotation=m.spin?Math.round(m.spin*t/(Math.PI/2))*(Math.PI/2):0;
 return {x:Math.round(m.x+m.vx*drag),y:Math.round(m.y+m.vy*drag+.5*m.gravity*t*t),alpha:alpha*fade,
  size:Math.max(1,Math.round(m.size*(1-.25*f))),rotation};
}
