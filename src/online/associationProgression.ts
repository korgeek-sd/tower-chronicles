import type {GameplayLease} from './gameSession';
import type {CloudSaveRecord} from './cloudSave';
import {getFreshSession} from './auth';
import {getDeviceId} from './cloudSave';
import {supabaseConfig} from './config';

export interface AssociationProgression {
 associationLevel:number;
 associationExp:number;
 associationExpNext:number;
 contributionPoint:number;
 totalSilverDonation:number;
 totalGoldDonation:number;
}

export interface AssociationDonationResult {
 progression:AssociationProgression;
 record:CloudSaveRecord;
}

const args=(lease:GameplayLease)=>({
 p_lease_id:lease.leaseId,
 p_generation:lease.generation,
 p_client_instance_id:lease.clientInstanceId,
 p_device_id:getDeviceId(),
});

async function rpc<T>(name:string,body:Record<string,unknown>):Promise<T>{
 if(!supabaseConfig)throw new Error('Supabase 공개 설정이 필요합니다.');
 const session=await getFreshSession();
 if(!session)throw new Error('Google 로그인이 필요합니다.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const text=await response.text();
 if(!response.ok)throw new Error('원정단 요청을 처리하지 못했습니다.');
 return (text?JSON.parse(text):null) as T;
}

export const donateToAssociation=(lease:GameplayLease,input:{currency:'silver'|'gold';amount:number})=>
 rpc<AssociationDonationResult>('donate_to_association',{...args(lease),p_currency:input.currency,p_amount:input.amount});

export const loadAssociationProgression=(lease:GameplayLease)=>
 rpc<AssociationProgression>('get_association_progression',args(lease));
