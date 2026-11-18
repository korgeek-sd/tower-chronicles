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
/** Bake colored edges and glow while preserving the white-hot core. */
export const BOX_LIGHTNING_STYLES={
 common:{palette:['#181b24','#353b48','#606979','#8995a3','#d4dce6','#edf1f6','#fafbff','#ffffff'],spark:0xd4dce6,inside:0xeef2f8},
 uncommon:{palette:['#11251e','#20482c','#34783b','#54b64a','#88ed65','#c4ffa2','#ecffe0','#ffffff'],spark:0x88ed65,inside:0xe0ffd1},
 rare:{palette:['#101b35','#163865','#205a9b','#328de6','#62bdff','#ace3ff','#e3f5ff','#ffffff'],spark:0x62bdff,inside:0xd6edff},
 heroic:{palette:['#251338','#482064','#75379f','#a55cde','#cd8bff','#e8c0ff','#f6e7ff','#ffffff'],spark:0xcd8bff,inside:0xf0ddff},
 legendary:{palette:['#241329','#643028','#aa531d','#e59825','#ffc84b','#ffe992','#fff6cb','#ffffff'],spark:0xffc84b,inside:0xffe1a0}
} as const;
export type BoxLightningGrade=keyof typeof BOX_LIGHTNING_STYLES;
