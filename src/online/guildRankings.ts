import type {GuildEmblemData} from '../components/association/GuildEmblem';
import type {GameplayLease} from './gameSession';
import {associationGrowthRpc as rpc,associationLeaseArgs as args} from './associationGrowthRpc';

export type GuildRankingMode='OVERALL'|'TERRITORY'|'WARS'|'GROWTH';
export interface GuildRankingEntry{
 rank:number;associationId:string;name:string;recordNumber:string;emblem?:GuildEmblemData;
 level:number;exp:number;members:number;memberLimit:number;
 combatPower:number;topPower:number;
 territories:number;victories:number;captures:number;defenses:number;
 createdAt:string;mine:boolean;
}
export interface GuildRankingState{
 mode:GuildRankingMode;totalGuilds:number;myAssociationId:string|null;
 myRank:number|null;entries:GuildRankingEntry[];updatedAt:string;
}
export const getGuildRankings=(lease:GameplayLease,mode:GuildRankingMode)=>
 rpc<GuildRankingState>('get_guild_rankings_v2',{...args(lease),p_mode:mode});

export interface GuildPublicProfile {
 associationId:string;description:string;leaderName:string|null;joinPolicy:'OPEN'|'APPROVAL'|'CLOSED';
 members:{nickname:string|null;role:string;combatPower:number}[];
 territories:{name:string;occupiedAt:string}[];
 recentWars:{townName:string;settledAt:string;outcome:'CAPTURED'|'DEFENDED'|'LOST'|'UNDECIDED'}[];
}
export const getGuildPublicProfile=(lease:GameplayLease,associationId:string)=>
 rpc<GuildPublicProfile|null>('get_guild_public_profile',{...args(lease),p_association_id:associationId});
