/** Four authored drawings, with a held impact and a short dissolving tail. */
export function lightningArtPose(age:number){
 if(age<.16||age>=1.4)return null;
 const frame=age<.72?Math.floor((age-.16)*10)%2:age<1?2:3;
 return {frame,alpha:age<1?1:Math.max(0,(1.4-age)/.4),scale:age<.26?.88+.12*(age-.16)/.1:1};
}
/** Traces follow the existing perspective chest metalwork, not arbitrary endpoints. */
export const CHARGE_TRACES=[
 [-98,4,-98,-24,-84,-24,-84,-48,-60,-48,-60,-72,-32,-72],
 [8,-56,28,-56,28,-40,48,-40,48,-20,72,-20,72,12],
 [-94,30,-70,30,-70,42,-34,42,-34,22,-12,22],
 [12,52,36,52,36,40,66,40,66,20,92,20],
 [-100,-12,-128,-24,-112,-44,-136,-56,-116,-84,-88,-84],
 [76,-8,116,-28,100,-44,128,-64,112,-92,88,-100]
] as const;
