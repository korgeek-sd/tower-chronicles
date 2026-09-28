import type {
 EquipmentEnhancementLevel,
 EquipmentGrade,
 EquipmentItem,
 EnhancementOutcome,
 GameState,
 Slot,
} from '../types';
import {
 V2_STARTER_EQUIPMENT_ID,
 equipmentItemName,
 equipmentItemSlot,
} from '../data/equipment';
import {ENHANCEMENT_STONE_ITEM_ID} from './equipmentDismantle';

export type EquipmentEnhancementAttemptLevel=Exclude<EquipmentEnhancementLevel,10>;
export type EquipmentEnhancementTargetLevel=Exclude<EquipmentEnhancementLevel,0>;

export interface EquipmentEnhancementRule {
 to:EquipmentEnhancementTargetLevel;
 successRate:number;
 failKeepRate:number;
 failDowngradeRate:number;
 failDestroyRate:number;
}

export const EQUIPMENT_ENHANCEMENT_RULES={
 0:{to:1,successRate:.50,failKeepRate:.50,failDowngradeRate:0,failDestroyRate:0},
 1:{to:2,successRate:.65,failKeepRate:.32,failDowngradeRate:.028,failDestroyRate:.002},
 2:{to:3,successRate:.60,failKeepRate:.34,failDowngradeRate:.057,failDestroyRate:.003},
 3:{to:4,successRate:.55,failKeepRate:.34,failDowngradeRate:.105,failDestroyRate:.005},
 4:{to:5,successRate:.48,failKeepRate:.34,failDowngradeRate:.173,failDestroyRate:.007},
 5:{to:6,successRate:.40,failKeepRate:.33,failDowngradeRate:.26,failDestroyRate:.01},
 6:{to:7,successRate:.32,failKeepRate:.31,failDowngradeRate:.36,failDestroyRate:.01},
 7:{to:8,successRate:.24,failKeepRate:.27,failDowngradeRate:.475,failDestroyRate:.015},
 8:{to:9,successRate:.19,failKeepRate:.24,failDowngradeRate:.55,failDestroyRate:.02},
 9:{to:10,successRate:.10,failKeepRate:.23,failDowngradeRate:.645,failDestroyRate:.025},
} as const satisfies Record<EquipmentEnhancementAttemptLevel,EquipmentEnhancementRule>;

export const EQUIPMENT_ENHANCEMENT_GRADE_BASE_COSTS={
 common:500,
 uncommon:750,
 rare:1100,
 heroic:1600,
 legendary:2500,
} as const satisfies Record<EquipmentGrade,number>;

export const EQUIPMENT_ENHANCEMENT_STAGE_FACTORS=[
 1,1.5,2.2,3.2,4.5,6.5,9.5,14,21,32,
] as const;

export const EQUIPMENT_ENHANCEMENT_STONE_COSTS={
 1:1,2:1,3:2,4:2,5:3,6:4,7:5,8:7,9:10,10:15,
} as const satisfies Record<EquipmentEnhancementTargetLevel,number>;

export function equipmentEnhancementSilverCost(grade:EquipmentGrade,target:EquipmentEnhancementTargetLevel):number {
 return Math.max(1,Math.round(EQUIPMENT_ENHANCEMENT_GRADE_BASE_COSTS[grade]*EQUIPMENT_ENHANCEMENT_STAGE_FACTORS[target-1]));
}

export interface EquipmentEnhancementQuote {
 itemId:string;
 current:EquipmentEnhancementAttemptLevel;
 target:EquipmentEnhancementTargetLevel;
 silverCost:number;
 stoneCost:number;
 stonesOwned:number;
 successRate:number;
 failKeepRate:number;
 failDowngradeRate:number;
 failDestroyRate:number;
 canAttempt:boolean;
 reason:string;
}

export function equipmentEnhancementQuote(state:GameState,itemId:string):EquipmentEnhancementQuote|null {
 const item=(state.equipmentItems??[]).find(value=>value.id===itemId);
 if(!item||item.id===V2_STARTER_EQUIPMENT_ID||item.enhancement>=10)return null;
 const current=item.enhancement as EquipmentEnhancementAttemptLevel;
 const rule=EQUIPMENT_ENHANCEMENT_RULES[current];
 const silverCost=equipmentEnhancementSilverCost(item.grade,rule.to);
 const stoneCost=EQUIPMENT_ENHANCEMENT_STONE_COSTS[rule.to];
 const stonesOwned=Math.max(0,state.lootItems[ENHANCEMENT_STONE_ITEM_ID]??0);
 const reason=state.expedition?'원정 중에는 강화할 수 없습니다.':
  state.silver<silverCost?'Silver가 부족합니다.':
  stonesOwned<stoneCost?'강화석이 부족합니다.':'';
 return {
  itemId:item.id,current,target:rule.to,silverCost,stoneCost,stonesOwned,
  successRate:rule.successRate,
  failKeepRate:rule.failKeepRate,
  failDowngradeRate:rule.failDowngradeRate,
  failDestroyRate:rule.failDestroyRate,
  canAttempt:!reason,
  reason,
 };
}

export function resolveEquipmentEnhancementOutcome(level:EquipmentEnhancementAttemptLevel,roll:number):EnhancementOutcome {
 if(!Number.isFinite(roll)||roll<0||roll>=1)throw Error('강화 확률 판정값이 올바르지 않습니다.');
 const rule=EQUIPMENT_ENHANCEMENT_RULES[level];
 const scale=1_000_000;
 const point=Math.floor(roll*scale);
 const successEnd=Math.round(rule.successRate*scale);
 const keepEnd=successEnd+Math.round(rule.failKeepRate*scale);
 const downgradeEnd=keepEnd+Math.round(rule.failDowngradeRate*scale);
 if(point<successEnd)return 'SUCCESS';
 if(point<keepEnd)return 'FAIL_KEEP';
 if(point<downgradeEnd)return 'FAIL_DOWNGRADE';
 return 'FAIL_DESTROYED';
}

function clearDestroyedReferences(state:GameState,item:EquipmentItem){
 const slot=equipmentItemSlot(item);
 if(state.equipped[slot]===item.id)state.equipped[slot]=null;
 for(const preset of state.expeditionPresets){
  if(preset?.equipment[slot]===item.id)preset.equipment[slot]=null;
 }
}

export function enhanceEquipmentV2(state:GameState,itemId:string,rng:()=>number=Math.random):GameState {
 if(state.expedition)return {...state,notice:'원정 중에는 장비를 강화할 수 없습니다.'};
 const source=(state.equipmentItems??[]).find(item=>item.id===itemId);
 if(!source)return {...state,notice:'강화할 장비를 찾을 수 없습니다.'};
 if(source.id===V2_STARTER_EQUIPMENT_ID)return {...state,notice:'협회 보급 장비는 강화할 수 없습니다.'};
 if(source.enhancement>=10)return {...state,notice:'이미 최대 강화 단계입니다.'};
 const quote=equipmentEnhancementQuote(state,itemId);
 if(!quote)return {...state,notice:'강화할 수 없는 장비입니다.'};
 if(state.silver<quote.silverCost)return {...state,notice:'강화에 필요한 Silver가 부족합니다.'};
 if((state.lootItems[ENHANCEMENT_STONE_ITEM_ID]??0)<quote.stoneCost)return {...state,notice:'강화에 필요한 강화석이 부족합니다.'};

 let outcome:EnhancementOutcome;
 try{outcome=resolveEquipmentEnhancementOutcome(quote.current,rng());}
 catch{return state;}

 const next=structuredClone(state);
 const item=next.equipmentItems.find(value=>value.id===itemId)!;
 next.silver-=quote.silverCost;
 next.lootItems[ENHANCEMENT_STONE_ITEM_ID]-=quote.stoneCost;
 if(next.lootItems[ENHANCEMENT_STONE_ITEM_ID]<=0)delete next.lootItems[ENHANCEMENT_STONE_ITEM_ID];

 if(outcome==='SUCCESS'){
  item.enhancement=quote.target;
  next.notice='강화 성공! '+equipmentItemName(item);
  return next;
 }
 if(outcome==='FAIL_KEEP'){
  next.notice='강화 실패. '+equipmentItemName(item)+'의 강화 단계가 유지됩니다.';
  return next;
 }
 if(outcome==='FAIL_DOWNGRADE'){
  item.enhancement=Math.max(0,item.enhancement-1) as EquipmentEnhancementLevel;
  next.notice='강화 실패. '+equipmentItemName(item)+'로 강화 단계가 하락했습니다.';
  return next;
 }
 const name=equipmentItemName(item);
 clearDestroyedReferences(next,item);
 next.equipmentItems=next.equipmentItems.filter(value=>value.id!==itemId);
 next.notice='강화 실패. '+name+' 장비가 파괴되었습니다.';
 return next;
}
