import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {GameState} from '../src/game/types';
import {initialState} from '../src/game/engine/state';
import {EquipmentScreen} from '../src/components/equipment/EquipmentScreen';
import {SkillsScreen} from '../src/components/skills/SkillsScreen';

function expeditionState(){
  const game=initialState();
  game.expedition={} as GameState['expedition'];
  return game;
}

test('equipment shows four character-centered slots and combat stats',()=>{
  const html=renderToStaticMarkup(React.createElement(EquipmentScreen,{
    game:initialState(),
    setGame:()=>{},
    onSkills:()=>{},
  }));
  for(const label of ['무기','갑옷','신발','장신구','HP','공격','방어','공격속도']){
    assert.match(html,new RegExp(label));
  }
  assert.equal((html.match(/equipment-slot-button/g)||[]).length,4);
});

test('equipment replacement controls remain locked during an expedition',()=>{
  const html=renderToStaticMarkup(React.createElement(EquipmentScreen,{
    game:expeditionState(),
    setGame:()=>{},
    onSkills:()=>{},
  }));
  assert.match(html,/원정 잠금/);
  assert.match(html,/disabled/);
});

test('skills screen renders three loadout slots and a paged catalog',()=>{
  const html=renderToStaticMarkup(React.createElement(SkillsScreen,{
    game:initialState(),
    setGame:()=>{},
    onBack:()=>{},
  }));
  assert.equal((html.match(/skill-loadout-slot/g)||[]).length,3);
  assert.match(html,/1순위/);
  assert.match(html,/2순위/);
  assert.match(html,/3순위/);
  assert.match(html,/page-stepper/);
});

test('skills changing controls remain locked during an expedition',()=>{
  const html=renderToStaticMarkup(React.createElement(SkillsScreen,{
    game:expeditionState(),
    setGame:()=>{},
    onBack:()=>{},
  }));
  assert.match(html,/원정 중에는 스킬 구성을 변경할 수 없습니다/);
  assert.match(html,/disabled/);
});

test('equipment and skills mobile CSS never enables page scrolling',()=>{
  const equipmentCss=readFileSync(new URL('../src/components/equipment/equipment-mobile.css',import.meta.url),'utf8');
  const skillsCss=readFileSync(new URL('../src/components/skills/skills-mobile.css',import.meta.url),'utf8');
  assert.match(equipmentCss,/\.equipment-screen\{[^}]*height:100%[^}]*overflow:hidden/);
  assert.match(skillsCss,/\.skills-screen\{[^}]*height:100%[^}]*overflow:hidden/);
  assert.doesNotMatch(equipmentCss,/overflow-y:auto/);
  assert.doesNotMatch(skillsCss,/overflow-y:auto/);
});
