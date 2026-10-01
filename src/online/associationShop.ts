import {getFreshSession} from './auth';
import {supabaseConfig} from './config';
import {getDeviceId} from './cloudSave';
import type {GameplayLease} from './gameSession';

export type AssociationShopReset='DAILY'|'WEEKLY';

export interface OnlineAssociationShopItem {
 itemId:string;
 name:string;
 description:string;
 reset:AssociationShopReset;
 contributionCost:number;
 purchaseLimit:number;
 purchased:number;
}

export interface OnlineAssociationShopState {
 contribution:number;
 daily:OnlineAssociationShopItem[];
 weekly:OnlineAssociationShopItem[];
}

export interface OnlineAssociationShopResult {
 state:OnlineAssociationShopState;
}

const headers=(token:string)=>({
 apikey:supabaseConfig!.publishableKey,
 Authorization:'Bearer '+token,
 'Content-Type':'application/json',
});

async function rpc<T>(name:string,body:Record<string,unknown>):Promise<T>{
 if(!supabaseConfig)throw Error('Supabase 공개 설정이 필요합니다.');
 const session=await getFreshSession();
 if(!session)throw Error('Google 로그인이 필요합니다.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+name,{
  method:'POST',
  headers:headers(session.accessToken),
  body:JSON.stringify(body),
 });
 const text=await response.text();
 if(!response.ok)throw Error(text||'원정단 상점 요청을 처리하지 못했습니다.');
 return (text?JSON.parse(text):null) as T;
}

const leaseArgs=(lease:GameplayLease)=>({
 p_lease_id:lease.leaseId,
 p_generation:lease.generation,
 p_client_instance_id:lease.clientInstanceId,
 p_device_id:getDeviceId(),
});

export function loadOnlineAssociationShop(lease:GameplayLease){
 return rpc<OnlineAssociationShopState>('get_online_association_shop',leaseArgs(lease));
}

export function buyOnlineAssociationShopItem(lease:GameplayLease,itemId:string){
 return rpc<OnlineAssociationShopResult>('buy_online_association_shop_item',{
  ...leaseArgs(lease),
  p_item_id:itemId,
 });
}
