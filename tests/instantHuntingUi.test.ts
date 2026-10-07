import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {HuntingScreen} from '../src/components/hunting/HuntingScreen';import {initialState} from '../src/game/engine/state';import {initialHuntingState,resolveHunt} from '../src/game/hunting/model';
test('instant hunting shows maps, result, rewards and expandable turn logs without realtime controls',()=>{
 const game=initialState(),h=resolveHunt(initialHuntingState(0),'plains',{hp:180,attack:18,defense:7,speed:10},['heavy'],0,()=>.5).state;
 const html=renderToStaticMarkup(React.createElement(HuntingScreen,{game,hunting:h,now:0,busy:false,onHunt:()=>{},onSettings:()=>{}}));
 for(const copy of ['평야','숲','광산','활력','승리','전투 기록','강타'])assert.ok(html.includes(copy));
 assert.match(html,/<details/);assert.doesNotMatch(html,/tc-ref-actions|행동을 선택하세요/);assert.match(html,/aria-label="탐사자 HP"/);
});
test('zero vitality and pending request disable map actions',()=>{
 const html=renderToStaticMarkup(React.createElement(HuntingScreen,{game:initialState(),hunting:{...initialHuntingState(0),vitality:0},now:0,busy:false,onHunt:()=>{},onSettings:()=>{}}));
 assert.equal((html.match(/disabled=""/g)??[]).length,3);assert.match(html,/활력이 부족/);
});
