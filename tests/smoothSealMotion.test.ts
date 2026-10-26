import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SSRRevealFrame} from '../src/components/appearance/SSRReveal';
import {readFileSync} from 'node:fs';
const p={draw:{id:'valkyrie',rarity:'SR' as const,duplicate:false},total:10,onDone:()=>{},onRepeat:()=>{},canRepeat:true,busy:false};
test('smooth seal combines 24-frame crack and shatter atlases, rune glow and bounded motes',()=>{
 for(const rarity of ['SR','SSR'] as const){
 const html=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,draw:{...p.draw,rarity},ready:false}));
 assert.match(html,/seal-stone-cracks-v4-24f\.webp/);assert.match(html,/seal-rune-mask-v2\.webp/);
 assert.equal((html.match(/class="tc-seal-destruction-sprite"/g)||[]).length,1);
 assert.equal((html.match(/class="tc-seal-mote"/g)||[]).length,rarity==='SSR'?24:16);
 assert.doesNotMatch(html,/seal-particles-v1\.webp/);
 const done=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,draw:{...p.draw,rarity},ready:true}));assert.doesNotMatch(done,/tc-seal-destruction|tc-seal-mote|tc-seal-rune-glow/);
 }
 const m=JSON.parse(readFileSync('public/assets/vfx/summon/seal-stone-cracks-v4-24f.json','utf8'));assert.equal(m.frames.length,24);
 const css=readFileSync('src/components/appearance/ssr-reveal.css','utf8');assert.match(css,/\.tc-seal-stone-motion/);assert.doesNotMatch(css,/\.tc-ssr-reveal\[data-rarity="SSR"\] \.tc-seal-stone\{[^}]*tremor/);assert.match(css,/tc-seal-destruction-frames/);assert.match(css,/tc-seal-mote-flight/);assert.match(css,/prefers-reduced-motion/);
});
