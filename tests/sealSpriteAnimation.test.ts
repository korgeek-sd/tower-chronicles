import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {SSRRevealFrame} from '../src/components/appearance/SSRReveal';
const p={draw:{id:'valkyrie',rarity:'SR' as const,duplicate:false},total:10,onDone:()=>{},onRepeat:()=>{},canRepeat:true,busy:false};
test('SR and SSR use the aligned 16-frame atlas only while the seal is opening',()=>{
 for(const rarity of ['SR','SSR'] as const){
 const opening=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,draw:{...p.draw,rarity},ready:false}));assert.match(opening,/seal-stone-16frames-v2\.webp/);assert.match(opening,/tc-seal-stone-sprite/);assert.doesNotMatch(opening,/seal-stone-v1\.webp/);
 const ready=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,draw:{...p.draw,rarity},ready:true}));assert.doesNotMatch(ready,/tc-seal-stone-sprite|seal-stone-16frames/);
 }
 const m=JSON.parse(readFileSync('public/assets/vfx/summon/seal-stone-16frames-v2.json','utf8'));assert.equal(m.frames.length,16);assert.equal(m.width,m.cellSize*4);assert.equal(m.height,m.cellSize*4);
 for(const [i,f] of m.frames.entries()){assert.equal(f.x,(i%4)*m.cellSize);assert.equal(f.y,Math.floor(i/4)*m.cellSize);assert.equal(f.anchorX,m.anchorX);assert.equal(f.anchorY,m.anchorY);}
 const css=readFileSync('src/components/appearance/ssr-reveal.css','utf8');assert.match(css,/background-size:400% 400%/);assert.match(css,/tc-seal-stone-frames 4s steps\(1,end\)/);assert.match(css,/prefers-reduced-motion/);
});
