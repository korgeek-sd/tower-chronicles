import {supabaseConfig,type SupabasePublicConfig} from './config';
import {getFreshSession,type OnlineSession} from './auth';
import {validateNickname,type PlayerProfile} from './playerProfiles';
import {isPermanentClass} from './permanentClass';
import type {ClassId} from '../game/classes/progression';

// The RPC registers the nickname and the final starting class in ONE database
// transaction. A provisional pre-nickname class may be replaced; after
// registration, both nickname and class are immutable.
export function createInitialCharacterApi(
 config:SupabasePublicConfig,
 getSession:()=>Promise<OnlineSession|null>,
 request:typeof fetch=fetch
){
 return async(nicknameInput:string,classId:ClassId):Promise<PlayerProfile>=>{
  const {nickname,error}=validateNickname(nicknameInput);
  if(error)throw Error(error);
  if(!isPermanentClass(classId))throw Error('선택할 수 없는 직업입니다.');
  const session=await getSession();
  if(!session)throw Error('Google 로그인이 필요합니다.');

  const response=await request(config.url+'/rest/v1/rpc/register_initial_character',{
   method:'POST',
   headers:{
    apikey:config.publishableKey,
    Authorization:'Bearer '+session.accessToken,
    'Content-Type':'application/json'
   },
   body:JSON.stringify({p_nickname:nickname,p_class_id:classId}),
   signal:AbortSignal.timeout(10000)
  });
  const payload:unknown=await response.json();
  if(!response.ok){
   const detail=payload&&typeof payload==='object'?payload as {code?:string;message?:string}:null;
   if(detail?.code==='23505')throw Error('이미 사용 중인 닉네임입니다. 다른 이름을 입력해 주세요.');
   if(detail?.code==='23514'||detail?.code==='22023')throw Error('사용할 수 없는 직업 또는 닉네임입니다.');
   if(detail?.code==='P0001')throw Error('이미 등록된 직업과 이름은 변경할 수 없습니다.');
   throw Error('캐릭터를 서버에 저장하지 못했습니다. 다시 시도해 주세요.');
  }
  if(!Array.isArray(payload)||payload.length!==1)throw Error('캐릭터 등록 결과를 확인하지 못했습니다.');
  const row=payload[0] as {user_id?:unknown;nickname?:unknown;class_id?:unknown};
  if(row.user_id!==session.userId||row.nickname!==nickname||row.class_id!==classId){
   throw Error('캐릭터 등록 결과가 로그인 계정과 일치하지 않습니다.');
  }
  return {userId:session.userId,nickname};
 };
}
const api=()=>{if(!supabaseConfig)throw Error('온라인 설정을 확인하지 못했습니다.');return createInitialCharacterApi(supabaseConfig,getFreshSession);};
export const registerInitialCharacter=(nickname:string,classId:ClassId)=>api()(nickname,classId);
