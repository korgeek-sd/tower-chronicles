import type {Weapon} from '../../game/types';

const KEY='tower-combat-sound';
let context:AudioContext|null=null;
let enabled=true;
const voices=new Set<{stop:()=>void}>();
const noiseBuffers=new WeakMap<AudioContext,AudioBuffer>();

export function combatAudioEnabled(){
 try{enabled=localStorage.getItem(KEY)!=='off';}catch{/* sound remains optional */}
 return enabled;
}
export function setCombatAudioEnabled(value:boolean){
 enabled=value;
 try{localStorage.setItem(KEY,value?'on':'off');}catch{/* private storage */}
 if(!value)stopCombatAudio();
}
export function unlockCombatAudio(){
 if(!enabled)return;
 try{
  const Ctor=window.AudioContext;
  if(!Ctor)return;
  context??=new Ctor();
  if(context.state==='suspended')void context.resume().catch(()=>{});
 }catch{/* unsupported or blocked audio must not affect the action */}
}
export function stopCombatAudio(){for(const voice of voices)voice.stop();voices.clear();}

/** Short deterministic synthesis: no download, network, or gameplay state mutation. */
export function playCombatImpact(weapon:Weapon,critical:boolean,guard:boolean,finishing=false){
 const ctx=context;
 if(!enabled||!ctx||ctx.state!=='running')return;
 try{
  while(voices.size>=8)voices.values().next().value?.stop();
  let buffer=noiseBuffers.get(ctx);
  if(!buffer){
   buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.22),ctx.sampleRate);
   const data=buffer.getChannelData(0);let seed=771;
   for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;data[i]=(seed>>>0)/2147483648-1;}
   noiseBuffers.set(ctx,buffer);
  }
  const now=ctx.currentTime,life=finishing?.24:critical?.19:guard?.12:.09;
  const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),tone=ctx.createOscillator(),body=ctx.createGain();
  noise.buffer=buffer;filter.type=guard?'highpass':'bandpass';
  filter.frequency.value=guard?2600:weapon==='bow'?1800:weapon==='staff'?900:1100;
  filter.Q.value=guard?1:weapon==='staff'?3:.7;
  gain.gain.setValueAtTime(.001,now);gain.gain.linearRampToValueAtTime(finishing?.2:critical?.19:.1,now+.003);gain.gain.exponentialRampToValueAtTime(.001,now+life);
  tone.type=guard?'triangle':weapon==='staff'?'sine':'triangle';
  tone.frequency.setValueAtTime(guard?1300:weapon==='staff'?440:finishing?95:critical?125:190,now);
  tone.frequency.exponentialRampToValueAtTime(guard?700:weapon==='staff'?160:65,now+life);
  body.gain.setValueAtTime(finishing?.12:critical?.09:.035,now);body.gain.exponentialRampToValueAtTime(.001,now+life);
  noise.connect(filter);filter.connect(gain);gain.connect(ctx.destination);tone.connect(body);body.connect(ctx.destination);
  let stopped=false;
  const voice={stop:()=>{if(stopped)return;stopped=true;try{noise.stop();tone.stop();}catch{}noise.disconnect();filter.disconnect();gain.disconnect();tone.disconnect();body.disconnect();voices.delete(voice);}};
  voices.add(voice);noise.onended=voice.stop;
  noise.start(now);tone.start(now);noise.stop(now+life+.01);tone.stop(now+life+.01);
 }catch{/* presentation failure is isolated from combat */}
}

/** One rising warning per preparation, with immediate cancellation. */
export function playCombatCharge():()=>void{
 const ctx=context;
 if(!enabled||!ctx||ctx.state!=='running')return()=>{};
 try{
  while(voices.size>=8)voices.values().next().value?.stop();
  const tone=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime;
  tone.type='triangle';tone.frequency.setValueAtTime(120,now);tone.frequency.exponentialRampToValueAtTime(240,now+.2);
  gain.gain.setValueAtTime(.001,now);gain.gain.linearRampToValueAtTime(.045,now+.03);gain.gain.exponentialRampToValueAtTime(.001,now+.24);
  tone.connect(gain);gain.connect(ctx.destination);
  let stopped=false;
  const voice={stop:()=>{if(stopped)return;stopped=true;tone.onended=null;try{tone.stop();}catch{}tone.disconnect();gain.disconnect();voices.delete(voice);}};
  voices.add(voice);tone.onended=voice.stop;tone.start(now);tone.stop(now+.25);
  return voice.stop;
 }catch{return()=>{};}
}
