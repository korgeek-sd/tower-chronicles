import type {GameplayLease} from './gameSession';
import {associationGrowthRpc as rpc,associationLeaseArgs as args} from './associationGrowthRpc';
import type {GuildMaterial} from './guildMaterials';

export interface GuildTerritoryTown {
 townId:string;name:string;kind:'herb'|'farm'|'city';
 ownerAssociationId:string|null;ownerName:string;owned:boolean;
 occupiedAt:string|null;rate:number;changedAt:string|null;
 todayTax:number;weekTax:number;
 todayMaterials:Partial<Record<GuildMaterial,number>>;
 weekMaterials:Partial<Record<GuildMaterial,number>>;
}
export interface GuildTerritoryWar{
 eventId:string;townId:string;townName:string;settledAt:string;
 previousOwner:string;winner:string;
 outcome:'CAPTURED'|'DEFENDED'|'UNDECIDED';ourWar:boolean;
}
export interface GuildTerritoryState {
 associationId:string;isLeader:boolean;ownedCount:number;totalCount:number;
 todayTax:number;weekTax:number;stockTotal:number;todayStart:string;serverNow:number;
 towns:GuildTerritoryTown[];history:GuildTerritoryWar[];
}
export const getGuildTerritoryState=(lease:GameplayLease)=>
 rpc<GuildTerritoryState>('get_guild_territory_state',args(lease));
