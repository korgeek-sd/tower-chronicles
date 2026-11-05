import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {HomeScreen} from '../src/components/mobile/CoreScreens';
import {initialState} from '../src/game/engine/state';

test('reference hub puts quests on the map with no second navigation strip',()=>{
 const game=initialState(),before=JSON.stringify(game);
 const html=renderToStaticMarkup(React.createElement(HomeScreen,{game,nickname:'긴 이름의 탐험가',onMove:()=>{},onOpenJobs:()=>{},mailUnread:12}));
 assert.doesNotMatch(html,/tc-village-services/);
 assert.match(html,/novar-moonlit-v3.webp/);
 assert.match(html,/의뢰 게시판/);
 assert.match(html,/닉네임으로 성장 현황 열기/);
 assert.match(html,/캐릭터 아이콘으로 성장 현황 열기/);
 assert.equal(JSON.stringify(game),before,'render must not mutate gameplay or ownership');
});

test('facility artwork is a compact inner plaque inside the independent touch target',()=>{
 const html=renderToStaticMarkup(React.createElement(HomeScreen,{game:initialState(),onMove:()=>{},onOpenJobs:()=>{}}));
 assert.match(html,/<span class="tc-village-nameplate"><span class="tc-hub-icon/);
 assert.match(html,/data-hub-icon="quests"/);
});
