export type BattleVfxKind=
 |'player-basic-cue'|'player-skill-cue'
 |'basic-hit'|'critical-hit'|'player-damaged'
 |'guard'|'heal'|'death';

export type BattleVfxSpec={
 duration:number;
 holdMs:number;
 shakePx:number;
 particles:number;
};

export const BATTLE_VFX_SPECS:Record<BattleVfxKind,BattleVfxSpec>={
 'player-basic-cue':{duration:170,holdMs:0,shakePx:0,particles:0},
 'player-skill-cue':{duration:240,holdMs:0,shakePx:0,particles:4},
 'basic-hit':{duration:360,holdMs:34,shakePx:1.2,particles:14},
 'critical-hit':{duration:600,holdMs:72,shakePx:3.6,particles:28},
 'player-damaged':{duration:450,holdMs:46,shakePx:2.1,particles:16},
 'guard':{duration:390,holdMs:24,shakePx:.5,particles:10},
 'heal':{duration:620,holdMs:0,shakePx:0,particles:14},
 'death':{duration:860,holdMs:82,shakePx:4.6,particles:26},
};

export const battleVfxNow=()=>typeof performance!=='undefined'&&performance.now?performance.now():Date.now();

export function battleVisualRate(speed:number){
 return Math.min(2,Math.max(.75,Number.isFinite(speed)&&speed>0?speed:1));
}

export function battleVfxTiming(kind:BattleVfxKind,speed:number){
 const spec=BATTLE_VFX_SPECS[kind],rate=battleVisualRate(speed);
 return{
  duration:Math.round(spec.duration/rate),
  holdMs:Math.round(spec.holdMs/rate),
  shakePx:spec.shakePx,
  particles:spec.particles,
 };
}

// Fast white contact flash, slower coloured expansion; visual time only.
export function battleImpactEnvelope(elapsedMs:number,critical:boolean){
 const t=Math.max(0,elapsedMs),attack=Math.min(1,t/45);
 return {
  core:attack*Math.max(0,1-Math.max(0,t-45)/115),
  flame:attack*Math.max(0,1-Math.max(0,t-65)/(critical?490:310)),
  radius:(critical?38:20)+(critical?64:32)*(1-Math.pow(1-Math.min(1,t/240),3)),
 };
}

export function criticalVisualHold(critical:boolean,speed:number,reducedMotion:boolean){
 return critical&&!reducedMotion?Math.round(55/battleVisualRate(speed)):0;
}

// Keep retaliation readable when the server returns both sides in one response.
export function counterattackDelay(events:readonly {attacker:'player'|'monster';hitIndex:number}[],speed:number){
 if(!events.some(e=>e.attacker==='player')||!events.some(e=>e.attacker==='monster'))return 0;
 const rate=battleVisualRate(speed),lastHit=Math.max(...events.filter(e=>e.attacker==='player').map(e=>Math.max(0,e.hitIndex-1)));
 return Math.round(700/rate)+lastHit*Math.round(78/rate);
}

export function playerRecoveryDelay(events:readonly {attacker:'player'|'monster';hitIndex:number}[],speed:number){
 const enemy=events.filter(e=>e.attacker==='monster');
 if(!enemy.length)return 0;
 const rate=battleVisualRate(speed),lastHit=Math.max(...enemy.map(e=>Math.max(0,e.hitIndex-1)));
 return counterattackDelay(events,speed)+lastHit*Math.round(78/rate)+Math.round(700/rate);
}
