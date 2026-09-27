type MediaHost={matchMedia?:(query:string)=>{matches:boolean}};
export function readGameFeelPreferences(host?:MediaHost):boolean{try{const target=host??(typeof window!=='undefined'?window:{});return !!target.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}catch{return false;}}
