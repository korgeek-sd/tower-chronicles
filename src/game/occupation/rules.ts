export const OCCUPATION_RULES={
 bidMin:10,
 bidMax:100,
 bidCooldownMs:30*60_000,
 bidRefundRate:.5,
 bidOpenDay:1,
 bidCloseDay:5,
 bidCloseHour:22,
 battleDay:6,
 battleStartHour:22,
 battleDurationMs:30*60_000,
 fronts:['LEFT','CENTER','RIGHT'] as const,
 frontsToWin:2,
} as const;

export type OccupationFront=typeof OCCUPATION_RULES.fronts[number];
export type OccupationPhase='BIDDING'|'LOCKED'|'BATTLE'|'SETTLED';

const KST_OFFSET_MS=9*60*60_000;

export interface OccupationWindow {
 cycleKey:string;
 phase:OccupationPhase;
 cycleStart:number;
 bidClosesAt:number;
 battleStartsAt:number;
 battleEndsAt:number;
 nextCycleAt:number;
}

const isoDate=(utcLikeMs:number)=>new Date(utcLikeMs).toISOString().slice(0,10);

/** Weekly occupation schedule in Asia/Seoul (KST has no DST). */
export function occupationWindow(now=Date.now()):OccupationWindow {
 const shifted=now+KST_OFFSET_MS;
 const d=new Date(shifted);
 const weekday=d.getUTCDay();
 const daysSinceMonday=(weekday+6)%7;
 const mondayShifted=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-daysSinceMonday,0,0,0,0);
 const cycleStart=mondayShifted-KST_OFFSET_MS;
 const bidClosesAt=cycleStart+4*86_400_000+22*3_600_000;
 const battleStartsAt=cycleStart+5*86_400_000+22*3_600_000;
 const battleEndsAt=battleStartsAt+OCCUPATION_RULES.battleDurationMs;
 const nextCycleAt=cycleStart+7*86_400_000;
 const phase:OccupationPhase=now<bidClosesAt?'BIDDING':now<battleStartsAt?'LOCKED':now<battleEndsAt?'BATTLE':'SETTLED';
 return {cycleKey:isoDate(mondayShifted),phase,cycleStart,bidClosesAt,battleStartsAt,battleEndsAt,nextCycleAt};
}

export const validOccupationBidAmount=(amount:number)=>
 Number.isInteger(amount)&&amount>=OCCUPATION_RULES.bidMin&&amount<=OCCUPATION_RULES.bidMax;

export const losingBidRefund=(submitted:number)=>
 Math.floor(Math.max(0,submitted)*OCCUPATION_RULES.bidRefundRate);

export function occupationFrontWinner(fronts:Record<OccupationFront,'ATTACKER'|'DEFENDER'|'OPEN'>):
 'ATTACKER'|'DEFENDER'|'OPEN' {
 let attacker=0,defender=0;
 for(const front of OCCUPATION_RULES.fronts){
  if(fronts[front]==='ATTACKER')attacker++;
  if(fronts[front]==='DEFENDER')defender++;
 }
 if(attacker>=OCCUPATION_RULES.frontsToWin)return 'ATTACKER';
 if(defender>=OCCUPATION_RULES.frontsToWin)return 'DEFENDER';
 return 'OPEN';
}
