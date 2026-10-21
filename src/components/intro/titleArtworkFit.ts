// Must match start-background-pixel.webp and the image's center 56% cover alignment.
export const TITLE_ART_WIDTH=841;
export const TITLE_ART_HEIGHT=1870;
export function fitTitleArtwork(width:number,height:number){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return null;
 const scale=Math.max(width/TITLE_ART_WIDTH,height/TITLE_ART_HEIGHT);
 const artWidth=TITLE_ART_WIDTH*scale,artHeight=TITLE_ART_HEIGHT*scale;
 return {width:artWidth,height:artHeight,left:(width-artWidth)/2,top:(height-artHeight)*.56};
}
