import test from'node:test';import assert from'node:assert/strict';
import{playHaptic}from'../src/gameFeel/haptics.ts';
import{createFeedbackQueue}from'../src/gameFeel/feedback.ts';
import{readGameFeelPreferences}from'../src/gameFeel/preferences.ts';
import{resolveGameFeelRecipe}from'../src/gameFeel/engine.ts';

test('GAME FEEL RUNTIME: haptics are optional and non-throwing',()=>{
 assert.doesNotThrow(()=>playHaptic('normal',{}));
 assert.doesNotThrow(()=>playHaptic('strong',{vibrate:()=>{throw new Error('blocked')}}));
});
test('GAME FEEL RUNTIME: feedback queue is bounded and expires entries',()=>{
 const queue=createFeedbackQueue({maxActive:3,now:()=>100});
 for(let i=0;i<6;i++)queue.enqueue(resolveGameFeelRecipe('combat.basic-hit'));
 assert.equal(queue.snapshot().length,3);
 queue.prune(1000);assert.equal(queue.snapshot().length,0);
});
test('GAME FEEL RUNTIME: reduced motion preference safely detects browser support',()=>{
 assert.equal(readGameFeelPreferences({}),false);
 assert.equal(readGameFeelPreferences({matchMedia:()=>({matches:true})}),true);
});
