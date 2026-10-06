import test from 'node:test';
import assert from 'node:assert/strict';
import {assetUrl} from '../src/game/data/graphics.ts';
import {JOB_VISUAL_ASSETS} from '../src/game/jobs/visualAssets.ts';

test('replaced character art gets a new image URL independently of the page URL',()=>{
 assert.equal(assetUrl('assets/characters/jobs/duelist.webp'),'./assets/characters/jobs/duelist.webp?v=e4991963');
 assert.equal(assetUrl('/assets/characters/jobs/duelist.webp'),'./assets/characters/jobs/duelist.webp?v=e4991963');
 assert.equal(assetUrl('assets/monsters/iron-t1/mine_bat.png'),'./assets/monsters/iron-t1/mine_bat.png');
});

test('every registered job portrait has a revision URL after the HD replacement',()=>{
 for(const path of Object.values(JOB_VISUAL_ASSETS)){
  assert.ok(path);
  assert.match(assetUrl(path!),/\?v=/);
 }
});
