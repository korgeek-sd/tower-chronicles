import type {GameplayLease} from './gameSession';
import type {CloudSaveRecord} from './cloudSave';
import type {OnlineJobRegistrationResult} from './economy';
import {associationGrowthRpc as rpc,associationLeaseArgs as args} from './associationGrowthRpc';

export type AssociationShopReset='DAILY'|'WEEKLY';
export interface OnlineAssociationShopItem {
 itemId:string;name:string;description:string;reset:AssociationShopReset;
 contributionCost:number;purchaseLimit:number;purchased:number;requiredLevel:number;
}
export interface OnlineAssociationShopState {
 contribution:number;level:number;daily:OnlineAssociationShopItem[];weekly:OnlineAssociationShopItem[];
 dailyResetAt:string;weeklyResetAt:string;
}
export interface OnlineAssociationShopResult {
 state:OnlineAssociationShopState;record:CloudSaveRecord;replayed:boolean;
 reward:{name:string;type:string;quantity:number};
}
export const loadOnlineAssociationShop=(lease:GameplayLease)=>rpc<OnlineAssociationShopState>('get_online_association_shop',args(lease));
export const buyOnlineAssociationShopItem=(lease:GameplayLease,itemId:string,requestId:string=crypto.randomUUID())=>
 rpc<OnlineAssociationShopResult>('buy_online_association_shop_item',{...args(lease),p_item_id:itemId,p_request_id:requestId});
export const registerOnlineJobWithTickets=(lease:GameplayLease,rolls:1|10,requestId:string=crypto.randomUUID())=>
 rpc<OnlineJobRegistrationResult>('register_online_job_with_tickets',{...args(lease),p_rolls:rolls,p_request_id:requestId});
