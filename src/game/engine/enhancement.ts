import type {EnhancementLevel,EnhancementOutcome,GameState,Item,Tower} from '../types';
import {PASSIVES,WEAPONS} from '../data/config';
import {
  ENHANCEMENT_MATERIAL_BY_CATEGORY,
  ENHANCEMENT_POLICY,
  enhancementMaterialCost,
  enhancementRule,
  enhancementSilverCost,
  isEquipmentTier,
  type EnhancementAttemptLevel,
  type EnhancementEquipmentCategory,
  type EquipmentTier,
} from '../data/enhancement';
import {random} from '../events/rng';
import {itemName} from './state';

export interface EnhancementQuote {
  itemId:string;
  current:EnhancementAttemptLevel;
  target:EnhancementLevel;
  silverCost:number;
  materialTower:Tower;
  materialTier:EquipmentTier;
  materialCost:number;
  successRate:number;
  failKeepRate:number;
  failDowngradeRate:number;
  failDestroyRate:number;
}

function categoryOf(item:Item):EnhancementEquipmentCategory|null {
  if(item.kind in WEAPONS)return 'weapon';
  if(item.kind==='armor')return 'armor';
  if(item.kind==='boots')return 'boots';
  if(item.kind in PASSIVES)return 'accessory';
  return null;
}

export function enhancementQuote(state:GameState,itemId:string):EnhancementQuote|null {
  const item=state.items.find(x=>x.id===itemId);
  if(!item||item.id==='starter'||item.enhancement>=ENHANCEMENT_POLICY.maxEnhancement||!isEquipmentTier(item.tier))return null;
  const category=categoryOf(item);
  if(!category)return null;
  const current=item.enhancement as EnhancementAttemptLevel;
  const rule=enhancementRule(current);
  if(!rule)return null;
  const tier=item.tier as EquipmentTier;
  return {
    itemId:item.id,
    current,
    target:rule.to,
    silverCost:enhancementSilverCost(current,tier),
    materialTower:ENHANCEMENT_MATERIAL_BY_CATEGORY[category],
    materialTier:tier,
    materialCost:enhancementMaterialCost(current,tier),
    successRate:rule.successRate,
    failKeepRate:rule.failKeepRate,
    failDowngradeRate:rule.failDowngradeRate,
    failDestroyRate:rule.failDestroyRate,
  };
}

export function resolveEnhancementOutcome(level:EnhancementAttemptLevel,roll:number):EnhancementOutcome {
  if(!Number.isFinite(roll)||roll<0||roll>=1)throw Error('강화 확률 판정값이 올바르지 않습니다.');
  const rule=enhancementRule(level)!;
  const successEnd=rule.successRate;
  const keepEnd=successEnd+rule.failKeepRate;
  const downgradeEnd=keepEnd+rule.failDowngradeRate;
  if(roll<successEnd)return 'SUCCESS';
  if(roll<keepEnd)return 'FAIL_KEEP';
  if(roll<downgradeEnd)return 'FAIL_DOWNGRADE';
  return 'FAIL_DESTROYED';
}

function autoUnequip(state:GameState,itemId:string){
  for(const slot of Object.keys(state.equipped) as (keyof GameState['equipped'])[]){
    if(state.equipped[slot]===itemId)state.equipped[slot]=null;
  }
}

export function enhanceEquipment(state:GameState,itemId:string,rng:()=>number=random):GameState {
  if(state.expedition&&!ENHANCEMENT_POLICY.allowDuringExpedition)return {...state,notice:'원정 중에는 장비를 강화할 수 없습니다.'};
  const quote=enhancementQuote(state,itemId);
  const source=state.items.find(x=>x.id===itemId);
  if(!source)return {...state,notice:'강화할 장비를 찾을 수 없습니다.'};
  if(source.id==='starter'&&!ENHANCEMENT_POLICY.allowStarterEquipment)return {...state,notice:'지급용 장비는 강화할 수 없습니다.'};
  if(source.enhancement>=ENHANCEMENT_POLICY.maxEnhancement)return {...state,notice:'이미 최대 강화 단계입니다.'};
  if(!quote)return {...state,notice:'강화할 수 없는 장비입니다.'};

  const materialIndex=quote.materialTier-1;
  if(state.silver<quote.silverCost)return {...state,notice:'강화에 필요한 Silver가 부족합니다.'};
  if(state.materials[quote.materialTower][materialIndex]<quote.materialCost)return {...state,notice:'강화에 필요한 재료가 부족합니다.'};

  const s=structuredClone(state);
  const item=s.items.find(x=>x.id===itemId)!;
  s.silver-=quote.silverCost;
  s.materials[quote.materialTower][materialIndex]-=quote.materialCost;

  let outcome:EnhancementOutcome;
  try{outcome=resolveEnhancementOutcome(quote.current,rng());}
  catch{return state;}

  const before=item.enhancement;
  if(outcome==='SUCCESS'){
    item.enhancement=quote.target;
    s.notice=`강화 성공! ${itemName(item)}`;
    return s;
  }
  if(outcome==='FAIL_KEEP'){
    s.notice=`강화 실패. ${itemName(item)}의 강화 단계가 유지됩니다.`;
    return s;
  }
  if(outcome==='FAIL_DOWNGRADE'){
    item.enhancement=Math.max(0,before-ENHANCEMENT_POLICY.downgradeAmount) as EnhancementLevel;
    s.notice=`강화 실패. ${itemName(item)}로 강화 단계가 하락했습니다.`;
    return s;
  }

  const destroyedName=itemName(item);
  if(ENHANCEMENT_POLICY.autoUnequipDestroyedItem)autoUnequip(s,itemId);
  if(ENHANCEMENT_POLICY.destroyedItemRemovedPermanently)s.items=s.items.filter(x=>x.id!==itemId);
  s.notice=`강화 실패. ${destroyedName} 장비가 파괴되었습니다.`;
  return s;
}
