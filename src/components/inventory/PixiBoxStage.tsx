import React,{useEffect,useRef} from 'react';
import {lightningArtPose,CHARGE_TRACES} from './boxLightningArt';
import {gsap} from 'gsap';
import type {Application} from 'pixi.js';
import {BOX_PARTICLE_CELL,BOX_PARTICLE_COUNT,makeBoxMotes,boxMotePose} from './boxPixelVfx';
import {BOX_BODY,BOX_LID_OUTSIDE,BOX_LID_INSIDE,BOX_LID_FAN,BOX_QUAD,fillLidVertices,lidSurfaceOpacity} from './boxHinge';
import {assetUrl} from '../../game/data/graphics';
import {BOX_FRAME_COUNT,BOX_FRAME_WIDTH,BOX_FRAME_HEIGHT,boxOpeningFrame,type boxReveal} from './boxPresentation';
type Reveal=NonNullable<ReturnType<typeof boxReveal>>;
const chestURL=assetUrl('assets/ui/shop/adventurer_box_opening_v4.png');
const lightningURL=assetUrl('assets/ui/shop/box_lightning_authored_v2.png');
const particleURL=assetUrl('assets/ui/shop/box_pixel_particles_16.png');
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
 void loadEngine().catch(()=>{});void loadImage(chestURL).catch(()=>{});void loadImage(lightningURL).catch(()=>{});void loadImage(particleURL).catch(()=>{});
 if(!warmRenderer){const pending=createRenderer();warmRenderer=pending;void pending.catch(()=>{if(warmRenderer===pending)warmRenderer=undefined;});}
}
export type BoxRendererStatus='loading'|'gpu'|'canvas'|'fallback';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
/** Local visualisation only. Receipt is authoritative; no random equipment is generated here. */
export function PixiBoxStage({feedback,onStatus,previewTime}:{feedback:Reveal;onStatus:(status:BoxRendererStatus)=>void;previewTime?:number}){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!host.current||!feedback.duration)return;
  const target=host.current;onStatus('loading');
  let disposed=false,failed=false,cleanup:(()=>void)|undefined;
  let started=0;
  const fail=(error:unknown)=>{if(disposed||failed)return;failed=true;try{cleanup?.();}catch{}cleanup=undefined;console.warn('[Box FX] GPU renderer unavailable',error);onStatus('fallback');};
  const initDeadline=window.setTimeout(()=>fail(new Error('Renderer initialization timeout')),3000);
  void (async()=>{
   const [P,chestImage,particleImage,lightningImage]=await Promise.all([loadEngine(),loadImage(chestURL),loadImage(particleURL),loadImage(lightningURL)]);if(disposed||failed)return;
   const app=await takeRenderer();
   if(disposed||failed){app.destroy(true,{children:true});return;}
   let timeline:gsap.core.Timeline|undefined;
   const geometries:import('pixi.js').MeshGeometry[]=[];
   cleanup=()=>{timeline?.kill();app.stop();app.destroy(true,{children:true});for(const geometry of geometries)geometry.destroy(true);};
   // DOM image sources avoid Pixi's worker/blob-based asset loader under the strict CSP.
   const texture=P.Texture.from(chestImage);
   const closedTexture=new P.Texture({source:texture.source,frame:new P.Rectangle(0,0,BOX_FRAME_WIDTH,BOX_FRAME_HEIGHT)});
   texture.source.scaleMode='nearest';
   const rank=ranks.indexOf(feedback.grade);
   const root=new P.Container();root.position.set(240,249);root.scale.set(4/3);app.stage.addChild(root);
   // No magic circle, radial halo, ground ring, or expanding shockwave.
   const box=new P.Container();root.addChild(box);
   // Stable body, two independent textured lid meshes, and the original
   // closed icon. Both meshes use the same atlas and update only vertices.
   const rearLightning=new P.Graphics();box.addChild(rearLightning);
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
   const closed=new P.Sprite(closedTexture);
   const canvasFallback=app.renderer.type===P.RendererType.CANVAS;
   const openingFrames=canvasFallback?Array.from({length:BOX_FRAME_COUNT},(_,i)=>new P.Texture({source:texture.source,frame:new P.Rectangle(i*BOX_FRAME_WIDTH,0,BOX_FRAME_WIDTH,BOX_FRAME_HEIGHT)})):[];
   if(canvasFallback)rig.addChild(closed);else rig.addChild(body.view,outside.view,inside.view,closed);
   // Golden stepped lightning surrounds the chest; a few approved square fragments remain.
   const frontLightning=new P.Graphics();box.addChild(frontLightning);
   const lightningAtlas=P.Texture.from(lightningImage);lightningAtlas.source.scaleMode='nearest';
   const cell=lightningImage.width/2;
   // Crop only the transparent cell seam; keep all authored lightning pixels.
   const lightningFrames=Array.from({length:4},(_,i)=>new P.Texture({source:lightningAtlas.source,frame:new P.Rectangle(i%2*cell+3,Math.floor(i/2)*cell+3,cell-6,cell-6)}));
   const discharge=new P.Sprite(lightningFrames[0]);discharge.anchor.set(.5,.85);discharge.position.set(-8,-12);discharge.alpha=0;box.addChild(discharge);
   const mouthLight=new P.Graphics().poly([-78,-16,-38,-34,68,-8,30,12,-48,2]).fill({color:0xffbf35,alpha:.72})
    .poly([-62,-13,-36,-26,54,-6,28,5,-38,-2]).fill({color:0xfff3b0,alpha:1});
   mouthLight.alpha=0;box.addChild(mouthLight);
   const latchLight=new P.Graphics().rect(-18,14,12,22).fill({color:0xffdb66,alpha:.9}).rect(-14,18,4,12).fill({color:0xffffdc});
   latchLight.alpha=0;box.addChild(latchLight);
   const particles=new P.Container();box.addChild(particles);
   const atlas=P.Texture.from(particleImage);atlas.source.scaleMode='nearest';
   const tiles=Array.from({length:BOX_PARTICLE_COUNT},(_,i)=>new P.Texture({source:atlas.source,frame:new P.Rectangle(i%4*BOX_PARTICLE_CELL,Math.floor(i/4)*BOX_PARTICLE_CELL,BOX_PARTICLE_CELL,BOX_PARTICLE_CELL)}));
   const motes=makeBoxMotes(rank).filter(m=>m.kind==='ember').slice(0,8).map(m=>({...m,tint:0xffd36a,size:2.5,life:.65,delay:.55+m.delay*.2}));
   const moteViews=motes.map(m=>{
    const view=new P.Sprite(tiles[m.tile]);view.anchor.set(.5);view.tint=m.tint;view.alpha=0;
    particles.addChild(view);
    return view;
   });
   const state={drop:-136,weight:0,pressure:0,suspense:0,angle:0,impact:0};
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
    .to(state,{impact:1,duration:Math.min(1.0,finish-burst-.28),ease:'none'},burst+.28);
   let lightningFrame=-1;
   function drawLightning(seconds:number){
    const frame=Math.floor(seconds*12);
    if(frame===lightningFrame)return;lightningFrame=frame;
    rearLightning.clear();frontLightning.clear();
    if(seconds<charge||seconds>=hold)return;
    const progress=clamp((seconds-charge)/(hold-charge));
    CHARGE_TRACES.forEach((trace,i)=>{
     if(i>=4&&progress<.55)return;
     const graphics=i>=4?rearLightning:frontLightning;
     const pulse=.65+.35*Math.sin(frame*1.8+i);
     for(const [width,color,alpha] of [[10,0xd18019,.16],[5,0xffbb36,.8],[2,0xfff5bd,1]]){
      graphics.moveTo(trace[0],trace[1]);
      for(let j=2;j<trace.length;j+=2)graphics.lineTo(trace[j],trace[j+1]);
      graphics.stroke({width,color,alpha:alpha*pulse*(.35+.65*progress),join:'miter',cap:'square'});
     }
    });
   }

   const draw=()=>{
    const seconds=Math.min(finish,Math.max(0,previewTime??(performance.now()-started)/1000));timeline!.time(seconds,false);
    const charged=seconds>=charge,holding=seconds>=hold&&seconds<burst,opened=seconds>=burst;
    const p=state.pressure,hit=state.impact,o=clamp(state.angle/88);
    const hover=rank>=3&&charged&&!opened?Math.sin(seconds*3)*2-9*p:0;
    const pulse=Math.max(0,Math.sin(seconds*7));
    const shake=holding?0:opened?Math.sin(hit*24)*(1-hit)*1.4:charged?Math.sin(seconds*33)*pulse*p*(1.1+rank*.4):0;
    root.position.set(240+shake*4/3,249+(opened?Math.sin(hit*24)*(1-hit)*4:0));
    root.scale.set(4/3*(1+.025*state.suspense*(1-o)+(opened?Math.sin(hit*Math.PI)*(rank+1)*.011:0)));
    box.position.set(0,state.drop+hover+state.weight*5);box.rotation=shake*.004;
    box.scale.set(1+state.weight*.035,1-state.weight*.055);
    const opacity=lidSurfaceOpacity(state.angle);
    closed.alpha=canvasFallback?1:opacity.closed;
    if(canvasFallback)closed.texture=openingFrames[boxOpeningFrame(Math.max(0,seconds-burst)*1000)];
    body.view.alpha=1-opacity.closed;
    outside.view.alpha=opacity.outside*(1-opacity.closed);
    inside.view.alpha=opacity.inside*(1-opacity.closed);
    if(opened&&!canvasFallback){
     fillLidVertices(outside.geometry.positions,BOX_LID_OUTSIDE,state.angle,false);
     outside.geometry.getBuffer('aPosition').update();
     fillLidVertices(inside.geometry.positions,BOX_LID_INSIDE,state.angle,true);
     inside.geometry.getBuffer('aPosition').update();
    }
    box.alpha=1;
    drawLightning(seconds);
    const artPose=lightningArtPose(seconds-burst);
    discharge.visible=!!artPose;
    if(artPose){discharge.texture=lightningFrames[artPose.frame];discharge.alpha=artPose.alpha;discharge.width=300*artPose.scale;discharge.height=220*artPose.scale;}
    mouthLight.alpha=opened?clamp((seconds-burst)/.2)*(.25+.75*clamp(1-(seconds-burst-.4)/.9)):0;
    latchLight.alpha=opened?0:charged?(holding?.9:.2+.6*p):0;
    inside.view.tint=opened?0xffe1a0:0xffffff;
    motes.forEach((m,i)=>{
     const view=moteViews[i],pose=boxMotePose(m,seconds,charge,burst,p);
     if(!pose){view.visible=false;return;}
     view.visible=true;view.position.set(pose.x,pose.y);view.alpha=pose.alpha;
     view.scale.set(pose.size);view.rotation=pose.rotation;
    });
   };
   target.appendChild(app.canvas);started=performance.now();draw();app.render();window.clearTimeout(initDeadline);
   app.ticker.add(()=>{try{draw();}catch(error){fail(error);}});app.start();onStatus(canvasFallback?'canvas':'gpu');
  })().catch(error=>{window.clearTimeout(initDeadline);fail(error);});
  return()=>{disposed=true;window.clearTimeout(initDeadline);cleanup?.();};
 },[feedback.grade,feedback.duration,feedback.chargeAt,feedback.holdAt,feedback.burstAt,onStatus,previewTime]);
 return <div ref={host} className="tc-box-pixi" aria-hidden="true"/>;
}
