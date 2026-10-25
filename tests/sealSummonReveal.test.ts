import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AppearanceSummonResultView,rareSummonDraws} from '../src/components/appearance/AppearanceSummonResultView';
import {SSRRevealFrame,SSR_REVEAL_DURATION_MS} from '../src/components/appearance/SSRReveal';
import type {AppearanceSummonDraw} from '../src/online/appearanceSummon';
const props={payment:{ticketsSpent:10,goldSpent:0},repeatPayment:{ticketsUsed:10,goldSpent:0},canRepeat:true,busy:false,selectedAppearanceId:'default',expedition:false,onRepeat:()=>{},onClose:()=>{},onList:()=>{}};
const draws:AppearanceSummonDraw[]=[{id:'scout',rarity:'C',duplicate:false},{id:'valkyrie',rarity:'SR',duplicate:false},{id:'nameless_king',rarity:'SSR',duplicate:true},{id:'valkyrie',rarity:'SR',duplicate:true}];
test('rare reveal queue preserves every SR and SSR in server order including repeated IDs',()=>{
 const before=JSON.stringify(draws);assert.deepEqual(rareSummonDraws(draws),draws.slice(1));assert.equal(JSON.stringify(draws),before);
 const html=renderToStaticMarkup(React.createElement(AppearanceSummonResultView,{...props,draws,animateSSR:true}));assert.match(html,/data-rarity="SR"/);assert.match(html,/희귀 외형 1 \/ 3/);
});
test('all lower grades and restored results go directly to results',()=>{
 for(const rarity of ['C','B','A'] as const){const html=renderToStaticMarkup(React.createElement(AppearanceSummonResultView,{...props,animateSSR:true,draws:[{id:'scout',rarity,duplicate:false}]}));assert.doesNotMatch(html,/tc-seal-scene/);}
 assert.doesNotMatch(renderToStaticMarkup(React.createElement(AppearanceSummonResultView,{...props,draws,animateSSR:false})),/tc-seal-scene/);
});
test('seal scene uses supplied four layers and exposes next versus skip-all separately',()=>{
 const p={draw:draws[1],total:10,onDone:()=>{},onSkip:()=>{},onRepeat:()=>{},canRepeat:true,busy:false,hasNext:true,sequenceIndex:0,sequenceTotal:3};
 const opening=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,ready:false}));
 for(const name of ['seal-chamber','seal-stone','seal-particles','seal-flare'])assert.match(opening,new RegExp(name+'-v1\\.webp'));
 assert.match(opening,/건너뛰기/);assert.match(opening,/disabled=""/);
 const ready=renderToStaticMarkup(React.createElement(SSRRevealFrame,{...p,ready:true}));assert.match(ready,/다음 외형/);assert.match(ready,/전체 결과/);assert.doesNotMatch(ready,/seal-stone-v1|seal-particles-v1|seal-flare-v1/);assert.equal(SSR_REVEAL_DURATION_MS,4000);
});
