import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveGameFeelRecipe} from '../src/gameFeel/engine.ts';
import {createFeedbackQueue} from '../src/gameFeel/feedback.ts';
import {playHaptic} from '../src/gameFeel/haptics.ts';
import {readGameFeelPreferences} from '../src/gameFeel/preferences.ts';

const withGlobal=<K extends keyof typeof globalThis>(key:K,value:(typeof globalThis)[K],run:()=>void)=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,key);
 Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 try{run();}finally{
  if(descriptor)Object.defineProperty(globalThis,key,descriptor);
  else delete (globalThis as Record<string,unknown>)[key as string];
 }
};

test('GAME FEEL RUNTIME 01: haptics are safe when vibration is unsupported',()=>{
 assert.doesNotThrow(()=>playHaptic('normal'));
});

test('GAME FEEL RUNTIME 02: a throwing vibration implementation is contained',()=>{
 withGlobal('navigator',{vibrate:()=>{throw new Error('blocked');}} as Navigator,()=>{
  assert.doesNotThrow(()=>playHaptic('exceptional'));
 });
});

test('GAME FEEL RUNTIME 03: haptic patterns are finite and semantic',()=>{
 const calls:(number|number[])[]=[];
 withGlobal('navigator',{vibrate:(pattern:number|number[])=>{calls.push(pattern);return true;}} as Navigator,()=>{
  playHaptic('subtle');
  playHaptic('normal');
  playHaptic('strong');
  playHaptic('exceptional');
 });
 assert.equal(calls.length,4);
 assert.deepEqual(calls[0],10);
 assert.deepEqual(calls[1],20);
 assert.deepEqual(calls[2],[18,28,18]);
 assert.deepEqual(calls[3],[22,32,30,32,22]);
});

test('GAME FEEL RUNTIME 04: feedback queue is bounded under rapid repeated events',()=>{
 const queue=createFeedbackQueue({maxActive:3});
 const recipe=resolveGameFeelRecipe('combat.basic-hit');
 for(let i=0;i<20;i++)queue.enqueue(recipe,1000+i);
 const entries=queue.snapshot();
 assert.equal(entries.length,3);
 assert.deepEqual(entries.map(entry=>entry.createdAt),[1017,1018,1019]);
});

test('GAME FEEL RUNTIME 05: feedback queue prunes expired entries',()=>{
 const queue=createFeedbackQueue({maxActive:4});
 const recipe=resolveGameFeelRecipe('ui.press');
 queue.enqueue(recipe,1000);
 assert.equal(queue.snapshot().length,1);
 queue.prune(1000+recipe.duration+1);
 assert.equal(queue.snapshot().length,0);
});

test('GAME FEEL RUNTIME 06: reduced-motion preference follows matchMedia',()=>{
 withGlobal('matchMedia',((query:string)=>({matches:query==='(prefers-reduced-motion: reduce)'})) as typeof matchMedia,()=>{
  assert.deepEqual(readGameFeelPreferences(),{reducedMotion:true});
 });
});

test('GAME FEEL RUNTIME 07: missing matchMedia safely defaults to normal motion',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'matchMedia');
 try{
  delete (globalThis as Record<string,unknown>).matchMedia;
  assert.deepEqual(readGameFeelPreferences(),{reducedMotion:false});
 }finally{
  if(descriptor)Object.defineProperty(globalThis,'matchMedia',descriptor);
 }
});
