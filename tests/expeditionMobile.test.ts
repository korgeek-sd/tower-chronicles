import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState} from '../src/game/engine/state';
import {ExpeditionPrepScreen,expeditionPrepState} from '../src/components/expedition/ExpeditionPrepScreen';

test('expedition prep render never consumes an entry permit',()=>{
  const game=initialState();
  const before=game.tickets.ore[0];
  renderToStaticMarkup(React.createElement(ExpeditionPrepScreen,{
    game,
    setGame:()=>{},
    tower:'ore',
    floor:1,
    setFloor:()=>{},
    now:0,
    onBack:()=>{},
    onStart:()=>{},
  }));
  assert.equal(game.tickets.ore[0],before);
});

test('expedition prep defaults to the expedition tab and exposes all three mobile tabs',()=>{
  const html=renderToStaticMarkup(React.createElement(ExpeditionPrepScreen,{
    game:initialState(),
    setGame:()=>{},
    tower:'ore',
    floor:1,
    setFloor:()=>{},
    now:0,
    onBack:()=>{},
    onStart:()=>{},
  }));
  for(const label of ['원정','장비','소모품'])assert.match(html,new RegExp(label));
  assert.equal((html.match(/탐사 시작/g)||[]).length,1);
  assert.match(html,/철맥의 첨탑/);
  assert.match(html,/SAFE/);
});

test('expedition prep blocks start when entry permit or potion limits are invalid',()=>{
  const noPermit=initialState();
  noPermit.tickets.ore[0]=0;
  assert.equal(expeditionPrepState(noPermit,'ore').canStart,false);

  const overLimit=initialState();
  overLimit.loadout.healing_lesser=31;
  overLimit.potions.healing_lesser=31;
  assert.equal(expeditionPrepState(overLimit,'ore').canStart,false);
});

test('expedition prep is a fixed no-scroll mobile surface with a persistent action footer',()=>{
  const css=readFileSync(new URL('../src/components/expedition/expedition-mobile.css',import.meta.url),'utf8');
  assert.match(css,/\.expedition-prep-screen\{[^}]*height:100%[^}]*overflow:hidden/);
  assert.match(css,/\.expedition-prep-actions\{[^}]*display:grid/);
  assert.match(css,/\.expedition-prep-actions button\{[^}]*min-height:48px/);
  assert.doesNotMatch(css,/overflow-y:auto/);
});
