/** Cosmetic pixel VFX; no gameplay randomness. */
export const BOX_PARTICLE_CELL=8;
export const BOX_PARTICLE_COUNT=16;
export const BOX_PARTICLE_COLORS=[0xe1c6a0,0xa3d979,0x70bdff,0xba8afa,0xffd76b] as const;
const counts=[[16,5,2],[20,6,3],[26,8,4],[32,9,5],[42,12,7]] as const;
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
   const start=random(),spread=random(),direction=(spread<.5?(random()-.5)*.58:spread<.9?(random()<.5?-1:1)*(.48+random()*.52):(random()<.5?-1:1)*(1.15+random()*.25));
   const speed=kind==='debris'?80+random()*120:kind==='spark'?55+random()*95:115+random()*165;
   const light=kind==='light'||kind==='ember'||kind==='leak',debris=kind==='debris'||kind==='dust';
   const tile=debris?6+Math.floor(random()*6):kind==='spark'?12+Math.floor(random()*4):Math.floor(random()*6);
   const tint=debris?0xffffff:random()<.42?0xfff3c0:random()<.45?0xf4d77a:tone;
   const m:PixelMote={kind,tile,x:-12+(random()-.5)*66,y:-20+(random()-.5)*13,
    vx:Math.sin(direction)*speed,vy:-Math.cos(direction)*speed,gravity:kind==='debris'?360:70,
    delay:start*.14,life:kind==='debris'?.48+random()*.29:kind==='spark'?.18+random()*.16:.29+random()*.26,
    size:kind==='spark'?1.55:light?1.35+random()*.65:1.65,tint,spin:kind==='debris'?(random()<.5?-1:1)*4:0};
   if(kind==='leak'){m.x=-8+(random()-.5)*95;m.vx=(random()-.5)*15;m.vy=-18-random()*32;m.gravity=0;m.life=.45+random()*.35;m.delay=start;m.size=1.3;}
   if(kind==='dust'){m.x=(random()-.5)*120;m.y=78;m.vx=m.x*.65;m.vy=-12-random()*30;m.gravity=105;m.delay=start*.07;m.life=.3+random()*.22;m.size=1.1;m.tint=0xa99577;m.spin=0;}
   if(kind==='ember'){m.vx*=.35;m.vy=-35-random()*55;m.gravity=8;m.delay=.38+random()*.28;m.life=.45+random()*.38;m.size=1.2;}
   result.push(m);
  }
 };
 add('dust',10);add('leak',6+level*2);
 add('light',counts[level][0]);add('debris',counts[level][1]);add('spark',counts[level][2]);add('ember',5+level*2);
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
