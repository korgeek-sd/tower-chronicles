import {validEventExpedition} from '../game/events/validation';
import {upgradeEvents} from '../game/events/service';
import type {GameState,ExpeditionLoot,Tower,MarketOrder,MarketStorageEntry,MarketTrade} from '../game/types';
import {initialState,initialGearMastery,initialMarketState,initialAssociationState,initialCraftingState} from '../game/engine/state';
import {towerIds,potionIds,WEAPONS,EQUIPMENT,PASSIVES,GEAR_MASTERY_KEYS} from '../game/data/config';
import {COSMETICS_CATALOG,appearanceById,titleById,type CosmeticsCatalog} from '../game/data/cosmetics';
import {initialCosmetics} from '../game/engine/cosmetics';
import {bossById,bossIdFor,initialBossTracking} from '../game/engine/bossTracking';
import {initialPresets,PRESET_NAME_MAX_LENGTH} from '../game/engine/presets';
import {isValidJobId} from '../game/jobs/catalog';
import {createMonsterRuntime} from '../game/engine/monsterAi';
import {monsterFor} from '../game/engine/drops';
import {EFFECTS} from '../game/engine/effects';
import {BESTIARY_ENTRIES,bestiaryEntryById} from '../game/data/bestiary';
import {emptyBestiary} from '../game/engine/bestiary';
export interface StoragePort {getItem(key:string):string|null;setItem(key:string,value:string):void}
export const APP_VERSION='0.1.44';
export const SAVE_EXPORT_FORMAT='tower-chronicles-save';
export const SAVE_EXPORT_FORMAT_VERSION=1;
// Keep the original key so an existing file/browser origin finds its save.
export const SAVE_KEY='tower-record-v1';
export const LEGACY_BACKUP_KEY='tower-record-v1-before-loot-v2';
export const MASTERY_BACKUP_KEY='tower-record-v1-before-mastery-v3';
export const SILVER_BACKUP_KEY='tower-record-v1-before-silver-v4';
export const COSMETICS_BACKUP_KEY='tower-record-v1-before-cosmetics-v5';
export const BOSS_TRACKING_BACKUP_KEY='tower-record-v1-before-boss-tracking-v6';
export const PRESETS_BACKUP_KEY='tower-record-v1-before-presets-v7';
export const GOLDEN_RECORDER_BACKUP_KEY='tower-record-v1-before-golden-recorder-v8';
export const MARKET_BACKUP_KEY='tower-record-v1-before-market-v9';
export const ASSOCIATION_BACKUP_KEY='tower-record-v1-before-association-v10';
export const CRAFTING_BACKUP_KEY='tower-record-v1-before-crafting-v11';
export const BESTIARY_BACKUP_KEY='tower-record-v1-before-bestiary-v22';
export const IMPORT_BACKUP_KEY='tower-record-v1-before-manual-import';
type Obj=Record<string,unknown>;
const obj=(x:unknown):x is Obj=>!!x&&typeof x==='object'&&!Array.isArray(x);
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
const count=(x:unknown):x is number=>finite(x)&&Number.isSafeInteger(x)&&x>=0;
const positive=(x:unknown):x is number=>finite(x)&&x>0;
const strings=(x:unknown):x is string[]=>Array.isArray(x)&&x.every(v=>typeof v==='string');
const numbers=(x:unknown,n:number)=>Array.isArray(x)&&x.length===n&&x.every(count);
const record=(x:unknown)=>obj(x)&&Object.entries(x).every(([k,v])=>!['__proto__','prototype','constructor'].includes(k)&&count(v));
const matrix=(x:unknown,n:number)=>obj(x)&&towerIds.every(t=>numbers(x[t],n));
const legacyPotionIds=['health','regen','attack','defense','haste'] as const;
const currentBag=(x:unknown)=>obj(x)&&potionIds.every(p=>count(x[p]))&&Object.keys(x).every(k=>potionIds.includes(k as any));
const legacyBag=(x:unknown)=>obj(x)&&legacyPotionIds.every(p=>count(x[p]));
const bag=(x:unknown)=>currentBag(x)||legacyBag(x);
const tower=(x:unknown)=>typeof x==='string'&&towerIds.includes(x as typeof towerIds[number]);
const floor=(x:unknown)=>count(x)&&x>=1&&x<=50;
function historicalLoot(x:unknown,currency:'gold'|'silver'='gold'):boolean {
  return obj(x)&&(currency!=='silver'||!('gold' in x))&&count(x[currency])&&matrix(x.materials,5)&&matrix(x.tickets,50)&&record(x.skillBooks)&&record(x.items);
}
export function validLoot(x:unknown):x is ExpeditionLoot {return historicalLoot(x,'silver');}
function validEquipment(x:unknown){return obj(x)&&['weapon','armor','boots','accessory'].every(k=>x[k]===null||typeof x[k]==='string');}
const validItem=(i:unknown)=>obj(i)&&typeof i.id==='string'&&typeof i.kind==='string'&&(i.kind in WEAPONS||i.kind in EQUIPMENT||i.kind in PASSIVES)&&count(i.tier)&&i.tier>=1&&i.tier<=5&&[0,1,2,3].includes(i.enhancement as number);
const historicalBossMatches=(pending:string,towerId:Tower,floorNumber:number)=>pending===bossIdFor(towerId,floorNumber)||(towerId==='ore'&&floorNumber===10&&pending==='mining_ogre');
function validBossTracking(x:unknown,towerId:Tower,floorNumber:number):boolean {if(!obj(x)||!count(x.progress)||x.progress>100||typeof x.bossDefeated!=='boolean')return false;const pending=x.pendingBossId,reason=x.encounterReason;if(pending===null){if(reason!==null)return false;}else if(typeof pending!=='string'||!bossById(pending)?.boss||!historicalBossMatches(pending,towerId,floorNumber)||!['early','max'].includes(reason as string)||(reason==='max'&&x.progress!==100)||(reason==='early'&&x.progress>=100))return false;if(!bossIdFor(towerId,floorNumber)&&(x.progress!==0||pending!==null||x.bossDefeated))return false;if(x.bossDefeated&&pending!==null)return false;return true;}
function validExpedition(x:unknown,legacy=false,v3=false,currency:'gold'|'silver'='gold',boss=false):boolean {
  if(x===null)return true;
  if(!obj(x)||!tower(x.tower)||!floor(x.floor)||!finite(x.hp)||!bag(x.bag)||!count(x.kills))return false;
  if(!['time','playerTimer','enemyTimer','spawnAt'].every(k=>finite(x[k])&&(x[k] as number)>=0))return false;
  if(!obj(x.cooldowns)||!Object.values(x.cooldowns).every(finite)||!obj(x.buffs)||!Object.values(x.buffs).every(finite))return false;
  const m=x.monster;
  if(!obj(m)||typeof m.name!=='string'||!positive(m.hp)||!finite(m.currentHp)||!finite(m.attack)||!finite(m.defense)||!positive(m.speed))return false;
  if(v3&&(!validEquipment(x.equipment)||typeof x.returnRequested!=='boolean'))return false;
  if(boss&&!validBossTracking(x.bossTracking,x.tower as Tower,x.floor as number))return false;
  return legacy?count(x.gold)&&count(x.material):historicalLoot(x.loot,currency);
}
function validResult(x:unknown,currency:'gold'|'silver'='gold'):boolean {
  return x===null||(obj(x)&&['returned','dead'].includes(x.outcome as string)&&tower(x.tower)&&floor(x.floor)&&finite(x.time)&&x.time>=0&&count(x.kills)&&historicalLoot(x.loot,currency)&&bag(x.remainingPotions));
}
function validBase(x:unknown,legacy=false,v3=false,currency:'gold'|'silver'='gold',boss=false):x is Obj {
  if(!obj(x)||(currency==='silver'&&'gold' in x)||!count(x[currency])||!matrix(x.materials,5)||!matrix(x.tickets,50)||!bag(x.potions)||!bag(x.loadout))return false;
  if(!strings(x.learned)||!Array.isArray(x.skills)||x.skills.length!==3||!x.skills.every(v=>v===null||typeof v==='string'))return false;
  if(!validEquipment(x.equipped))return false;
  if(!Array.isArray(x.items)||!x.items.every(validItem))return false;
  if(!obj(x.mastery)||!['weapon','armor','accessory','alchemy'].every(k=>{const m=(x.mastery as Obj)[k];return obj(m)&&count(m.unlocked)&&m.unlocked>=1&&m.unlocked<=5&&count(m.progress)&&count(m.crafts);} ))return false;
  return obj(x.progress)&&towerIds.every(t=>floor((x.progress as Obj)[t]))&&[0,30,50,70].includes(x.threshold as number)&&strings(x.logs)&&typeof x.notice==='string'&&count(x.nextId)&&validExpedition(x.expedition,legacy,v3,currency,boss);
}
function validGearMastery(x:unknown){return obj(x)&&GEAR_MASTERY_KEYS.every(k=>{const m=x[k];return obj(m)&&count(m.unlockedTier)&&m.unlockedTier>=1&&m.unlockedTier<=5&&count(m.progress);});}
function validV2(x:unknown){return validBase(x)&&x.version===2&&record(x.skillBooks)&&record(x.lootItems)&&validResult(x.lastExpedition);}
export function validV3(x:unknown):x is Obj {
  return validBase(x,false,true)&&x.version===3&&record(x.skillBooks)&&record(x.lootItems)&&validResult(x.lastExpedition)&&validGearMastery(x.gearMastery);
}
export function validV4(x:unknown):x is Obj {
 return validBase(x,false,true,'silver')&&x.version===4&&record(x.skillBooks)&&record(x.lootItems)&&validResult(x.lastExpedition,'silver')&&validGearMastery(x.gearMastery);
}
function uniqueStrings(x:unknown):x is string[]{return strings(x)&&new Set(x).size===x.length;}
export function validCosmetics(x:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):boolean {
 if(!obj(x)||!uniqueStrings(x.unlockedAppearanceIds)||!uniqueStrings(x.unlockedTitleIds)||!record(x.appearanceItems)||typeof x.selectedAppearanceId!=='string')return false;
 if(!x.unlockedAppearanceIds.includes(x.selectedAppearanceId)||!appearanceById(x.selectedAppearanceId,catalog))return false;
 if(!x.unlockedAppearanceIds.every(id=>!!appearanceById(id,catalog))||!Object.keys(x.appearanceItems as Obj).every(id=>!!appearanceById(id,catalog)))return false;
 if(!x.unlockedTitleIds.every(id=>!!titleById(id,catalog)))return false;
 return x.selectedTitleId===null||(typeof x.selectedTitleId==='string'&&x.unlockedTitleIds.includes(x.selectedTitleId)&&!!titleById(x.selectedTitleId,catalog));
}
function validV5(x:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):x is Obj {
 return validBase(x,false,true,'silver')&&x.version===5&&record(x.skillBooks)&&record(x.lootItems)&&validResult(x.lastExpedition,'silver')&&validGearMastery(x.gearMastery)&&validCosmetics(x.cosmetics,catalog);
}
function validV6(x:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):x is Obj {return validBase(x,false,true,'silver',true)&&x.version===6&&record(x.skillBooks)&&record(x.lootItems)&&validResult(x.lastExpedition,'silver')&&validGearMastery(x.gearMastery)&&validCosmetics(x.cosmetics,catalog);}
function validPreset(x:unknown):boolean {return x===null||(obj(x)&&typeof x.name==='string'&&x.name===x.name.trim()&&x.name.length>=1&&x.name.length<=PRESET_NAME_MAX_LENGTH&&validEquipment(x.equipment)&&Array.isArray(x.skills)&&x.skills.length===3&&x.skills.every(v=>v===null||typeof v==='string')&&bag(x.potions)&&[0,30,50,70].includes(x.threshold as number));}
function validV7(x:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):x is Obj {return validBase(x,false,true,'silver',true)&&x.version===7&&Array.isArray(x.expeditionPresets)&&x.expeditionPresets.length===5&&x.expeditionPresets.every(validPreset)&&record(x.skillBooks)&&record(x.lootItems)&&validResult(x.lastExpedition,'silver')&&validGearMastery(x.gearMastery)&&validCosmetics(x.cosmetics,catalog);}
const validGoldenRecorder=(x:unknown)=>obj(x)&&(x.expiresAt===null||(finite(x.expiresAt)&&x.expiresAt>=0));
const validMarketOrder=(x:unknown):x is MarketOrder=>obj(x)&&typeof x.orderId==='string'&&typeof x.itemId==='string'&&['BUY','SELL'].includes(x.side as string)&&positive(x.limitPrice)&&count(x.originalQuantity)&&x.originalQuantity>0&&count(x.remainingQuantity)&&x.remainingQuantity<=x.originalQuantity&&typeof x.ownerId==='string'&&finite(x.createdAt)&&count(x.sequence)&&x.sequence>0&&['OPEN','PARTIAL','FILLED','CANCELLED'].includes(x.status as string)&&(x.gear===undefined||validItem(x.gear))&&(!obj(x.gear)||(x.side==='SELL'&&x.itemId==='gear:'+String(x.gear.id)&&x.originalQuantity===1&&x.remainingQuantity<=1));
const validMarketTrade=(x:unknown):x is MarketTrade=>obj(x)&&['tradeId','itemId','buyOrderId','sellOrderId','buyerId','sellerId'].every(k=>typeof x[k]==='string')&&positive(x.price)&&count(x.quantity)&&x.quantity>0&&finite(x.executedAt)&&count(x.sequence)&&x.sequence>0;
const validMarketStorageEntry=(x:unknown):x is MarketStorageEntry=>obj(x)&&typeof x.storageId==='string'&&typeof x.tradeId==='string'&&['BUY','SELL'].includes(x.side as string)&&typeof x.itemId==='string'&&count(x.quantity)&&x.quantity>0&&count(x.silver)&&finite(x.createdAt)&&(x.gear===undefined||validItem(x.gear))&&(x.side!=='BUY'||!x.itemId.startsWith('gear:')||obj(x.gear));
const validMarket=(x:unknown)=>obj(x)&&typeof x.traderCertified==='boolean'&&typeof x.ownerId==='string'&&x.ownerId.length>0&&count(x.gold)&&Array.isArray(x.orders)&&x.orders.every(validMarketOrder)&&new Set(x.orders.map(o=>o.orderId)).size===x.orders.length&&Array.isArray(x.trades)&&x.trades.every(validMarketTrade)&&new Set(x.trades.map(t=>t.tradeId)).size===x.trades.length&&(x.storage===undefined||(Array.isArray(x.storage)&&x.storage.every(validMarketStorageEntry)&&new Set(x.storage.map(e=>e.storageId)).size===x.storage.length))&&(x.nextStorageId===undefined||(count(x.nextStorageId)&&x.nextStorageId>=1))&&['nextOrderId','nextTradeId','nextSequence'].every(k=>count(x[k])&&x[k]>=1);
function validV8(x:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):boolean {return validBase(x,false,true,'silver',true)&&x.version===8&&validGoldenRecorder(x.goldenRecorder)&&Array.isArray(x.expeditionPresets)&&x.expeditionPresets.length===5&&x.expeditionPresets.every(validPreset)&&record(x.skillBooks)&&record(x.lootItems)&&validResult(x.lastExpedition,'silver')&&validGearMastery(x.gearMastery)&&validCosmetics(x.cosmetics,catalog);}
function validV9(x:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):boolean{return obj(x)&&x.version===9&&validMarket(x.market)&&validV8({...x,version:8},catalog);}
const validMember=(x:unknown)=>obj(x)&&typeof x.playerId==='string'&&x.playerId.length>0&&['LEADER','MEMBER'].includes(x.role as string)&&finite(x.joinedAt);
const validApplication=(x:unknown)=>obj(x)&&typeof x.applicationId==='string'&&typeof x.associationId==='string'&&typeof x.applicantId==='string'&&finite(x.createdAt)&&['PENDING','ACCEPTED','REJECTED'].includes(x.status as string);
const validAssociation=(x:unknown)=>obj(x)&&(x.currentId===null||typeof x.currentId==='string')&&Array.isArray(x.associations)&&count(x.nextId)&&x.nextId>=1&&count(x.nextApplicationId)&&x.nextApplicationId>=1&&x.associations.every(a=>obj(a)&&typeof a.associationId==='string'&&typeof a.recordNumber==='string'&&typeof a.name==='string'&&typeof a.description==='string'&&typeof a.leaderId==='string'&&finite(a.createdAt)&&typeof a.notice==='string'&&(a.noticeUpdatedAt===null||finite(a.noticeUpdatedAt))&&['OPEN','APPROVAL','CLOSED'].includes(a.joinPolicy as string)&&['ACTIVE','DISBANDED'].includes(a.status as string)&&Array.isArray(a.members)&&a.members.every(validMember)&&a.members.filter(m=>(m as Obj).role==='LEADER').length===1&&a.members.some(m=>(m as Obj).playerId===a.leaderId)&&Array.isArray(a.applications)&&a.applications.every(validApplication)&&Array.isArray(a.activityLog)&&a.activityLog.every(e=>obj(e)&&finite(e.at)&&typeof e.text==='string'));
function validV10(x:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):boolean{return obj(x)&&x.version===10&&validAssociation(x.association)&&validV9({...x,version:9},catalog);}
const validCrafting=(x:unknown)=>obj(x)&&count(x.nextJobId)&&x.nextJobId>=1&&Array.isArray(x.jobs)&&x.jobs.filter(j=>obj(j)&&['QUEUED','CRAFTING','COMPLETED_UNCLAIMED','CANCELLED'].includes(j.status as string)).length===x.jobs.length;
function validV11(x:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):boolean{return obj(x)&&x.version===11&&validCrafting(x.crafting)&&validV10({...x,version:10},catalog);}
function validV13(x:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):boolean{return obj(x)&&x.version===13&&validExploration(x.exploration)&&validCrafting(x.crafting)&&validV10({...x,version:10},catalog);}
const validTurnExpedition=(x:unknown)=>x===null||(obj(x)&&['PLAYER_TURN','MONSTER_TURN','BATTLE_END'].includes(x.phase as string)&&count(x.playerTurn)&&x.playerTurn>=1&&count(x.monsterTurn)&&typeof x.pendingFlee==='boolean');
const validEffects=(x:unknown)=>Array.isArray(x)&&x.every(effect=>{if(!obj(effect)||typeof effect.instanceId!=='string'||typeof effect.effectId!=='string'||!['player','monster'].includes(effect.sourceActorId as string)||!['player','monster'].includes(effect.targetActorId as string)||!count(effect.remainingDuration)||!count(effect.stackCount)||!count(effect.applicationSequence)||!count(effect.createdTurn))return false;const definition=EFFECTS[effect.effectId],shield=definition?.behavior==='SHIELD';if(!shield)return !('currentShield' in effect)&&!('currentShieldHits' in effect);if(definition.shieldHits)return positive(effect.currentShieldHits)&&effect.currentShieldHits<=definition.shieldHits&&!('currentShield' in effect);return positive(effect.currentShield)&&effect.currentShield<=Number(definition.shieldAmount)&&!('currentShieldHits' in effect);});
const validEffectExpedition=(x:unknown)=>x===null||(obj(x)&&validEffects(x.playerEffects)&&validEffects(x.monsterEffects)&&validEffects(x.preparedEffects)&&count(x.effectSequence));
function validV15(x:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):boolean{return obj(x)&&x.version===15&&validTurnExpedition(x.expedition)&&validEffectExpedition(x.expedition)&&validV13({...x,version:13},catalog);}
const validJobRuntime=(x:unknown)=>obj(x)&&(x.jobId===null||isValidJobId(x.jobId))&&Array.isArray(x.passiveIds)&&[0,2].includes(x.passiveIds.length)&&strings(x.passiveIds)&&Array.isArray(x.activeSkillIds)&&[0,3].includes(x.activeSkillIds.length)&&strings(x.activeSkillIds)&&(x.resource===null||(obj(x.resource)&&typeof x.resource.id==='string'&&finite(x.resource.value)&&(x.resource.maxValue===undefined||finite(x.resource.maxValue))));
const validJobExpedition=(x:unknown)=>x===null||(obj(x)&&(x.jobSnapshotId===null||isValidJobId(x.jobSnapshotId))&&validJobRuntime(x.jobRuntime));
function validV16(x:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):boolean {return obj(x)&&x.version===16&&uniqueStrings(x.ownedJobIds)&&x.ownedJobIds.every(isValidJobId)&&(x.currentJobId===null||(isValidJobId(x.currentJobId)&&x.ownedJobIds.includes(x.currentJobId)))&&validJobExpedition(x.expedition)&&validV15({...x,version:15},catalog);}
function validV17(x:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):boolean {if(!obj(x)||x.version!==17||!validEventExpedition(x.expedition))return false;const e=x.expedition;return validV16({...x,version:16,expedition:e?{...e,bossTracking:{...e.bossTracking,progress:0,pendingBossId:null,encounterReason:null}}:null},catalog);}
export const EVENTS_BACKUP_KEY='tower-record-v1-before-events-v17';
export function migrateV16(value:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):GameState {const compatible=padTickets(value);if(!validV16(compatible,catalog))throw Error('v16 저장 데이터를 안전하게 이전할 수 없습니다.');const next:any=structuredClone(compatible);next.version=17;if(next.expedition)upgradeEvents(next.expedition);if(!validV17(next,catalog))throw Error('원정 이벤트 저장 데이터 이전 검증에 실패했습니다.');return migrateV17(next,catalog);}
const validMonsterRuntime=(x:unknown)=>obj(x)&&typeof x.definitionId==='string'&&x.definitionId.length>0&&obj(x.skillCooldowns)&&Object.values(x.skillCooldowns).every(count)&&(x.preparedActionId===null||typeof x.preparedActionId==='string')&&count(x.turnNumber);
const validMonsterRuntimeExpedition=(x:unknown)=>x===null||(obj(x)&&obj(x.events)&&((x.events.phase==='BATTLE'&&validMonsterRuntime(x.monsterRuntime))||(x.events.phase!=='BATTLE'&&x.monsterRuntime===null)));
function validV18(x:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):boolean {if(!obj(x)||x.version!==18||!validEventExpedition(x.expedition)||!validMonsterRuntimeExpedition(x.expedition))return false;const e=x.expedition;return validV16({...x,version:16,expedition:e?{...e,bossTracking:{...e.bossTracking,progress:0,pendingBossId:null,encounterReason:null}}:null},catalog);}
export const MONSTER_RUNTIME_BACKUP_KEY='tower-record-v1-before-monster-runtime-v18';
export function migrateV17(value:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):GameState {const compatible=padTickets(value);if(!validV17(compatible,catalog))throw Error('v17 저장 데이터를 안전하게 이전할 수 없습니다.');const next:any=structuredClone(compatible);next.version=18;if(next.expedition)next.expedition.monsterRuntime=next.expedition.events.phase==='BATTLE'?createMonsterRuntime(next.expedition.monster,next.expedition.monsterTurn):null;if(!validV18(next,catalog))throw Error('몬스터 전투 런타임 저장 데이터 이전 검증에 실패했습니다.');return migrateV18(next,catalog);}
const validReactiveRuntime=(x:unknown)=>x===null||(obj(x)&&typeof x.definitionId==='string'&&x.definitionId.length>0&&typeof x.prepareSkillId==='string'&&x.prepareSkillId.length>0&&typeof x.reactionSkillId==='string'&&x.reactionSkillId.length>0&&x.trigger==='DIRECT_HIT_RECEIVED');
const validReactiveExpedition=(x:unknown)=>x===null||(obj(x)&&obj(x.events)&&obj(x.reactivePrepared)&&validReactiveRuntime(x.reactivePrepared.player)&&validReactiveRuntime(x.reactivePrepared.monster)&&(x.events.phase==='BATTLE'||(x.reactivePrepared.player===null&&x.reactivePrepared.monster===null)));
function validV19(x:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):boolean {if(!obj(x)||x.version!==19||!validEventExpedition(x.expedition)||!validMonsterRuntimeExpedition(x.expedition)||!validReactiveExpedition(x.expedition))return false;const e=x.expedition;return validV16({...x,version:16,expedition:e?{...e,bossTracking:{...e.bossTracking,progress:0,pendingBossId:null,encounterReason:null}}:null},catalog);}
const validContinuationStep=(x:unknown)=>obj(x)&&((x.kind==='SKILL_EFFECTS'&&['player','monster'].includes(x.actor as string)&&Array.isArray(x.effects)&&x.effects.every(v=>obj(v)&&typeof v.effectId==='string'&&!!EFFECTS[v.effectId]&&['SELF','TARGET'].includes(v.target as string)))||['AFTER_PLAYER_ACTION','AFTER_PLAYER_PERIODIC','AFTER_MONSTER_ACTION','AFTER_EVENT_RESULT'].includes(x.kind as string)||(x.kind==='DIRECT_HITS'&&['player','monster'].includes(x.attacker as string)&&count(x.remainingHits)&&x.remainingHits>0&&finite(x.multiplier)&&x.multiplier>=0&&typeof x.allowReactive==='boolean'&&(!('defenseDivisor' in x)||(finite(x.defenseDivisor)&&Number(x.defenseDivisor)>=1))));
const validPendingRevival=(x:unknown)=>x===null||(obj(x)&&['DIRECT_HIT','PERIODIC_DAMAGE','EVENT_DAMAGE'].includes(x.source as string)&&Array.isArray(x.steps)&&x.steps.length>0&&x.steps.length<=32&&x.steps.every(validContinuationStep)&&obj(x.steps[x.steps.length-1])&&['AFTER_PLAYER_ACTION','AFTER_PLAYER_PERIODIC','AFTER_MONSTER_ACTION','AFTER_EVENT_RESULT'].includes(x.steps[x.steps.length-1].kind));
function validPotionGraph(x:Obj){if(!currentBag(x.potions)||!currentBag(x.loadout))return false;if(obj(x.expedition)&&(!currentBag(x.expedition.bag)||!validPendingRevival(x.expedition.pendingRevival)))return false;if(obj(x.lastExpedition)&&!currentBag(x.lastExpedition.remainingPotions))return false;if(!Array.isArray(x.expeditionPresets)||!x.expeditionPresets.every(p=>p===null||(obj(p)&&currentBag(p.potions))))return false;if(obj(x.expedition)){const e=x.expedition,p=e.pendingRevival;if(obj(p)){if(e.hp!==0||!obj(e.bag)||e.bag.revival!==1||!obj(e.events))return false;if(p.source==='EVENT_DAMAGE'?e.events.phase!=='EVENT_RESULT':e.events.phase!=='BATTLE')return false;}if(obj(e.bag)&&Number(e.bag.revival)>1)return false;}return true;}
function validV20(x:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):boolean {if(!obj(x)||x.version!==20||!validPotionGraph(x)||!validEventExpedition(x.expedition)||!validMonsterRuntimeExpedition(x.expedition)||!validReactiveExpedition(x.expedition))return false;const e=x.expedition;return validV16({...x,version:16,expedition:e?{...e,bossTracking:{...e.bossTracking,progress:0,pendingBossId:null,encounterReason:null}}:null},catalog);}
/** The v20 validator is reused for structural checks and expects 50 ticket slots.
 * Pad every persisted ticket bag (including an active expedition) only for that
 * validation pass; the actual v21 save always remains a 10-slot save. */
function padTickets(value:unknown):unknown {if(!obj(value))return value;const pad=(tickets:unknown)=>{if(!obj(tickets))return tickets;const next={...tickets};for(const t of towerIds){const row=next[t];if(Array.isArray(row)&&row.length===10)next[t]=[...row,...Array(40).fill(0)];}return next;};const next:any={...value,tickets:pad(value.tickets)};if(obj(value.expedition))next.expedition={...value.expedition,loot:{...(value.expedition.loot as Obj),tickets:pad((value.expedition.loot as Obj)?.tickets)}};if(obj(value.lastExpedition))next.lastExpedition={...value.lastExpedition,loot:{...(value.lastExpedition.loot as Obj),tickets:pad((value.lastExpedition.loot as Obj)?.tickets)}};return next;}
const validCombatEvents=(state:Obj)=>{if(state.combatEvents===undefined&&state.combatEventSequence===undefined)return true;if(!Array.isArray(state.combatEvents)||state.combatEvents.length>40||!count(state.combatEventSequence))return false;let previous=0;for(const event of state.combatEvents){if(!obj(event)||!count(event.id)||event.id<=previous||event.id>Number(state.combatEventSequence)||event.kind!=='DIRECT_DAMAGE'||!['player','monster'].includes(event.attacker as string)||!['player','monster'].includes(event.target as string)||event.attacker===event.target||!count(event.hitIndex)||!count(event.hitCount)||event.hitIndex>event.hitCount||!finite(event.incomingDamage)||event.incomingDamage<0||!finite(event.absorbedByShield)||event.absorbedByShield<0||!finite(event.hpDamage)||event.hpDamage<0||typeof event.critical!=='boolean')return false;previous=event.id as number;}return true;};
function validV21(x:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):boolean {if(!obj(x)||x.version!==21)return false;const state=x as Obj,tickets=state.tickets,progress=state.progress;if(!obj(tickets)||!towerIds.every(t=>numbers(tickets[t],10))||!obj(progress)||!towerIds.every(t=>floor21(progress[t]))||!validResult21(state.lastExpedition)||!validExpedition21(state.expedition)||!validCombatEvents(state))return false;const padded=padTickets(state);return obj(padded)&&validV20({...padded,version:20},catalog);}
const floor21=(x:unknown)=>count(x)&&x>=1&&x<=10;
function validResult21(x:unknown):boolean{if(x===null)return true;if(!obj(x))return false;const result=x as Obj,loot=result.loot;if(!obj(loot)||!obj(loot.tickets))return false;const tickets=loot.tickets as Obj;return floor21(result.floor)&&towerIds.every(t=>numbers(tickets[t],10));}
function validExpedition21(x:unknown):boolean{if(x===null)return true;if(!obj(x))return false;const expedition=x as Obj,loot=expedition.loot;if(!obj(loot)||!obj(loot.tickets))return false;const tickets=loot.tickets as Obj;return floor21(expedition.floor)&&towerIds.every(t=>numbers(tickets[t],10));}
const BESTIARY_IDS=new Set(BESTIARY_ENTRIES.map(entry=>entry.id));
export function validBestiary(x:unknown):boolean {
 if(!obj(x)||!obj(x.entries))return false;
 return Object.entries(x.entries).every(([id,value])=>BESTIARY_IDS.has(id)&&obj(value)&&count(value.encounters)&&count(value.defeats)&&Number(value.defeats)<=Number(value.encounters));
}
function validV22(x:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):boolean {
 if(!obj(x)||x.version!==22||!validBestiary(x.bestiary))return false;
 return validV21({...x,version:21},catalog);
}
export function validSave(x:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):x is GameState {return validV22(x,catalog);}
export function migrateV21(value:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):GameState {
 if(!validV21(value,catalog))throw Error('v21 저장 데이터를 안전하게 이전할 수 없습니다.');
 const next:any=structuredClone(value);
 next.version=22;
 next.bestiary=emptyBestiary();
 const id=next.expedition?.monster?.definitionId;
 if(typeof id==='string'&&bestiaryEntryById(id))next.bestiary.entries[id]={encounters:1,defeats:0};
 if(!validV22(next,catalog))throw Error('탐사 생물록 저장 데이터 이전 검증에 실패했습니다.');
 return next;
}
export const COMBAT_TRIGGERS_BACKUP_KEY='tower-record-v1-before-combat-triggers-v19';
export const POTION_OVERHAUL_BACKUP_KEY='tower-record-v1-before-potions-v20';
export function migrateV18(value:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):GameState {const compatible=padTickets(value);if(!validV18(compatible,catalog))throw Error('v18 저장 데이터를 안전하게 이전할 수 없습니다.');const next:any=structuredClone(compatible);next.version=19;if(next.expedition)next.expedition.reactivePrepared={player:null,monster:null};if(!validV19(next,catalog))throw Error('전투 트리거 저장 데이터 이전 검증에 실패했습니다.');return migrateV19(next,catalog);}
function migratePotionBag(value:any){if(currentBag(value))return value;return {healing_lesser:(value?.health??0)+(value?.attack??0)+(value?.defense??0)+(value?.haste??0),healing_standard:value?.regen??0,healing_greater:0,healing_supreme:0,revival:0};}
const legacyPotionMap:Record<string,string>={health:'healing_lesser',regen:'healing_standard',attack:'healing_lesser',defense:'healing_lesser',haste:'healing_lesser'};
export function migrateV19(value:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):GameState {const compatible=padTickets(value);if(!validV19(compatible,catalog))throw Error('v19 저장 데이터를 안전하게 이전할 수 없습니다.');const next:any=structuredClone(compatible);next.version=20;next.potions=migratePotionBag(next.potions);next.loadout=migratePotionBag(next.loadout);for(const preset of next.expeditionPresets??[])if(preset)preset.potions=migratePotionBag(preset.potions);if(next.lastExpedition)next.lastExpedition.remainingPotions=migratePotionBag(next.lastExpedition.remainingPotions);if(next.expedition){next.expedition.bag=migratePotionBag(next.expedition.bag);next.expedition.pendingRevival=null;}for(const job of next.crafting?.jobs??[]){const mapped=legacyPotionMap[job.kind];if(mapped){job.kind=mapped;job.itemId=mapped;job.recipeId=String(job.recipeId).replace(/^(health|regen|attack|defense|haste)-/,mapped+'-');}}if(!validV20(next,catalog))throw Error('포션 개편 저장 데이터 이전 검증에 실패했습니다.');return migrateV20(next,catalog);}
export const TOWER_STRUCTURE_BACKUP_KEY='tower-record-v1-before-tower-structure-v21';
/** Floors 11–50 no longer exist. Fold their unused ticket value into floor 10
 * instead of silently deleting permanent inventory during the one-way migration. */
const trimTickets=(row:unknown)=>{const source=Array.isArray(row)?row:[];const next=Array.from({length:10},(_,index)=>Number(source[index]??0));for(let index=10;index<source.length;index++)next[9]+=Number(source[index]??0);return next;};
/** v20's 50-floor progress becomes the final available 10F state; permanent wealth remains intact. */
export function migrateV20(value:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):GameState {const compatible=padTickets(value);if(!validV20(compatible,catalog))throw Error('v20 저장 데이터를 안전하게 이전할 수 없습니다.');const next:any=structuredClone(compatible);next.version=21;for(const t of towerIds){next.tickets[t]=trimTickets(next.tickets[t]);next.progress[t]=Math.min(10,Math.max(1,next.progress[t]));next.exploration.highestReturned[t]=Math.min(10,next.exploration.highestReturned[t]);next.exploration.unlockedTier[t]=1;}const normalizeLoot=(loot:any)=>{if(loot?.tickets)for(const t of towerIds)loot.tickets[t]=trimTickets(loot.tickets[t]);};normalizeLoot(next.lastExpedition?.loot);if(next.lastExpedition)next.lastExpedition.floor=Math.min(10,next.lastExpedition.floor);if(next.expedition){const e=next.expedition,wasBeyondFinalFloor=e.floor>10;e.floor=Math.min(10,e.floor);normalizeLoot(e.loot);if(wasBeyondFinalFloor){e.bossTracking=initialBossTracking();e.monster=monsterFor(e.tower,e.floor);e.monsterRuntime=createMonsterRuntime(e.monster,e.monsterTurn);}}if(!validV21(next,catalog))throw Error('10층 탑 구조 저장 데이터 이전 검증에 실패했습니다.');return migrateV21(next,catalog);}
export function migrateV8(value:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):any {if(!validV8(value,catalog))throw Error('v8 저장 데이터를 안전하게 이전할 수 없습니다.');const next={...(structuredClone(value) as Obj),version:9,market:initialMarketState()};if(!validV9(next,catalog))throw Error('거래소 저장 데이터 이전 검증에 실패했습니다.');return next;}
export function migrateV9(value:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):any {if(!validV9(value,catalog))throw Error('v9 저장 데이터를 안전하게 이전할 수 없습니다.');const next={...(structuredClone(value) as Obj),version:10,association:initialAssociationState()};if(!validV10(next,catalog))throw Error('조합 저장 데이터 이전 검증에 실패했습니다.');return next;}
export function migrateV10(value:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):any {if(!validV10(value,catalog))throw Error('v10 저장 데이터를 안전하게 이전할 수 없습니다.');const next={...(structuredClone(value) as Obj),version:11,crafting:initialCraftingState()};if(!validV11(next,catalog))throw Error('제작 저장 데이터 이전 검증에 실패했습니다.');return next as unknown as GameState;} export function migrateV11(value:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):GameState{if(!validV11(value,catalog))throw Error('v11 저장 데이터를 안전하게 이전할 수 없습니다.');const next:any={...(structuredClone(value) as Obj),version:12};for(const a of next.association.associations){a.revenueShareRatePercent??=0;a.treasurySilver??=0;a.treasuryLedger??=[];}return next as GameState;}
export function migrateV7(value:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):any {if(!validV7(value,catalog))throw Error('v7 저장 데이터를 안전하게 이전할 수 없습니다.');const next={...structuredClone(value),version:8,goldenRecorder:{expiresAt:null}};if(!validV8(next,catalog))throw Error('황금기록자 저장 데이터 이전 검증에 실패했습니다.');return next;}
export function migrateV6(value:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):Obj {if(!validV6(value,catalog))throw Error('v6 저장 데이터를 안전하게 이전할 수 없습니다.');const next={...structuredClone(value),version:7,expeditionPresets:initialPresets()};if(!validV7(next,catalog))throw Error('프리셋 저장 데이터 이전 검증에 실패했습니다.');return next;}
export function migrateV5(value:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):Obj {if(!validV5(value,catalog))throw Error('v5 저장 데이터를 안전하게 이전할 수 없습니다.');const old=structuredClone(value),expedition=obj(old.expedition)?{...old.expedition,bossTracking:initialBossTracking()}:null,next={...old,version:6,expedition};if(!validV6(next,catalog))throw Error('보스 추적 저장 데이터 이전 검증에 실패했습니다.');return next;}
export function migrateV4(value:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):Obj {
 if(!validV4(value))throw Error('v4 저장 데이터를 안전하게 이전할 수 없습니다.');
 const next={...structuredClone(value),version:5,cosmetics:initialCosmetics()};
 if(!validV5(next,catalog))throw Error('외형 저장 데이터 이전 검증에 실패했습니다.');
 return next;
}
export function migrateV3(value:unknown):Obj {
 if(!validV3(value))throw Error('v3 저장 데이터를 안전하게 이전할 수 없습니다.');
 const next=structuredClone(value);
 const rename=(target:Obj)=>{target.silver=target.gold;delete target.gold;};
 rename(next);
 if(obj(next.expedition)&&obj(next.expedition.loot))rename(next.expedition.loot);
 if(obj(next.lastExpedition)&&obj(next.lastExpedition.loot))rename(next.lastExpedition.loot);
 next.version=4;
 next.logs=(next.logs as string[]).map(line=>line.replace(/골드|Gold/g,'Silver'));
 next.notice=(next.notice as string).replace(/골드|Gold/g,'Silver');
 if(!validV4(next))throw Error('Silver 저장 데이터 이전 검증에 실패했습니다.');
 return next;
}
export function migrateV1(value:unknown):Obj {
  if(!validBase(value,true)||value.version!==1)throw Error('이전 저장 데이터를 안전하게 이전할 수 없습니다.');
  const old=structuredClone(value);
  // v1 already credited ALL drops. Tickets/books cannot be distinguished from
  // pre-expedition possessions, so never deduct or credit those drops again.
  if(obj(old.expedition)){
    const potions=old.potions as Record<string,number>,carried=old.expedition.bag as Record<string,number>;
    legacyPotionIds.forEach(p=>potions[p]+=carried[p]);
    old.notice='저장 형식 변경으로 이전 원정을 종료했습니다. 기존 재산·배운 스킬을 유지하고 남은 포션을 반환했습니다. 이전 보상은 재지급하지 않습니다.';
  }
  const next={...old,version:2,skillBooks:{},lootItems:{},lastExpedition:null,expedition:null};
  if(!validV2(next))throw Error('저장 데이터 이전 검증에 실패했습니다.');
  return migrateV2(next);
}
export function migrateV2(value:unknown):Obj {
  if(!validV2(value))throw Error('이전 저장 데이터를 안전하게 이전할 수 없습니다.');
  const old=structuredClone(value) as Obj;
  const expedition=obj(old.expedition)?{...old.expedition,equipment:{...(old.equipped as Obj)},returnRequested:false}:null;
  const next={...old,version:3,gearMastery:initialGearMastery(),expedition};
  if(!validV3(next))throw Error('저장 데이터 이전 검증에 실패했습니다.');
  return migrateV3(next);
}
const validExploration=(x:unknown)=>obj(x)&&obj(x.unlockedTier)&&obj(x.highestReturned)&&towerIds.every(t=>count((x.unlockedTier as Obj)[t])&&Number((x.unlockedTier as Obj)[t])>=1&&Number((x.unlockedTier as Obj)[t])<=5&&count((x.highestReturned as Obj)[t])&&Number((x.highestReturned as Obj)[t])<=50);
export function migrateV13(value:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):GameState {if(!validV13(value,catalog))throw Error('v13 저장 데이터를 안전하게 이전할 수 없습니다.');const next:any=structuredClone(value);next.version=15;if(next.expedition){const e=next.expedition;e.phase='PLAYER_TURN';e.playerTurn=1;e.monsterTurn=0;e.pendingFlee=false;e.returnRequested=false;e.playerTimer=0;e.enemyTimer=0;e.spawnAt=0;e.buffs={};e.playerEffects=[];e.monsterEffects=[];e.preparedEffects=[];e.effectSequence=0;e.cooldowns=Object.fromEntries(Object.entries(e.cooldowns).filter(([key,value])=>key.startsWith('turn:')&&finite(value)).map(([key,value])=>[key,Math.max(0,Math.ceil(value as number))]));}if(!validV15(next,catalog))throw Error('수동 턴제 저장 데이터 이전 검증에 실패했습니다.');return migrateV15(next,catalog);}
export function migrateV12(value:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):GameState {if(!obj(value)||value.version!==12||!validV11({...value,version:11},catalog))throw Error('v12 저장 데이터가 손상되었습니다.');const n=structuredClone(value);const old=n as unknown as GameState;const unlockedTier={ore:1,leather:1,gem:1,kaleon:1},highestReturned={ore:0,leather:0,gem:0,kaleon:0};for(const t of towerIds){const highestTicket=old.tickets[t].reduce((v,q,i)=>q>0?Math.max(v,i+1):v,1);const evidence=Math.max(old.progress[t],highestTicket,old.expedition?.tower===t?old.expedition.floor:1,old.lastExpedition?.tower===t?old.lastExpedition.floor:1);unlockedTier[t]=Math.min(5,Math.ceil(evidence/10));if(old.lastExpedition?.tower===t&&old.lastExpedition.outcome==='returned')highestReturned[t]=old.lastExpedition.floor;}const next={...n,version:13,exploration:{unlockedTier,highestReturned}};if(!validV13(next,catalog))throw Error('탐사 저장 데이터 이전 실패');return migrateV13(next,catalog);}
export const EXPLORATION_BACKUP_KEY='tower-record-v1-before-exploration-v13';
export const TURN_BATTLE_BACKUP_KEY='tower-record-v1-before-turn-battle-v14';
export const EFFECTS_BACKUP_KEY='tower-record-v1-before-effects-v15';
export const JOBS_BACKUP_KEY='tower-record-v1-before-jobs-v16';
export function migrateV14(value:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):GameState {if(!obj(value)||value.version!==14||!validTurnExpedition(value.expedition)||!validV13({...value,version:13},catalog))throw Error('v14 저장 데이터를 안전하게 이전할 수 없습니다.');const next:any=structuredClone(value);next.version=15;if(next.expedition){next.expedition.playerEffects=[];next.expedition.monsterEffects=[];next.expedition.preparedEffects=[];next.expedition.effectSequence=0;}if(!validV15(next,catalog))throw Error('상태효과 저장 데이터 이전 검증에 실패했습니다.');return migrateV15(next,catalog);}
export function migrateV15(value:unknown,catalog:CosmeticsCatalog=COSMETICS_CATALOG):GameState {if(!validV15(value,catalog))throw Error('v15 저장 데이터를 안전하게 이전할 수 없습니다.');const next:any=structuredClone(value);next.version=16;next.ownedJobIds=[];next.currentJobId=null;if(next.expedition)next.expedition={...next.expedition,jobSnapshotId:null,jobRuntime:{jobId:null,passiveIds:[],activeSkillIds:[],resource:null}};if(!validV16(next,catalog))throw Error('직업 저장 데이터 이전 검증에 실패했습니다.');return migrateV16(next,catalog);}
function normalizeV16JobReferences(value:unknown):unknown {if(!obj(value)||value.version!==16)return value;const next:any=structuredClone(value);if(Array.isArray(next.ownedJobIds))next.ownedJobIds=[...new Set(next.ownedJobIds.filter(isValidJobId))];if(!isValidJobId(next.currentJobId)||!next.ownedJobIds?.includes(next.currentJobId))next.currentJobId=null;if(next.expedition&&!isValidJobId(next.expedition.jobSnapshotId)){next.expedition.jobSnapshotId=null;next.expedition.jobRuntime={jobId:null,passiveIds:[],activeSkillIds:[],resource:null};}return next;}
export interface SaveExportEnvelope {format:typeof SAVE_EXPORT_FORMAT;formatVersion:typeof SAVE_EXPORT_FORMAT_VERSION;appVersion:string;exportedAt:string;state:GameState}
export function serializeSaveExport(state:GameState,exportedAt=Date.now(),catalog:CosmeticsCatalog=COSMETICS_CATALOG):string {
  if(!validSave(state,catalog))throw Error('유효하지 않은 게임 상태는 내보낼 수 없습니다.');
  const envelope:SaveExportEnvelope={format:SAVE_EXPORT_FORMAT,formatVersion:SAVE_EXPORT_FORMAT_VERSION,appVersion:APP_VERSION,exportedAt:new Date(exportedAt).toISOString(),state};
  return JSON.stringify(envelope,null,2);
}
export function parseSaveImport(raw:string,catalog:CosmeticsCatalog=COSMETICS_CATALOG):GameState {
  let parsed:unknown;try{parsed=JSON.parse(raw);}catch{throw Error('가져올 저장 파일이 올바른 JSON이 아닙니다.');}
  let candidate=parsed;
  if(obj(parsed)&&parsed.format===SAVE_EXPORT_FORMAT){
    if(parsed.formatVersion!==SAVE_EXPORT_FORMAT_VERSION)throw Error('지원하지 않는 저장 파일 형식입니다.');
    candidate=parsed.state;
  }
  let current=JSON.stringify(candidate);
  const memory:StoragePort={getItem:key=>key===SAVE_KEY?current:null,setItem:(key,value)=>{if(key===SAVE_KEY)current=value;}};
  try{return createRepository(memory,catalog).load();}catch(error){throw Error(error instanceof Error?`저장 파일을 가져올 수 없습니다. ${error.message}`:'저장 파일을 가져올 수 없습니다.');}
}
export function createRepository(storage:StoragePort,catalog:CosmeticsCatalog=COSMETICS_CATALOG){
  return {
    save(state:GameState){
      if(!validSave(state,catalog))throw Error('유효하지 않은 게임 상태는 저장할 수 없습니다.');
      // Both permanent balances and active expedition are one atomic storage value.
      storage.setItem(SAVE_KEY,JSON.stringify(state));
    },
    exportSave(state:GameState,exportedAt=Date.now()){return serializeSaveExport(state,exportedAt,catalog);},
    importSave(raw:string):GameState {
      const next=parseSaveImport(raw,catalog);
      const current=storage.getItem(SAVE_KEY);
      if(current!==null)storage.setItem(IMPORT_BACKUP_KEY,current);
      storage.setItem(SAVE_KEY,JSON.stringify(next));
      return next;
    },
    load():GameState {
      const raw=storage.getItem(SAVE_KEY);if(!raw)return initialState();
      let data:unknown;try{data=JSON.parse(raw);}catch{throw Error('저장 파일을 읽을 수 없습니다.');}
      if(obj(data)&&data.version===1){
        const next=migrateV12(migrateV11(migrateV10(migrateV9(migrateV8(migrateV7(migrateV6(migrateV5(migrateV4(migrateV1(data),catalog),catalog),catalog),catalog),catalog)))));
        if(storage.getItem(LEGACY_BACKUP_KEY)===null)storage.setItem(LEGACY_BACKUP_KEY,raw);
        if(storage.getItem(COSMETICS_BACKUP_KEY)===null)storage.setItem(COSMETICS_BACKUP_KEY,raw);
        storage.setItem(SAVE_KEY,JSON.stringify(next));
        return next;
      }
      if(obj(data)&&data.version===2){
        const next=migrateV12(migrateV11(migrateV10(migrateV9(migrateV8(migrateV7(migrateV6(migrateV5(migrateV4(migrateV2(data),catalog),catalog),catalog),catalog),catalog)))));
        if(storage.getItem(MASTERY_BACKUP_KEY)===null)storage.setItem(MASTERY_BACKUP_KEY,raw);
        if(storage.getItem(COSMETICS_BACKUP_KEY)===null)storage.setItem(COSMETICS_BACKUP_KEY,raw);
        storage.setItem(SAVE_KEY,JSON.stringify(next));
        return next;
      }
      if(obj(data)&&data.version===3){
        const next=migrateV12(migrateV11(migrateV10(migrateV9(migrateV8(migrateV7(migrateV6(migrateV5(migrateV4(migrateV3(data),catalog),catalog),catalog),catalog),catalog)))));
        if(storage.getItem(SILVER_BACKUP_KEY)===null)storage.setItem(SILVER_BACKUP_KEY,raw);
        if(storage.getItem(COSMETICS_BACKUP_KEY)===null)storage.setItem(COSMETICS_BACKUP_KEY,raw);
        storage.setItem(SAVE_KEY,JSON.stringify(next));
        return next;
      }
      if(obj(data)&&data.version===4){
        const next=migrateV12(migrateV11(migrateV10(migrateV9(migrateV8(migrateV7(migrateV6(migrateV5(migrateV4(data,catalog),catalog),catalog),catalog),catalog)))));
        if(storage.getItem(COSMETICS_BACKUP_KEY)===null)storage.setItem(COSMETICS_BACKUP_KEY,raw);
        storage.setItem(SAVE_KEY,JSON.stringify(next));
        return next;
      }
      if(obj(data)&&data.version===5){
        const next=migrateV12(migrateV11(migrateV10(migrateV9(migrateV8(migrateV7(migrateV6(migrateV5(data,catalog),catalog),catalog),catalog)))));
        if(storage.getItem(BOSS_TRACKING_BACKUP_KEY)===null)storage.setItem(BOSS_TRACKING_BACKUP_KEY,raw);
        storage.setItem(SAVE_KEY,JSON.stringify(next));
        return next;
      }
      if(obj(data)&&data.version===6){
        const next=migrateV12(migrateV11(migrateV10(migrateV9(migrateV8(migrateV7(migrateV6(data,catalog),catalog),catalog)))));
        if(storage.getItem(PRESETS_BACKUP_KEY)===null)storage.setItem(PRESETS_BACKUP_KEY,raw);
        storage.setItem(SAVE_KEY,JSON.stringify(next));
        return next;
      }
      if(obj(data)&&data.version===7){
        const next=migrateV12(migrateV11(migrateV10(migrateV9(migrateV8(migrateV7(data,catalog),catalog)))));
        if(storage.getItem(GOLDEN_RECORDER_BACKUP_KEY)===null)storage.setItem(GOLDEN_RECORDER_BACKUP_KEY,raw);
        storage.setItem(SAVE_KEY,JSON.stringify(next));
        return next;
      }
      if(obj(data)&&data.version===8){
        const next=migrateV12(migrateV11(migrateV10(migrateV9(migrateV8(data,catalog)))));
        if(storage.getItem(MARKET_BACKUP_KEY)===null)storage.setItem(MARKET_BACKUP_KEY,raw);
        storage.setItem(SAVE_KEY,JSON.stringify(next));
        return next;
      }
      if(obj(data)&&data.version===9&&obj(data.market)&&!('gold' in data.market)){data.market.gold=1000;storage.setItem(SAVE_KEY,JSON.stringify(data));}
      if(obj(data)&&data.version===9){const next=migrateV12(migrateV11(migrateV10(migrateV9(data,catalog),catalog)));if(storage.getItem(ASSOCIATION_BACKUP_KEY)===null)storage.setItem(ASSOCIATION_BACKUP_KEY,raw);if(storage.getItem(CRAFTING_BACKUP_KEY)===null)storage.setItem(CRAFTING_BACKUP_KEY,raw);storage.setItem(SAVE_KEY,JSON.stringify(next));return next;}
      if(obj(data)&&data.version===10){const next=migrateV12(migrateV11(migrateV10(data,catalog)));if(storage.getItem(CRAFTING_BACKUP_KEY)===null)storage.setItem(CRAFTING_BACKUP_KEY,raw);storage.setItem(SAVE_KEY,JSON.stringify(next));return next;}
      if(obj(data)&&data.version===11){const next=migrateV12(migrateV11(data,catalog),catalog);storage.setItem(SAVE_KEY,JSON.stringify(next));return next;}
      if(obj(data)&&data.version===12){const next=migrateV12(data,catalog);if(storage.getItem(EXPLORATION_BACKUP_KEY)===null)storage.setItem(EXPLORATION_BACKUP_KEY,raw);storage.setItem(SAVE_KEY,JSON.stringify(next));return next;}
      if(obj(data)&&data.version===13){const next=migrateV13(data,catalog);if(storage.getItem(TURN_BATTLE_BACKUP_KEY)===null)storage.setItem(TURN_BATTLE_BACKUP_KEY,raw);storage.setItem(SAVE_KEY,JSON.stringify(next));return next;}
      if(obj(data)&&data.version===14){const next=migrateV14(data,catalog);if(storage.getItem(EFFECTS_BACKUP_KEY)===null)storage.setItem(EFFECTS_BACKUP_KEY,raw);storage.setItem(SAVE_KEY,JSON.stringify(next));return next;}
      if(obj(data)&&data.version===15){const next=migrateV15(data,catalog);if(storage.getItem(JOBS_BACKUP_KEY)===null)storage.setItem(JOBS_BACKUP_KEY,raw);storage.setItem(SAVE_KEY,JSON.stringify(next));return next;}
      data=normalizeV16JobReferences(data);
      if(obj(data)&&data.version===16){const next=migrateV16(data,catalog);if(storage.getItem(EVENTS_BACKUP_KEY)===null)storage.setItem(EVENTS_BACKUP_KEY,raw);storage.setItem(SAVE_KEY,JSON.stringify(next));return next;}
       if(obj(data)&&data.version===17){const next=migrateV17(data,catalog);if(storage.getItem(MONSTER_RUNTIME_BACKUP_KEY)===null)storage.setItem(MONSTER_RUNTIME_BACKUP_KEY,raw);storage.setItem(SAVE_KEY,JSON.stringify(next));return next;}
       if(obj(data)&&data.version===18){const next=migrateV18(data,catalog);if(storage.getItem(COMBAT_TRIGGERS_BACKUP_KEY)===null)storage.setItem(COMBAT_TRIGGERS_BACKUP_KEY,raw);storage.setItem(SAVE_KEY,JSON.stringify(next));return next;}
       if(obj(data)&&data.version===19){const next=migrateV19(data,catalog);if(storage.getItem(POTION_OVERHAUL_BACKUP_KEY)===null)storage.setItem(POTION_OVERHAUL_BACKUP_KEY,raw);if(storage.getItem(TOWER_STRUCTURE_BACKUP_KEY)===null)storage.setItem(TOWER_STRUCTURE_BACKUP_KEY,raw);storage.setItem(SAVE_KEY,JSON.stringify(next));return next;}
      if(obj(data)&&data.version===20){const next=migrateV20(data,catalog);if(storage.getItem(TOWER_STRUCTURE_BACKUP_KEY)===null)storage.setItem(TOWER_STRUCTURE_BACKUP_KEY,raw);storage.setItem(SAVE_KEY,JSON.stringify(next));return next;}
      if(obj(data)&&data.version===21){const next=migrateV21(data,catalog);if(storage.getItem(BESTIARY_BACKUP_KEY)===null)storage.setItem(BESTIARY_BACKUP_KEY,raw);storage.setItem(SAVE_KEY,JSON.stringify(next));return next;}
      if(!validSave(data,catalog))throw Error('지원하지 않거나 손상된 저장 데이터입니다.');
      return data;
    }
  };
}
