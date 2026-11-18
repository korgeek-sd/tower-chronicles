import test from 'node:test';
import assert from 'node:assert/strict';
import {boxLightning} from '../src/components/inventory/boxLightning';
test('lightning respects charge, silence, burst and expiry',()=>{
 assert.deepEqual(boxLightning(.2,.65,1.4,1.6),[]);
 assert.ok(boxLightning(1,.65,1.4,1.6).length>0);
 assert.deepEqual(boxLightning(1.5,.65,1.4,1.6),[]);
 assert.ok(boxLightning(1.9,.65,1.4,1.6).length>=3);
 assert.deepEqual(boxLightning(3.2,.65,1.4,1.6),[]);
});
test('bolts are deterministic, grid aligned and bounded inside the stage',()=>{
 for(let t=.7;t<3.1;t+=.037){
  const bolts=boxLightning(t,.65,1.4,1.6);
  assert.deepEqual(bolts,boxLightning(t,.65,1.4,1.6));
  for(const bolt of bolts){
   assert.ok(bolt.alpha>0&&bolt.alpha<=1);
   for(const [x,y] of bolt.points){assert.ok(x%4===0);assert.ok(y%4===0);assert.ok(Math.abs(x)<=168&&y>=-176&&y<=100);}
  }
 }
});
