import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {SSRRevealFrame} from '../src/components/appearance/SSRReveal';
import {APPEARANCES} from '../src/game/data/cosmetics';
const props={draw:{id:'bahamut',rarity:'SSR' as const,duplicate:false},appearance:APPEARANCES.find(x=>x.id==='bahamut'),total:10,onDone:()=>{},onRepeat:()=>{},canRepeat:true,busy:false};
test('finished reveal removes every VFX and skip control and keeps the actual art and concise actions',()=>{
 const html=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...props,ready:true}));
 assert.doesNotMatch(html,/tc-ssr-vfx|건너뛰기|기록이 깨어납니다|전체 소환 결과에서|<svg/);
 assert.match(html,/bahamut-/);assert.match(html,/결과 보기/);assert.match(html,/다시 소환/);assert.match(html,/tc-ssr-grade/);
});
test('opening reveal uses the supplied seal textures with safe disabled actions',()=>{
 const html=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...props,ready:false}));
 assert.match(html,/seal-stone-cracks-v3\.webp/);assert.match(html,/건너뛰기/);assert.match(html,/disabled=""/);assert.doesNotMatch(html,/<svg/);
 const png=readFileSync('public/assets/vfx/summon/codemanu-anima-30fps.png');assert.equal(png.toString('ascii',1,4),'PNG');assert.ok(png[25]===6||(png[25]===3&&png.includes(Buffer.from('tRNS'))));
 const css=readFileSync('src/components/appearance/ssr-reveal.css','utf8');assert.match(css,/prefers-reduced-motion/);assert.doesNotMatch(css,/drop-shadow|clip-path/);
});
