import type {EnhancementFeelOutcome} from '../../gameFeel/types';

export const ENHANCEMENT_ATTEMPT_MIN_MS=220;

export type EnhancementVfxSpec={
 duration:number;
 holdMs:number;
 shakeMs:number;
 shakePx:number;
 particles:number;
 rings:number;
};

export const ENHANCEMENT_VFX_SPECS:Record<EnhancementFeelOutcome,EnhancementVfxSpec>={
 SUCCESS:{duration:1080,holdMs:68,shakeMs:125,shakePx:2.15,particles:36,rings:3},
 FAIL_KEEP:{duration:420,holdMs:28,shakeMs:55,shakePx:.7,particles:7,rings:1},
 FAIL_DOWNGRADE:{duration:590,holdMs:46,shakeMs:120,shakePx:2.2,particles:14,rings:1},
 FAIL_DESTROY:{duration:920,holdMs:82,shakeMs:210,shakePx:4.8,particles:30,rings:2},
};

export const enhancementNow=()=>typeof performance!=='undefined'&&performance.now?performance.now():Date.now();

export async function waitForEnhancementAnticipation(startedAt:number){
 const remaining=Math.max(0,ENHANCEMENT_ATTEMPT_MIN_MS-(enhancementNow()-startedAt));
 if(remaining>0)await new Promise<void>(resolve=>globalThis.setTimeout(resolve,remaining));
}

export function enhancementVfxProgress(outcome:EnhancementFeelOutcome,elapsed:number){
 const spec=ENHANCEMENT_VFX_SPECS[outcome];
 const post=Math.max(0,elapsed-spec.holdMs);
 return Math.min(1,post/Math.max(1,spec.duration-spec.holdMs));
}
