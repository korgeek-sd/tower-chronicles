/**
 * The Tower Chronicles summon ritual: original procedural sound design.
 * Generated in Web Audio; zero audio downloads, one shared effect bus.
 * The neutral stone taps never receive rarity until the visual reveal.
 */
export type SummonGrade='C'|'B'|'A'|'SR'|'SSR';
export type SummonSoundPreferences={enabled:boolean;volume:number};
export const DEFAULT_SUMMON_SOUND_PREFERENCES:SummonSoundPreferences={enabled:true,volume:.62};
export const SUMMON_SOUND_EVENT='tower:summon-sound-preferences';
const KEY='tower-summon-effects-v1';
const clamp=(value:number)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;

export function readSummonSoundPreferences():SummonSoundPreferences{
 try{
  const raw=JSON.parse(localStorage.getItem(KEY)??'{}') as Partial<SummonSoundPreferences>;
  return {enabled:typeof raw.enabled==='boolean'?raw.enabled:true,volume:typeof raw.volume==='number'?clamp(raw.volume):DEFAULT_SUMMON_SOUND_PREFERENCES.volume};
 }catch{return {...DEFAULT_SUMMON_SOUND_PREFERENCES};}
}
export function saveSummonSoundPreferences(value:SummonSoundPreferences):boolean{
 const next={enabled:Boolean(value.enabled),volume:clamp(value.volume)};
 let saved=true;
 try{localStorage.setItem(KEY,JSON.stringify(next));}catch{saved=false;}
 applyVolume();
 if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent(SUMMON_SOUND_EVENT,{detail:next}));
 return saved;
}

export const SUMMON_TAP_PRESETS=[
 {duration:.22,low:163,high:108,crack:.052,rumble:.055},
 {duration:.34,low:137,high:81,crack:.076,rumble:.073},
 {duration:.64,low:104,high:43,crack:.12,rumble:.105},
] as const;
export const SUMMON_REVEAL_PRESETS={
 SR:{root:293.665,tones:[1,1.189,1.498,2],duration:1.75},
 SSR:{root:146.832,tones:[.5,1,1.189,1.498,2,2.378],duration:2.65},
} as const;

type Cue={
 ctx:AudioContext;at:number;output:GainNode;
 nodes:AudioNode[];sources:AudioScheduledSourceNode[];
 remaining:number;stop:()=>void;disposed:boolean;
};
let context:AudioContext|null=null,master:GainNode|null=null,noise:AudioBuffer|null=null;
const active=new Set<Cue>();
function applyVolume(){
 if(!context||!master)return;
 const p=readSummonSoundPreferences();
 master.gain.setTargetAtTime(p.enabled?p.volume*.56:0,context.currentTime,.025);
 if(!p.enabled)for(const cue of [...active])cue.stop();
}
export function unlockSsrSound(){
 try{
  if(!readSummonSoundPreferences().enabled||typeof window==='undefined'||!window.AudioContext)return;
  if(!context||context.state==='closed'){
   context=new window.AudioContext();
   master=context.createGain();master.gain.value=readSummonSoundPreferences().volume*.56;
   const limiter=context.createDynamicsCompressor();
   limiter.threshold.value=-15;limiter.knee.value=12;limiter.ratio.value=8;
   limiter.attack.value=.003;limiter.release.value=.2;
   master.connect(limiter);limiter.connect(context.destination);
   noise=null;
  }
  if(context.state==='suspended')void context.resume().catch(()=>{});
 }catch{/* Audio is optional and must never block summoning. */}
}
function beginCue():Cue|null{
 try{
  if(typeof window==='undefined'||!readSummonSoundPreferences().enabled)return null;
  unlockSsrSound();
  if(!context||!master||context.state==='closed')return null;
  while(active.size>=7)active.values().next().value?.stop();
  const ctx=context,out=ctx.createGain();
  out.gain.value=1;out.connect(master);
  const cue:Cue={
   ctx,at:ctx.currentTime+.008,output:out,nodes:[out],sources:[],remaining:0,disposed:false,
   stop:()=>{}
  };
  cue.stop=()=>{
   if(cue.disposed)return;
   cue.disposed=true;
   for(const source of cue.sources){source.onended=null;try{source.stop();}catch{}}
   for(const node of cue.nodes)try{node.disconnect();}catch{}
   active.delete(cue);
  };
  active.add(cue);
  return cue;
 }catch{return null;}
}
function schedule(cue:Cue,source:AudioScheduledSourceNode,start:number,end:number){
 cue.sources.push(source);cue.remaining++;
 source.onended=()=>{
  cue.remaining--;
  if(cue.remaining<=0)cue.stop();
 };
 source.start(start);source.stop(end);
}
type Wave='sine'|'triangle'|'sawtooth'|'square';
function tone(cue:Cue,offset:number,duration:number,startHz:number,endHz:number,level:number,wave:Wave='sine',attack=.018){
 const at=cue.at+offset,end=at+duration;
 const osc=cue.ctx.createOscillator(),amp=cue.ctx.createGain();
 osc.type=wave;
 osc.frequency.setValueAtTime(Math.max(20,startHz),at);
 osc.frequency.exponentialRampToValueAtTime(Math.max(20,endHz),end);
 amp.gain.setValueAtTime(0,at);
 amp.gain.linearRampToValueAtTime(level,at+Math.min(attack,duration*.35));
 amp.gain.exponentialRampToValueAtTime(.0001,end);
 osc.connect(amp);amp.connect(cue.output);
 cue.nodes.push(osc,amp);
 schedule(cue,osc,at,end+.01);
}
function noiseBuffer(ctx:AudioContext){
 if(noise)return noise;
 const length=Math.ceil(ctx.sampleRate*.8);
 const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
 const data=buffer.getChannelData(0);let seed=0x5afe2416;
 for(let i=0;i<data.length;i++){
  seed=(Math.imul(seed,1664525)+1013904223)|0;
  data[i]=((seed>>>0)/2147483648-1)*.86;
 }
 noise=buffer;return buffer;
}
function grain(cue:Cue,offset:number,duration:number,frequency:number,level:number,q=1){
 const at=cue.at+offset,end=at+duration;
 const src=cue.ctx.createBufferSource(),filter=cue.ctx.createBiquadFilter(),amp=cue.ctx.createGain();
 src.buffer=noiseBuffer(cue.ctx);
 filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=q;
 amp.gain.setValueAtTime(0,at);
 amp.gain.linearRampToValueAtTime(level,at+.007);
 amp.gain.exponentialRampToValueAtTime(.0001,end);
 src.connect(filter);filter.connect(amp);amp.connect(cue.output);
 cue.nodes.push(src,filter,amp);
 schedule(cue,src,at,end);
}
/** Called directly on the 1-pull/10-pull button, not before the server confirms a result. */
export function playSummonRequest(rolls:1|10=1){
 const cue=beginCue();if(!cue)return;
 try{
  tone(cue,0,.3,340,192,.06,'triangle',.01);
  tone(cue,.07,.35,230,122,.065,'sine',.025);
  grain(cue,.015,.25,1150,.068,1.9);
  if(rolls===10)tone(cue,.17,.31,290,152,.042,'triangle',.015);
 }catch{cue.stop();}
}
/** Neutral stone impacts: all ranks share identical 1st, 2nd and 3rd strikes. */
export function playSealImpact(tap:number):void{
 const preset=SUMMON_TAP_PRESETS[tap-1];if(!preset)return;
 const cue=beginCue();if(!cue)return;
 try{
  grain(cue,0,preset.duration*.53,820+tap*350,preset.crack,1.25);
  grain(cue,.022,preset.duration*.37,2500+tap*440,preset.crack*.45,1.8);
  tone(cue,0,preset.duration,preset.low,preset.high,preset.rumble,'triangle',.011);
  tone(cue,.023,preset.duration*.75,preset.low*.505,Math.max(22,preset.high*.6),preset.rumble*.72,'sine',.022);
  if(tap===3){
   grain(cue,.075,.43,460,.10,.7);
   tone(cue,.1,.53,91,34,.072,'sawtooth',.055);
  }
 }catch{cue.stop();}
}
/** Only fired after rarity color becomes visible; distinct SR shimmer and SSR cathedral bells. */
export function playSummonRarityReveal(rarity:'SR'|'SSR'):()=>void{
 const cue=beginCue();if(!cue)return()=>{};
 try{
  const preset=SUMMON_REVEAL_PRESETS[rarity],ssr=rarity==='SSR';
  // Magical seal dust disperses first, then the bells answer.
  grain(cue,0,ssr?.6:.36,ssr?960:1850,ssr?.08:.055,.75);
  tone(cue,0,ssr?.65:.42,ssr?115:220,ssr?48:127,ssr?.096:.041,'sawtooth',.04);
  preset.tones.forEach((ratio,index)=>{
   const at=(ssr?.09:.07)+index*(ssr?.075:.085);
   const frequency=preset.root*ratio;
   tone(cue,at,preset.duration-at,frequency,frequency*.999,
    (ssr?.065:.051)/Math.sqrt(index+1),'sine',ssr?.025:.009);
   tone(cue,at+.03,Math.max(.18,(preset.duration-at)*.62),frequency*2.01,frequency*2.005,
    (ssr?.016:.021)/Math.sqrt(index+1),'sine',.01);
  });
  if(ssr){
   // Slow choral foundation under a huge, decaying bell.
   tone(cue,.12,2.48,73.416,73.416,.073,'triangle',.19);
   tone(cue,.29,2.19,110,110,.046,'sine',.23);
   grain(cue,.8,.7,2550,.032,3);
   tone(cue,.94,1.35,587.33,584.9,.037,'sine',.018);
  }else{
   tone(cue,.46,.87,783.99,782,.043,'sine',.008);
   tone(cue,.60,.82,987.77,985,.029,'sine',.007);
  }
 }catch{cue.stop();}
 return cue.stop;
}
/** Ordinary C/B/A pulls still acknowledge a confirmed summon, with no rare flourish. */
export function playSummonOrdinaryResult(rarity:'C'|'B'|'A'='C'){
 const cue=beginCue();if(!cue)return;
 try{
  const base=rarity==='A'?392:rarity==='B'?329.63:261.63;
  tone(cue,0,.35,base,base*.992,.045,'sine',.006);
  tone(cue,.085,.39,base*1.5,base*1.49,rarity==='A'?.036:.021,'sine',.009);
  if(rarity==='A')tone(cue,.16,.43,base*2,base*1.99,.023,'sine',.015);
 }catch{cue.stop();}
}
/** Retain the legacy name for integrations not yet migrated to ranked cues. */
export function playSsrBell(intensity=1):()=>void{
 return playSummonRarityReveal(intensity>=.8?'SSR':'SR');
}
