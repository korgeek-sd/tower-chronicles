import {supabaseConfig} from './config';
import {getFreshSession} from './auth';
import {getDeviceId} from './cloudSave';

export type GameNotificationTarget='home'|'mail'|'gold-exchange'|'bank'|'association'|'occupation';
export interface GameNotification{
 id:string;category:'trade'|'mail'|'bank'|'auction'|'war';
 title:string;body:string;target:GameNotificationTarget;createdAt:number;read:boolean;
}
export interface GameNotificationState{unread:number;items:GameNotification[]}

async function rpc<T>(name:string,args:Record<string,unknown>={},expectedUser?:string):Promise<T>{
 if(!supabaseConfig)throw Error('온라인 설정이 필요합니다.');
 const session=await getFreshSession();
 if(!session||expectedUser&&session.userId!==expectedUser)throw Error('로그인을 다시 확인해 주세요.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+name,{
  method:'POST',headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},
  body:JSON.stringify(args),signal:AbortSignal.timeout(15000),
 });
 if(!response.ok)throw Error('알림 정보를 처리하지 못했습니다.');
 return (response.status===204?null:await response.json()) as T;
}
export const getGameNotifications=(userId:string)=>rpc<GameNotificationState>('get_game_notifications',{},userId);
export const readGameNotifications=(userId:string,ids:string[]|null)=>rpc<GameNotificationState>('read_game_notifications',{p_ids:ids},userId);
export const setGamePushToken=(userId:string,token:string,enabled=true)=>rpc<void>('set_game_push_token',{
 p_token:token,p_device_id:getDeviceId(),p_enabled:enabled,
},userId);
