type PageItem={top:number;bottom:number};

/** Prefer a break before a row or control, and always cover every pixel of the panel. */
export function guildPageOffsets(contentHeight:number,pageHeight:number,items:PageItem[]):number[]{
 const offsets=[0];
 if(pageHeight<1||contentHeight<=pageHeight)return offsets;
 while(offsets[offsets.length-1]+pageHeight<contentHeight){
  const start=offsets[offsets.length-1];
  const edge=start+pageHeight;
  const crossing=items.filter(item=>item.top<edge&&item.bottom>edge&&item.top>=start+pageHeight/2);
  const next=crossing.length?Math.min(...crossing.map(item=>Math.floor(item.top))):edge;
  offsets.push(Math.max(start+1,next));
 }
 return offsets;
}
