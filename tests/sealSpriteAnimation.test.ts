import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {SSRRevealFrame} from '../src/components/appearance/SSRReveal';
const p={draw:{id:'valkyrie',rarity:'SR' as const,duplicate:false},total:10,onDone:()=>{},onRepeat:()=>{},canRepeat:true,busy:false};

test('SR and SSR use two 60-frame sprites after a user gesture and remove both on completion',()=>{
 for(const rarity of ['SR','SSR'] as const){
  const opening=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,draw:{...p.draw,rarity},ready:false}));
  assert.match(opening,/seal-stone-cracks-v5-60f\.webp/);
  assert.match(opening,/seal-stone-opening-v3-60f\.webp/);
  assert.match(opening,/tc-seal-stone-sprite/);
  assert.match(opening,/tc-seal-opening-sprite/);
  assert.match(opening,/소환석 봉인 해제/);
  assert.doesNotMatch(opening,/seal-stone-v1\.webp/);
  const ready=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,draw:{...p.draw,rarity},ready:true}));
  assert.doesNotMatch(ready,/tc-seal-stone-sprite|tc-seal-opening-sprite|seal-stone-cracks/);
 }
});
test('crack and opening images have their respective grid dimensions and frame coordinates',()=>{
 for(const name of ['seal-stone-cracks-v5-60f','seal-stone-opening-v3-60f']){
  const base='public/assets/vfx/summon/'+name;
  const m=JSON.parse(readFileSync(base+'.json','utf8'));
  const cracks=name.includes('cracks');
  assert.equal(m.frameCount,60);
  assert.equal(m.frames.length,60);
  assert.equal(m.columns,10);
  assert.equal(m.rows,6);
  assert.equal(m.cellSize,cracks?256:160);
  assert.equal(m.width,m.columns*m.cellSize);
  assert.equal(m.height,m.rows*m.cellSize);
  for(const [i,f] of m.frames.entries()){assert.equal(f.x,(i%m.columns)*m.cellSize);assert.equal(f.y,Math.floor(i/m.columns)*m.cellSize);}
  const img=readFileSync(base+'.webp');
  assert.equal(img.toString('ascii',0,4),'RIFF');
  assert.equal(img.toString('ascii',8,12),'WEBP');
  assert.ok(img.byteLength>2000);
 }
});
test('touch timeline runs crack frames then split-opening frames on 10x6 grids',()=>{
 const css=readFileSync('src/components/appearance/ssr-reveal.css','utf8');
 assert.match(css,/tc-seal-stone-frames 4s steps\(1,end\)/);
 assert.match(css,/tc-seal-opening-frames 4s steps\(1,end\)/);
 assert.match(css,/\.tc-seal-stone-sprite\{[^}]*background-size:1000% 600%/);
 assert.match(css,/\.tc-seal-opening-sprite\{[^}]*background-size:1000% 600%/);
 assert.match(css,/\.tc-ssr-reveal\.is-waiting \.tc-seal-stone-sprite\{animation:none;background-position:0 0/);
 assert.match(css,/\.tc-ssr-reveal\.is-waiting \.tc-seal-opening/);
 assert.match(css,/\.tc-ssr-reveal\.is-opening \*\{animation-delay:-2s!important/);
 assert.match(css,/prefers-reduced-motion/);
});
