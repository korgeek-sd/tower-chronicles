import test from 'node:test';
import assert from 'node:assert/strict';
import * as feedback from '../src/components/battle/battleVfxTimeline.ts';

test('critical visual freeze scales with playback and respects reduced motion',()=>{
 assert.equal(feedback.criticalVisualHold(false,1,false),0);
 assert.equal(feedback.criticalVisualHold(true,1,false),55);
 assert.equal(feedback.criticalVisualHold(true,2,false),28);
 assert.equal(feedback.criticalVisualHold(true,1,true),0);
});

test('unsupported audio cannot break battle actions or sound preferences',async()=>{
 const audio=await import('../src/components/battle/combatAudio.ts');
 assert.doesNotThrow(()=>audio.unlockCombatAudio());
 assert.doesNotThrow(()=>audio.playCombatImpact('sword',true,false));
 assert.doesNotThrow(()=>audio.setCombatAudioEnabled(false));
 assert.doesNotThrow(()=>audio.stopCombatAudio());
 audio.setCombatAudioEnabled(true);
});
