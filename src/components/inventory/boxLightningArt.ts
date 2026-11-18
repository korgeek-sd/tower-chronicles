/** Baked pixelfx frames: .8s charging, 1.2s discharge and decay. */
export function lightningArtPose(age:number){
 if(age<0||age>=2)return null;
 return {frame:Math.min(47,Math.floor(age*24)),alpha:1,scale:1};
}
/** Align binding current and seam pressure to each grade; keep the release speed fixed. */
export function boxLightningTime(seconds:number,charge:number,hold:number,burst:number){
 if(seconds<charge)return -1;
 if(seconds<hold)return .72*(seconds-charge)/Math.max(.01,hold-charge);
 if(seconds<burst)return .72+.08*(seconds-hold)/Math.max(.01,burst-hold);
 return .8+(seconds-burst);
}
