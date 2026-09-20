import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {GameState,Item} from '../src/game/types';
import {initialState} from '../src/game/engine/state';
import {EquipmentScreen} from '../src/components/equipment/EquipmentScreen';
import {SkillsScreen} from '../src/components/skills/SkillsScreen';

function equippedFixture(){
  const game=initialState();
  const extra:Item[]=[
    {id:'armor-1',kind:'armor',tier:1,enhancement:0},
    {id:'boots-1',kind:'boots',tier:1,enhancement:0},
    {id:'accessory-1',kind:'vampire',tier:1,enhancement:0},
  ];
  game.items.push(...extra);
  game.equipped.armor='armor-1';
  game.equipped.boots='boots-1';
  game.equipped.accessory='accessory-1';
  return game;
}

test('equipment screen renders four character-centered equipment slots',()=>{
  const html=renderToStaticMarkup(React.createElement(EquipmentScreen,{
    game:equippedFixture(),
    setGame:()=>{},
    onSkills:()=>{},
  }));
  for(const slot of ['무기','갑옷','장신구','신발'])assert.match(html,new RegExp(slot));
  assert.equal((html.match(/class="equipment-slot-button/g)||[]).length,4);
  for(const stat of ['HP','공격','방어','공격속도'])assert.match(html,new RegExp(stat));
});

test('equipment replacement controls remain locked during an expedition',()=>{
  const game=equippedFixture();
  game.expedition={} as unknown as NonNullable<GameState['expedition']>;
  const html=renderToStaticMarkup(React.createElement(EquipmentScreen,{
    game,
    setGame:()=>{},
    onSkills:()=>{},
  }));
  assert.match(html,/원정 잠금/);
  assert.match(html,/disabled/);
});

test('skills screen renders exactly three equipped skill slots and a paged catalog',()=>{
  const html=renderToStaticMarkup(React.createElement(SkillsScreen,{
    game:initialState(),
    setGame:()=>{},
    onBack:()=>{},
  }));
  assert.equal((html.match(/class="skill-loadout-slot/g)||[]).length,3);
  assert.match(html,/스킬 카탈로그/);
  assert.match(html,/class="page-stepper"/);
});

test('skills controls stay locked during an expedition',()=>{
  const game=initialState();
  game.expedition={} as unknown as NonNullable<GameState['expedition']>;
  const html=renderToStaticMarkup(React.createElement(SkillsScreen,{
    game,
    setGame:()=>{},
    onBack:()=>{},
  }));
  assert.match(html,/원정 중 변경 불가/);
  assert.match(html,/disabled/);
});
