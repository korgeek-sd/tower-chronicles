import {supabaseConfig,type SupabasePublicConfig} from './config';
import {getFreshSession,type OnlineSession} from './auth';
import type {ClassId} from '../game/classes/progression';

type ClassRow={user_id:string;class_id:ClassId};
export const isPermanentClass=(value:unknown):value is ClassId=>value==='warrior'||value==='mage'||value==='archer';

export function createPermanentClassApi(
 config:SupabasePublicConfig,
 session:()=>Promise<OnlineSession|null>,
 request:typeof fetch=fetch
){
 const connected=async(userId:string)=>{
  const current=await session();
  if(!current||current.userId!==userId)throw Error('로그인 계정을 확인하지 못했습니다. 다시 로그인해 주세요.');
  return current;
 };
 const headers=(token:string)=>({apikey:config.publishableKey,Authorization:'Bearer '+token,'Content-Type':'application/json'});
 const url=config.url+'/rest/v1/game_initial_classes';
 const load=async(userId:string):Promise<ClassId|null>=>{
   const current=await connected(userId);
   const response=await request(url+'?select=user_id,class_id&user_id=eq.'+encodeURIComponent(userId)+'&limit=1',{
    headers:headers(current.accessToken),signal:AbortSignal.timeout(10000)
   });
   if(!response.ok)throw Error('서버에서 직업 기록을 불러오지 못했습니다. 다시 시도해 주세요.');
   const data:unknown=await response.json();
   if(!Array.isArray(data))throw Error('서버의 직업 응답이 올바르지 않습니다.');
   if(data.length===0)return null;
   const row=data[0] as Partial<ClassRow>;
   if(row.user_id!==userId||!isPermanentClass(row.class_id))throw Error('서버의 직업 기록이 올바르지 않습니다.');
   return row.class_id;
  };
 return {
  load,
  lock:async(userId:string,id:ClassId):Promise<ClassId>=>{
   if(!isPermanentClass(id))throw Error('선택할 수 없는 직업입니다.');
   const current=await connected(userId);
   const response=await request(url+'?select=user_id,class_id',{
    method:'POST',headers:{...headers(current.accessToken),Prefer:'return=representation'},
    body:JSON.stringify({user_id:userId,class_id:id}),signal:AbortSignal.timeout(10000)
   });
   if(response.status===409||!response.ok){
    let code='';
    try{const error=await response.json() as {code?:string};code=error?.code??'';}catch{}
    if(response.status===409||code==='23505'){
     const existing=await load(userId);
     if(existing===id)return id;
     throw Error('이미 확정된 직업은 변경할 수 없습니다.');
    }
    throw Error('직업을 서버에 저장하지 못했습니다. 다시 시도해 주세요.');
   }
   const data:unknown=await response.json();
   if(!Array.isArray(data)||data.length!==1)throw Error('서버의 직업 저장 결과를 확인하지 못했습니다.');
   const row=data[0] as Partial<ClassRow>;
   if(row.user_id!==userId||row.class_id!==id)throw Error('서버의 직업 확정 결과가 일치하지 않습니다.');
   return id;
  }
 };
}
const api=()=>{if(!supabaseConfig)throw Error('온라인 설정을 확인하지 못했습니다.');return createPermanentClassApi(supabaseConfig,getFreshSession);};
export const loadPermanentClass=(userId:string)=>api().load(userId);
export const lockPermanentClass=(userId:string,id:ClassId)=>api().lock(userId,id);
