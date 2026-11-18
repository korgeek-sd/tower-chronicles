import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lightningArtPose} from '../src/components/inventory/boxLightningArt';
test('authored discharge begins with open lid and settles through all four drawings',()=>{
 assert.equal(lightningArtPose(0),null);
 assert.equal(lightningArtPose(.1),null);
 assert.equal(lightningArtPose(.2)?.frame,0);
 assert.equal(lightningArtPose(.3)?.frame,1);
 assert.equal(lightningArtPose(.9)?.frame,2);
 assert.equal(lightningArtPose(1.1)?.frame,3);
 assert.equal(lightningArtPose(1.5),null);
});
test('atlas and actual stage use transparent authored art with mouth light',()=>{
 const image=readFileSync('public/assets/ui/shop/box_lightning_authored_v2.png');
 assert.equal(image[25],6);
 assert.equal(image.readUInt32BE(16),image.readUInt32BE(20));
 const stage=readFileSync('src/components/inventory/PixiBoxStage.tsx','utf8');
 assert.ok(stage.includes('lightningArtPose(seconds-burst)'));
 assert.ok(stage.includes('mouthLight.alpha='));
 assert.ok(!stage.includes('boxLightning(seconds'));
});
