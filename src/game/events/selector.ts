import type {GameState} from '../types';
import {tierOf} from '../data/config';
import {stats} from '../engine/state';
import type {EventCondition,ExpeditionEventDefinition} from './types';
import {weighted,type Rng} from './rng';
// Provisional tuning only, not finalized game balance. Progress is a kill count.
export const EVENT_BALANCE={normalChance:.25,bossBaseChance:.03,bossChancePerKill:.02,bossMaxProgress:20,repeatWindow:1};
export function bossChance(progress:number,config=EVENT_BALANCE){return progress>=config.bossMaxProgress?1:Math.min(1,config.bossBaseChance+progress*config.bossChancePerKill);}
export function meetsCondition(s:GameState,c:EventCondition):boolean {const e=s.expedition;if(!e)return false;const hp=e.hp/stats(s,e.equipment).hp;switch(c.kind){
 case 'TOWER':return c.values.includes(e.tower);
 case 'TIER':return tierOf(e.floor)>=c.min&&tierOf(e.floor)<=c.max;
 case 'FLOOR':return e.floor>=c.min&&e.floor<=c.max;
 case 'BOSS_FLOOR':return (e.floor%10===0)===c.value;
 case 'FLOOR_TYPE':return (e.floor%10===0)===(c.value==='BOSS');
 case 'PLAYER_HP_BELOW':return hp<c.ratio;
 case 'PLAYER_HP_ABOVE':return hp>c.ratio;
 case 'HAS_ITEM':case 'MISSING_ITEM':{const q=(e.loot.items[c.itemId]??0)+(s.lootItems[c.itemId]??0)+s.items.filter(i=>i.id===c.itemId).length;return c.kind==='HAS_ITEM'?q>=(c.quantity??1):q<(c.quantity??1);}
 case 'CUSTOM':return false; // Future registered predicates fail closed.
 default:{const exhaustive:never=c;return exhaustive;}
}}
export const meetsConditions=(s:GameState,conditions:EventCondition[]=[])=>conditions.every(c=>meetsCondition(s,c));
export function eligible(s:GameState,d:ExpeditionEventDefinition){const e=s.expedition;return !!e&&(!d.towerIds||d.towerIds.includes(e.tower))&&(!d.tiers||d.tiers.includes(tierOf(e.floor)))&&(!d.floors||d.floors.includes(e.floor))&&(d.type!=='BOSS'||e.floor%10===0)&&meetsConditions(s,d.conditions);}
export function selectNormalEvent(s:GameState,catalog:ExpeditionEventDefinition[],rng:Rng){const recent=s.expedition?.events.recentEventIds??[];return weighted(catalog.filter(d=>d.type!=='BOSS'&&eligible(s,d)&&!recent.includes(d.id)),rng);}

export function selectBossEvent(s:GameState,catalog:ExpeditionEventDefinition[],rng:Rng){return weighted(catalog.filter(d=>d.type==='BOSS'&&eligible(s,d)),rng);}
