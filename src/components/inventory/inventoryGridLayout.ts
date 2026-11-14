/** Keep bag icons at the detail thumbnail's 52px size instead of stretching rows. */
export function inventoryGridLayout(width:number,height:number){
 const columns=6,gap=6;
 const slotSize=Math.max(1,Math.min(52,(width-gap*(columns-1))/columns));
 const rows=Math.max(1,Math.floor((height+gap)/(slotSize+gap)));
 return {columns,slotSize,rows,pageSize:rows*columns};
}
