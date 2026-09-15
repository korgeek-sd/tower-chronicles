import type {GameState} from '../types';
import {BASE_PRESET_SLOT_LIMIT,PREMIUM_PRESET_SLOT_LIMIT} from '../engine/presets';
export const GOLDEN_RECORDER_BENEFITS={presetSlots:5,craftingMaterialReductionBonus:.02,goldSaleFeeRate:.01} as const;
export const STANDARD_BENEFITS={presetSlots:2,craftingMaterialReductionBonus:0,goldSaleFeeRate:.02} as const;
export const isGoldenRecorderActive=(s:Pick<GameState,'goldenRecorder'>,now:number)=>s.goldenRecorder.expiresAt!==null&&now<s.goldenRecorder.expiresAt;
export const getGoldenRecorderBenefits=(s:Pick<GameState,'goldenRecorder'>,now:number)=>isGoldenRecorderActive(s,now)?GOLDEN_RECORDER_BENEFITS:STANDARD_BENEFITS;
export const getGoldenPresetSlotLimit=(s:Pick<GameState,'goldenRecorder'>,now:number)=>isGoldenRecorderActive(s,now)?PREMIUM_PRESET_SLOT_LIMIT:BASE_PRESET_SLOT_LIMIT;
export const extendGoldenRecorder=(s:GameState,now:number,durationMs:number):GameState=>{if(!Number.isFinite(now)||!Number.isFinite(durationMs)||durationMs<=0)return s;const n=structuredClone(s);n.goldenRecorder.expiresAt=Math.max(now,n.goldenRecorder.expiresAt??0)+durationMs;return n;};
export const remainingGoldenTime=(expiresAt:number|null,now:number)=>{if(expiresAt===null||now>=expiresAt)return '미등록';const ms=expiresAt-now,hours=Math.max(1,Math.ceil(ms/3600000));return hours>=24?Math.ceil(hours/24)+'일':hours+'시간';};
