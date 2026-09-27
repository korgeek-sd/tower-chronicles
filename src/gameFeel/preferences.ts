export interface GameFeelPreferences{
 reducedMotion:boolean;
}

export function readGameFeelPreferences():GameFeelPreferences{
 try{
  if(typeof globalThis.matchMedia!=='function')return {reducedMotion:false};
  return {reducedMotion:globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches};
 }catch{
  return {reducedMotion:false};
 }
}
