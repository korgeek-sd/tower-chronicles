import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SSRRevealFrame} from '../src/components/appearance/SSRReveal';
const props={draw:{id:'nameless_king',rarity:'SSR' as const,duplicate:false},total:1,onDone:()=>{},onRepeat:()=>{},canRepeat:true,busy:false};
test('seal scene replaces the old atlas while preserving clean final results',()=>{
 const opening=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...props,ready:false}));
 assert.match(opening,/seal-stone-cracks-v4-24f\.webp/);assert.doesNotMatch(opening,/codemanu-anima|ssr-crack-v1/);
 const result=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...props,ready:true}));assert.doesNotMatch(result,/codemanu-anima|tc-ssr-vfx/);
 const png=readFileSync('public/assets/vfx/summon/codemanu-anima-30fps.png');assert.equal(png.readUInt32BE(16),437*6);assert.equal(png.readUInt32BE(20),437*5);assert.ok(png[25]===6||(png[25]===3&&png.includes(Buffer.from('tRNS'))));
 const css=readFileSync('src/components/appearance/ssr-reveal.css','utf8');assert.match(css,/tc-seal-rune-charge/);assert.match(css,/tc-seal-character/);assert.match(css,/prefers-reduced-motion/);
});
