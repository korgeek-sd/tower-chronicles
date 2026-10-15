import type {GameplayLease} from './gameSession';
import {associationGrowthRpc as rpc,associationLeaseArgs as args} from './associationGrowthRpc';

export type GuildRankingMode='OVERALL'|'TERRITORY'|'WARS'|'GROWTH';
export interface GuildRankingEntry{
 rank:number;associationId:string;name:string;recordNumber:string;
 level:number;exp:number;members:number;memberLimit:number;
 territories:number;victories:number;captures:number;defenses:number;
 createdAt:string;mine:boolean;
}
export interface GuildRankingState{
 mode:GuildRankingMode;totalGuilds:number;myAssociationId:string|null;
 myRank:number|null;entries:GuildRankingEntry[];updatedAt:string;
}
export const getGuildRankings=(lease:GameplayLease,mode:GuildRankingMode)=>
 rpc<GuildRankingState>('get_guild_rankings',{...args(lease),p_mode:mode});
