import type {ExpeditionEvents} from './events/types';
export type Weapon = 'sword'|'dagger'|'bow'|'staff';
export type Slot = 'weapon'|'armor'|'boots'|'accessory';
export type Field = 'weapon'|'armor'|'accessory'|'alchemy';
export type Potion = 'health'|'regen'|'attack'|'defense'|'haste';
export type Tower = 'ore'|'leather'|'gem'|'kaleon';
export type GearMasteryKey = Weapon|'armor'|'boots'|'accessory';
export type Bag = Record<Potion,number>;
export interface Item {id:string; kind:string; tier:number; enhancement:0|1|2|3}
export interface Stats {hp:number;attack:number;defense:number;speed:number;skillPower:number}
export interface Monster extends Stats {name:string;currentHp:number;definitionId?:string}
export interface BossTracking {progress:number;pendingBossId:string|null;encounterReason:'early'|'max'|null;bossDefeated:boolean}
export interface ExpeditionPreset {name:string;equipment:Record<Slot,string|null>;skills:[string|null,string|null,string|null];potions:Bag;threshold:number}
export interface GoldenRecorder {expiresAt:number|null}
export type MarketSide='BUY'|'SELL';
export type MarketOrderStatus='OPEN'|'PARTIAL'|'FILLED'|'CANCELLED';
export interface MarketOrder {orderId:string;itemId:string;side:MarketSide;limitPrice:number;originalQuantity:number;remainingQuantity:number;ownerId:string;createdAt:number;sequence:number;status:MarketOrderStatus;gear?:Item}
export interface MarketTrade {tradeId:string;itemId:string;price:number;quantity:number;buyOrderId:string;sellOrderId:string;buyerId:string;sellerId:string;executedAt:number;sequence:number}
export interface MarketState {traderCertified:boolean;ownerId:string;gold:number;orders:MarketOrder[];trades:MarketTrade[];nextOrderId:number;nextTradeId:number;nextSequence:number}
export type AssociationRole='LEADER'|'MEMBER';export type AssociationPolicy='OPEN'|'APPROVAL'|'CLOSED';export type AssociationStatus='ACTIVE'|'DISBANDED';export interface AssociationMember {playerId:string;role:AssociationRole;joinedAt:number}export interface AssociationApplication {applicationId:string;associationId:string;applicantId:string;createdAt:number;status:'PENDING'|'ACCEPTED'|'REJECTED'}export interface AssociationTreasuryEntry {entryId:string;memberId:string;deltaSilver:number;grossExpeditionSilver:number;revenueShareRatePercent:number;createdAt:number}export interface AssociationActivity {at:number;text:string}export interface Association {associationId:string;recordNumber:string;name:string;description:string;leaderId:string;createdAt:number;notice:string;noticeUpdatedAt:number|null;joinPolicy:AssociationPolicy;status:AssociationStatus;members:AssociationMember[];applications:AssociationApplication[];activityLog:AssociationActivity[];revenueShareRatePercent:number;treasurySilver:number;treasuryLedger:AssociationTreasuryEntry[]}export interface AssociationState {currentId:string|null;associations:Association[];nextId:number;nextApplicationId:number}
export type CraftJobStatus='QUEUED'|'CRAFTING'|'COMPLETED_UNCLAIMED'|'CANCELLED';export interface CraftJob {jobId:string;recipeId:string;itemId:string;kind:string;tier:number;quantity:number;field:Field;status:CraftJobStatus;queuedAt:number;startedAt:number|null;completesAt:number|null;durationMs:number;consumedMaterials:number;consumedSilver:number}export interface CraftingState {jobs:CraftJob[];nextJobId:number}
export interface Mastery {unlocked:number; progress:number; crafts:number}
export interface GearMastery {unlockedTier:number;progress:number}
export interface Cosmetics {unlockedAppearanceIds:string[];selectedAppearanceId:string;appearanceItems:Record<string,number>;unlockedTitleIds:string[];selectedTitleId:string|null}
export interface ExpeditionLoot {silver:number;materials:Record<Tower,number[]>;tickets:Record<Tower,number[]>;skillBooks:Record<string,number>;items:Record<string,number>}
export interface ExpeditionResult {outcome:'returned'|'dead';tower:Tower;floor:number;time:number;kills:number;loot:ExpeditionLoot;remainingPotions:Bag}
export type BattlePhase='PLAYER_TURN'|'MONSTER_TURN'|'BATTLE_END';
export type EffectCategory='BUFF'|'DEBUFF'|'SPECIAL';export type EffectBehavior='STAT_MODIFIER'|'PERIODIC_DAMAGE'|'PERIODIC_HEAL'|'SHIELD'|'TURN_START_TRIGGER'|'TURN_END_TRIGGER'|'PREPARED_REACTION'|'PREPARED_DELAYED'|'CONTROL';export type EffectTag='DOT'|'HOT'|'POISON'|'BLEED'|'REGEN'|'STAT_UP'|'STAT_DOWN'|'CONTROL'|'STUN'|'PREPARED'|'SHIELD';export type StackingPolicy='REFRESH_DURATION'|'REPLACE'|'STACK'|'IGNORE_IF_ACTIVE';
export interface EffectThresholdReaction {threshold:number;removeSelf?:boolean;removeEffectIds?:string[];applyEffectIds?:string[];message?:string}
export interface EffectDefinition {id:string;name:string;description:string;category:EffectCategory;behavior:EffectBehavior;tags:EffectTag[];defaultDuration:number;stackingPolicy:StackingPolicy;maxStacks?:number;shieldAmount?:number;scope?:'BATTLE'|'EXPEDITION';payload?:{stat?:'attack'|'defense'|'receivedDamage';multiplier?:number;amount?:number};thresholdReaction?:EffectThresholdReaction}
export interface ActiveEffect {instanceId:string;effectId:string;sourceActorId:'player'|'monster';targetActorId:'player'|'monster';remainingDuration:number;stackCount:number;applicationSequence:number;createdTurn:number;scope:'BATTLE'|'EXPEDITION';currentShield?:number}
export interface BattleJobRuntime {jobId:string|null;passiveIds:[string,string]|[];activeSkillIds:[string,string,string]|[];resource:{id:string;value:number;maxValue?:number}|null}
export interface MonsterBattleRuntime {definitionId:string;skillCooldowns:Record<string,number>;preparedActionId:string|null;turnNumber:number}
export type CombatActor='player'|'monster';
export interface ReactivePreparedRuntime {definitionId:string;prepareSkillId:string;reactionSkillId:string;trigger:'DIRECT_HIT_RECEIVED'}
export type ReactivePreparedByActor=Record<CombatActor,ReactivePreparedRuntime|null>;
export interface Expedition {events:ExpeditionEvents;tower:Tower;floor:number;hp:number;monster:Monster;monsterRuntime:MonsterBattleRuntime|null;reactivePrepared:ReactivePreparedByActor;bag:Bag;time:number;playerTimer:number;enemyTimer:number;spawnAt:number;cooldowns:Record<string,number>;buffs:Record<string,number>;playerEffects:ActiveEffect[];monsterEffects:ActiveEffect[];preparedEffects:ActiveEffect[];effectSequence:number;jobSnapshotId:string|null;jobRuntime:BattleJobRuntime;kills:number;loot:ExpeditionLoot;equipment:Record<Slot,string|null>;returnRequested:boolean;bossTracking:BossTracking;phase:BattlePhase;playerTurn:number;monsterTurn:number;pendingFlee:boolean;revenueShareSnapshot?:{associationId:string|null;rate:number}}
export interface GameState {version:19;ownedJobIds:string[];currentJobId:string|null;exploration:{unlockedTier:Record<Tower,number>;highestReturned:Record<Tower,number>};crafting:CraftingState;association:AssociationState;market:MarketState;goldenRecorder:GoldenRecorder;expeditionPresets:(ExpeditionPreset|null)[];cosmetics:Cosmetics;gearMastery:Record<GearMasteryKey,GearMastery>;skillBooks:Record<string,number>;lootItems:Record<string,number>;lastExpedition:ExpeditionResult|null;silver:number;materials:Record<Tower,number[]>;items:Item[];equipped:Record<Slot,string|null>;learned:string[];skills:[string|null,string|null,string|null];potions:Bag;loadout:Bag;threshold:number;mastery:Record<Field,Mastery>;tickets:Record<Tower,number[]>;progress:Record<Tower,number>;expedition:Expedition|null;logs:string[];notice:string;nextId:number}





