import type {GameplayLease} from './gameSession';
import type {CloudSaveRecord} from './cloudSave';
import {associationGrowthRpc as rpc,associationLeaseArgs as args} from './associationGrowthRpc';
import type {EquipmentItem} from '../game/types';

export interface GuildAuctionListing {
 listingId:string;source:'BOSS'|'TREASURY';gear:EquipmentItem;
 startingBid:number;topBid:number;nextBid:number;topUserId:string|null;
 startedAt:string;endsAt:string;claimedAt:string|null;
 status:'OPEN'|'SOLD'|'CLAIMED'|'UNSOLD';isMyTopBid:boolean;
}
export interface GuildBossClaim {
 encounterId:string;kind:'DAILY'|'WEEKLY';name:string;defeatedAt:string;
 silver:number;contribution:number;potions:number;vitalityPotions:number;
}
export interface GuildAuctionState {
 associationId:string;points:number;listings:GuildAuctionListing[];claimableRewards:GuildBossClaim[];
}
export interface GuildAuctionBidResponse {replayed:boolean;state:GuildAuctionState}
export interface GuildAuctionClaimResponse {
 replayed:boolean;record:CloudSaveRecord;state:GuildAuctionState;gear?:EquipmentItem;
 silver?:number;contribution?:number;potions?:number;vitalityPotions?:number;
}
export const getGuildAuctionState=(lease:GameplayLease)=>rpc<GuildAuctionState>('get_guild_auction_state',args(lease));
export const bidGuildAuction=(lease:GameplayLease,listingId:string,bid:number,requestId:string)=>
 rpc<GuildAuctionBidResponse>('bid_guild_auction',{...args(lease),p_request_id:requestId,p_listing_id:listingId,p_bid:bid});
export const claimGuildBossReward=(lease:GameplayLease,encounterId:string)=>
 rpc<GuildAuctionClaimResponse>('claim_guild_boss_reward',{...args(lease),p_encounter_id:encounterId});
export const claimGuildAuctionItem=(lease:GameplayLease,listingId:string)=>
 rpc<GuildAuctionClaimResponse>('claim_guild_auction_item',{...args(lease),p_listing_id:listingId});
