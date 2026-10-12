import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {HomeScreen} from '../src/components/mobile/CoreScreens';
import {initialState} from '../src/game/engine/state';

test('iron camp preserves main actions, facility disclosure, live chat dock and game state',()=>{
 const game=initialState(),before=JSON.stringify(game);
 const html=renderToStaticMarkup(React.createElement(HomeScreen,{game,onMove:()=>{},onOpenJobs:()=>{},mailUnread:7}));
 assert.match(html,/tc-iron-camp-screen/);
 for(const label of ['사냥하기','마을 이동','HP','MP','활력','미확인 우편 7개'])assert.ok(html.includes(label),label);
 assert.match(html,/aria-expanded="false" aria-controls="tc-camp-extra-facilities"/);
 assert.match(html,/id="tc-camp-chat-dock"/);
 assert.equal(JSON.stringify(game),before);
});
test('camp bounds upper rows to reserve chat space and keeps secondary facilities scrollable',()=>{
 const css=readFileSync('src/components/mobile/iron-camp.css','utf8');
 assert.match(css,/grid-template-rows:96px 64px 154px minmax\(0,1fr\)/);
 assert.match(css,/@media\(max-height:590px\)/);
 assert.match(css,/\.tc-camp-v2-extra\{[^}]*overflow-y:auto/);
 assert.match(css,/\.tc-camp-v2-quick button\{[^}]*min-height:44px/);
 assert.match(css,/border-image-source:var\(--camp-panel\)/);
 assert.match(css,/\.tc-camp-v2-portrait img\{filter:none/);
});
