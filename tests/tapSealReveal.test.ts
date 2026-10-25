import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {SSRRevealFrame} from '../src/components/appearance/SSRReveal';
const p={draw:{id:'valkyrie',rarity:'SR' as const,duplicate:false},total:10,onDone:()=>{},onOpen:()=>{},onRepeat:()=>{},canRepeat:true,busy:false};
test('seal waits for an accessible tap, then removes the trigger during opening and result',()=>{
 const waiting=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,ready:false,opened:false}));
 assert.match(waiting,/data-phase="waiting"/);assert.match(waiting,/result="warm"/);assert.match(waiting,/aria-label="SR 소환석 봉인 해제"/);assert.match(waiting,/소환석을 눌러/);
 const opening=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,ready:false,opened:true}));assert.match(opening,/data-phase="opening"/);assert.doesNotMatch(opening,/tc-seal-stone-trigger/);
 const ready=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,ready:true,opened:true}));assert.match(ready,/data-phase="ready"/);assert.doesNotMatch(ready,/tc-seal-stone-trigger|tc-ssr-vfx/);
 const busy=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,ready:false,busy:true}));assert.match(busy,/class="tc-seal-stone-trigger"[^>]*disabled=""/);
});
test('SR violet and SSR gold tint only VFX, with static waiting and reduced motion support',()=>{
 const css=readFileSync('src/components/appearance/ssr-reveal.css','utf8');assert.match(css,/--seal-color:#c8a2ee/);assert.match(css,/--seal-color:#edcb83/);assert.match(css,/\.is-waiting/);assert.match(css,/animation-delay:-2s/);assert.match(css,/prefers-reduced-motion/);
 const source=readFileSync('src/components/appearance/SSRReveal.tsx','utf8');assert.match(source,/if\(!opened\)return/);
});
