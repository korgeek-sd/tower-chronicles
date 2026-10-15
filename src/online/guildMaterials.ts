import type {GameplayLease} from './gameSession';
import {associationGrowthRpc as rpc,associationLeaseArgs as args} from './associationGrowthRpc';

export type GuildMaterial='herb'|'pepper'|'potato'|'wheat';
export const GUILD_MATERIAL_NAMES:Record<GuildMaterial,string>={herb:'약초',pepper:'고추',potato:'감자',wheat:'밀'};
export const GUILD_MATERIAL_IDS:GuildMaterial[]=['herb','pepper','potato','wheat'];
export interface GuildMaterialTown{
 townId:string;name:string;owned:boolean;owner:string;
 rate:number;changedAt:string|null;
}
export interface GuildMaterialLedger{
 entryId:number;operation:'GATHER_TAX'|'DEPOSIT'|'WITHDRAW'|'AUCTION_LIST'|'AUCTION_RETURN';
 material:GuildMaterial;amount:number;balanceAfter:number;
 townId:string|null;detail:string;actorName:string;createdAt:string;
}
export interface GuildMaterialsState{
 associationId:string;isLeader:boolean;
 materials:Record<GuildMaterial,number>;
 personal:Record<GuildMaterial,number>;
 towns:GuildMaterialTown[];
 ledger:GuildMaterialLedger[];
}
export type GuildMaterialsResult={state:GuildMaterialsState;replayed:boolean};
export const getGuildMaterials=(lease:GameplayLease)=>
 rpc<GuildMaterialsState>('get_guild_materials',args(lease));
export const setGuildVillageTax=(lease:GameplayLease,townId:string,rate:number)=>
 rpc<GuildMaterialsState>('set_guild_village_tax',{...args(lease),p_town_id:townId,p_tax_rate:rate});
export const transferGuildMaterial=(lease:GameplayLease,requestId:string,direction:'DEPOSIT'|'WITHDRAW',material:GuildMaterial,amount:number)=>
 rpc<GuildMaterialsResult>('transfer_guild_material',{...args(lease),p_request_id:requestId,p_direction:direction,p_material:material,p_amount:amount});
export const registerGuildMaterialAuction=(lease:GameplayLease,requestId:string,material:GuildMaterial,quantity:number,startingBid:number)=>
 rpc<{state:import('./guildAuction').GuildAuctionState;replayed:boolean}>('register_guild_material_auction',
 {...args(lease),p_request_id:requestId,p_material:material,p_quantity:quantity,p_starting_bid:startingBid});
export const recoverGuildMaterialAuction=(lease:GameplayLease,listingId:string)=>
 rpc<{state:import('./guildAuction').GuildAuctionState;replayed:boolean}>('recover_guild_material_auction',
 {...args(lease),p_listing_id:listingId});
