import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AppearanceSummonResultView} from '../src/components/appearance/AppearanceSummonResultView';
const props={payment:{ticketsSpent:1,goldSpent:0},repeatPayment:{ticketsUsed:1,goldSpent:0},canRepeat:true,busy:false,selectedAppearanceId:'default',expedition:false,onRepeat:()=>{},onClose:()=>{},onList:()=>{}};
test('confirmed SSR gets an accessible skippable reveal using its real artwork',()=>{
 const html=renderToStaticMarkup(React.createElement(AppearanceSummonResultView,{...props,animateSSR:true,draws:[{id:'nameless_king',rarity:'SSR',duplicate:false}]}));
 assert.match(html,/tc-ssr-reveal/);assert.match(html,/건너뛰기/);assert.match(html,/nameless_king-/);assert.match(html,/이름 잃은 왕/);
 assert.doesNotMatch(html,/tc-summon-result-grid/);
});
test('ordinary pulls and restored results do not play the SSR reveal',()=>{
 for(const [rarity,animateSSR] of [['C',true],['SSR',false]] as const){
 const html=renderToStaticMarkup(React.createElement(AppearanceSummonResultView,{...props,animateSSR,draws:[{id:'nameless_king',rarity,duplicate:false}]}));
 assert.doesNotMatch(html,/tc-ssr-reveal/);assert.match(html,/1회 다시 소환/);
 }
});
test('ten pulls start at the first rare result without modifying the draw array',()=>{
 const draws=[{id:'scout',rarity:'C',duplicate:false},{id:'nameless_king',rarity:'SSR',duplicate:true}] as const;
 const before=JSON.stringify(draws);
 const html=renderToStaticMarkup(React.createElement(AppearanceSummonResultView,{...props,animateSSR:true,draws:[...draws]}));
 assert.match(html,/tc-ssr-reveal/);assert.match(html,/전용 조각 ×1 획득/);assert.equal(JSON.stringify(draws),before);
});
