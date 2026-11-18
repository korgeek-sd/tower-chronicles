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
