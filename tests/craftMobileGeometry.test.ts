import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
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
document.getElementById('layout-results').textContent=JSON.stringify(data);
</script>`;
function chromiumBinary():string|null{
 for(const name of ['chromium','google-chrome','chromium-browser']){
  const r=spawnSync('which',[name],{encoding:'utf8'});
  if(r.status===0)return r.stdout.trim();
 }
 return null;
}
const isolated=process.env.CRAFT_GEOMETRY_E2E==='1';
const binary=chromiumBinary();
// Chrome can time out under the 1600+ concurrent full-suite tests. Run this
// expensive real-browser check separately in the focused crafting workflow.
test('narrow-viewport crafting: ingredients, controls and queue have separate visible rectangles',
 {skip:!isolated?'Runs independently in the focused UI workflow':false},()=>{
 assert.ok(binary,'Chromium is required for the isolated crafting UI geometry test');
 for(const [width,height] of [[360,630],[390,750],[320,568]]){
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'craft-layout-'));
  const html=path.join(folder,'fixture.html');
  fs.writeFileSync(html,`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}
  html,body{width:${width}px;height:${height}px;margin:0;background:#080808;}
  .tc-app{width:${width}px;height:${height}px;}
  .tc-main{padding:4px 6px;}
  </style></head><body><div class="tc-app"><div class="tc-topbar"></div><div class="tc-statusbar"></div><main class="tc-main"><div class="tc-world-page"><section class="tc-life tc-craft-page"><header class="tc-life-header tc-craft-hero"><div class="tc-craft-hero-mark">⚒</div><div class="tc-craft-hero-copy"><h1>제작 공방</h1><p>수집한 재료로 다양한 아이템을 제작할 수 있습니다.</p></div><div class="tc-life-navigation"><button>↻</button><button>가방</button><button>거점</button></div></header>${app}</section></div></main><nav class="tc-nav"></nav></div><pre id="layout-results"></pre>${report}</body></html>`);
  try{
   const result=spawnSync(binary!,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--hide-scrollbars',`--window-size=${width},${height}`,'--force-device-scale-factor=1','--virtual-time-budget=1000','--dump-dom','file://'+html],{encoding:'utf8',timeout:22000,maxBuffer:2000000});
   assert.equal(result.status,0,`Chromium failed for ${width}x${height}: ${result.stderr.slice(-1500)}`);
   const match=result.stdout.match(/<pre id="layout-results">([^<]+)<\/pre>/);
   assert.ok(match,`Missing layout data for ${width}x${height}`);
   const d=JSON.parse(match[1].replaceAll('&quot;','"').replaceAll('&amp;','&')) as Record<string,any>;
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
   for(let i=1;i<d.buttons.length;i++)assert.ok(d.buttons[i-1].right<=d.buttons[i].x+2,'Quantity buttons overlap: '+summary);
  }finally{fs.rmSync(folder,{recursive:true,force:true});}
 }
});
