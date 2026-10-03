import {getFreshSession} from './auth';
import {supabaseConfig,type SupabasePublicConfig} from './config';
export interface FriendInviteState {code:string;rewardedInvites:number;rewardLimit:100;appliedCode:string|null;appliedAt:string|null}
export interface FriendInviteResult extends FriendInviteState {duplicate:boolean}
export const normalizeInviteCode=(code:string)=>code.trim().toUpperCase();
const codePattern=/^TC-[A-F0-9]{12}$/;
export function parseInviteState(value:unknown):FriendInviteState {
 const s=value as FriendInviteState;
 if(!s||typeof s.code!=='string'||!codePattern.test(s.code)||!Number.isInteger(s.rewardedInvites)||s.rewardedInvites<0||s.rewardedInvites>100||s.rewardLimit!==100||!(s.appliedCode===null||typeof s.appliedCode==='string'&&codePattern.test(s.appliedCode))||!(s.appliedAt===null||typeof s.appliedAt==='string'&&Number.isFinite(Date.parse(s.appliedAt)))||(s.appliedCode===null)!==(s.appliedAt===null))throw Error('초대 정보를 확인하지 못했습니다. 다시 시도해 주세요.');
 return {code:s.code,rewardedInvites:s.rewardedInvites,rewardLimit:100,appliedCode:s.appliedCode,appliedAt:s.appliedAt};
}
const errors:Record<string,string>={INVITE_AUTH_REQUIRED:'Google 로그인이 필요합니다.',INVITE_PROFILE_REQUIRED:'닉네임을 등록한 후 이용해 주세요.',INVITE_CODE_INVALID:'유효한 친구 초대 코드를 입력해 주세요.',INVITE_SELF_FORBIDDEN:'자신의 초대 코드는 적용할 수 없습니다.',INVITE_ALREADY_APPLIED:'이 계정은 이미 친구 초대 코드를 적용했습니다.'};
export function createFriendInviteApi(config:SupabasePublicConfig|null,getSession:()=>Promise<{userId:string;accessToken:string}|null>,request:typeof fetch=fetch){
 async function rpc(userId:string,name:string,args:Record<string,unknown>={}){
  if(!config)throw Error('온라인 설정이 필요합니다.');
  const session=await getSession();if(!session||session.userId!==userId)throw Error('계정이 변경되었습니다. 설정 창을 다시 열어 주세요.');
  const response=await request(config.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:config.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});
  const raw=await response.text();if(!response.ok){for(const [code,message] of Object.entries(errors))if(raw.includes(code))throw Error(message);throw Error('친구 초대 요청에 실패했습니다. 다시 시도해 주세요.');}
  return JSON.parse(raw) as unknown;
 }
 return {load:async(userId:string)=>parseInviteState(await rpc(userId,'get_friend_invite_state')),apply:async(userId:string,code:string):Promise<FriendInviteResult>=>{const raw=await rpc(userId,'apply_friend_invite_code',{p_code:normalizeInviteCode(code)});const state=parseInviteState(raw);if(typeof (raw as FriendInviteResult).duplicate!=='boolean')throw Error('적용 결과를 확인하지 못했습니다. 다시 시도해 주세요.');return {...state,duplicate:(raw as FriendInviteResult).duplicate};}};
}
const api=createFriendInviteApi(supabaseConfig,getFreshSession);
export const loadFriendInviteState=api.load;
export const applyFriendInviteCode=api.apply;
