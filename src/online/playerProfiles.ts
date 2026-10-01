import {supabaseConfig,type SupabasePublicConfig} from './config';
import {getFreshSession,type OnlineSession} from './auth';
export interface PlayerProfile {userId:string;nickname:string}
const reserved=new Set(['admin','administrator','gm','system','운영자','관리자','시스템','공지']);
export function validateNickname(value:string){
 const nickname=value.normalize('NFC').trim();
 const valid=/^[가-힣A-Za-z0-9]{2,12}$/.test(nickname);
 return {nickname,error:!valid?'한글·영문·숫자로 2~12자를 입력해 주세요.':reserved.has(nickname.toLowerCase())?'사용할 수 없는 닉네임입니다.':null};
}
export function createProfileApi(config:SupabasePublicConfig,getSession:()=>Promise<OnlineSession|null>,request:typeof fetch=fetch){
 const session=async()=>{const value=await getSession();if(!value)throw Error('Google 로그인이 필요합니다.');return value;};
 const headers=(token:string)=>({apikey:config.publishableKey,Authorization:'Bearer '+token,'Content-Type':'application/json'});
 const parse=(rows:unknown,userId:string):PlayerProfile|null=>{
  if(!Array.isArray(rows))throw Error('닉네임 정보를 확인하지 못했습니다.');
  const row=rows[0];if(!row)return null;
  if(row.user_id!==userId||typeof row.nickname!=='string'||validateNickname(row.nickname).error)throw Error('닉네임 정보를 확인하지 못했습니다.');
  return {userId,nickname:row.nickname};
 };
 const loadFor=async(s:OnlineSession)=>{
  const response=await request(config.url+'/rest/v1/game_player_profiles?select=user_id,nickname&user_id=eq.'+encodeURIComponent(s.userId)+'&limit=1',{headers:headers(s.accessToken),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('닉네임 정보를 불러오지 못했습니다. 다시 시도해 주세요.');
  return parse(await response.json(),s.userId);
 };
 return {
  load:async()=>loadFor(await session()),
  register:async(value:string)=>{
   const validation=validateNickname(value);if(validation.error)throw Error(validation.error);
   const s=await session();
   const response=await request(config.url+'/rest/v1/game_player_profiles?select=user_id,nickname',{method:'POST',headers:{...headers(s.accessToken),Prefer:'return=representation'},body:JSON.stringify({user_id:s.userId,nickname:validation.nickname}),signal:AbortSignal.timeout(10000)});
   const data=await response.json();
   if(!response.ok){
    if(data?.code==='23505'){const existing=await loadFor(s);if(existing)return existing;throw Error('이미 사용 중인 닉네임입니다. 다른 이름을 입력해 주세요.');}
    if(data?.code==='23514')throw Error('사용할 수 없는 닉네임입니다. 한글·영문·숫자 2~12자를 입력해 주세요.');
    throw Error('닉네임을 저장하지 못했습니다. 다시 시도해 주세요.');
   }
   const profile=parse(data,s.userId);if(!profile)throw Error('닉네임 저장 결과를 확인하지 못했습니다.');return profile;
  },
 };
}
const api=()=>{if(!supabaseConfig)throw Error('온라인 설정을 확인하지 못했습니다.');return createProfileApi(supabaseConfig,getFreshSession);};
export const loadPlayerProfile=()=>api().load();
export const registerPlayerNickname=(value:string)=>api().register(value);
