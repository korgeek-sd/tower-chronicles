import type {Potion,Tower} from '../types';
export type EventType='RECOVERY'|'SUPPLY'|'DISCOVERY'|'RISK'|'STATUS'|'SPECIAL'|'STRONGHOLD'|'BOSS';
export type ResourceStrongholdStatus='ACTIVE'|'CONTESTED'|'COMPLETED'|'ABANDONED'|'DELETED';
export interface ResourceStrongholdReward {tower:Tower;tier:number;materialAmount:number;silver:number}
export interface ResourceStrongholdRuntime {
 instanceId:string;status:ResourceStrongholdStatus;ownerUserId:string;tower:Tower;floor:number;version:number;
 captureStartedAt:number;captureEndsAt:number;reward:ResourceStrongholdReward;
 contestedByUserId:string|null;contestRemainingMs:number|null;
 completedAt:number|null;abandonedAt:number|null;deletedAt:number|null;
}
export type EventMode='production'|'test';
export type EventCondition=
 | {kind:'TOWER';values:Tower[]} | {kind:'TIER'|'FLOOR';min:number;max:number}
 | {kind:'BOSS_FLOOR';value:boolean} | {kind:'FLOOR_TYPE';value:'NORMAL'|'BOSS'}
 | {kind:'PLAYER_HP_BELOW'|'PLAYER_HP_ABOVE';ratio:number}
 | {kind:'HAS_ITEM'|'MISSING_ITEM';itemId:string;quantity?:number}
 | {kind:'CUSTOM';id:string};
export type EventEffect=
 | {kind:'HEAL_HP';ratio:number} | {kind:'ADD_POTION';potion:Potion;amount:number}
 | {kind:'ADD_EXPEDITION_SILVER';amount:number}
 | {kind:'ADD_TEMP_LOOT';loot:{kind:'MATERIAL';tower:Tower|'CURRENT';tier:number|'CURRENT';amount:number}|{kind:'ITEM';itemId:string;amount:number}}
 | {kind:'APPLY_EFFECT';effectId:string;scope:'BATTLE'|'EXPEDITION'}
 | {kind:'REMOVE_EFFECT';effectId:string} | {kind:'TAKE_DAMAGE';amount:number}
 | {kind:'START_BOSS_BATTLE'} | {kind:'START_RESOURCE_STRONGHOLD'} | {kind:'NO_EFFECT'};
export interface EventOutcome {id:string;weight:number;effects:EventEffect[];resultText:string}
export interface EventChoice {id:string;label:string;description?:string;icon?:string;effects:EventEffect[];conditions?:EventCondition[];outcomes?:EventOutcome[];resultText?:string;styleVariant?:'PRIMARY'|'SKIP'|'DANGER'}
export interface ExpeditionEventDefinition {id:string;type:EventType;title:string;description:string;imageAssetKey?:string;towerIds?:Tower[];tiers?:number[];floors?:number[];weight:number;conditions?:EventCondition[];choices:EventChoice[];rewardPreview?:{label:string;iconAssetKey?:string;note?:string}[];decisionMs?:number;metadata?:{fixture?:boolean}}
export interface PendingExpeditionEvent {instanceId:string;eventId:string;bossId:string|null;state:'CHOICE'|'RESULT';choiceId:string|null;outcomeId:string|null;resultText:string;resultLines:string[];next:'NORMAL'|'BOSS';randomValue:number;expiresAt?:number|null}
export interface ExpeditionEvents {phase:'BATTLE'|'POST_BATTLE'|'EVENT'|'EVENT_RESULT';mode:EventMode;pendingEvent:PendingExpeditionEvent|null;sequence:number;recentEventIds:string[];bossKillCountThisExpedition:number;activeBossId:string|null;stronghold?:ResourceStrongholdRuntime|null}
