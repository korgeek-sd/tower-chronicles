export function cardRows(count:number):number[]{
 const rows=[[1],[2],[3],[2,2],[3,2],[3,3],[3,3,1],[3,3,2],[3,3,3],[3,4,3]];
 return rows[Math.max(0,Math.min(9,count-1))];
}
export function cardSize(count:number,width:number,height:number){
 const rows=cardRows(count),cols=Math.max(...rows);
 return Math.max(1,Math.min(count===1?220:150,(width-8*(cols-1))/cols,(height-8*(rows.length-1))/rows.length*.7));
}
export function remainingCards(count:number,opened:ReadonlySet<number>){return Array.from({length:count},(_,i)=>i).filter(i=>!opened.has(i));}
