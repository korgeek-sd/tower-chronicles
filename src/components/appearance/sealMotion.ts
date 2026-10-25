/** Fixed presentation geometry. No gameplay RNG, state, timers or network access. */
const seeds=[[192,91],[148,147],[233,145],[192,185],[151,238],[230,236],[191,302]] as const;
function region(index:number){
 let polygon:number[][]=[[0,0],[384,0],[384,384],[0,384]];
 const [sx,sy]=seeds[index];
 for(const [j,[ox,oy]] of seeds.entries()){
  if(j===index)continue;
  const a=2*(ox-sx),b=2*(oy-sy),c=ox*ox+oy*oy-sx*sx-sy*sy;
  const next:number[][]=[];
  for(let k=0;k<polygon.length;k++){
   const start=polygon[k],end=polygon[(k+1)%polygon.length],d0=a*start[0]+b*start[1]-c,d1=a*end[0]+b*end[1]-c;
   if(d0<=0)next.push(start);
   if((d0<0&&d1>0)||(d0>0&&d1<0)){const t=d0/(d0-d1);next.push([start[0]+t*(end[0]-start[0]),start[1]+t*(end[1]-start[1])]);}
  }
  polygon=next;
 }
 return 'polygon('+polygon.map(([x,y])=>(x/3.84).toFixed(3)+'% '+(y/3.84).toFixed(3)+'%').join(',')+')';
}
const travel=[[-10,-27,-33],[-27,-12,-57],[29,-13,62],[-7,10,31],[-26,24,-75],[27,25,84],[6,34,-42]] as const;
export const SEAL_FRAGMENTS=seeds.map(([x,y],i)=>({clip:region(i),origin:(x/3.84)+'% '+(y/3.84)+'%',dx:travel[i][0]+'%',dy:travel[i][1]+'%',rotation:travel[i][2]+'deg'}));
export const SEAL_MOTES=Array.from({length:24},(_,i)=>{
 const angle=i*Math.PI*2/24,radius=26+(i%3)*5;
 return {x:(Math.cos(angle)*radius)+'%',y:(Math.sin(angle)*radius)+'%',qx:(Math.cos(angle+.85)*radius*.75)+'%',qy:(Math.sin(angle+.85)*radius*.75)+'%',dx:(Math.cos(angle)*radius*1.5)+'%',dy:(Math.sin(angle)*radius*1.5)+'%',size:2+i%3};
});
