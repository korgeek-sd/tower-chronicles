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
 'basic-hit':{duration:330,holdMs:30,shakePx:.8,particles:8},
 'critical-hit':{duration:560,holdMs:68,shakePx:3.0,particles:20},
 'player-damaged':{duration:420,holdMs:42,shakePx:1.7,particles:11},
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
