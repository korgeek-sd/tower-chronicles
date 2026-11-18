import React,{useEffect,useRef} from 'react';
import {gsap} from 'gsap';
import type {Application} from 'pixi.js';
import {EQUIPMENT_DEFINITIONS} from '../../game/data/equipment';
import {BOX_PARTICLE_CELL,BOX_PARTICLE_COUNT,makeBoxMotes,boxMotePose} from './boxPixelVfx';
import {BOX_BODY,BOX_LID_OUTSIDE,BOX_LID_INSIDE,BOX_LID_FAN,BOX_QUAD,fillLidVertices,lidSurfaceOpacity} from './boxHinge';
import {assetUrl} from '../../game/data/graphics';
import type {EquipmentItem} from '../../game/types';
import {BOX_FRAME_COUNT,BOX_FRAME_WIDTH,BOX_FRAME_HEIGHT,type boxReveal} from './boxPresentation';
type Reveal=NonNullable<ReturnType<typeof boxReveal>>;
const chestURL=assetUrl('assets/ui/shop/adventurer_box_opening_v4.png');
const particleURL=assetUrl('assets/ui/shop/adventurer_box_pixel_vfx_v1.png');
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
let warmRenderer:Promise<Application>|undefined;
async function createRenderer(){
 const P=await loadEngine(),app=new P.Application();
 try{
  await app.init({width:480,height:480,backgroundAlpha:0,antialias:false,resolution:1,preference:'webgl',autoStart:false});
  app.ticker.maxFPS=60;
  return app;
 }catch(error){try{app.destroy(true,{children:true});}catch{}throw error;}
}
function takeRenderer(){const pending=warmRenderer??createRenderer();warmRenderer=undefined;return pending;}
export function disposePreloadedBoxEffects(){const pending=warmRenderer;warmRenderer=undefined;void pending?.then(app=>app.destroy(true,{children:true}),()=>{});}
export function preloadBoxEffects(){
 void loadEngine().catch(()=>{});void loadImage(chestURL).catch(()=>{});void loadImage(particleURL).catch(()=>{});
 for(const kind of Object.keys(EQUIPMENT_DEFINITIONS))void loadImage(assetUrl('assets/ui/equipment/'+kind+'.png')).catch(()=>{});
 if(!warmRenderer){const pending=createRenderer();warmRenderer=pending;void pending.catch(()=>{if(warmRenderer===pending)warmRenderer=undefined;});}
}
export type BoxRendererStatus='loading'|'gpu'|'fallback';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
/** Local visualisation only. Receipt is authoritative; no random equipment is generated here. */
export function PixiBoxStage({feedback,reward,onStatus}:{feedback:Reveal;reward:EquipmentItem;onStatus:(status:BoxRendererStatus)=>void}){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!host.current||!feedback.duration)return;
  const target=host.current;onStatus('loading');
  let disposed=false,failed=false,cleanup:(()=>void)|undefined;
  let started=0;
  const fail=(error:unknown)=>{if(disposed||failed)return;failed=true;try{cleanup?.();}catch{}cleanup=undefined;console.warn('[Box FX] GPU renderer unavailable',error);onStatus('fallback');};
  const initDeadline=window.setTimeout(()=>fail(new Error('Renderer initialization timeout')),3000);
  void (async()=>{
   const [P,chestImage,prizeImage,particleImage]=await Promise.all([loadEngine(),loadImage(chestURL),loadImage(assetUrl('assets/ui/equipment/'+reward.kind+'.png')),loadImage(particleURL)]);if(disposed||failed)return;
   const app=await takeRenderer();
   if(disposed||failed){app.destroy(true,{children:true});return;}
   let timeline:gsap.core.Timeline|undefined;
   const geometries:import('pixi.js').MeshGeometry[]=[];
   cleanup=()=>{timeline?.kill();app.stop();app.destroy(true,{children:true});for(const geometry of geometries)geometry.destroy(true);};
   // DOM image sources avoid Pixi's worker/blob-based asset loader under the strict CSP.
   const texture=P.Texture.from(chestImage),prizeTex=P.Texture.from(prizeImage);
   const closedTexture=new P.Texture({source:texture.source,frame:new P.Rectangle(0,0,BOX_FRAME_WIDTH,BOX_FRAME_HEIGHT)});
   texture.source.scaleMode='nearest';prizeTex.source.scaleMode='nearest';
   const rank=ranks.indexOf(feedback.grade),tone=colors[feedback.grade];
   const root=new P.Container();root.position.set(240,249);root.scale.set(4/3);app.stage.addChild(root);
   // No magic circle, radial halo, ground ring, or expanding shockwave.
   const rearParticles=new P.Container();root.addChild(rearParticles);
   const box=new P.Container();root.addChild(box);
   // Stable body, two independent textured lid meshes, and the original
   // closed icon. Both meshes use the same atlas and update only vertices.
   const rig=new P.Container();rig.position.set(-56*2.15,-80*2.15);rig.scale.set(2.15);box.addChild(rig);
   function mesh(source:readonly number[],indices:readonly number[],frame:number){
    const positions=new Float32Array(source),uvs=new Float32Array(source.length);
    for(let i=0;i<source.length;i+=2){uvs[i]=(source[i]+frame*BOX_FRAME_WIDTH)/(BOX_FRAME_WIDTH*BOX_FRAME_COUNT);uvs[i+1]=source[i+1]/BOX_FRAME_HEIGHT;}
    const geometry=new P.MeshGeometry({positions,uvs,indices:new Uint32Array(indices)});
    geometries.push(geometry);
    const view=new P.Mesh({geometry,texture,roundPixels:false});
    return {geometry,view};
   }
   const body=mesh(BOX_BODY,BOX_QUAD,BOX_FRAME_COUNT-1),outside=mesh(BOX_LID_OUTSIDE,BOX_LID_FAN,0),inside=mesh(BOX_LID_INSIDE,BOX_QUAD,BOX_FRAME_COUNT-1);
   const closed=new P.Sprite(closedTexture);rig.addChild(body.view,outside.view,inside.view,closed);
   const innerLight=new P.Graphics()
    .poly([-67,-6,-38,-19,41,3,77,-14,55,4,40,11,-67,-3]).fill({color:tone,alpha:.25})
    .rect(-16,-8,22,4).fill({color:0xfff3c0,alpha:.7});
   innerLight.alpha=0;box.addChild(innerLight);
   const particles=new P.Container();root.addChild(particles);
   const prize=new P.Sprite(prizeTex);prize.anchor.set(.5);prize.width=prize.height=112;prize.alpha=0;root.addChild(prize);
   const frontSparkles=new P.Container();root.addChild(frontSparkles);
   const flash=new P.Graphics().rect(0,0,480,480).fill(tone);flash.alpha=0;app.stage.addChild(flash);
   const atlas=P.Texture.from(particleImage);atlas.source.scaleMode='nearest';
   const tiles=Array.from({length:BOX_PARTICLE_COUNT},(_,i)=>new P.Texture({source:atlas.source,frame:new P.Rectangle(i%4*BOX_PARTICLE_CELL,Math.floor(i/4)*BOX_PARTICLE_CELL,BOX_PARTICLE_CELL,BOX_PARTICLE_CELL)}));
   const motes=makeBoxMotes(rank);
   const moteViews=motes.map(m=>{
    const view=new P.Sprite(tiles[m.tile]);view.anchor.set(.5);view.tint=m.tint;view.alpha=0;
    (m.kind==='spark'?frontSparkles:m.kind==='dust'||m.kind==='ember'?rearParticles:particles).addChild(view);
    return view;
   });
   const state={drop:-136,weight:0,pressure:0,suspense:0,angle:0,impact:0,show:0};
   const charge=feedback.chargeAt/1000,hold=feedback.holdAt/1000,burst=feedback.burstAt/1000,finish=feedback.duration/1000;
   timeline=gsap.timeline({paused:true});
   timeline.to(state,{drop:0,duration:.38,ease:'power3.in'},0)
    .to(state,{weight:1,duration:.075,ease:'power2.out'},.38)
    .to(state,{weight:-.3,duration:.12,ease:'power2.out'},.455)
    .to(state,{weight:0,duration:.22,ease:'power2.inOut'},.575)
    .to(state,{pressure:1,duration:Math.max(.2,hold-charge),ease:'power2.in'},charge)
    .to(state,{suspense:1,duration:Math.max(.1,burst-hold),ease:'power1.inOut'},hold)
    .to(state,{angle:12,duration:.16,ease:'power2.in'},burst)
    .to(state,{angle:96,duration:.44,ease:'power2.out'},burst+.16)
    .to(state,{angle:88,duration:.16,ease:'power2.inOut'},burst+.60)
    .to(state,{impact:1,duration:Math.min(1.0,finish-burst-.28),ease:'none'},burst+.28)
    .to(state,{show:1,duration:Math.max(.3,finish-burst-.88),ease:'power2.out'},burst+.78);
   const draw=()=>{
    const seconds=Math.min(finish,Math.max(0,(performance.now()-started)/1000));timeline!.time(seconds,false);
    const charged=seconds>=charge,holding=seconds>=hold&&seconds<burst,opened=seconds>=burst;
    const p=state.pressure,hit=state.impact,o=clamp(state.angle/88),show=state.show;
    const hover=rank>=3&&charged&&!opened?Math.sin(seconds*3)*2-9*p:0;
    const pulse=Math.max(0,Math.sin(seconds*7));
    const shake=holding?0:opened?Math.sin(hit*24)*(1-hit)*1.4:charged?Math.sin(seconds*33)*pulse*p*(1.1+rank*.4):0;
    root.position.set(240+shake*4/3,249+(opened?Math.sin(hit*24)*(1-hit)*4:0));
    root.scale.set(4/3*(1+.025*state.suspense*(1-o)+(opened?Math.sin(hit*Math.PI)*(rank+1)*.011:0)));
    box.position.set(0,state.drop+hover+state.weight*5);box.rotation=shake*.004;
    box.scale.set(1+state.weight*.035,1-state.weight*.055);
    const opacity=lidSurfaceOpacity(state.angle);
    closed.alpha=opacity.closed;
    body.view.alpha=1-opacity.closed;
    outside.view.alpha=opacity.outside*(1-opacity.closed);
    inside.view.alpha=opacity.inside*(1-opacity.closed);
    if(opened){
     fillLidVertices(outside.geometry.positions,BOX_LID_OUTSIDE,state.angle,false);
     outside.geometry.getBuffer('aPosition').update();
     fillLidVertices(inside.geometry.positions,BOX_LID_INSIDE,state.angle,true);
     inside.geometry.getBuffer('aPosition').update();
    }
    innerLight.alpha=opened?Math.min(1,o*1.6)*(1-show*.8):charged?p*.18:0;
    box.alpha=1;
    motes.forEach((m,i)=>{
     const view=moteViews[i],pose=boxMotePose(m,seconds,charge,burst,p);
     if(!pose){view.visible=false;return;}
     view.visible=true;view.position.set(pose.x,pose.y);view.alpha=pose.alpha;
     view.scale.set(pose.size);view.rotation=pose.rotation;
    });
    const flashTime=seconds-burst-.22;
    flash.alpha=flashTime>=0&&flashTime<.085?(1-flashTime/.085)*(rank>=3?.14:.055):0;
    prize.alpha=Math.min(1,show*1.8);prize.position.set(0,-10-94*show);prize.scale.set((112/prizeTex.width)*(.45+.55*show));
   };
   target.appendChild(app.canvas);started=performance.now();draw();app.render();window.clearTimeout(initDeadline);
   app.ticker.add(()=>{try{draw();}catch(error){fail(error);}});app.start();onStatus('gpu');
  })().catch(error=>{window.clearTimeout(initDeadline);fail(error);});
  return()=>{disposed=true;window.clearTimeout(initDeadline);cleanup?.();};
 },[feedback.grade,feedback.duration,feedback.chargeAt,feedback.holdAt,feedback.burstAt,reward.kind,onStatus]);
 return <div ref={host} className="tc-box-pixi" aria-hidden="true"/>;
}
