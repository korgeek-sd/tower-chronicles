import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialHuntingState,VITALITY_INTERVAL} from '../src/game/hunting/model';
import {HuntingVitality} from '../src/components/hunting/HuntingVitality';

test('vitality strip shows the real balance and counts down to the next recovery every second',()=>{
 const hunting={...initialHuntingState(0),vitality:42};
 const render=(now:number)=>renderToStaticMarkup(React.createElement(HuntingVitality,{hunting,now}));
 assert.match(render(VITALITY_INTERVAL-2000),/남은 활력/);assert.match(render(VITALITY_INTERVAL-2000),/42/);
 assert.match(render(VITALITY_INTERVAL-2000),/2초 후/);assert.match(render(VITALITY_INTERVAL-1000),/1초 후/);
 assert.match(render(VITALITY_INTERVAL),/43/);assert.match(render(VITALITY_INTERVAL),/300초 후/);
 assert.equal(hunting.vitality,42);
});
test('full, bonus and unloaded vitality do not invent an active recovery countdown',()=>{
 for(const [value,label] of [[100,'충전 완료'],[835,'100 미만부터 회복']] as const){
  const html=renderToStaticMarkup(React.createElement(HuntingVitality,{hunting:{...initialHuntingState(0),vitality:value},now:250000}));
  assert.ok(html.includes(label));assert.ok(html.includes(String(value)));assert.doesNotMatch(html,/초 후/);
 }
 const html=renderToStaticMarkup(React.createElement(HuntingVitality,{hunting:null,now:0}));
 assert.match(html,/불러오는 중/);assert.doesNotMatch(html,/초 후/);
});
test('vitality bar shows remaining energy without overflowing for bonus vitality',()=>{
 for(const value of [0,42,100,835]){
  const html=renderToStaticMarkup(React.createElement(HuntingVitality,{hunting:{...initialHuntingState(0),vitality:value},now:0}));
  assert.match(html,/role="progressbar" aria-label="활력"/);
  assert.ok(html.includes(`aria-valuenow="${Math.min(100,value)}"`));
  assert.ok(html.includes(`aria-valuetext="활력 ${value.toLocaleString()}${value>100?' · 추가 지급':' / 100'}"`));
  assert.ok(html.includes(`style="width:${Math.min(100,value)}%"`));
 }
});
