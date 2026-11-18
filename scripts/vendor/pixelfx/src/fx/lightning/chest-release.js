// Chest choreography uses Patch pixelfx's lightning helpers, adapted from Sprite Fusion's lightning.
// MIT License, Copyright (c) 2026 Hugo Duprez. See NOTICE.md and LICENSE.
import {fit,rng,hex} from '../../core/index.js';
import {zigzag,bowed,stroke,crackle} from './_lib.js';
const GOLD=['#241329','#643028','#aa531d','#e59825','#ffc84b','#ffe992','#fff6cb','#ffffff'];
export const meta={name:'Chest release',desc:'Metal-bound charge, branching upward discharge, falling sparks. No rewards or rings.',tags:['lightning','chest'],size:[192,192],origin:[96,140],duration:2,loop:false,fps:24,bg:'dark',options:{palette:GOLD,seed:31}};
export function draw(p,t,o){
 if(t<=0||t>=2)return;
 const C=fit(o.palette,8),f=Math.floor(t*24),R=rng(o.seed,12,Math.floor(f/2));
 if(t<.8){
  const power=Math.min(1,t/.15)*(.25+.75*t/.8);
  for(let i=0;i<2+Math.floor(power*3);i++){
   const side=i%2?1:-1,x=side*R.range(35,51),y=R.range(-38,6);
   crackle(p,zigzag(R,x,y,x+R.range(-9,9),y-R.range(10,24),.25,.2),power,C,.18);
  }
  p.glow(0,0,29,C[4],.15*power);
  return;
 }
 const a=t-.8,k=Math.max(0,1-a/1.2);
 // Branches grow upward out of the chest mouth; re-strike rather than rotate as a sticker.
 if(a<.65){
  const power=Math.min(1,a/.07)*Math.max(0,1-a/.75);
  for(let i=0;i<3;i++){
   const q=rng(o.seed,30,i,Math.floor(a*12)),x0=(i-1)*20;
   const x1=(i-1)*38+q.range(-10,10),y1=-q.range(65,110);
   stroke(p,zigzag(q,x0,0,x1,y1,.24,.65),power,C,.8,{light:.24,a:Math.min(1,power*2),upTo:Math.min(1,a/.12),hero:a<.1});
  }
 }
 // The opening breath: narrow hot core with soft spill, no solid gold polygon.
 p.glow(0,-3,40,C[4],k*k*.8);
 for(let i=0;i<26;i++){
  const q=rng(o.seed,42,i),delay=q.range(0,.22),age=a-delay,life=q.range(.35,.9);
  if(age<0||age>life)continue;
  const vx=q.range(-70,70),vy=q.range(-150,-55),x=q.range(-24,24)+vx*age,y=vy*age+65*age*age;
  const fade=1-age/life;
  p.line(x,y,x-vx*.025,y-(vy+130*age)*.025,C[5],fade);
  p.px(x,y,C[7]);if(i%5===0)p.rect(x-1,y-1,2,2,C[6],fade);p.glow(x,y,5,C[4],fade*.22);
 }
 if(a>.25&&a<.95){
  const q=rng(o.seed,60,Math.floor(a*15));
  crackle(p,bowed(q,-35,-1,35,0,-q.range(12,30),.18,.2),k*.7,C,.15,k*k);
 }
}
