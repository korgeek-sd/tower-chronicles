export interface BattlePrefs{speed:number;damageNumbers:boolean;autoscroll:boolean}
export const PREFS_KEY='tower-chronicles-ui-prefs';
export const DEFAULT_PREFS:BattlePrefs={speed:1,damageNumbers:true,autoscroll:true};
export const SPEEDS=[.5,1,1.5,2] as const;
export interface PrefsStorage{getItem(key:string):string|null;setItem(key:string,value:string):void}

function ambientStorage():PrefsStorage|null{
 try{
  const g=globalThis as unknown as {localStorage?:PrefsStorage};
  return g.localStorage??null;
 }catch{return null;}
}

/** Battle-only UI preferences. Never stored inside the game save. */
export function loadPrefs(storage?:PrefsStorage|null):BattlePrefs{
 const store=storage??ambientStorage();
 if(!store)return {...DEFAULT_PREFS};
 try{
  const raw=store.getItem(PREFS_KEY);
  if(!raw)return {...DEFAULT_PREFS};
  const parsed=JSON.parse(raw) as Partial<BattlePrefs>;
  return {
   speed:parsed.speed===.5||parsed.speed===1||parsed.speed===1.5||parsed.speed===2?parsed.speed:1,
   damageNumbers:parsed.damageNumbers!==false,
   autoscroll:parsed.autoscroll!==false,
  };
 }catch{return {...DEFAULT_PREFS};}
}

export function savePrefs(prefs:BattlePrefs,storage?:PrefsStorage|null):void{
 const store=storage??ambientStorage();
 if(!store)return;
 try{store.setItem(PREFS_KEY,JSON.stringify(prefs));}catch{/* private mode etc. */}
}
