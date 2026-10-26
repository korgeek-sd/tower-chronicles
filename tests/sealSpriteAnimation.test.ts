import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {SSRRevealFrame} from '../src/components/appearance/SSRReveal';
const p={draw:{id:'valkyrie',rarity:'SR' as const,duplicate:false},total:10,onDone:()=>{},onRepeat:()=>{},canRepeat:true,busy:false};

test('SR and SSR use two 24-frame sprites after a user gesture and remove both on completion',()=>{
 for(const rarity of ['SR','SSR'] as const){
  const opening=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,draw:{...p.draw,rarity},ready:false}));
  assert.match(opening,/seal-stone-cracks-v4-24f\.webp/);
  assert.match(opening,/seal-stone-destruction-v1-24f\.webp/);
  assert.match(opening,/tc-seal-stone-sprite/);
  assert.match(opening,/tc-seal-destruction-sprite/);
  assert.match(opening,/소환석 봉인 해제/);
  assert.doesNotMatch(opening,/seal-stone-v1\.webp/);
  const ready=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,draw:{...p.draw,rarity},ready:true}));
  assert.doesNotMatch(ready,/tc-seal-stone-sprite|tc-seal-destruction-sprite|seal-stone-cracks/);
 }
});
test('both images have matching 6x4 cell layout and frame-coordinate metadata',()=>{
 for(const name of ['seal-stone-cracks-v4-24f','seal-stone-destruction-v1-24f']){
  const base='public/assets/vfx/summon/'+name;
  const m=JSON.parse(readFileSync(base+'.json','utf8'));
  assert.equal(m.frameCount,24);
  assert.equal(m.frames.length,24);
  assert.equal(m.columns,6);
  assert.equal(m.rows,4);
  assert.equal(m.cellSize,384);
  assert.equal(m.width,2304);
  assert.equal(m.height,1536);
  for(const [i,f] of m.frames.entries()){assert.equal(f.x,(i%6)*m.cellSize);assert.equal(f.y,Math.floor(i/6)*m.cellSize);}
  const img=readFileSync(base+'.webp');
  assert.equal(img.toString('ascii',0,4),'RIFF');
  assert.equal(img.toString('ascii',8,12),'WEBP');
  assert.ok(img.byteLength>2000);
 }
});
test('touch timeline runs crack frames then destruction frames at the same 6x4 grid',()=>{
 const css=readFileSync('src/components/appearance/ssr-reveal.css','utf8');
 assert.match(css,/tc-seal-stone-frames 4s steps\(1,end\)/);
 assert.match(css,/tc-seal-destruction-frames 4s steps\(1,end\)/);
 assert.match(css,/background-size:600% 400%/);
 assert.match(css,/\.tc-ssr-reveal\.is-waiting \.tc-seal-stone-sprite\{animation:none;background-position:0 0/);
 assert.match(css,/\.tc-ssr-reveal\.is-waiting \.tc-seal-destruction/);
 assert.match(css,/\.tc-ssr-reveal\.is-opening \*\{animation-delay:-2s!important/);
 assert.match(css,/prefers-reduced-motion/);
});
