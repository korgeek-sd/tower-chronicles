import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SSRRevealFrame} from '../src/components/appearance/SSRReveal';
import {SEAL_FRAGMENTS} from '../src/components/appearance/sealMotion';
import {readFileSync} from 'node:fs';
const p={draw:{id:'valkyrie',rarity:'SR' as const,duplicate:false},total:10,onDone:()=>{},onRepeat:()=>{},canRepeat:true,busy:false};
test('smooth seal separates crack frames, rune glow, seven fragments and bounded independent motes',()=>{
 for(const rarity of ['SR','SSR'] as const){
 const html=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,draw:{...p.draw,rarity},ready:false}));
 assert.match(html,/seal-stone-cracks-v3\.webp/);assert.match(html,/seal-rune-mask-v2\.webp/);
 assert.equal((html.match(/class="tc-seal-fragment"/g)||[]).length,7);
 assert.equal((html.match(/class="tc-seal-mote"/g)||[]).length,rarity==='SSR'?24:16);
 assert.doesNotMatch(html,/seal-particles-v1\.webp/);
 const done=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,draw:{...p.draw,rarity},ready:true}));assert.doesNotMatch(done,/tc-seal-fragment|tc-seal-mote|tc-seal-rune-glow/);
 }
 const m=JSON.parse(readFileSync('public/assets/vfx/summon/seal-stone-cracks-v3.json','utf8'));assert.equal(m.frames.length,14);
 const css=readFileSync('src/components/appearance/ssr-reveal.css','utf8');assert.match(css,/\.tc-seal-stone-motion/);assert.doesNotMatch(css,/\.tc-ssr-reveal\[data-rarity="SSR"\] \.tc-seal-stone\{[^}]*tremor/);assert.match(css,/tc-seal-fragment-flight/);assert.match(css,/tc-seal-mote-flight/);assert.match(css,/prefers-reduced-motion/);
});

test('fragment masks partition the entire source cell without losing pieces',()=>{
 let area=0;
 for(const f of SEAL_FRAGMENTS){
 const values=f.clip.match(/-?[\d.]+/g)!.map(Number);const points=Array.from({length:values.length/2},(_,i)=>[values[i*2],values[i*2+1]]);
 assert.ok(points.every(p=>p.every(v=>v>=-.001&&v<=100.001)));
 area+=Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;
 }
 assert.ok(Math.abs(area-10000)<1);
});
