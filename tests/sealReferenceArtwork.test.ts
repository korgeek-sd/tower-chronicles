import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {SealArtwork} from '../src/components/seal/SealArtwork';

test('reference seal uses raster art and labels all thirty server progress stages',()=>{
 const html=renderToStaticMarkup(React.createElement(SealArtwork,{variant:'association',level:12,mode:'idle',sequence:0}));
 assert.match(html,/seal-solar-reference-v1\.png/);
 assert.equal((html.match(/class="tc-insignia-ring-node"/g)||[]).length,30);
 assert.equal((html.match(/data-reached="true"/g)||[]).length,12);
 assert.match(html,/aria-current="step"/);
 assert.doesNotMatch(html,/<svg|<canvas/);
 const guardian=renderToStaticMarkup(React.createElement(SealArtwork,{variant:'guardian',level:30,mode:'forge',sequence:2}));
 assert.match(guardian,/수호 인장/);
 assert.equal((guardian.match(/data-reached="true"/g)||[]).length,30);
});

test('engraving light only follows a confirmed result and marks the actual gained stages',()=>{
 for(const step of [1,2,3]){
  const html=renderToStaticMarkup(React.createElement(SealArtwork,{variant:'association',level:12+step,fromLevel:12,step,mode:'forge',sequence:step}));
  assert.match(html,new RegExp('data-result-step="'+step+'"'));
  assert.match(html,/tc-insignia-forge-light/);
  assert.equal((html.match(/data-forged="true"/g)||[]).length,step);
 }
 const capped=renderToStaticMarkup(React.createElement(SealArtwork,{variant:'guardian',level:30,fromLevel:29,step:3,mode:'forge',sequence:4}));
 assert.equal((capped.match(/data-forged="true"/g)||[]).length,1);
 for(const mode of ['idle','reset','forge'] as const){
  const html=renderToStaticMarkup(React.createElement(SealArtwork,{variant:'association',level:12,fromLevel:10,step:null,mode,sequence:0}));
  assert.doesNotMatch(html,/tc-insignia-forge-light|data-forged="true"/);
 }
 const css=readFileSync('src/components/seal/seal-reference.css','utf8');
 assert.doesNotMatch(css,/transform:[^;}]*\b(?:scale|rotate)\(|tc-reference-forge/);
 assert.match(css,/mask-image:url\(/);
 assert.match(css,/tc-seal-light-travel/);
 assert.match(css,/tc-seal-node-afterglow/);
 const ui=readFileSync('src/components/seal/SealScreen.tsx','utf8');
 assert.ok(ui.indexOf('setVisualFromLevel(lastBeforeLevel)')>ui.indexOf('const result=await rollOnlineSeal(onlineLease,sealId)'));
});

test('reference artwork is present, motion is bounded, and controls fit without scrolling',()=>{
 for(const name of ['seal-solar-reference-v1.png','seal-cathedral-reference-v1.png']){
  const bytes=readFileSync('src/assets/ui/seals/'+name);
  assert.equal(bytes.subarray(1,4).toString(),'PNG');
 }
 const css=readFileSync('src/components/seal/seal-reference.css','utf8');
 assert.match(css,/prefers-reduced-motion/);
 assert.doesNotMatch(css,/overflow-y:auto|minmax\((?:230|270)px,1fr\)/);
 assert.match(css,/container-name:seal-viewport/);
 assert.match(css,/@container seal-viewport \(max-height:540px\)/);
 assert.match(css,/grid-template-rows:44px minmax\(0,1fr\) 36px 54px 104px/);
 assert.doesNotMatch(css,/conic-gradient|clip-path|infinite/);
 const ui=readFileSync('src/components/seal/SealScreen.tsx','utf8');
 assert.match(ui,/<SealArtwork variant=\{selected\} level=\{level\}/);
 assert.match(ui,/disabled=\{!canRoll\}/);
 assert.match(ui,/disabled=\{!canReset\}/);
 assert.match(ui,/aria-label="빠른 주조 횟수 선택"/);
 assert.match(ui,/onChange=\{event=>setRollCount\(Math.min\(Number\(event.target.value\),maxSelectableRolls\)\)\}/);
});
