import {Capacitor} from '@capacitor/core';
import {getStoredSession} from './auth';
import {setGamePushToken} from './notifications';
import {PushNotifications,type PluginListenerHandle} from '@capacitor/push-notifications';

let listeners:PluginListenerHandle[]=[];
let currentUser:string|null=null;
let currentToken:string|null=null;
let generation=0;
export function isAndroidPushAvailable(){return Capacitor.getPlatform()==='android';}
export async function stopNativePushListeners(){
 generation++;currentUser=null;
 const previous=listeners;listeners=[];
 await Promise.all(previous.map(listener=>listener.remove().catch(()=>{})));
}
export async function initializeNativePush(userId:string){
 if(!isAndroidPushAvailable())return;
 await stopNativePushListeners();
 const mine=++generation;currentUser=userId;
 const isCurrent=()=>generation===mine&&currentUser===userId&&getStoredSession()?.userId===userId;
 listeners=[
  await PushNotifications.addListener('registration',token=>{
   if(!isCurrent())return;
   currentToken=token.value;
   void setGamePushToken(userId,token.value).catch(()=>window.dispatchEvent(new CustomEvent('tc-push-status',{detail:'기기 등록에 실패했습니다.'})));
  }),
  await PushNotifications.addListener('registrationError',()=>{
   if(isCurrent())window.dispatchEvent(new CustomEvent('tc-push-status',{detail:'Firebase 알림 등록에 실패했습니다. APK 설정을 확인하세요.'}));
  }),
  await PushNotifications.addListener('pushNotificationReceived',()=>{
   if(isCurrent())window.dispatchEvent(new Event('tc-game-notifications-updated'));
  }),
  await PushNotifications.addListener('pushNotificationActionPerformed',event=>{
   if(!isCurrent())return;
   const target=event.notification.data?.target;
   window.dispatchEvent(new CustomEvent('tc-game-notification-tap',{detail:{target:typeof target==='string'?target:'home'}}));
  }),
 ];
 try{
  const permissions=await PushNotifications.checkPermissions();
  if(isCurrent()&&permissions.receive==='granted')await PushNotifications.register();
 }catch{/* The user can retry from the notification center. */}
}
export async function enableNativePush(userId:string){
 if(!isAndroidPushAvailable())throw Error('푸시 알림은 Android APK에서만 활성화할 수 있습니다.');
 if(currentUser!==userId)await initializeNativePush(userId);
 const permissions=await PushNotifications.checkPermissions();
 const result=permissions.receive==='granted'?permissions:await PushNotifications.requestPermissions();
 if(result.receive!=='granted')throw Error('휴대전화 알림 권한을 허용해야 합니다.');
 await PushNotifications.createChannel({id:'tower-events',name:'게임 주요 알림',description:'거래·우편·전쟁·은행 알림',importance:4,visibility:1,sound:'default'});
 await PushNotifications.register();
 return '알림 권한을 확인했습니다. Firebase 연결 시 기기가 자동 등록됩니다.';
}
export async function disableNativePush(userId:string){
 if(currentToken&&getStoredSession()?.userId===userId){
  await setGamePushToken(userId,currentToken,false);
 }
 currentToken=null;
 await PushNotifications.unregister();
}
