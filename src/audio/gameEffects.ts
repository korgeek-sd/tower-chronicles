/**
 * Tower Chronicles — phase-one UI and hunting sound palette.
 * All nine sounds are procedural Web Audio; no media download, no gameplay writes.
 * A single master gain and per-cue rate limits prevent repetitive overlap.
 */
import type {GameFeelEvent,GameFeelPayloadMap} from '../gameFeel/types';

export const EFFECT_SOUND_KEY='tower-general-effects-v1';
export const EFFECT_SOUND_EVENT='tower:general-sound-settings';
export type GameEffectName='ui.click'|'ui.confirm'|'ui.error'|'hunt.start'|'hunt.victory'|'hunt.defeat'|'loot.common'|'loot.rare'|'player.level-up'|'seal.cast'|'seal.step-1'|'seal.step-2'|'seal.step-3'|'seal.reset';
export type GameEffectSettings={enabled:boolean;volume:number};
export const DEFAULT_EFFECT_SOUND_SETTINGS:GameEffectSettings={enabled:true,volume:.58};
const clamp=(value:number)=>Number.isFinite(value)?Math.min(1,Math.max(0,value)):0;
export function readEffectSoundSettings():GameEffectSettings{
 try{
  const value=JSON.parse(localStorage.getItem(EFFECT_SOUND_KEY)??'{}') as Partial<GameEffectSettings>;
  return {enabled:typeof value.enabled==='boolean'?value.enabled:true,volume:typeof value.volume==='number'?clamp(value.volume):DEFAULT_EFFECT_SOUND_SETTINGS.volume};
 }catch{return {...DEFAULT_EFFECT_SOUND_SETTINGS};}
}
export function saveEffectSoundSettings(value:GameEffectSettings):boolean{
 const settings={enabled:!!value.enabled,volume:clamp(value.volume)};
 let saved=true;
 try{localStorage.setItem(EFFECT_SOUND_KEY,JSON.stringify(settings));}catch{saved=false;}
 applyEffectVolume();
 if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent(EFFECT_SOUND_EVENT,{detail:settings}));
 return saved;
}
export type SoundInstruction={delay:number;duration:number;startHz:number;endHz:number;gain:number;wave:'sine'|'triangle'|'sawtooth'|'square';noise?:boolean;filterHz?:number};
const note=(delay:number,duration:number,startHz:number,endHz:number,gain:number,wave:SoundInstruction['wave']='sine'):SoundInstruction=>({delay,duration,startHz,endHz,gain,wave});
const grain=(delay:number,duration:number,filterHz:number,gain:number):SoundInstruction=>({delay,duration,startHz:0,endHz:0,gain,wave:'sine',noise:true,filterHz});
export const EFFECT_SOUND_PROFILES:Readonly<Record<GameEffectName,readonly SoundInstruction[]>>={
 'ui.click':[note(0,.075,540,385,.078,'triangle'),grain(.005,.042,1950,.024)],
 'ui.confirm':[note(0,.15,660,660,.065),note(.095,.22,880,877,.064)],
 'ui.error':[note(0,.22,200,112,.097,'sawtooth'),note(.09,.19,126,79,.049,'triangle')],
 'hunt.start':[grain(0,.23,900,.065),note(0,.27,270,108,.075,'triangle'),note(.085,.23,170,95,.045)],
 'hunt.victory':[note(0,.18,330,330,.07),note(.12,.19,440,440,.065),note(.25,.35,554.37,552,.068),note(.27,.31,659.25,657,.033)],
 'hunt.defeat':[note(0,.32,220,114,.092,'triangle'),note(.17,.43,147,64,.07,'sawtooth'),grain(.015,.24,410,.04)],
 'loot.common':[note(0,.16,523,520,.051),note(.085,.24,659,656,.05),grain(.02,.09,1600,.02)],
 'loot.rare':[grain(0,.21,2160,.036),note(0,.36,523,519,.056),note(.12,.44,784,780,.073),note(.27,.61,1174.66,1166,.062),note(.38,.52,1567.98,1562,.039)],
 'player.level-up':[note(0,.22,293.66,293.66,.061),note(.13,.24,392,392,.068),note(.28,.3,587.33,587.33,.072),note(.47,.59,783.99,780,.088),note(.5,.64,1174.66,1169,.041),grain(.48,.35,2840,.025)],
 // 협회 인장 전용: 철 인장으로 석판을 두드리는 타격 + 봉인 각인 공명.
 'seal.cast':[grain(0,.095,870,.071),grain(.028,.17,2060,.033),note(0,.26,214,112,.11,'triangle'),note(.10,.35,97,146,.050,'sine')],
 // +1: 거칠고 짧은 각인. +2: 2단 화음. +3: 성당 종처럼 길게 울리는 고유 보상음.
 'seal.step-1':[grain(0,.095,1740,.037),note(0,.21,329.63,327,.054,'triangle'),note(.09,.32,440,436,.041,'sine')],
 'seal.step-2':[grain(0,.17,2420,.036),note(0,.20,349.23,348,.055),note(.13,.27,523.25,522,.063),note(.26,.48,698.46,694,.056),note(.29,.39,1046.5,1040,.017)],
 'seal.step-3':[grain(0,.27,2950,.048),note(0,.32,174.61,174,.082,'triangle'),note(.12,.31,349.23,348,.056),note(.23,.40,523.25,521,.072),note(.40,.76,783.99,779,.078),note(.46,.91,1174.66,1168,.051),note(.56,.90,1567.98,1560,.023),note(.47,.57,87.31,86,.055,'triangle')],
 // 재주조: 낡은 인장의 문양을 지우고 봉인을 다시 찍는 낮은 쇳소리.
 'seal.reset':[grain(0,.16,600,.058),note(0,.39,260,105,.080,'sawtooth'),note(.20,.36,131,71,.072,'triangle'),grain(.23,.20,1290,.046)],

};
export type Cue={name:GameEffectName;delay:number};
export function cuesForFeedback(event:GameFeelEvent,payload?:GameFeelPayloadMap[GameFeelEvent]):Cue[]{
 if(event==='ui.press')return [{name:'ui.click',delay:0}];
 if(event==='ui.confirm')return [{name:'ui.confirm',delay:0}];
 if(event==='ui.error')return [{name:'ui.error',delay:0}];
 if(event==='hunt.start')return [{name:'hunt.start',delay:0}];
 if(event==='seal.roll.start')return [{name:'seal.cast',delay:0}];
 if(event==='seal.reset')return [{name:'seal.reset',delay:0}];
 if(event==='seal.roll.result'){
  const step=(payload as GameFeelPayloadMap['seal.roll.result']|undefined)?.step;
  return step===1?[{name:'seal.step-1',delay:0}]:
         step===2?[{name:'seal.step-2',delay:0}]:
         step===3?[{name:'seal.step-3',delay:0}]:[];
 }
 if(event!=='hunt.result')return [];
 const result=payload as GameFeelPayloadMap['hunt.result']|undefined;
 if(!result)return [];
 const cues:Cue[]=[{name:result.outcome==='victory'?'hunt.victory':'hunt.defeat',delay:0}];
 if(result.outcome==='victory'&&result.grade){
  cues.push({name:['rare','heroic','legendary'].includes(result.grade)?'loot.rare':'loot.common',delay:.42});
 }
 if(result.outcome==='victory'&&result.leveledUp)cues.push({name:'player.level-up',delay:result.grade?.length?1.06:.67});
 return cues;
}

let ctx:AudioContext|null=null,master:GainNode|null=null,limiter:DynamicsCompressorNode|null=null,noiseBuffer:AudioBuffer|null=null;
const voices=new Set<{stop:()=>void}>();
const lastPlayed=new Map<GameEffectName,number>();
function applyEffectVolume(){
 if(!ctx||!master)return;
 const prefs=readEffectSoundSettings();
 master.gain.setTargetAtTime(prefs.enabled?prefs.volume*.62:0,ctx.currentTime,.035);
 if(!prefs.enabled)stopEffectVoices();
}
export function stopEffectVoices(){
 for(const voice of [...voices])voice.stop();
 voices.clear();
}
export function unlockGameEffectAudio():void{
 try{
  if(typeof window==='undefined'||!readEffectSoundSettings().enabled||!window.AudioContext)return;
  if(!ctx||ctx.state==='closed'){
   ctx=new window.AudioContext();
   master=ctx.createGain();master.gain.value=readEffectSoundSettings().volume*.62;
   limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-16;limiter.knee.value=9;limiter.ratio.value=9;
   limiter.attack.value=.002;limiter.release.value=.12;master.connect(limiter);limiter.connect(ctx.destination);
   noiseBuffer=null;
  }
  if(ctx.state==='suspended')void ctx.resume().catch(()=>{});
 }catch{/* audio must never interrupt play */ }
}
function getNoise(context:AudioContext):AudioBuffer{
 if(noiseBuffer)return noiseBuffer;
 const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*.7),context.sampleRate),data=buffer.getChannelData(0);
 let seed=81729;
 for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;data[i]=(seed>>>0)/2147483648-1;}
 noiseBuffer=buffer;return buffer;
}
export function playGameEffect(name:GameEffectName,delay=0):void{
 const pref=readEffectSoundSettings();
 if(!pref.enabled||pref.volume<=0||typeof document==='undefined'||document.hidden)return;
 unlockGameEffectAudio();
 if(!ctx||!master)return;
 const now=ctx.currentTime,previous=lastPlayed.get(name)??-Infinity;
 if(now-previous<(name==='ui.click'?.075:.095))return;
 lastPlayed.set(name,now);
 const instructions=EFFECT_SOUND_PROFILES[name];
 try{
  while(voices.size>=13)voices.values().next().value?.stop();
  const gain=ctx.createGain();gain.gain.value=1;gain.connect(master);
  const sources:AudioScheduledSourceNode[]=[],nodes:AudioNode[]=[gain];
  let remaining=0,disposed=false;
  const voice={stop:()=>{
   if(disposed)return;
   disposed=true;
   sources.forEach(source=>{source.onended=null;try{source.stop();}catch{}});
   nodes.forEach(node=>{try{node.disconnect();}catch{}});
   voices.delete(voice);
  }};
  voices.add(voice);
  for(const step of instructions){
   const begin=now+.008+delay+step.delay,end=begin+step.duration;
   const envelope=ctx.createGain();
   envelope.gain.setValueAtTime(.00001,begin);
   envelope.gain.linearRampToValueAtTime(step.gain,begin+Math.min(.015,step.duration*.2));
   envelope.gain.exponentialRampToValueAtTime(.00001,end);
   let source:AudioScheduledSourceNode;
   if(step.noise){
    const audio=ctx.createBufferSource(),filter=ctx.createBiquadFilter();
    audio.buffer=getNoise(ctx);filter.type='bandpass';filter.frequency.value=step.filterHz??900;filter.Q.value=1.3;
    audio.connect(filter);filter.connect(envelope);nodes.push(filter);source=audio;
   }else{
    const audio=ctx.createOscillator();audio.type=step.wave;audio.frequency.setValueAtTime(step.startHz,begin);
    audio.frequency.exponentialRampToValueAtTime(Math.max(20,step.endHz),end);
    audio.connect(envelope);source=audio;
   }
   envelope.connect(gain);nodes.push(source,envelope);sources.push(source);remaining++;
   source.onended=()=>{remaining--;if(!remaining)voice.stop();};
   source.start(begin);source.stop(end+.008);
  }
 }catch{/* skip blocked Web Audio silently */ }
}
export function playGameFeedback(event:GameFeelEvent,payload?:GameFeelPayloadMap[GameFeelEvent]):void{
 cuesForFeedback(event,payload).forEach(cue=>playGameEffect(cue.name,cue.delay));
}
/** One global listener handles ordinary buttons without requiring every screen to opt in. */
export function mountInterfaceSounds():()=>void{
 if(typeof window==='undefined'||typeof document==='undefined')return()=>{};
 const unlock=()=>unlockGameEffectAudio();
 const click=(event:MouseEvent)=>{
  if(!event.isTrusted)return;
  const target=event.target;
  if(!(target instanceof Element))return;
  const button=target.closest('button,[role="button"],select');
  if(!(button instanceof HTMLElement)||button.matches(':disabled,[aria-disabled="true"]'))return;
  // Dedicated summon/hunt cues run through their own confirmed interactions.
  if(button.closest('.tc-ssr-reveal,.tc-appearance-summon-screen')||button.matches('.tc-hunt-enter,.tc-hunt-next,.tc-seal-roll,.tc-seal-reset,.tc-seal-audio-preview'))return;
  playGameEffect('ui.click');
 };
 document.addEventListener('pointerdown',unlock,{capture:true,passive:true});
 document.addEventListener('keydown',unlock,{capture:true});
 document.addEventListener('click',click,true);
 const hide=()=>{if(document.hidden)stopEffectVoices();};
 document.addEventListener('visibilitychange',hide);
 return()=>{
  document.removeEventListener('pointerdown',unlock,true);
  document.removeEventListener('keydown',unlock,true);
  document.removeEventListener('click',click,true);
  document.removeEventListener('visibilitychange',hide);
  stopEffectVoices();
 };
}
