export type ViewportBand='compact'|'standard'|'tall';

export type PagedSurface=
  |'inventory'
  |'market'
  |'equipment'
  |'jobs'
  |'association'
  |'cosmetics'
  |'skills'
  |'recipes';

export function viewportBand(height:number):ViewportBand{
  if(height<720)return 'compact';
  if(height<900)return 'standard';
  return 'tall';
}

const SIZES:Record<PagedSurface,Record<ViewportBand,number>>={
  inventory:{compact:12,standard:16,tall:20},
  market:{compact:4,standard:5,tall:6},
  equipment:{compact:4,standard:5,tall:6},
  jobs:{compact:4,standard:5,tall:6},
  association:{compact:4,standard:5,tall:6},
  cosmetics:{compact:6,standard:8,tall:10},
  skills:{compact:3,standard:4,tall:5},
  recipes:{compact:2,standard:3,tall:4},
};

export function pageSizeFor(surface:PagedSurface,height:number){
  return SIZES[surface][viewportBand(height)];
}

export function clampPageIndex(index:number,itemCount:number,pageSize:number){
  const safePageSize=Math.max(1,pageSize);
  const pageCount=Math.max(1,Math.ceil(Math.max(0,itemCount)/safePageSize));
  const safeIndex=Number.isFinite(index)?Math.trunc(index):0;
  return Math.min(Math.max(0,safeIndex),pageCount-1);
}

export function pageSlice<T>(items:readonly T[],index:number,pageSize:number){
  const safePageSize=Math.max(1,Math.trunc(pageSize));
  const safe=clampPageIndex(index,items.length,safePageSize);
  const start=safe*safePageSize;
  return items.slice(start,start+safePageSize);
}
