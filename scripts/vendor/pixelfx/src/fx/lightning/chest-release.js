// Chest choreography uses Patch pixelfx's lightning helpers, adapted from Sprite Fusion's lightning.
// MIT License, Copyright (c) 2026 Hugo Duprez. See NOTICE.md and LICENSE.
import {fit,rng} from '../../core/index.js';
import {zigzag,stroke,crackle} from './_lib.js';
const GOLD=['#241329','#643028','#aa531d','#e59825','#ffc84b','#ffe992','#fff6cb','#ffffff'];
export const meta={name:'Chest release',desc:'Current follows brass bindings. The seam ignites before six curled discharges break apart.',tags:['lightning','chest'],size:[192,192],origin:[96,140],duration:2,loop:false,fps:24,bg:'dark',options:{palette:GOLD,seed:31}};
// Coordinates measured against the existing 112x128 chest, at the runtime's 2x FX scale.
const BINDINGS=[[[ -24,-30],[-33,-19],[-38,-4],[-38,8]],[[17,-22],[8,-10],[7,8],[7,14]],[[-41,5],[-10,14],[27,20],[48,8],[50,-1]]];
// Two original channels x three distinct silhouettes, all rooted inside the mouth.
export const LIGHTNING_CHANNELS=[
 [[-14,2],[-43,-19],[-37,-40],[-61,-52],[-47,-58],[-22,-67]],
 [[14,2],[47,-16],[57,-35],[34,-48],[46,-58],[28,-78]],
 [[-9,0],[-27,-22],[-16,-38],[-31,-53],[-20,-69],[-36,-77]],
 [[9,0],[25,-18],[16,-34],[31,-49],[13,-65],[21,-79]],
 [[-3,-1],[-12,-19],[1,-33],[-11,-46],[-6,-59],[3,-73]],
 [[3,-1],[13,-15],[6,-29],[20,-44],[7,-57],[12,-67]]
];
export const CHARGE_CHANNELS=BINDINGS.length*3;
function seam(p,C,k){
 for(const [x,y] of [[-30,8],[-10,13],[10,17],[30,17]])p.glow(x,y,12,C[4],k*.2);
 p.polyline([[-40,5],[-10,14],[27,20],[48,8]],C[5],k);
 p.polyline([[-39,5],[-10,13],[27,19]],C[7],k*.8);
}
export function draw(p,t,o){
 if(t<=0||t>=2)return;
 const C=fit(o.palette,8),f=Math.floor(t*24);
 if(t<.8){
  const power=Math.min(1,t/.16)*(.2+.8*t/.8);
  Array.from({length:CHARGE_CHANNELS},(_,i)=>{
   const points=BINDINGS[Math.floor(i/3)];
   const r=rng(o.seed,10,i,Math.floor(f/2));
   const n=(i%3+Math.floor(t*3))%(points.length-1);
   const offset=(i%3-1)*1.2;
   const a=points[n].map((v,j)=>v+(j===0?offset:0)),b=points[n+1].map((v,j)=>v+(j===0?offset:0));
   crackle(p,zigzag(r,...a,...b,.07,.08),power,C,.12,.7);
  });
  seam(p,C,Math.max(0,(t-.45)/.35));
  return;
 }
 const age=t-.8,fade=Math.max(0,1-age/1.2);
 // Warm light is confined to the perspective opening, with four overlapping pools.
 const mouth=Math.min(1,age/.08)*Math.pow(fade,1.5);
 for(let y=-15;y<15;y++)for(let x=-37;x<49;x++){
  const u=(x+37)/86,v=(y+15)/30;
  const d=Math.abs(u-.5)*1.4+Math.abs(v-.5)*1.6;
  if(d<.65)p.blend(x,y,C[5],mouth*(.65-d)*.95);
 }
 for(let i=0;i<4;i++)p.glow(-22+i*17,-1+i*2,17,C[5],mouth*.95);
 seam(p,C,fade*.6);
 // Energy rises in six bowed channels; the silhouette stays coherent across re-strikes.
 const a=age-.21;
 if(a>=0&&a<.46){
  const power=Math.min(1,(a+.025)/.07)*Math.min(1,(.46-a)/.15);
  for(let channel=0;channel<LIGHTNING_CHANNELS.length;channel++){
   const r=rng(o.seed,30,channel,Math.floor(a*16));
   const path=LIGHTNING_CHANNELS[channel];
   const paths=[];
   for(let j=0;j<path.length-1;j++){
    const b=zigzag(r,...path[j],...path[j+1],.25,a<.15?0:.45);
    if(j===0)paths.push(...b.paths);else {paths[0].pts.push(...b.paths[0].pts.slice(1));paths.push(...b.paths.slice(1));}
   }
   stroke(p,{paths},power,C,.9,{light:.22,a:Math.min(1,power*2),upTo:Math.min(1,(a+.025)/.13),hero:a<.07});
  }
 }
 // A few substantial sparks escape and cool, rather than a cloud of confetti.
 for(let i=0;i<16;i++){
  const q=rng(o.seed,42,i),delay=q.range(.11,.26),a=age-delay,life=q.range(.25,.65);
  if(a<0||a>life)continue;
  const vx=q.range(-65,65),vy=q.range(-120,-50),x=q.range(-24,24)+vx*a,y=vy*a+75*a*a;
  const k=1-a/life;
  p.line(x,y,x-vx*.022,y-(vy+150*a)*.022,C[5],k);
  if(i%4===0)p.rect(x-1,y-1,2,2,C[6],k);else p.dot(x,y,C[7],k);
  p.glow(x,y,5,C[4],k*.2);
 }
}
