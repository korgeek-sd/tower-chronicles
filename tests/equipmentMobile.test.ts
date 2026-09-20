import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState} from '../src/game/engine/state';
import {startExpedition} from '../src/game/engine/expedition';
import {EquipmentScreen} from '../src/components/equipment/EquipmentScreen';
import {SkillsScreen} from '../src/components/skills/SkillsScreen';

test('equipment screen centers the character around four equipment slots',()=>{
  const html=renderToStaticMarkup(React.createElement(EquipmentScreen,{
    game:initialState(),
    setGame:()=>{},
    onSkills:()=>{},
  }));
  assert.equal((html.match(/equipment-slot /g)||[]).length,4);
  for(const label of ['무기','갑옷','신발','장신구'])assert.match(html,new RegExp(label));
  for(const stat of ['HP','공격','방어','공격속도'])assert.match(html,new RegExp(stat));
});

test('equipment replacement controls remain locked during an expedition',()=>{
  const game=startExpedition(initialState(),'ore');
  const html=renderToStaticMarkup(React.createElement(EquipmentScreen,{
    game,
    setGame:()=>{},
    onSkills:()=>{},
  }));
  assert.match(html,/원정 잠금/);
  assert.equal((html.match(/equipment-slot [^"]*" disabled/g)||[]).length,4);
});

test('skills screen presents three loadout slots and one paged catalog',()=>{
  const html=renderToStaticMarkup(React.createElement(SkillsScreen,{
    game:initialState(),
    setGame:()=>{},
    onBack:()=>{},
  }));
  assert.equal((html.match(/class="skill-loadout-slot"/g)||[]).length,3);
  assert.match(html,/1순위/);
  assert.match(html,/2순위/);
  assert.match(html,/3순위/);
  assert.match(html,/class="page-stepper"/);
});

test('skills loadout stays disabled during an expedition',()=>{
  const game=startExpedition(initialState(),'ore');
  const html=renderToStaticMarkup(React.createElement(SkillsScreen,{
    game,
    setGame:()=>{},
    onBack:()=>{},
  }));
  assert.match(html,/원정 중 변경 불가/);
  assert.equal((html.match(/class="skill-loadout-slot" disabled/g)||[]).length,3);
});

test('equipment and skills mobile layouts never enable page scrolling',()=>{
  const equipmentCss=readFileSync(new URL('../src/components/equipment/equipment-mobile.css',import.meta.url),'utf8');
  const skillsCss=readFileSync(new URL('../src/components/skills/skills-mobile.css',import.meta.url),'utf8');
  assert.match(equipmentCss,/\.equipment-screen\{[^}]*height:100%[^}]*overflow:hidden/);
  assert.match(equipmentCss,/grid-template-areas:[^;]*"weapon weapon weapon"[^;]*"armor character accessory"[^;]*"boots boots boots"/);
  assert.match(skillsCss,/\.skills-screen\{[^}]*height:100%[^}]*overflow:hidden/);
  assert.doesNotMatch(equipmentCss,/overflow-y:auto/);
  assert.doesNotMatch(skillsCss,/overflow-y:auto/);
});
