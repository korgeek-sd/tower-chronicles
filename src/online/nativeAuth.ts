import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {Capacitor} from '@capacitor/core';
import {completeGoogleOAuth,NATIVE_OAUTH_REDIRECT} from './auth';
import {supabaseConfig} from './config';

const expected=new URL(NATIVE_OAUTH_REDIRECT);
export function isNativeGoogleOAuthCallback(value:string):boolean{
 try{
  const url=new URL(value);
  return url.protocol===expected.protocol&&url.hostname===expected.hostname&&url.pathname===expected.pathname
   &&(url.searchParams.has('code')||url.searchParams.has('error')||url.hash.includes('error='));
 }catch{return false;}
}

/** Set up before the game UI mounts, including cold-start callback delivery. */
export async function initializeNativeOAuth():Promise<void>{
 if(!Capacitor.isNativePlatform())return;
 let processing=false;
 let lastHandledUrl='';
 const finish=async(url:string,reload:boolean)=>{
  if(processing||url===lastHandledUrl||!isNativeGoogleOAuthCallback(url))return;
  processing=true;
  lastHandledUrl=url;
  try{
   if(!supabaseConfig)throw Error('AUTH_CONFIG_MISSING');
   await completeGoogleOAuth(supabaseConfig,url,localStorage,localStorage);
   localStorage.removeItem('tower-native-auth-error');
  }catch{
   localStorage.setItem('tower-native-auth-error','1');
  }finally{
   try{await Browser.close();}catch{}
   processing=false;
   if(reload)window.location.reload();
  }
 };
 await App.addListener('appUrlOpen',({url})=>{void finish(url,true);});
 const launch=await App.getLaunchUrl();
 if(launch?.url&&isNativeGoogleOAuthCallback(launch.url))await finish(launch.url,false);
 if(localStorage.getItem('tower-native-auth-error')){
  localStorage.removeItem('tower-native-auth-error');
  throw Error('AUTH_NATIVE_CALLBACK_FAILED');
 }
}
