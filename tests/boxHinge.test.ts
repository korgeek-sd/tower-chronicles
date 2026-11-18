import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BOX_HINGE,BOX_LID_OUTSIDE,BOX_LID_INSIDE,projectLidOutside,projectLidInside,fillLidVertices,lidSurfaceOpacity} from '../src/components/inventory/boxHinge';
test('lid outside projection preserves the original artwork precisely at zero degrees',()=>{
 for(let i=0;i<BOX_LID_OUTSIDE.length;i+=2){
  const x=BOX_LID_OUTSIDE[i],y=BOX_LID_OUTSIDE[i+1],p=projectLidOutside(x,y,0);
  assert.ok(Math.abs(p[0]-x)<1e-8);assert.ok(Math.abs(p[1]-y)<1e-8);
 }
});
test('inner lid has a fixed hinge across continuous rotation, with a stable resting pose',()=>{
 for(let angle=0;angle<=96;angle+=.5){
  for(let i=0;i<4;i+=2){
   const p=projectLidInside(BOX_HINGE[i],BOX_HINGE[i+1],angle);
   assert.ok(Math.abs(p[0]-BOX_HINGE[i])<1e-8);assert.ok(Math.abs(p[1]-BOX_HINGE[i+1])<1e-8);
  }
  const a=new Float32Array(BOX_LID_INSIDE.length),b=new Float32Array(BOX_LID_INSIDE.length);
  fillLidVertices(a,BOX_LID_INSIDE,angle,true);fillLidVertices(b,BOX_LID_INSIDE,angle+.5,true);
  assert.ok(a.every((v,i)=>Number.isFinite(v)&&Math.abs(v-b[i])<1));
 }
 assert.deepEqual(lidSurfaceOpacity(0),{outside:1,inside:0,closed:1});
 assert.deepEqual(lidSurfaceOpacity(88),{outside:0,inside:1,closed:0});
});
test('GPU stage prewarms its renderer, reuses particles, and starts after initialization',()=>{
 const fx=readFileSync('src/components/inventory/PixiBoxStage.tsx','utf8');
 const dialog=readFileSync('src/components/inventory/AdventurerBoxDialog.tsx','utf8');
 assert.match(fx,/warmRenderer/);assert.match(fx,/app\.ticker\.maxFPS=60/);
 assert.match(fx,/fillLidVertices\(outside\.geometry\.positions/);
 assert.match(fx,/getBuffer\('aPosition'\)\.update\(\)/);
 assert.match(fx,/started=performance\.now\(\);draw\(\)/);
 assert.doesNotMatch(fx,/particles\.clear\(/);
 assert.match(dialog,/renderer==='loading'\|\|startedReceipt/);
 assert.match(dialog,/disposePreloadedBoxEffects/);
});
