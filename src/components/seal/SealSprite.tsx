import React,{useEffect,useRef} from 'react';
import type{AssociationSealId} from '../../online/seal';
import atlasUrl from '../../assets/ui/seals/guild-seal-animations.avif';

type SealVisual=AssociationSealId|'sealed-3'|'sealed-4';
type SpriteMode='idle'|'forge'|'reset';
type Motion={start:number;frames:number;fps:number;loop:boolean};
const spriteSize=72;
const columns=10;
const rows=16;
export const totalFrames=156;
const motion:Record<string,Motion>={
 combat_tier1_idle:{start:16,frames:8,fps:7,loop:true},
 combat_tier1_forge:{start:24,frames:12,fps:13,loop:false},
 combat_tier2_idle:{start:36,frames:8,fps:7,loop:true},
 combat_tier2_forge:{start:44,frames:12,fps:13,loop:false},
 combat_tier3_idle:{start:56,frames:8,fps:7,loop:true},
 combat_tier3_forge:{start:64,frames:12,fps:13,loop:false},
 combat_reset:{start:76,frames:10,fps:12,loop:false},
 guardian_tier1_idle:{start:86,frames:8,fps:7,loop:true},
 guardian_tier1_forge:{start:94,frames:12,fps:13,loop:false},
 guardian_tier2_idle:{start:106,frames:8,fps:7,loop:true},
 guardian_tier2_forge:{start:114,frames:12,fps:13,loop:false},
 guardian_tier3_idle:{start:126,frames:8,fps:7,loop:true},
 guardian_tier3_forge:{start:134,frames:12,fps:13,loop:false},
 guardian_reset:{start:146,frames:10,fps:12,loop:false},
};
const tierForLevel=(level:number)=>level>=20?3:level>=10?2:1;
const sealArtId=(seal:AssociationSealId)=>seal==='guardian'?'guardian':'combat';
const iconIndex=(variant:SealVisual,level:number)=>{
 if(variant==='sealed-3')return 6;
 if(variant==='sealed-4')return 7;
 return (variant==='guardian'?3:0)+(tierForLevel(level)-1);
};
/** The six engraved stones use slots 9–14 of the shared real-image atlas. */
export function SealSpriteIcon({variant,level=0,milestone,active=true,className=''}:{
 variant?:SealVisual;level?:number;milestone?:number;active?:boolean;className?:string;
}){
 const index=milestone===undefined?iconIndex(variant??'association',level):
  !active?8:Math.min(14,8+Math.floor(milestone/5));
 const x=index%columns,y=Math.floor(index/columns);
 return <span aria-hidden="true" className={'tc-insignia-icon '+className}
  style={{
   backgroundImage:`url("${atlasUrl}")`,
   backgroundSize:`${columns*100}% ${rows*100}%`,
   backgroundPosition:`${x/(columns-1)*100}% ${y/(rows-1)*100}%`,
  }}/>;
}
/** Purely visual; no RNG or server updates originate from this component.
 * A forge or reset sequence is played only after its RPC is confirmed.
 */
export function SealSprite({variant,level,mode,sequence}:{
 variant:AssociationSealId;level:number;mode:SpriteMode;sequence:number;
}){
 const canvasRef=useRef<HTMLCanvasElement|null>(null);
 useEffect(()=>{
  const canvas=canvasRef.current;
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  if(!ctx)return;
  const image=new Image();
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const seal=sealArtId(variant);
  const tier=tierForLevel(level);
  let disposed=false;
  let timer:number|undefined;
  const draw=(frame:number)=>{
   if(disposed)return;
   const x=(frame%columns)*spriteSize;
   const y=Math.floor(frame/columns)*spriteSize;
   ctx.clearRect(0,0,canvas.width,canvas.height);
   ctx.imageSmoothingEnabled=true;
   ctx.imageSmoothingQuality='high';
   ctx.drawImage(image,x,y,spriteSize,spriteSize,0,0,canvas.width,canvas.height);
  };
  const start=(action:SpriteMode)=>{
   if(disposed)return;
   if(timer!==undefined)window.clearInterval(timer);
   timer=undefined;
   const key=action==='reset'?`${seal}_reset`:`${seal}_tier${tier}_${action}`;
   const animation=motion[key]??motion[`${seal}_tier${tier}_idle`];
   let frame=0;
   draw(animation.start);
   if(media.matches)return;
   timer=window.setInterval(()=>{
    frame++;
    if(frame>=animation.frames){
     if(animation.loop)frame=0;
     else{start('idle');return;}
    }
    draw(animation.start+frame);
   },1000/animation.fps);
  };
  const begin=()=>{if(!disposed)start(mode)};
  image.onload=begin;
  image.src=atlasUrl;
  if(image.complete&&image.naturalWidth)begin();
  return()=>{
   disposed=true;
   image.onload=null;
   if(timer!==undefined)window.clearInterval(timer);
  };
 },[variant,level,mode,sequence]);
 return <canvas ref={canvasRef} width={216} height={216} className="tc-insignia-sprite"
  role="img" aria-label={variant==='guardian'?'수호 인장 애니메이션':'전투 인장 애니메이션'}/>;
}
