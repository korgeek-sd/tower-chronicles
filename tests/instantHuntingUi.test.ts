import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {HomeScreen} from '../src/components/mobile/CoreScreens';
import {HuntingScreen} from '../src/components/hunting/HuntingScreen';import {initialState} from '../src/game/engine/state';import {initialHuntingState,resolveHunt} from '../src/game/hunting/model';
test('instant hunting shows maps, result, rewards and turn cards with HP snapshots without realtime controls',()=>{
 const game=initialState(),h=resolveHunt(initialHuntingState(0),'plains',{hp:180,attack:18,defense:7,speed:10},['heavy'],0,()=>.5).state;
 const html=renderToStaticMarkup(React.createElement(HuntingScreen,{game,hunting:h,now:0,busy:false,onHunt:()=>{},onSettings:()=>{}}));
 for(const copy of ['평야','숲','폐광','활력','승리','전투 기록','강타'])assert.ok(html.includes(copy));
 assert.match(html,/<dialog[^>]*aria-label="전투 기록"/);assert.match(html,/전투 기록 보기/);assert.doesNotMatch(html,/<dialog[^>]*open=/);assert.doesNotMatch(html,/<details/);assert.match(html,/tc-hunt-turn-card/);assert.match(html,/aria-label="Turn 1 탐사자 HP"/);assert.match(html,/aria-label="Turn 1 가죽 갉는 하이에나 HP"/);assert.match(html,/tc-hunt-action player/);assert.match(html,/tc-hunt-action enemy/);assert.match(html,/tc-hunt-damage/);assert.doesNotMatch(html,/tc-ref-actions|행동을 선택하세요/);assert.match(html,/aria-label="탐사자 HP"/);
});
test('zero vitality and pending request disable map actions',()=>{
 const html=renderToStaticMarkup(React.createElement(HuntingScreen,{game:initialState(),hunting:{...initialHuntingState(0),vitality:0},now:0,busy:false,onHunt:()=>{},onSettings:()=>{}}));
 assert.equal((html.match(/disabled=""/g)??[]).length,1);assert.match(html,/활력이 부족/);
});
test('online hunting shows recovered HP, remaining potion count and food turns while logs keep battle HP',()=>{
 const h=resolveHunt(initialHuntingState(0),'plains',{hp:180,attack:18,defense:7,speed:10},['heavy'],0,()=>.5).state;
 const html=renderToStaticMarkup(React.createElement(HuntingScreen,{game:initialState(),hunting:{...h,currentHp:180,maxHp:180,potions:1234,foodTurns:{attack_food:29,defense_food:0,experience_food:30}} as any,now:0,busy:false,onHunt:()=>{},onSettings:()=>{}}));
 assert.match(html,/포션 1,234/);assert.match(html,/공격 29회/);assert.match(html,/경험치 30회/);assert.match(html,/aria-label="탐사자 HP"[^>]*aria-valuenow="180"/);
});

test('hunting map ascends from plains to ruins and home exposes matching shortcut',()=>{
 const html=renderToStaticMarkup(React.createElement(HuntingScreen,{game:initialState(),hunting:initialHuntingState(0),now:0,busy:false,onHunt:()=>{},onSettings:()=>{}}));
 for(const name of ['외곽 평야','어두운 숲','폐광','무너진 성채','심층 유적','추천 레벨','입장하기'])assert.ok(html.includes(name),name);
 assert.ok(html.indexOf('심층 유적')<html.indexOf('외곽 평야'));
 assert.match(html,/aria-pressed="true"/);
});

test('home has a hunting facility button using the bestiary facility treatment',()=>{const html=renderToStaticMarkup(React.createElement(HomeScreen,{game:initialState(),onMove:()=>{},onOpenJobs:()=>{}}));assert.match(html,/data-facility="hunt"/);assert.match(html,/data-facility="bestiary"/);});
