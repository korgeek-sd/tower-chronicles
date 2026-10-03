import type {Expedition} from '../types';
import type {CombatSkillResource} from '../jobs/framework';
export const COMBAT_RESOURCE_CAP=4;
export function resourceValue(e:Expedition):number {
 e.jobRuntime.resource??={id:'combat',value:0,maxValue:4};
 e.jobRuntime.resource.maxValue=4;
 e.jobRuntime.resource.value=Math.max(0,Math.min(4,Math.floor(e.jobRuntime.resource.value)));
 return e.jobRuntime.resource.value;
}
export function gainCombatResource(e:Expedition,amount:number):number {
 const before=resourceValue(e);e.jobRuntime.resource!.value=Math.min(4,Math.max(0,before+Math.floor(amount)));
 return e.jobRuntime.resource!.value-before;
}
export function resourceCost(e:Expedition,resource:CombatSkillResource):number|null {
 if(resource.kind!=='SPENDER')return 0;
 const value=resourceValue(e),cost=resource.cost;
 if(cost.mode==='FIXED')return value>=cost.amount?cost.amount:null;
 return value>=cost.min?Math.min(value,cost.max):null;
}
export function spendCombatResource(e:Expedition,resource:CombatSkillResource):number|null {
 const cost=resourceCost(e,resource);if(cost===null)return null;
 gainCombatResource(e,-cost);return cost;
}
export function grantBasicAttackResource(e:Expedition,successfulHitCount:number):number {
 return successfulHitCount>0?gainCombatResource(e,1):0;
}
