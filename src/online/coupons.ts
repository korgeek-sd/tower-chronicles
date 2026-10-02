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
  if(time < new Date(coupon.startsAt).getTime()) {
    return {ok:false,message:'아직 사용할 수 없는 쿠폰입니다.'};
  }
  if(time > new Date(coupon.expiresAt).getTime()) {
    return {ok:false,message:'기간이 만료된 쿠폰입니다.'};
  }
  return {ok:true,message:'쿠폰 사용 가능',reward:coupon.reward};
}
