export interface DemoMarketLevel{
 price:number;
 quantity:number;
}
export interface DemoMarketView{
 asks:DemoMarketLevel[];
 bids:DemoMarketLevel[];
 series:number[];
 last:number;
 delta:number;
}

function hashText(text:string){
 let hash=2166136261;
 for(let i=0;i<text.length;i++){
  hash^=text.charCodeAt(i);
  hash=Math.imul(hash,16777619);
 }
 return hash>>>0;
}

function clampPrice(value:number){
 return Math.max(1,Math.round(value));
}

function quantityWave(seed:number,tick:number,level:number,side:number){
 const a=Math.sin((tick+seed*0.013+level*1.71+side*.77)*.91);
 const b=Math.cos((tick*.43+seed*0.007+level*.63+side*1.33));
 return 3+Math.abs(Math.round(a*18+b*11));
}

export function demoMarketView(itemId:string,anchor:number|null,tick:number):DemoMarketView{
 const seed=hashText(itemId);
 const fallback=80+(seed%1420);
 const base=Math.max(1,anchor??fallback);
 const phase=(seed%97)/13;
 const move=Math.sin((tick+phase)*.62)*.014+Math.cos((tick*.37+phase)*.91)*.006;
 const mid=clampPrice(base*(1+move));
 const step=Math.max(1,Math.round(mid*.0065));
 const asks=Array.from({length:4},(_,index)=>({
  price:mid+step*(index+1),
  quantity:quantityWave(seed,tick,index,1),
 }));
 const bids=Array.from({length:4},(_,index)=>({
  price:Math.max(1,mid-step*(index+1)),
  quantity:quantityWave(seed,tick,index,2),
 }));
 const series=Array.from({length:24},(_,index)=>{
  const t=tick-(23-index);
  const wave=Math.sin((t+phase)*.54)*.017+Math.cos((t*.31+phase)*.77)*.009;
  return clampPrice(base*(1+wave));
 });
 const first=series[0]||mid;
 const last=series.at(-1)??mid;
 return {asks,bids,series,last,delta:first?((last-first)/first)*100:0};
}
