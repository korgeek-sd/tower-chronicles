/** Presentation-only deterministic paths, in chest-local coordinates. */
export type BoxBolt={points:[number,number][];width:number;alpha:number;front:boolean};
const snap=(n:number)=>Math.round(n/4)*4||0;
function path(a:[number,number],b:[number,number],seed:number):[number,number][]{
 const points:[number,number][]=[a];
 for(let i=1;i<9;i++){
  const t=i/9,offset=Math.sin(seed*2.7+i*4.3)*14*Math.sin(t*Math.PI);
  points.push([snap(a[0]+(b[0]-a[0])*t+offset),snap(a[1]+(b[1]-a[1])*t)]);
 }
 points.push(b);return points;
}
export function boxLightning(seconds:number,charge:number,hold:number,burst:number):BoxBolt[]{
 if(seconds<charge||seconds>=burst+1.35||seconds>=hold&&seconds<burst)return [];
 const frame=Math.floor(seconds*12),opened=seconds>=burst,age=seconds-burst;
 if(opened&&age<.16)return []; // Wait for the lid to release before discharging.
 const strength=opened?Math.max(0,1-(age-.16)/1.19):Math.min(1,(seconds-charge)/(hold-charge));
 const targets:[number,number][]=opened?[[-160,-80],[12,-172],[160,-116]]:[[-100,-44],[48,-88],[96,44]];
 return targets.flatMap((target,i)=>{
  if(opened&&age>.75&&(frame+i)%3===0)return [];
  const start:[number,number]=opened?[i*24-24,-16]:[0,24];
  const points=path(start,target,frame+i*7);
  const bolt:BoxBolt={points,width:opened?6:3,alpha:(opened?1:.35+.6*strength)*strength,front:!opened||i===1};
  const branchStart=points[5];
  return [bolt,{points:path(branchStart,[snap(target[0]*.7),snap(target[1]+28)],frame+i+19),width:2,alpha:bolt.alpha*.65,front:bolt.front}];
 });
}
