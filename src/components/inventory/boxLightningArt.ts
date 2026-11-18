/** Baked pixelfx frames: .8s charging, 1.2s discharge and decay. */
export function lightningArtPose(age:number){
 if(age<0||age>=2)return null;
 return {frame:Math.min(47,Math.floor(age*24)),alpha:1,scale:1};
}
