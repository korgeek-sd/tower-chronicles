import type{GameFeelIntensity}from'./types';
type Vibrator={vibrate?:(pattern:number|number[])=>unknown};
const patterns:Record<GameFeelIntensity,number|number[]>={subtle:10,normal:20,strong:[18,24,18],exceptional:[22,28,32]};
export function playHaptic(intensity:GameFeelIntensity,target?:Vibrator):void{try{const host=target??(typeof navigator!=='undefined'?navigator:{});host.vibrate?.(patterns[intensity]);}catch{}}
