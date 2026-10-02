import {getFreshSession} from './auth';
import {supabaseConfig} from './config';
export type CouponReward = {
  gold?: number;
  silver?: number;
  items?: { id:string; quantity:number }[];
};

export type CouponState = {
  code:string;
  name:string;
  reward:CouponReward;
  startsAt:string;
  expiresAt:string;
  maxUses?:number;
};

export type CouponResult =
  | { ok:true; message:string; reward:CouponReward }
  | { ok:false; message:string };

/**
 * Coupon verification hook.
 * Server RPC validation should call this flow before creating reward mail.
 */
export function validateCouponWindow(coupon:CouponState, now=new Date()):CouponResult {
  const time=now.getTime();
  if(!Number.isFinite(time)||!Number.isFinite(Date.parse(coupon.startsAt))||!Number.isFinite(Date.parse(coupon.expiresAt))||Date.parse(coupon.expiresAt)<=Date.parse(coupon.startsAt))return {ok:false,message:'쿠폰 기간이 올바르지 않습니다.'};
  if(time < new Date(coupon.startsAt).getTime()) {
    return {ok:false,message:'아직 사용할 수 없는 쿠폰입니다.'};
  }
  if(time >= new Date(coupon.expiresAt).getTime()) {
    return {ok:false,message:'기간이 만료된 쿠폰입니다.'};
  }
  return {ok:true,message:'쿠폰 사용 가능',reward:coupon.reward};
}

export interface AdminCoupon extends CouponState {couponId:string;enabled:boolean;usedCount:number}
const errors:Record<string,string>={AUTH_REQUIRED:'Google 로그인이 필요합니다.',COUPON_INVALID:'유효한 쿠폰 코드를 입력해 주세요.',COUPON_NOT_STARTED:'아직 사용할 수 없는 쿠폰입니다.',COUPON_EXPIRED:'기간이 만료된 쿠폰입니다.',COUPON_ALREADY_USED:'이미 사용한 쿠폰입니다.',COUPON_EXHAUSTED:'쿠폰 사용 수량이 모두 소진되었습니다.',COUPON_ADMIN_REQUIRED:'쿠폰 관리자 권한이 필요합니다.',COUPON_DUPLICATE:'이미 등록된 쿠폰 코드입니다.',COUPON_REWARD_INVALID:'보상 수량과 아이템을 확인해 주세요.',COUPON_CONFIG_INVALID:'코드·이름·기간·사용 한도를 확인해 주세요.'};
async function couponRpc<T>(userId:string,name:string,args:Record<string,unknown>={}):Promise<T>{
 if(!supabaseConfig)throw Error('온라인 설정이 필요합니다.');
 const session=await getFreshSession();if(!session||session.userId!==userId)throw Error('계정이 변경되었습니다. 설정창을 다시 열어 주세요.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},body:JSON.stringify(args)});
 const raw=await response.text();if(!response.ok){for(const [code,message]of Object.entries(errors))if(raw.includes(code))throw Error(message);throw Error('쿠폰 요청에 실패했습니다. 다시 시도해 주세요.');}return JSON.parse(raw) as T;
}
export const redeemCoupon=(userId:string,code:string)=>couponRpc<{ok:true;mailId:string;name:string}>(userId,'redeem_game_coupon',{p_code:code.trim().toUpperCase()});
export const couponAdminStatus=(userId:string)=>couponRpc<boolean>(userId,'is_coupon_admin');
export const listAdminCoupons=(userId:string)=>couponRpc<AdminCoupon[]>(userId,'list_game_coupons');
export const createAdminCoupon=(userId:string,coupon:CouponState)=>couponRpc<AdminCoupon>(userId,'create_game_coupon',{p_code:coupon.code.trim().toUpperCase(),p_name:coupon.name.trim(),p_reward:coupon.reward,p_starts_at:coupon.startsAt,p_expires_at:coupon.expiresAt,p_max_uses:coupon.maxUses??null});
export const setCouponEnabled=(userId:string,couponId:string,enabled:boolean)=>couponRpc<void>(userId,'set_game_coupon_enabled',{p_coupon_id:couponId,p_enabled:enabled});

