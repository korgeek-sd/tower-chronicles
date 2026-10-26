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
  assert.match(opening,/seal-stone-dissolve-v2-60f\.webp/);
  assert.match(opening,/tc-seal-stone-sprite/);
  assert.match(opening,/tc-seal-dissolve-sprite/);
  assert.match(opening,/소환석 봉인 해제/);
  assert.doesNotMatch(opening,/seal-stone-v1\.webp/);
  const ready=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,draw:{...p.draw,rarity},ready:true}));
  assert.doesNotMatch(ready,/tc-seal-stone-sprite|tc-seal-dissolve-sprite|seal-stone-cracks/);
 }
});
test('SR and SSR hide rarity until tapped and then reveal their distinct colors',()=>{
 const css=readFileSync('src/components/appearance/ssr-reveal.css','utf8');
 assert.match(css,/\.tc-ssr-reveal\{--seal-color:#a6a8a5/);
 assert.match(css,/--seal-filter:grayscale\(1\) brightness\(\.83\)/);
 assert.match(css,/\.tc-ssr-reveal\[data-rarity="SR"\]\{--seal-color:#c8a2ee/);
 assert.match(css,/\.tc-ssr-reveal\[data-rarity="SSR"\]\{--seal-color:#edcb83/);
 assert.match(css,/\.tc-ssr-reveal\.is-waiting \.tc-seal-rarity-halo/);
 assert.match(css,/tc-seal-rarity-halo-reveal/);
 for(const rarity of ['SR','SSR'] as const){
  const draw={...p.draw,rarity};
  const waiting=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,draw,ready:false}));
  assert.match(waiting,/data-rarity="sealed" data-phase="waiting"/);
  assert.match(waiting,/aria-label="소환석 봉인 해제"/);
  assert.doesNotMatch(waiting,/data-rarity="SR"|data-rarity="SSR"|aria-label="SR |aria-label="SSR |seal-violet/);
  assert.equal((waiting.match(/class="tc-seal-mote"/g)||[]).length,24);
  assert.match(waiting,/봉인된 기록/);
  const opened=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,draw,ready:false,opened:true}));
  assert.match(opened,new RegExp('data-rarity="'+rarity+'" data-phase="opening"'));
  assert.match(opened,/tc-seal-rarity-halo/);
  if(rarity==='SR')assert.match(opened,/seal-violet-/);
  else assert.doesNotMatch(opened,/seal-violet-/);
  const result=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,draw,ready:true}));
  assert.match(result,new RegExp('data-rarity="'+rarity+'" data-phase="ready"'));
 }
});

test('crack and dissolve images have their respective grid dimensions and frame coordinates',()=>{
 for(const name of ['seal-stone-cracks-v5-60f','seal-stone-dissolve-v2-60f']){
  const base='public/assets/vfx/summon/'+name;
  const m=JSON.parse(readFileSync(base+'.json','utf8'));
  const cracks=name.includes('cracks');
  assert.equal(m.frameCount,60);
  assert.equal(m.frames.length,60);
  assert.equal(m.columns,10);
  assert.equal(m.rows,6);
  assert.equal(m.cellSize,256);
  assert.equal(m.width,m.columns*m.cellSize);
  assert.equal(m.height,m.rows*m.cellSize);
  for(const [i,f] of m.frames.entries()){assert.equal(f.x,(i%m.columns)*m.cellSize);assert.equal(f.y,Math.floor(i/m.columns)*m.cellSize);}
  const img=readFileSync(base+'.webp');
  assert.equal(img.toString('ascii',0,4),'RIFF');
  assert.equal(img.toString('ascii',8,12),'WEBP');
  assert.ok(img.byteLength>2000);
  if(!cracks){
   assert.equal(m.effect,'irregular_noise_dissolve');
   assert.equal(m.partition,'warped_voronoi');
   assert.ok(m.chipCount>=25);
   assert.ok(m.particleCount>=80);
  }
 }
});
test('touch timeline runs crack frames then crumble-and-dissolve frames on 10x6 grids',()=>{
 const css=readFileSync('src/components/appearance/ssr-reveal.css','utf8');
 assert.match(css,/display:none!important/);
 assert.match(css,/tc-seal-stone-frames 4s steps\(1,end\)/);
 assert.match(css,/tc-seal-dissolve-frames 4s steps\(1,end\)/);
 assert.match(css,/\.tc-seal-stone-sprite\{[^}]*background-size:1000% 600%/);
 assert.match(css,/\.tc-seal-dissolve-sprite\{[^}]*background-size:1000% 600%/);
 assert.match(css,/\.tc-ssr-reveal\.is-waiting \.tc-seal-stone-sprite\{animation:none;background-position:0 0/);
 assert.match(css,/\.tc-ssr-reveal\.is-waiting \.tc-seal-dissolve/);
 assert.match(css,/\.tc-ssr-reveal\.is-opening \*\{animation-delay:-2\.6s!important/);
 assert.match(css,/prefers-reduced-motion/);
});
