import test from 'node:test';
import assert from 'node:assert/strict';
import {lightningArtPose} from '../src/components/inventory/boxLightningArt';
test('pixelfx sequence separates charge, hold, release and complete',()=>{
 assert.equal(lightningArtPose(-1),null);
 assert.equal(lightningArtPose(.2)?.frame,4);
 assert.equal(lightningArtPose(.8)?.frame,19);
 assert.equal(lightningArtPose(1)?.frame,24);
 assert.equal(lightningArtPose(2),null);
});
import {boxLightningTime} from '../src/components/inventory/boxLightningArt';
test('charge follows grade timing but mouth glow precedes the branching release',()=>{
 for(const burst of [1.62,2.32,3.65]){
  const charge=.65,hold=burst-.4;
  assert.equal(boxLightningTime(charge-.01,charge,hold,burst),-1);
  assert.equal(boxLightningTime(hold,charge,hold,burst),.72);
  assert.ok(boxLightningTime(burst-.01,charge,hold,burst)<.8);
  assert.equal(boxLightningTime(burst,charge,hold,burst),.8);
  assert.equal(lightningArtPose(boxLightningTime(burst+1.21,charge,hold,burst)),null);
 }
});
