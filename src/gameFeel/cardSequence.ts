/** Presentation timeline for already-confirmed rewards. Never rolls or mutates rewards. */
export type CardPhase='charge'|'flip'|'impact'|'return'|'finish';
export type CardMoment={at:number;index:number;phase:CardPhase};
const ranks:Record<string,number>={common:0,uncommon:1,rare:2,heroic:3,legendary:4};
export function cardTimeline(grades:readonly string[],indices:readonly number[],reduced:boolean):CardMoment[]{
 const order=[...indices].sort((a,b)=>(ranks[grades[a]]??0)-(ranks[grades[b]]??0));
 let cursor=0,priorEnd=0,legendCount=0;const events:CardMoment[]=[];
 for(const index of order){
  const grade=grades[index],special=grade==='legendary'||grade==='heroic';
  if(special)cursor=Math.max(cursor,priorEnd);
  const charge=grade==='legendary'?(legendCount===0?700:480):grade==='heroic'?450:grade==='rare'?260:140;
  const hold=grade==='legendary'?(legendCount++===0?800:400):grade==='heroic'?300:100;
  const impact=cursor+charge+350,end=impact+hold+(grade==='legendary'?300:0);
  events.push({at:cursor,index,phase:'charge'},{at:cursor+charge,index,phase:'flip'},{at:impact,index,phase:'impact'},{at:end,index,phase:'finish'});
  if(grade==='legendary')events.push({at:impact+hold,index,phase:'return'});
  priorEnd=Math.max(priorEnd,end);cursor=special?end+80:cursor+190;
 }
 return events.map(e=>({...e,at:reduced?0:e.at})).sort((a,b)=>a.at-b.at);
}
export function runCardTimeline(events:readonly CardMoment[],emit:(event:CardMoment)=>void,done:()=>void,schedule:(fn:()=>void,ms:number)=>number,cancelTimer:(id:number)=>void){
 let cancelled=false;const ids=events.map(e=>schedule(()=>{if(!cancelled)emit(e);},e.at));
 ids.push(schedule(()=>{if(!cancelled)done();},(events.at(-1)?.at??0)+1));
 return()=>{cancelled=true;ids.forEach(cancelTimer);};
}
