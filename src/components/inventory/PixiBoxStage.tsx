import React,{useEffect,useRef} from 'react';
import {gsap} from 'gsap';
import {assetUrl} from '../../game/data/graphics';
import type {EquipmentItem} from '../../game/types';
import type {boxReveal} from './boxPresentation';
type Reveal=NonNullable<ReturnType<typeof boxReveal>>;
const chestURL=assetUrl('assets/ui/shop/adventurer_equipment_box.png');
const colors={common:0xd5c7a9,uncommon:0x82b86b,rare:0x60bfff,heroic:0xbc7ce0,legendary:0xffcc66};
const ranks=['common','uncommon','rare','heroic','legendary'] as const;
let engine:Promise<typeof import('pixi.js')>|undefined;
// The production CSP deliberately disallows dynamic code evaluation and blob workers.
const loadEngine=()=>engine??=(import('pixi.js').then(async P=>{
 await import('pixi.js/unsafe-eval'); // Installs CSP-safe uniform and shader synchronization, not an unsafe-eval permission.
 return P;
}).catch(error=>{engine=undefined;throw error;}));
const images=new Map<string,Promise<HTMLImageElement>>();
function loadImage(url:string){
 const absolute=new URL(url,document.baseURI).href;
 let promise=images.get(absolute);
 if(!promise){
  promise=new Promise<HTMLImageElement>((resolve,reject)=>{
   const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Could not load box art: '+absolute));image.src=absolute;
  }).catch(error=>{images.delete(absolute);throw error;});
  images.set(absolute,promise);
 }
 return promise;
}
export function preloadBoxEffects(){void loadEngine().catch(()=>{});void loadImage(chestURL).catch(()=>{});}
export type BoxRendererStatus='loading'|'gpu'|'fallback';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const ease=(v:number)=>1-Math.pow(1-clamp(v),3);
const TAU=Math.PI*2;
/** Local visualisation only. Receipt is authoritative; no random equipment is generated here. */
export function PixiBoxStage({feedback,reward,onStatus}:{feedback:Reveal;reward:EquipmentItem;onStatus:(status:BoxRendererStatus)=>void}){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!host.current||!feedback.duration)return;
  const target=host.current;onStatus('loading');
  let disposed=false,cleanup:(()=>void)|undefined;
  const started=performance.now();
  const fail=(error:unknown)=>{if(disposed)return;try{cleanup?.();}catch{}cleanup=undefined;console.warn('[Box FX] GPU renderer unavailable',error);onStatus('fallback');};
  void (async()=>{
   const [P,chestImage,prizeImage]=await Promise.all([loadEngine(),loadImage(chestURL),loadImage(assetUrl('assets/ui/equipment/'+reward.kind+'.png'))]);if(disposed)return;
   const app=new P.Application();
   await app.init({width:360,height:360,backgroundAlpha:0,antialias:false,resolution:1,preference:'webgl',autoStart:false});
   if(disposed){app.destroy(true,{children:true});return;}
   let timeline:gsap.core.Timeline|undefined;
   cleanup=()=>{timeline?.kill();app.stop();app.destroy(true,{children:true});};
   // DOM image sources avoid Pixi's worker/blob-based asset loader under the strict CSP.
   const texture=P.Texture.from(chestImage),prizeTex=P.Texture.from(prizeImage);
   texture.source.scaleMode='nearest';prizeTex.source.scaleMode='nearest';
   const rank=ranks.indexOf(feedback.grade),tone=colors[feedback.grade],gold=0xe9c17b;
   const root=new P.Container();root.position.set(180,187);app.stage.addChild(root);
   const halo=new P.Graphics(),runes=new P.Graphics(),dust=new P.Graphics(),waves=new P.Graphics(),cracks=new P.Graphics();
   const rings=new P.Container();root.addChild(halo,rings,dust,waves,cracks);rings.addChild(runes);
   runes.ellipse(0,88,118,29).stroke({color:gold,width:1.5,alpha:.55});
   runes.ellipse(0,88,99,22).stroke({color:gold,width:1,alpha:.4});
   for(let i=0;i<18;i++){const a=i*TAU/18,x=Math.cos(a)*108,y=88+Math.sin(a)*26;runes.rect(x-2,y-2,4,4).fill({color:gold,alpha:.65});}
   const box=new P.Container();root.addChild(box);
   // Split the current 96px sprite along its isometric lid seam. Each part has its own transform.
   const scale=2.15,half=48*scale;
   const base=new P.Container(),lid=new P.Container();
   const bodySprite=new P.Sprite(texture),lidSprite=new P.Sprite(texture);
   for(const s of [bodySprite,lidSprite]){s.anchor.set(.5);s.scale.set(scale);}
   const seam=[-half,-12, 0,13, half,-16];
   const topMask=new P.Graphics().poly([-half,-half,half,-half,half,-16,0,13,-half,-12]).fill(0xffffff);
   const bottomMask=new P.Graphics().poly([-half,-12,0,13,half,-16,half,half,-half,half]).fill(0xffffff);
   base.addChild(bodySprite,bottomMask);bodySprite.mask=bottomMask;
   lid.addChild(lidSprite,topMask);lidSprite.mask=topMask;
   const inner=new P.Graphics().poly([-87,-12,0,12,87,-16,1,-57]).fill(0x22160f).stroke({width:3,color:gold,alpha:.8});inner.alpha=0;
   const seamLight=new P.Graphics().moveTo(seam[0],seam[1]).lineTo(seam[2],seam[3]).lineTo(seam[4],seam[5]).stroke({width:3,color:0xffe9b2});seamLight.alpha=0;
   box.addChild(base,inner,lid,seamLight);
   const prize=new P.Sprite(prizeTex);prize.anchor.set(.5);prize.width=prize.height=112;prize.alpha=0;root.addChild(prize);
   const particles=new P.Graphics();root.addChild(particles);
   const flash=new P.Graphics().rect(0,0,360,360).fill(tone);flash.alpha=0;app.stage.addChild(flash);
   // Fixed particle seeds are cosmetic and never influence the receipt.
   const points=Array.from({length:36+rank*12},(_,i)=>({a:i*2.39996323,d:55+(i*37%91),size:2+i%4,s:(i*19%17)/17}));
   const state={drop:-135,pressure:0,suspense:0,open:0,impact:0,show:0};
   const charge=feedback.chargeAt/1000,hold=feedback.holdAt/1000,burst=feedback.burstAt/1000,finish=feedback.duration/1000;
   timeline=gsap.timeline({paused:true});
   timeline.to(state,{drop:0,duration:.38,ease:'bounce.out'},0)
    .to(state,{pressure:1,duration:Math.max(.2,hold-charge),ease:'power2.in'},charge)
    .to(state,{suspense:1,duration:Math.max(.1,burst-hold),ease:'power1.inOut'},hold)
    .to(state,{open:1,duration:.45,ease:'power3.out'},burst)
    .to(state,{impact:1,duration:Math.min(.8,finish-burst),ease:'none'},burst)
    .to(state,{show:1,duration:Math.max(.2,finish-burst-.16),ease:'power3.out'},burst+.16);
   const draw=()=>{
    const seconds=Math.min(finish,Math.max(0,(performance.now()-started)/1000));timeline!.time(seconds,false);
    const landed=seconds>=.38,charged=seconds>=charge,holding=seconds>=hold&&seconds<burst,opened=seconds>=burst;
    const p=state.pressure,hit=state.impact,o=state.open,show=state.show;
    const hover=rank>=3&&charged?Math.sin(seconds*4)*5-14*p:0;
    const shake=holding?0:opened?Math.sin(hit*30)*(1-hit)*4:charged?Math.sin(seconds*53)*p*(2+rank):landed?Math.sin(seconds*26)*Math.max(0,1-seconds)*3:0;
    root.position.set(180+shake,187+(opened?Math.sin(hit*24)*(1-hit)*4:0));
    root.scale.set(1+(holding?.035:0)+(opened?Math.sin(hit*Math.PI)*(rank+1)*.011:0));
    box.position.set(0,state.drop+hover);box.rotation=shake*.007;
    lid.position.set(-12*o,-40*o);lid.rotation=-.32*o;inner.alpha=o;seamLight.alpha=opened?(1-hit)*.75:charged?p*(holding?.35:1):0;
    box.alpha=1-show*.35;
    halo.clear();dust.clear();waves.clear();particles.clear();cracks.clear();
    const strength=opened?Math.max(.18,1-hit):charged?p*(holding?.16:.55):.08;
    for(let j=6;j>=1;j--)halo.circle(0,-8,j*23).fill({color:opened?tone:gold,alpha:strength*.025*(7-j)});
    rings.alpha=.35+p*.55;
    const landing=clamp((seconds-.32)/.55);
    if(landed&&landing<1)for(let i=0;i<18;i++){const a=i*TAU/18;dust.rect(Math.cos(a)*landing*95,87+Math.sin(a)*landing*16,3,3).fill({color:0xa89576,alpha:(1-landing)*.6});}
    if(charged&&!opened&&!holding)for(const point of points){const f=(seconds*.75+point.s)%1,rad=point.d*(1-f);particles.rect(Math.cos(point.a+seconds*.6)*rad,Math.sin(point.a+seconds*.6)*rad-8,point.size,point.size).fill({color:gold,alpha:Math.sin(f*Math.PI)*p*.75});}
    if(holding&&rank>=3){
     for(let i=0;i<rank+1;i++){const a=i*TAU/(rank+1)+.2;cracks.moveTo(Math.cos(a)*64,Math.sin(a)*64).lineTo(Math.cos(a+.1)*94,Math.sin(a+.1)*94).lineTo(Math.cos(a-.06)*139,Math.sin(a-.06)*139).stroke({color:tone,width:rank===4?3:1.5,alpha:state.suspense*.9});}
    }
    if(opened){
     for(let j=0;j<(rank>=2?3:1);j++){const w=clamp(hit*1.4-j*.18);if(w>0&&w<1)waves.circle(0,-5,27+143*ease(w)).stroke({color:tone,width:rank>=3?3:2,alpha:(1-w)*.8});}
     for(const point of points){const rad=20+point.d*ease(hit)*(rank>=3?1.35:1),x=Math.cos(point.a)*rad,y=Math.sin(point.a)*rad-8+hit*hit*40;particles.rect(x,y,point.size,point.size).fill({color:point.s>.65?gold:tone,alpha:(1-hit)*.95});}
     flash.alpha=Math.max(0,1-hit*5)*(rank>=3?.30:.12);
    }else flash.alpha=0;
    prize.alpha=show;prize.position.set(0,-10-78*show);prize.scale.set((112/prizeTex.width)*(.6+.4*show));
   };
   target.appendChild(app.canvas);draw();app.render();
   app.ticker.add(()=>{try{draw();}catch(error){fail(error);}});app.start();onStatus('gpu');
  })().catch(fail);
  return()=>{disposed=true;cleanup?.();};
 },[feedback.grade,feedback.duration,feedback.chargeAt,feedback.holdAt,feedback.burstAt,reward.kind,onStatus]);
 return <div ref={host} className="tc-box-pixi" aria-hidden="true"/>;
}
