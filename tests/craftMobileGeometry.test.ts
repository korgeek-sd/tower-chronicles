import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CraftScreen} from '../src/components/world/CraftScreen';
import {WORLD_TOWNS} from '../src/components/world/worldMap';
import type {VillageLifeState} from '../src/online/villageLife';

const root=new URL('../',import.meta.url);
const read=(p:string)=>fs.readFileSync(new URL(p,root),'utf8');
const styles=['src/mobile-game.css','src/components/world/world-map.css','src/components/world/craft-screen.css','src/components/world/forge-craft.css','src/components/world/forge-craft-layout.css','src/components/world/forge-craft-mobile-safe.css'].map(read).join('\n');
const state:VillageLifeState={location:'city',vitality:629,materials:{herb:0,pepper:0,potato:0,wheat:0,stone:0},products:{potion:85431,attack_food:0,defense_food:0,experience_food:0,challenge_ticket:0,vitality_potion:0},lifeMasteries:{herb:244,farm:0,ticket:0},craftCarry:{},towns:WORLD_TOWNS,serverNow:1000,nextResetAt:999999};
const app=renderToStaticMarkup(React.createElement(CraftScreen,{state,busy:false,count:1,recipe:'potion',queue:[],onRecipe:()=>{},onCount:()=>{},onCraft:()=>{},onFindMaterials:()=>{},onTravel:()=>{},onMap:()=>{},now:1000}));
const readyApp=renderToStaticMarkup(React.createElement(CraftScreen,{state:{...state,materials:{...state.materials,pepper:200}},busy:false,count:1,recipe:'attack_food',queue:[],onRecipe:()=>{},onCount:()=>{},onCraft:()=>{},onFindMaterials:()=>{},onTravel:()=>{},onMap:()=>{},now:1000}));
const report=`<script>
function rect(selector){
 const el=document.querySelector(selector); if(!el)return null;
 const r=el.getBoundingClientRect();
 return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};
}
const selectors=['.tc-forge-workspace','.tc-craft-result','.tc-craft-material','.tc-craft-footer','.tc-life-quantity [role="group"]','.tc-craft-main','.tc-craft-queue','.tc-forge-shell'];
const data=Object.fromEntries(selectors.map(x=>[x,rect(x)]));
data.buttons=[...document.querySelectorAll('.tc-life-quantity [role="group"] button')].map(x=>{const r=x.getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,bottom:r.bottom}});
data.viewport={width:window.innerWidth,height:window.innerHeight,matchingMobile:window.matchMedia('(max-width: 520px)').matches};
const action=document.querySelector('.tc-craft-main');
const actionLabel=action?.querySelector('.tc-craft-main-label');
const bRect=action?.getBoundingClientRect(),lRect=actionLabel?.getBoundingClientRect();
data.actionAlignment={buttonCenter:bRect?bRect.left+bRect.width/2:null,labelCenter:lRect?lRect.left+lRect.width/2:null,labelText:actionLabel?.textContent??'',layout:action?getComputedStyle(action).display:''};
document.getElementById('layout-results').textContent=JSON.stringify(data);
</script>`;
function chromiumBinary():string|null{
 for(const name of ['chromium','google-chrome','chromium-browser']){
  const r=spawnSync('which',[name],{encoding:'utf8'});
  if(r.status===0)return r.stdout.trim();
 }
 return null;
}

const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
async function startChrome(binary:string){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'craft-cdp-'));
 const child=spawn(binary,['--headless=new','--no-sandbox','--no-zygote','--disable-gpu','--disable-dev-shm-usage','--disable-extensions','--disable-background-networking','--no-first-run','--remote-allow-origins=*','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 let ws:WebSocket|null=null;
 const pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void}>();
 let seq=0;
 try{
  let port=0;
  for(let tries=0;tries<260;tries++){
   const file=path.join(profile,'DevToolsActivePort');
   if(fs.existsSync(file)){port=Number(fs.readFileSync(file,'utf8').split('\n')[0]);break;}
   if(child.exitCode!==null)throw new Error('Chrome exited before DevTools opened: '+child.exitCode);
   await pause(100);
  }
  assert.ok(port>0,'Chrome never started DevTools for mobile geometry');
  const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json() as Array<{type:string;webSocketDebuggerUrl?:string}>;
  const socketUrl=tabs.find(t=>t.type==='page'&&t.webSocketDebuggerUrl)?.webSocketDebuggerUrl;
  assert.ok(socketUrl,'Chrome page debugger socket was not found');
  ws=new WebSocket(socketUrl);
  await new Promise<void>((resolve,reject)=>{
   ws!.addEventListener('open',()=>resolve(),{once:true});
   ws!.addEventListener('error',()=>reject(new Error('Cannot open Chromium DevTools WebSocket')),{once:true});
  });
  ws.addEventListener('message',(event)=>{
   try{const data=JSON.parse(String(event.data));if(!data.id)return;
    const task=pending.get(data.id);if(!task)return;pending.delete(data.id);
    if(data.error)task.reject(new Error(data.error.message));else task.resolve(data.result);
   }catch{}
  });
  function command(method:string,params:Record<string,unknown>={}):Promise<any>{
   const id=++seq;
   return new Promise((resolve,reject)=>{
    pending.set(id,{resolve,reject});ws!.send(JSON.stringify({id,method,params}));
   });
  }
  await command('Page.enable');
  await command('Runtime.enable');
  return {
   async measure(url:string,width:number,height:number):Promise<Record<string,any>>{
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true,screenWidth:width,screenHeight:height});
    await command('Page.navigate',{url});
    for(let i=0;i<100;i++){
     const result=await command('Runtime.evaluate',{expression:"document.getElementById('layout-results')?.textContent || ''",returnByValue:true});
     const value=result?.result?.value;
     if(typeof value==='string'&&value.startsWith('{'))return JSON.parse(value);
     await pause(50);
    }
    throw new Error('No layout results at '+width+'x'+height);
   },
   async close(){ws?.close();child.kill('SIGTERM');await pause(100);fs.rmSync(profile,{recursive:true,force:true});}
  };
 }catch(error){ws?.close();child.kill('SIGTERM');fs.rmSync(profile,{recursive:true,force:true});throw error;}
}
const isolated=process.env.CRAFT_GEOMETRY_E2E==='1';
const binary=chromiumBinary();
// Chrome can time out under the 1600+ concurrent full-suite tests. Run this
// expensive real-browser check separately in the focused crafting workflow.
test('narrow-viewport crafting: ingredients, controls and queue have separate visible rectangles',
 {skip:!isolated?'Runs independently in the focused UI workflow':false,timeout:110000},async()=>{
 assert.ok(binary,'Chromium is required for the isolated crafting UI geometry test');
 const browser=await startChrome(binary!);
 try{
 for(const [width,height] of [[360,630],[390,750],[320,568]]){
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'craft-layout-'));
  const html=path.join(folder,'fixture.html');
  fs.writeFileSync(html,`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}
  html,body{width:${width}px;height:${height}px;margin:0;background:#080808;}
  .tc-app{width:${width}px;height:${height}px;}
  .tc-main{padding:4px 6px;}
  </style></head><body><div class="tc-app"><div class="tc-topbar"></div><div class="tc-statusbar"></div><main class="tc-main"><div class="tc-world-page"><section class="tc-life tc-craft-page"><header class="tc-life-header tc-craft-hero"><div class="tc-craft-hero-mark">⚒</div><div class="tc-craft-hero-copy"><h1>제작 공방</h1><p>수집한 재료로 다양한 아이템을 제작할 수 있습니다.</p></div><div class="tc-life-navigation"><button>↻</button><button>가방</button><button>거점</button></div></header>${app}</section></div></main><nav class="tc-nav"></nav></div><pre id="layout-results"></pre>${report}</body></html>`);
  try{
   const d=await browser.measure('file://'+html,width,height);
   assert.equal(d.viewport.width,width,`The Chromium viewport must actually be ${width}px wide: ${JSON.stringify(d.viewport)}`);
   assert.equal(d.viewport.matchingMobile,true,'Mobile-specific CSS media rules must match the screenshot viewport');
   const a=d['.tc-craft-result'],b=d['.tc-craft-material'],c=d['.tc-craft-footer'],w=d['.tc-forge-workspace'],q=d['.tc-craft-queue'],g=d['.tc-life-quantity [role="group"]'],main=d['.tc-craft-main'];
   const summary=`${width}x${height}: ${JSON.stringify({result:a,material:b,footer:c,workspace:w,queue:q,main,group:g,buttons:d.buttons})}`;
   for(const [k,v] of Object.entries({result:a,material:b,footer:c,workspace:w,queue:q,group:g,main})){
    assert.ok(v&&v.height>8&&v.width>20,`${k} invisible: ${summary}`);
   }
   assert.ok(a.bottom<=b.y+2,'Item preview overlaps ingredients: '+summary);
   assert.ok(b.bottom<=c.y+2,'Ingredients overlap crafting controls: '+summary);
   assert.ok(c.bottom<=w.bottom+3,'Craft controls overflow workspace: '+summary);
   assert.ok(w.bottom<=q.y+3,'Workspace overlaps queue: '+summary);
   assert.ok(main.right<=w.right+3,'Craft action overflows panel horizontally: '+summary);
   assert.ok(g.right<=w.right+3,'Quantity group overflows panel: '+summary);
   assert.equal(d.actionAlignment.layout,'grid','Craft action should use a balanced 3-track grid: '+summary);
   assert.ok(Math.abs(d.actionAlignment.buttonCenter-d.actionAlignment.labelCenter)<2,'Gather action title must be centered on the entire button: '+JSON.stringify(d.actionAlignment));
   for(let i=1;i<d.buttons.length;i++)assert.ok(d.buttons[i-1].right<=d.buttons[i].x+2,'Quantity buttons overlap: '+summary);
   const readyHtml=path.join(folder,'ready.html');
   fs.writeFileSync(readyHtml,fs.readFileSync(html,'utf8').replace(app,readyApp));
   const ready=await browser.measure('file://'+readyHtml,width,height);
   assert.match(ready.actionAlignment.labelText,/제작하기/,'Ready button text did not load in mobile fixture');
   assert.equal(ready.actionAlignment.layout,'grid');
   assert.ok(Math.abs(ready.actionAlignment.buttonCenter-ready.actionAlignment.labelCenter)<2,
     'Ready crafting title must be centered on the entire button: '+JSON.stringify(ready.actionAlignment));

  }finally{fs.rmSync(folder,{recursive:true,force:true});}
 }
 }finally{await browser.close();}
});
