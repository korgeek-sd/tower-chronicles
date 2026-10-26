import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {SSRRevealFrame,nextSealTapCount,SEAL_TAPS_REQUIRED,vibrateSealTap} from '../src/components/appearance/SSRReveal';
const p={draw:{id:'valkyrie',rarity:'SR' as const,duplicate:false},total:10,onDone:()=>{},onOpen:()=>{},onRepeat:()=>{},canRepeat:true,busy:false};
test('seal waits for an accessible tap, then removes the trigger during opening and result',()=>{
 const waiting=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,ready:false,opened:false}));
 assert.match(waiting,/data-phase="waiting"/);assert.match(waiting,/data-rarity="sealed"/);
 assert.doesNotMatch(waiting,/result="warm"|data-rarity="SR"|seal-violet/);
 assert.match(waiting,/aria-label="소환석 봉인 해제"/);assert.match(waiting,/소환석을 눌러/);
 const opening=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,ready:false,opened:true}));
 assert.match(opening,/data-phase="opening"/);assert.match(opening,/data-rarity="SR"/);
 assert.match(opening,/result="warm"/);assert.match(opening,/seal-violet/);
 assert.doesNotMatch(opening,/tc-seal-stone-trigger/);
 const ready=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,ready:true,opened:true}));assert.match(ready,/data-phase="ready"/);assert.doesNotMatch(ready,/tc-seal-stone-trigger|tc-ssr-vfx/);
 const busy=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,ready:false,busy:true}));assert.match(busy,/class="tc-seal-stone-trigger"[^>]*disabled=""/);
});
test('SR violet and SSR gold tint only VFX, with static waiting and reduced motion support',()=>{
 const css=readFileSync('src/components/appearance/ssr-reveal.css','utf8');assert.match(css,/--seal-color:#c8a2ee/);assert.match(css,/--seal-color:#edcb83/);assert.match(css,/\.is-waiting/);assert.match(css,/animation-delay:-2[.]6s/);assert.match(css,/prefers-reduced-motion/);
 const source=readFileSync('src/components/appearance/SSRReveal.tsx','utf8');assert.match(source,/if\(!opened\)return/);
});

test('three taps crack a neutral stone twice before revealing rarity on the third',()=>{
 assert.equal(SEAL_TAPS_REQUIRED,3);
 assert.equal(nextSealTapCount(0),1);
 assert.equal(nextSealTapCount(1),2);
 assert.equal(nextSealTapCount(2),3);
 assert.equal(nextSealTapCount(3),3);
 for(const rarity of ['SR','SSR'] as const){
  for(const taps of [0,1,2]){
   const html=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,draw:{...p.draw,rarity},ready:false,opened:false,taps}));
   assert.match(html,new RegExp('data-rarity="sealed" data-phase="waiting" data-taps="'+taps+'"'));
   assert.match(html,/aria-label="소환석 봉인 해제"/);
   assert.doesNotMatch(html,/seal-violet|data-rarity="SR"|data-rarity="SSR"/);
   if(taps===1)assert.match(html,/첫 번째 균열/);
   if(taps===2)assert.match(html,/마지막으로 누르세요/);
  }
  const html=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,draw:{...p.draw,rarity},ready:false,opened:true,taps:3}));
  assert.match(html,new RegExp('data-rarity="'+rarity+'" data-phase="opening" data-taps="3"'));
  assert.doesNotMatch(html,/tc-seal-stone-trigger/);
 }
 const css=readFileSync('src/components/appearance/ssr-reveal.css','utf8');
 assert.match(css,/is-waiting.*data-taps="1".*background-position:22[.]222222% 20%/);
 assert.match(css,/is-waiting.*data-taps="2".*background-position:22[.]222222% 60%/);
 assert.match(css,/tc-seal-first-hit/);
 assert.match(css,/tc-seal-second-hit/);
});
test('haptic pattern grows across touches and gracefully supports devices without vibration',()=>{
 const received:Array<number|number[]>=[];
 const vibrate=(pattern:number|number[])=>{received.push(pattern);return true;};
 assert.equal(vibrateSealTap(1,vibrate),true);
 assert.equal(vibrateSealTap(2,vibrate),true);
 assert.equal(vibrateSealTap(3,vibrate),true);
 assert.deepEqual(received,[20,40,[70,45,90]]);
 assert.equal(vibrateSealTap(2),false);
 assert.equal(vibrateSealTap(3,()=>{throw Error('not supported')}),false);
 assert.equal(vibrateSealTap(4,vibrate),false);
});


test('final tap has a neutral suspense beat before SR or SSR is exposed',()=>{
 for(const rarity of ['SR','SSR'] as const){
  const suspended=renderToStaticMarkup(React.createElement(SSRRevealFrame,{
   ...p,draw:{...p.draw,rarity},ready:false,opened:true,colorRevealed:false,taps:3,
  }));
  assert.match(suspended,/data-rarity="sealed" data-phase="opening" data-taps="3"/);
  assert.doesNotMatch(suspended,/data-rarity="SR"|data-rarity="SSR"|seal-violet/);
  assert.match(suspended,/tc-seal-suspense-shade/);
  const exposed=renderToStaticMarkup(React.createElement(SSRRevealFrame,{
   ...p,draw:{...p.draw,rarity},ready:false,opened:true,colorRevealed:true,taps:3,
  }));
  assert.match(exposed,new RegExp('data-rarity="'+rarity+'" data-phase="opening"'));
 }
 const waiting=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,ready:false,opened:false,taps:2}));
 assert.equal((waiting.match(/class="is-broken"/g)||[]).length,2);
 assert.match(waiting,/tc-seal-tap-meter/);
 const css=readFileSync('src/components/appearance/ssr-reveal.css','utf8');
 assert.match(css,/tc-seal-hit-ring-1/);
 assert.match(css,/tc-seal-hit-ring-2/);
 assert.match(css,/tc-seal-ssr-reveal-pulse 1900ms/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
