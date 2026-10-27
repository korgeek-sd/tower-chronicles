import {decodeTowerTheme,THEME_SECONDS,THEME_TICKS_PER_SECOND,type ThemeNote} from './towerThemeScore';
export type MusicPreferences={enabled:boolean;volume:number};
export const DEFAULT_MUSIC_PREFERENCES:MusicPreferences={enabled:true,volume:0.3};
const KEY='tc-background-music-v1';
export const MUSIC_PREFERENCES_EVENT='tower:background-music-preferences';
const clamp=(n:number)=>Math.min(1,Math.max(0,Number.isFinite(n)?n:0));
export function readMusicPreferences():MusicPreferences{
 try{
  const raw=JSON.parse(localStorage.getItem(KEY)??'{}') as Partial<MusicPreferences>;
  return {enabled:typeof raw.enabled==='boolean'?raw.enabled:true,volume:typeof raw.volume==='number'?clamp(raw.volume):0.3};
 }catch{return {...DEFAULT_MUSIC_PREFERENCES};}
}
export function saveMusicPreferences(value:MusicPreferences):boolean{
 const next={enabled:Boolean(value.enabled),volume:clamp(value.volume)};
 let saved=true;
 try{localStorage.setItem(KEY,JSON.stringify(next));}catch{saved=false;}
 if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent(MUSIC_PREFERENCES_EVENT,{detail:next}));
 return saved;
}
const notes=decodeTowerTheme();
const freq=(pitch:number)=>440*Math.pow(2,(pitch-69)/12);
let context:AudioContext|null=null,master:GainNode|null=null,scheduler:number|null=null;
let anchor=0,noteIndex=0,loop=0,active=false;
let noiseBuffer:AudioBuffer|null=null;
function voice(ctx:AudioContext,when:number,length:number,pitch:number,velocity:number,instrument:number,destination:AudioNode){
 const level=Math.min(1,velocity/100);
 if(instrument===5){
  if(!noiseBuffer){
   noiseBuffer=ctx.createBuffer(1,Math.round(ctx.sampleRate*0.6),ctx.sampleRate);
   const data=noiseBuffer.getChannelData(0);let seed=91237;
   for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;data[i]=(seed>>>0)/2147483648-1;}
  }
  const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),amp=ctx.createGain();
  src.buffer=noiseBuffer;filter.type='lowpass';filter.frequency.value=230;
  amp.gain.setValueAtTime(0,when);amp.gain.linearRampToValueAtTime(.11*level,when+.008);amp.gain.exponentialRampToValueAtTime(.0001,when+.42);
  src.connect(filter);filter.connect(amp);amp.connect(destination);
  src.onended=()=>{src.disconnect();filter.disconnect();amp.disconnect();};
  src.start(when);src.stop(when+.43);
  return;
 }
 const bell=instrument===3,choir=instrument===1,strings=instrument===2,drone=instrument===6;
 const duration=Math.max(.07,length),attack=bell?.006:choir?.32:strings?.12:drone?.58:.055;
 const release=bell?2.0:choir?.62:strings?.22:drone?.72:.23;
 const volume=[.060,.044,.033,.072,.052,0,.052][instrument]*level;
 const sources:OscillatorNode[]=[];
 const amp=ctx.createGain(),filter=ctx.createBiquadFilter();
 filter.type='lowpass';filter.frequency.value=bell?4900:choir?820:strings?1120:drone?390:1550;
 amp.gain.setValueAtTime(0,when);
 amp.gain.linearRampToValueAtTime(volume,when+Math.min(attack,duration*.5));
 amp.gain.setValueAtTime(volume*(bell?.44:.79),when+duration);
 amp.gain.linearRampToValueAtTime(.00001,when+duration+release);
 const base=freq(pitch);
 const partials=bell?[[1,1],[2.015,.36],[3.93,.12]]:choir?[[1,1],[1.008,.4]]:strings?[[1,1],[2,.12]]:drone?[[1,1],[.501,.16]]:[[1,1],[2,.20]];
 for(const [ratio,strength] of partials){
  const osc=ctx.createOscillator(),vol=ctx.createGain();
  osc.type=bell?'sine':choir||strings?'sawtooth':drone?'sine':'triangle';
  osc.frequency.value=base*ratio;vol.gain.value=strength/(bell?1.4:1.3);
  osc.connect(vol);vol.connect(filter);sources.push(osc);
  osc.start(when);osc.stop(when+duration+release+.025);
  osc.onended=()=>{osc.disconnect();vol.disconnect();};
 }
 filter.connect(amp);amp.connect(destination);
 const last=sources[sources.length-1];last.onended=()=>{last.disconnect();filter.disconnect();amp.disconnect();};
}
function schedule(){
 const ctx=context,output=master;
 if(!ctx||!output||!active||document.hidden)return;
 const horizon=ctx.currentTime+1.15;
 let guard=0;
 while(guard++<80){
  const note:ThemeNote=notes[noteIndex];
  const start=anchor+loop*THEME_SECONDS+note.tick/THEME_TICKS_PER_SECOND;
  if(start>horizon)break;
  if(start>ctx.currentTime-.12)voice(ctx,Math.max(ctx.currentTime+.002,start),note.duration/THEME_TICKS_PER_SECOND,note.pitch,note.velocity,note.instrument,output);
  noteIndex++;
  if(noteIndex>=notes.length){noteIndex=0;loop++;}
 }
}
function stop(){
 active=false;
 if(scheduler!==null){window.clearInterval(scheduler);scheduler=null;}
 if(context&&master)master.gain.setTargetAtTime(0,context.currentTime,.07);
}
/**
 * Attempt background music as soon as the title screen appears.
 * Browsers may suspend audio until a trusted user gesture; scheduled notes
 * remain queued and a direct resume on touch starts playback automatically.
 */
function start(){
 if(active||!readMusicPreferences().enabled||document.hidden)return;
 try{
  if(!context||context.state==='closed'){
   context=new window.AudioContext();
   master=context.createGain();master.gain.value=0;master.connect(context.destination);
  }
  active=true;noteIndex=0;loop=0;anchor=context.currentTime+.08;
  master!.gain.setTargetAtTime(readMusicPreferences().volume*.66,context.currentTime,.08);
  scheduler=window.setInterval(schedule,180);
  schedule();
  // Keep the context queued even when mobile autoplay is suspended.
  if(context.state!=='running')void context.resume().catch(()=>{});
 }catch{stop();}
}
export function mountBackgroundMusic():()=>void{
 if(typeof window==='undefined'||typeof document==='undefined')return()=>{};
 const unlock=()=>{if(context&&context.state==='suspended')void context.resume().catch(()=>{});start();};
 const visibility=()=>{if(document.hidden)stop();else start();};
 const settings=()=>{const prefs=readMusicPreferences();if(!prefs.enabled){stop();return;}if(active&&master&&context)master.gain.setTargetAtTime(prefs.volume*.66,context.currentTime,.06);else start();};
 document.addEventListener('pointerdown',unlock,{capture:true});
 document.addEventListener('keydown',unlock,{capture:true});
 document.addEventListener('visibilitychange',visibility);
 window.addEventListener(MUSIC_PREFERENCES_EVENT,settings);
 window.addEventListener('storage',settings);
 // Start with the server-selection title, not after pressing Enter.
 start();
 return ()=>{
  document.removeEventListener('pointerdown',unlock,{capture:true});
  document.removeEventListener('keydown',unlock,{capture:true});
  document.removeEventListener('visibilitychange',visibility);
  window.removeEventListener(MUSIC_PREFERENCES_EVENT,settings);
  window.removeEventListener('storage',settings);
  stop();
  if(context){void context.close().catch(()=>{});context=null;master=null;noiseBuffer=null;}
 };
}
