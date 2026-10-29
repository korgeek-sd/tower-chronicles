import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {HomeScreen} from '../src/components/mobile/CoreScreens';
import {initialState} from '../src/game/engine/state';

test('reference hub exposes all five service shortcuts without opening a menu',()=>{
 const game=initialState(),before=JSON.stringify(game);
 const html=renderToStaticMarkup(React.createElement(HomeScreen,{game,nickname:'긴 이름의 탐험가',onMove:()=>{},onOpenJobs:()=>{},mailUnread:12}));
 const services=html.match(/<nav class="tc-village-services"[^>]*>(.*?)<\/nav>/)?.[1]??'';
 for(const id of ['bank','quests','association','seal','cosmetics'])assert.match(services,new RegExp('data-facility="'+id+'"'));
 assert.match(html,/novar-moonlit-v3.webp/);
 assert.match(html,/미확인 우편 12개/);
 assert.match(html,/닉네임으로 성장 현황 열기/);
 assert.match(html,/캐릭터 아이콘으로 성장 현황 열기/);
 assert.equal(JSON.stringify(game),before,'render must not mutate gameplay or ownership');
});

test('facility artwork is a compact inner plaque inside the independent touch target',()=>{
 const html=renderToStaticMarkup(React.createElement(HomeScreen,{game:initialState(),onMove:()=>{},onOpenJobs:()=>{}}));
 assert.match(html,/<span class="tc-village-nameplate"><span class="tc-hub-icon/);
 const services=html.match(/<nav class="tc-village-services"[^>]*>(.*?)<\/nav>/)?.[1]??'';
 assert.match(services,/data-hub-icon="seal"/);
 assert.match(services,/data-hub-icon="association"/);
});
