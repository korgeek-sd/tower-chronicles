import type {GameplayLease} from './gameSession';
import type {CloudSaveRecord} from './cloudSave';
import {associationGrowthRpc as rpc,associationLeaseArgs as args} from './associationGrowthRpc';

export interface AssociationProgression {
 associationLevel:number;
 associationExp:number;
 associationExpNext:number;
 contributionPoint:number;
 totalSilverDonation:number;
 totalGoldDonation:number;
 dailySilverDonation:number;
 dailyGoldDonation:number;
 dailySilverLimit:number;
 dailyGoldLimit:number;
 dailyResetAt:string;
}

export interface AssociationDonationResult {
 progression:AssociationProgression;
 record:CloudSaveRecord;
}

export const donateToAssociation=(lease:GameplayLease,input:{currency:'silver'|'gold';amount:number},requestId:string=crypto.randomUUID())=>
 rpc<AssociationDonationResult>('donate_to_association',{...args(lease),p_request_id:requestId,p_currency:input.currency,p_amount:input.amount});

export const loadAssociationProgression=(lease:GameplayLease)=>
 rpc<AssociationProgression>('get_association_progression',args(lease));
