import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState} from '../src/game/engine/state';
import {HomeScreen} from '../src/components/home/HomeScreen';
import {TowerSelectScreen} from '../src/components/expedition/TowerSelectScreen';
import {ExpeditionResultScreen} from '../src/components/expedition/ExpeditionResultScreen';

test('home exposes one expedition CTA and four quick actions',()=>{
  const html=renderToStaticMarkup(React.createElement(HomeScreen,{
    game:initialState(),
    onNavigate:()=>{},
  }));
  assert.equal((html.match(/탑으로 떠나기/g)||[]).length,1);
  for(const label of ['직업','외형','저장','숙련'])assert.match(html,new RegExp(label));
  assert.doesNotMatch(html,/원정의 순환/);
});

test('home character summary shows current combat identity without a long web dashboard',()=>{
  const html=renderToStaticMarkup(React.createElement(HomeScreen,{
    game:initialState(),
    onNavigate:()=>{},
  }));
  for(const label of ['HP','공격','방어','검'])assert.match(html,new RegExp(label));
  assert.doesNotMatch(html,/wide-link/);
});

test('tower selection shows four tower cards but only Iron Vein is currently enterable',()=>{
  const html=renderToStaticMarkup(React.createElement(TowerSelectScreen,{
    game:initialState(),
    onChooseTower:()=>{},
  }));
  for(const name of ['철맥의 첨탑','붉은 송곳니의 성소','천광의 수정탑','칼레온의 녹빛 첨탑']){
    assert.match(html,new RegExp(name));
  }
  assert.equal((html.match(/tower-select-enter/g)||[]).length,1);
  assert.equal((html.match(/준비 중/g)||[]).length,3);
});

test('expedition result stays compact and exposes one primary storage action',()=>{
  const state=initialState();
  const result={
    outcome:'returned',
    tower:'ore',
    floor:3,
    time:83,
    kills:4,
    loot:{
      silver:125,
      materials:{ore:[0,3,0,0,0],leather:[0,0,0,0,0],gem:[0,0,0,0,0],kaleon:[0,0,0,0,0]},
      tickets:{ore:[1,0,0,0,0,0,0,0,0,0],leather:[0,0,0,0,0,0,0,0,0,0],gem:[0,0,0,0,0,0,0,0,0,0],kaleon:[0,0,0,0,0,0,0,0,0,0]},
      skillBooks:{},
      items:{},
    },
    remainingPotions:state.loadout,
  } as const;
  const html=renderToStaticMarkup(React.createElement(ExpeditionResultScreen,{
    result,
    notice:'안전 귀환',
    onInventory:()=>{},
    onNextExpedition:()=>{},
  }));
  assert.equal((html.match(/영구 보관함 확인/g)||[]).length,1);
  assert.match(html,/다음 원정 준비/);
  assert.match(html,/Silver/);
  assert.match(html,/재료/);
  assert.doesNotMatch(html,/<details/);
});
