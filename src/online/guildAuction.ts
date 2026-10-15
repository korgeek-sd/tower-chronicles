import type {GameplayLease} from './gameSession';
import type {CloudSaveRecord} from './cloudSave';
import {associationGrowthRpc as rpc,associationLeaseArgs as args} from './associationGrowthRpc';
import type {EquipmentItem} from '../game/types';

export interface GuildAuctionListing {
 listingId:string;source:'BOSS'|'TREASURY'|'LEADER'|'MATERIAL';gear:EquipmentItem;
 materialId?:import('./guildMaterials').GuildMaterial|null;materialQuantity?:number|null;canReturnMaterial?:boolean;
 sellerId:string|null;isMyListing:boolean;cancelledAt:string|null;returnedAt:string|null;
 canCancel:boolean;canReturn:boolean;canRelist:boolean;
 startingBid:number;topBid:number;nextBid:number;topUserId:string|null;
 startedAt:string;endsAt:string;claimedAt:string|null;
 status:'OPEN'|'SOLD'|'CLAIMED'|'UNSOLD'|'CANCELLED'|'RETURNED';isMyTopBid:boolean;
}
export interface GuildBossClaim {
 encounterId:string;kind:'DAILY'|'WEEKLY';name:string;defeatedAt:string;
 silver:number;contribution:number;potions:number;vitalityPotions:number;
}
export interface GuildAuctionState {
 associationId:string;points:number;isLeader:boolean;availableEquipment:{itemId:string;gear:EquipmentItem}[];
 listings:GuildAuctionListing[];claimableRewards:GuildBossClaim[];
}
export interface GuildAuctionBidResponse {replayed:boolean;state:GuildAuctionState}
export interface GuildAuctionClaimResponse {
 replayed:boolean;record:CloudSaveRecord;state:GuildAuctionState;gear?:EquipmentItem;materialId?:string;materialQuantity?:number;
 silver?:number;contribution?:number;potions?:number;vitalityPotions?:number;
}
export const getGuildAuctionState=(lease:GameplayLease)=>rpc<GuildAuctionState>('get_guild_auction_state',args(lease));
export const bidGuildAuction=(lease:GameplayLease,listingId:string,bid:number,requestId:string)=>
 rpc<GuildAuctionBidResponse>('bid_guild_auction',{...args(lease),p_request_id:requestId,p_listing_id:listingId,p_bid:bid});
export const claimGuildBossReward=(lease:GameplayLease,encounterId:string)=>
 rpc<GuildAuctionClaimResponse>('claim_guild_boss_reward',{...args(lease),p_encounter_id:encounterId});
export const claimGuildAuctionItem=(lease:GameplayLease,listingId:string)=>
 rpc<GuildAuctionClaimResponse>('claim_guild_auction_item',{...args(lease),p_listing_id:listingId});

export const registerGuildAuctionItem=(lease:GameplayLease,requestId:string,itemId:string,startingBid:number)=>
 rpc<GuildAuctionClaimResponse>('register_guild_auction_item',{...args(lease),p_request_id:requestId,p_item_id:itemId,p_starting_bid:startingBid});
export const recoverGuildAuctionItem=(lease:GameplayLease,listingId:string)=>
 rpc<GuildAuctionClaimResponse>('recover_guild_auction_item',{...args(lease),p_listing_id:listingId});
export const relistGuildBossAuctionItem=(lease:GameplayLease,listingId:string,startingBid:number)=>
 rpc<{state:GuildAuctionState}>('relist_guild_boss_auction_item',{...args(lease),p_listing_id:listingId,p_starting_bid:startingBid});
