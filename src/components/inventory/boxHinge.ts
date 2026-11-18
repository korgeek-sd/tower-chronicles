/** Pixel-space rig derived from the existing 112×128 closed and open artwork.
 * The back hinge is fixed. Outside and inside surfaces share one continuous
 * angle, rather than replacing the whole chest texture with another frame.
 */
export const BOX_HINGE=[39,57,97,71] as const;
export const BOX_LID_OUTSIDE=[10,80,10,66,17,51,32,37,45,38,88,48,98,55,102,70,79,91,53,65];
export const BOX_LID_INSIDE=[39,57,97,71,90,41,29,27];
export const BOX_BODY=[0,47,112,74.6,112,128,0,128];
export const BOX_LID_FAN=[0,1,9,1,2,9,2,3,9,3,4,9,4,5,9,5,6,9,6,7,9,7,8,9,8,0,9];
export const BOX_QUAD=[0,1,2,0,2,3];
const rad=Math.PI/180;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(n:number)=>{const t=clamp(n);return t*t*(3-2*t);};
export function lidSurfaceOpacity(angle:number){
 return {outside:1-smooth((angle-28)/27),inside:smooth((angle-28)/18),closed:1-smooth(angle/5)};
}
/** Project the curved outer lid around the back axis; the input art is
 * unchanged at zero. Height and depth rotate together, not as a flat sprite. */
export function projectLidOutside(x:number,y:number,angle:number):[number,number]{
 const h=BOX_HINGE,dx=x-h[0],dy=y-h[1],s=dy-dx*14/58;
 const depth=clamp((s+18)/47),height=depth*(22+26*14/58)-s;
 const u=(dx+26*depth)/58;
 const c=Math.cos(angle*rad),sine=Math.sin(angle*rad);
 const d=depth*c-height/30*sine,z=height*c+30*depth*sine;
 return [h[0]+58*u-26*d,h[1]+14*u+22*d-z];
}
/** Project inside panel from its open texture. The two hinge vertices are
 * invariant for every angle. A small perspective correction matches the art. */
export function projectLidInside(x:number,y:number,angle:number):[number,number]{
 const [hx,hy]=BOX_HINGE;
 // Source inside is a slightly trapezoidal quad; solve a stable affine basis.
 const ux=58,uy=14,vx=-10,vy=-30,det=ux*vy-uy*vx;
 const dx=x-hx,dy=y-hy,u=(dx*vy-dy*vx)/det,v=(ux*dy-uy*dx)/det;
 const c=Math.cos(angle*rad),s=Math.sin(angle*rad);
 return [hx+u*ux+v*(-26*c-10*s),hy+u*uy+v*(22*c-30*s)];
}
export function fillLidVertices(out:Float32Array,source:readonly number[],angle:number,inside:boolean){
 for(let i=0;i<source.length;i+=2){
  const [x,y]=(inside?projectLidInside:projectLidOutside)(source[i],source[i+1],angle);
  out[i]=x;out[i+1]=y;
 }
}
