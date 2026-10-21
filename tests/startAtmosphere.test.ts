import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {fitTitleArtwork,TITLE_ART_WIDTH,TITLE_ART_HEIGHT} from '../src/components/intro/titleArtworkFit';
import {StartAtmosphere} from '../src/components/intro/StartAtmosphere';
test('effects follow cover crop and the same 56 percent vertical anchor on mobile and desktop',()=>{
 for(const [w,h] of [[360,800],[320,640],[700,936],[700,400],[1080,2400]]){
  const fit=fitTitleArtwork(w,h)!;
  assert.ok(fit.width>=w-1e-8&&fit.height>=h-1e-8);
  assert.ok(Math.abs(fit.width/fit.height-TITLE_ART_WIDTH/TITLE_ART_HEIGHT)<1e-8);
  assert.ok(Math.abs(fit.left-(w-fit.width)/2)<1e-8);
  assert.ok(Math.abs(fit.top-(h-fit.height)*.56)<1e-8);
 }
 assert.equal(fitTitleArtwork(0,800),null);assert.equal(fitTitleArtwork(300,NaN),null);
});
test('decorative effects are hidden from assistive tech and can pause behind notices',()=>{
 const html=renderToStaticMarkup(React.createElement(StartAtmosphere,{paused:true}));
 assert.match(html,/aria-hidden="true"/);assert.match(html,/data-paused="true"/);
 assert.doesNotMatch(html,/<button|<canvas/);
});
test('effects respect motion settings, use no idle JS render loop and clean up visibility observation',()=>{
 const source=readFileSync(new URL('../src/components/intro/StartAtmosphere.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/components/intro/start-atmosphere.css',import.meta.url),'utf8');
 assert.match(source,/visibilitychange/);assert.match(source,/removeEventListener/);assert.match(source,/disconnect\(\)/);
 assert.doesNotMatch(source,/requestAnimationFrame|setInterval|fetch\(/);
 assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/data-tc-reduced-motion/);assert.match(css,/animation-play-state:paused/);assert.match(css,/pointer-events:none/);
 assert.doesNotMatch(css,/blur\(/);
});

test('atmosphere remains perceptible above the title shade',()=>{
 const screen=readFileSync(new URL('../src/components/intro/StartScreen.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/components/intro/start-atmosphere.css',import.meta.url),'utf8');
 assert.ok(screen.indexOf('<StartAtmosphere')>screen.indexOf('className="tc-start-screen__shade"'));
 assert.match(css,/opacity:\.5/);
 assert.match(css,/translate\(-64px,8px\)/);

});

test('cloud banks fill several depths with doubled strength and no light overlay',()=>{
 const source=readFileSync(new URL('../src/components/intro/StartAtmosphere.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/__glow|radialGradient|clipPath|useId/);
 const css=readFileSync(new URL('../src/components/intro/start-atmosphere.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/__glow|door-light/);
 for(const [name,baseline] of [['far',.22],['near',.16],['sky',.26],['middle',.32]] as const){
  const specific=css.match(new RegExp(`\\.tc-start-atmosphere__fog--${name}\\{[^}]*opacity:([.0-9]+)`));
  const inherited=css.match(/\.tc-start-atmosphere__fog\{[^}]*opacity:([.0-9]+)/);
  assert.ok(Number((specific||inherited)![1])>=baseline*2,`${name} strength must at least double`);
 }
 assert.match(source,/tc-start-atmosphere__fog--sky/);
 assert.match(source,/tc-start-atmosphere__fog--middle/);
 assert.ok((source.match(/<CloudBank /g)||[]).length>=12);
 assert.doesNotMatch(source,/M428 1018V914/);
});
