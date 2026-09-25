import type {GameState} from '../game/types';
import {APP_VERSION,validSave} from '../storage/repository';
import {supabaseConfig} from './config';
import {getFreshSession} from './auth';

export const CLOUD_META_KEY='tower-cloud-meta-v1';
export const DEVICE_ID_KEY='tower-device-id-v1';

export interface CloudSaveRecord {
 revision:number;
 saveSchema:number;
 appVersion:string;
 payload:GameState;
 payloadHash:string;
 updatedAt:string;
}

export interface CloudMeta {userId:string;revision:number;payloadHash:string;updatedAt:string}

export class CloudConflictError extends Error {
 constructor(public serverRevision:number|null){super('다른 기기에서 더 최근의 클라우드 저장이 발견되었습니다.');this.name='CloudConflictError';}
}

export function stableStringify(value:unknown):string {
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(stableStringify).join(',')+']';
 const object=value as Record<string,unknown>;
 return '{'+Object.keys(object).sort().map(key=>JSON.stringify(key)+':'+stableStringify(object[key])).join(',')+'}';
}

export async function hashPayload(payload:GameState):Promise<string>{
 const bytes=new TextEncoder().encode(stableStringify(payload));
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

export function getDeviceId(storage:Storage=localStorage){
 let value=storage.getItem(DEVICE_ID_KEY);
 if(!value){value=crypto.randomUUID();storage.setItem(DEVICE_ID_KEY,value);}
 return value;
}

const headers=(token:string)=>({
 apikey:supabaseConfig!.publishableKey,
 Authorization:'Bearer '+token,
 'Content-Type':'application/json',
});

export async function loadCloudSave():Promise<CloudSaveRecord|null>{
 if(!supabaseConfig)throw Error('Supabase 공개 설정이 필요합니다.');
 const session=await getFreshSession();
 if(!session)throw Error('Google 로그인이 필요합니다.');
 const url=new URL('/rest/v1/game_saves',supabaseConfig.url);
 url.searchParams.set('select','revision,save_schema,app_version,payload,payload_hash,updated_at');
 url.searchParams.set('user_id','eq.'+session.userId);
 url.searchParams.set('limit','1');
 const response=await fetch(url,{headers:headers(session.accessToken)});
 if(!response.ok)throw Error('클라우드 저장을 읽지 못했습니다.');
 const rows=await response.json() as Array<{revision:number;save_schema:number;app_version:string;payload:GameState;payload_hash:string;updated_at:string}>;
 const row=rows[0];if(!row)return null;
 if(!validSave(row.payload))throw Error('클라우드 저장 데이터의 구조가 올바르지 않습니다.');
 const actualHash=await hashPayload(row.payload);
 if(actualHash!==row.payload_hash)throw Error('클라우드 저장 데이터의 무결성 확인에 실패했습니다.');
 return {revision:row.revision,saveSchema:row.save_schema,appVersion:row.app_version,payload:row.payload,payloadHash:row.payload_hash,updatedAt:row.updated_at};
}

export async function saveCloudState(payload:GameState,baseRevision:number):Promise<CloudSaveRecord>{
 if(!validSave(payload))throw Error('유효하지 않은 게임 상태는 클라우드에 저장할 수 없습니다.');
 if(!supabaseConfig)throw Error('Supabase 공개 설정이 필요합니다.');
 const session=await getFreshSession();
 if(!session)throw Error('Google 로그인이 필요합니다.');
 const payloadHash=await hashPayload(payload);
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/save_game_state',{
  method:'POST',headers:headers(session.accessToken),
  body:JSON.stringify({
   p_base_revision:baseRevision,
   p_save_schema:payload.version,
   p_app_version:APP_VERSION,
   p_payload:payload,
   p_payload_hash:payloadHash,
   p_device_id:getDeviceId(),
  }),
 });
 if(response.status===409)throw new CloudConflictError(null);
 if(!response.ok){
  const text=await response.text();
  if(text.includes('SAVE_CONFLICT'))throw new CloudConflictError(null);
  throw Error('클라우드 저장에 실패했습니다.');
 }
 const rows=await response.json() as Array<{revision:number;updated_at:string}>;
 const result=rows[0];
 if(!result)throw Error('클라우드 저장 결과를 확인하지 못했습니다.');
 const record={revision:result.revision,saveSchema:payload.version,appVersion:APP_VERSION,payload,payloadHash,updatedAt:result.updated_at};
 const meta:CloudMeta={userId:session.userId,revision:record.revision,payloadHash,updatedAt:record.updatedAt};
 localStorage.setItem(CLOUD_META_KEY,JSON.stringify(meta));
 return record;
}

export function readCloudMeta(storage:Storage=localStorage):CloudMeta|null{
 try{
  const value=JSON.parse(storage.getItem(CLOUD_META_KEY)??'null') as CloudMeta|null;
  return value&&typeof value.userId==='string'&&Number.isSafeInteger(value.revision)?value:null;
 }catch{return null;}
}
