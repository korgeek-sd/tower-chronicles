let context:AudioContext|null=null;
/** Unlock only from the summon button gesture; unsupported or blocked audio is silent. */
export function unlockSsrSound(){try{if(typeof window==='undefined'||!window.AudioContext)return;context??=new window.AudioContext();void context.resume().catch(()=>{});}catch{}}
export function playSsrBell(intensity=1):()=>void {
 const nodes:OscillatorNode[]=[];let stopped=false;
 const stop=()=>{if(stopped)return;stopped=true;for(const node of nodes){try{node.stop();node.disconnect();}catch{}}};
 try{if(!context||context.state!=='running')return stop;const now=context.currentTime;
 for(const [frequency,volume] of [[174,.09],[348,.035],[521,.02]]){const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(volume*intensity,now+.02);gain.gain.exponentialRampToValueAtTime(.0001,now+1.4);oscillator.connect(gain);gain.connect(context.destination);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};oscillator.start(now);oscillator.stop(now+1.5);nodes.push(oscillator);}
 }catch{stop();}return stop;
}
