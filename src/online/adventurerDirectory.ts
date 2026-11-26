import type {GameplayLease} from './gameSession';
import {associationGrowthRpc as rpc,associationLeaseArgs as args} from './associationGrowthRpc';
import type {GuildEmblemData} from '../components/association/GuildEmblem';
import type {EquipmentKind,EquipmentGrade} from '../game/types';
export interface AdventurerEntry{userId:string;nickname:string;level:number;classId:string|null;selectedAppearanceId?:string;combatPower:number;guildName:string|null;guildEmblem?:GuildEmblemData|null;rank:number}
export interface AdventurerProfile extends Omit<AdventurerEntry,'rank'>{
 guildEmblem:GuildEmblemData|null;guildRole:string|null;currentJobId:string|null;selectedAppearanceId:string;
 stats:{hp:number;attack:number;defense:number;critChance:number};
 equipment:{slot:string;kind:EquipmentKind;grade:EquipmentGrade;enhancement:number}[];
 associationSeal:number;guardianSeal:number;collectionCompleted:number;collectionTotal:number;
}
export interface AdventurerRanking{myRank:number|null;mine?:AdventurerEntry|null;total:number;entries:AdventurerEntry[]}
export const getAdventurerProfile=(lease:GameplayLease,userId:string)=>rpc<AdventurerProfile|null>('get_adventurer_directory',{...args(lease),p_target:userId,p_search:''});
export const getAdventurerRanking=(lease:GameplayLease,search='')=>rpc<AdventurerRanking>('get_adventurer_directory',{...args(lease),p_target:null,p_search:search});
export type AdventurerDirectoryRequest = {userId:string|null;fromRanking?:boolean};
export const openAdventurerProfile=(userId:string,fromRanking=false)=>window.dispatchEvent(new CustomEvent<AdventurerDirectoryRequest>('tower-adventurer-directory',{detail:{userId,fromRanking}}));
export const openAdventurerRanking=()=>window.dispatchEvent(new CustomEvent('tower-adventurer-directory',{detail:{userId:null}}));
