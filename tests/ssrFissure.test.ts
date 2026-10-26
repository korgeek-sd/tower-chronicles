import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SSRRevealFrame,SSR_REVEAL_DURATION_MS} from '../src/components/appearance/SSRReveal';
const props={draw:{id:'nameless_king',rarity:'SSR' as const,duplicate:false},total:1,onDone:()=>{},onRepeat:()=>{},canRepeat:true,busy:false};
test('seal replaces fissure during a bounded reveal with disabled actions and motion fallback',()=>{
 const opening=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...props,ready:false}));
 assert.match(opening,/seal-stone-dissolve-v2-60f\.webp/);assert.doesNotMatch(opening,/seal-flare-v1|ssr-fissure-v2/);assert.match(opening,/disabled=""/);
 const result=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...props,ready:true}));assert.doesNotMatch(result,/ssr-fissure|tc-ssr-vfx/);
 assert.equal(SSR_REVEAL_DURATION_MS,4000);
 const css=readFileSync('src/components/appearance/ssr-reveal.css','utf8');assert.match(css,/tc-seal-dissolve-frames/);assert.match(css,/prefers-reduced-motion/);
 const image=readFileSync('public/assets/vfx/summon/ssr-fissure-v2.webp');assert.equal(image.toString('ascii',8,12),'WEBP');
});
