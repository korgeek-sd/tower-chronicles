import test from 'node:test';
import assert from 'node:assert/strict';
import {attackWindup,recoilFrames} from '../src/components/battle/battleVfxTimeline.ts';
test('attack windup scales with presentation speed',()=>{
 assert.equal(attackWindup(1),120);assert.equal(attackWindup(2),60);
});
test('recoil pushes away from attacker and returns to rest',()=>{
 const player=recoilFrames('player',false,1),monster=recoilFrames('monster',true,1);
 assert.match(player.frames[2].transform,/translate\(-/);
 assert.match(monster.frames[2].transform,/translate\(12px/);
 assert.equal(monster.frames.at(-1)?.transform,'translate(0,0) scale(1)');
 assert.ok(monster.duration>player.duration);
 assert.equal(recoilFrames('monster',true,1,true).frames.length,0);
});
