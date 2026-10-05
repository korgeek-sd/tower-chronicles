export type FighterImageRendering='auto'|'pixelated';

export const LOW_RES_FIGHTER_MAX_PX=256;
const FIGHTER_SELECTOR='.tc-battle .player-figure img,.tc-battle .monster-figure img';

export function fighterImageRendering(width:number,height:number):FighterImageRendering{
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return 'auto';
 return Math.max(width,height)<=LOW_RES_FIGHTER_MAX_PX?'pixelated':'auto';
}

function applyFighterRendering(image:HTMLImageElement){
 if(!image.matches(FIGHTER_SELECTOR)||!image.complete||image.naturalWidth<=0||image.naturalHeight<=0)return;
 image.dataset.rendering=fighterImageRendering(image.naturalWidth,image.naturalHeight);
}

function scanFighterImages(root:ParentNode=document){
 root.querySelectorAll<HTMLImageElement>(FIGHTER_SELECTOR).forEach(applyFighterRendering);
}

export function installAdaptiveFighterRendering(){
 if(typeof document==='undefined'||typeof MutationObserver==='undefined')return()=>{};
 const handleLoad=(event:Event)=>{
  const target=event.target;
  if(target instanceof HTMLImageElement)applyFighterRendering(target);
 };
 document.addEventListener('load',handleLoad,true);
 scanFighterImages();
 const observer=new MutationObserver(records=>{
  for(const record of records){
   for(const node of record.addedNodes){
    if(!(node instanceof Element))continue;
    if(node instanceof HTMLImageElement)applyFighterRendering(node);
    scanFighterImages(node);
   }
  }
 });
 observer.observe(document.documentElement,{childList:true,subtree:true});
 return()=>{
  document.removeEventListener('load',handleLoad,true);
  observer.disconnect();
 };
}

installAdaptiveFighterRendering();
