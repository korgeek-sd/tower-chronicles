import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {StatAllocationScreen} from '../src/components/stats/StatAllocationScreen';import {HomeScreen} from '../src/components/mobile/CoreScreens';import {initialState} from '../src/game/engine/state';
test('hub exposes stat allocation and screen shows real stats with unavailable allocation clearly disabled',()=>{
 const game=initialState();const home=renderToStaticMarkup(React.createElement(HomeScreen,{game,onMove:()=>{},onOpenJobs:()=>{}}));assert.match(home,/스탯 분배/);
 const html=renderToStaticMarkup(React.createElement(StatAllocationScreen,{game,level:5,onHome:()=>{}}));
 for(const label of ['스탯 분배','거점으로','공격력','방어력','최대 HP','치명타 확률','배분 확정'])assert.ok(html.includes(label));
 assert.match(html,/포인트 지급 규칙/);assert.match(html,/<button[^>]*disabled=""[^>]*>배분 확정/);assert.doesNotMatch(html,/<dialog/);
});
