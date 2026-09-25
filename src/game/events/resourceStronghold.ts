import type {GameState,Tower} from '../types';
import type {ResourceStrongholdReward,ResourceStrongholdRuntime} from './types';
import {tierOf,TOWERS} from '../data/config';
import {log} from '../engine/state';

export const STRONGHOLD_BALANCE={
 decisionMs:30_000,
 captureMs:15*60_000,
 baseMaterial:6,
 materialPerFloor:2,
 baseSilver:0,
 silverPerFloor:0,
} as const;

export const strongholdRewardFor=(tower:Tower,floor:number):ResourceStrongholdReward=>({
 tower,
 tier:tierOf(floor),
 materialAmount:STRONGHOLD_BALANCE.baseMaterial+floor*STRONGHOLD_BALANCE.materialPerFloor,
 silver:STRONGHOLD_BALANCE.baseSilver+floor*STRONGHOLD_BALANCE.silverPerFloor,
});

export function createStrongholdRuntime(state:GameState,now=Date.now()):ResourceStrongholdRuntime|null {
 const e=state.expedition;
 if(!e||e.floor<3||e.floor>10)return null;
 return {
  instanceId:'stronghold-'+(++state.nextId),
  status:'ACTIVE',
  ownerUserId:state.market.ownerId,
  tower:e.tower,
  floor:e.floor,
  version:1,
  captureStartedAt:now,
  captureEndsAt:now+STRONGHOLD_BALANCE.captureMs,
  reward:strongholdRewardFor(e.tower,e.floor),
  contestedByUserId:null,
  contestRemainingMs:null,
  completedAt:null,
  abandonedAt:null,
  deletedAt:null,
 };
}

export const activeStronghold=(state:GameState)=>state.expedition?.events.stronghold?.status==='ACTIVE'?state.expedition.events.stronghold:null;
export const strongholdRemainingMs=(runtime:ResourceStrongholdRuntime,now=Date.now())=>Math.max(0,runtime.captureEndsAt-now);

export function settleStronghold(state:GameState,now=Date.now()):GameState {
 const runtime=activeStronghold(state);
 if(!runtime||now<runtime.captureEndsAt)return state;
 const s=structuredClone(state),e=s.expedition!,r=e.events.stronghold!;
 const reward=r.reward;
 e.loot.materials[reward.tower][reward.tier-1]+=reward.materialAmount;
 e.loot.silver+=reward.silver;
 r.status='COMPLETED';r.completedAt=now;r.version++;
 log(s,`자원거점 점령 완료 · ${TOWERS[reward.tower].material} +${reward.materialAmount}${reward.silver? ` · Silver +${reward.silver}`:''}`);
 r.status='DELETED';r.deletedAt=now;r.version++;
 return s;
}

export function abandonStronghold(state:GameState,now=Date.now()):GameState {
 const runtime=activeStronghold(state);
 if(!runtime)return state;
 const s=structuredClone(state),r=s.expedition!.events.stronghold!;
 r.status='ABANDONED';r.abandonedAt=now;r.version++;
 log(s,'자원거점 점령 포기 · 거점이 소멸합니다.');
 r.status='DELETED';r.deletedAt=now;r.version++;
 return s;
}
