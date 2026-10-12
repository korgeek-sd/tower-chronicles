import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {AppearanceSummonScreen} from '../src/components/appearance/AppearanceSummonScreen';
import {initialState} from '../src/game/engine/state';

test('summon showcase has three existing sprites and safe disabled actions before server integration',()=>{
 const game=initialState(),before=JSON.stringify(game);
 const html=renderToStaticMarkup(React.createElement(AppearanceSummonScreen,{game,onList:()=>{}}));
 assert.equal((html.match(/class="tc-summon-figure /g)??[]).length,3);
 assert.ok(html.includes('외형 소환'));
 assert.ok(html.includes('착용 효과'));
 assert.ok(html.includes('1회 소환'));
 assert.ok(html.includes('10회 소환'));
 assert.ok(html.includes('disabled=""'));
 assert.ok(html.includes('서버 연결 준비 중'));
 assert.equal(JSON.stringify(game),before);
});
test('summon navigation connects both codex entries and compact viewport layout',()=>{
 const app=readFileSync('src/main.tsx','utf8'),css=readFileSync('src/components/appearance/appearance-summon.css','utf8');
 assert.ok(app.includes('<AppearanceSummonScreen'));
 assert.ok(app.includes('onSummon='));
 assert.ok(css.includes('minmax(0,1fr)'));
 assert.ok(css.includes('prefers-reduced-motion'));
});
test('iron summon footer keeps the real ticket balance and disabled actions with collection navigation',()=>{
 const game=initialState();game.cosmetics.summonTickets=23;const before=JSON.stringify(game);
 const html=renderToStaticMarkup(React.createElement(AppearanceSummonScreen,{game,onList:()=>{},onCollection:()=>{}}));
 assert.match(html,/tc-iron-summon-screen/);
 const footer=html.slice(html.indexOf('<footer class="tc-summon-footer"'));
 assert.match(footer,/외형 소환권/);assert.match(footer,/23장/);assert.match(footer,/1회 소환/);assert.match(footer,/10회 소환/);assert.match(footer,/소환권 사용/);
 assert.equal((footer.match(/disabled=""/g)??[]).length,3);
 assert.match(footer,/컬렉션/);assert.match(footer,/서버 연결 준비 중/);
 assert.equal(JSON.stringify(game),before);
});
