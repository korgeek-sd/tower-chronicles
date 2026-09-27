import type {GameFeelIntensity} from './types';

const patternFor=(intensity:GameFeelIntensity):number|number[]=>{
 if(intensity==='subtle')return 10;
 if(intensity==='normal')return 20;
 if(intensity==='strong')return [18,28,18];
 return [22,32,30,32,22];
};

export function playHaptic(intensity:GameFeelIntensity):void{
 try{
  const nav=typeof navigator==='undefined'?undefined:navigator;
  if(!nav||typeof nav.vibrate!=='function')return;
  nav.vibrate(patternFor(intensity));
 }catch{
  // Haptics are optional presentation and must never affect gameplay.
 }
}
