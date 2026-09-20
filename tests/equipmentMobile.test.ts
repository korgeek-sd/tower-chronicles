import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState} from '../src/game/engine/state';
import {EquipmentScreen} from '../src/components/equipment/EquipmentScreen';
import {SkillsScreen} from '../src/components/skills/SkillsScreen';

function activeExpeditionState(){
  const game=initialState();
  game.expedition={
    events:{pendingEvent:null,eventHistory:[],nextEventCheckAt:0},
    tower:'ore',floor:1,hp:180,
    monster:{name:'고블린 광부',hp:42,attack:11,defense:1,speed:.8,skillPower:1,currentHp:42},
    monsterRuntime:null,
    reactivePrepared:{player:null,monster:null},
    bag:{...game.loadout},time:0,playerTimer:0,enemyTimer:0,spawnAt:0,
    cooldowns:{},buffs:{},playerEffects:[],monsterEffects:[],preparedEffects:[],
    effectSequence:0,jobSnapshotId:null,
    jobRuntime:{jobId:null,passiveIds:[],activeSkillIds:[],resource:null},
    kills:0,
    loot:{silver:0,materials:{ore:[0,0,0,0,0],leather:[0,0,0,0,0],gem:[0,0,0,0,0],kaleon:[0,0,0,0,0]},tickets:{ore:Array(10).fill(0),leather:Array(10).fill(0),gem:Array(10).fill(0),kaleon:Array(10).fill(0)},skillBooks:{},items:{}},
    equipment:{...game.equipped},returnRequested:false,
    bossTracking:{progress:0,pendingBossId:null,encounterReason:null,bossDefeated:false},
    phase:'PLAYER_TURN',playerTurn:0,monsterTurn:0,pendingFlee:false,pendingRevival:null,
  };
  return game;
}

test('equipment screen presents four character-centered equipment slots',()=>{
  const html=renderToStaticMarkup(React.createElement(EquipmentScreen,{
    game:initialState(),setGame:()=>{},onSkills:()=>{},
  }));
  for(const label of ['무기','갑옷','신발','장신구'])assert.match(html,new RegExp(label));
  assert.equal((html.match(/equipment-slot-button/g)||[]).length,4);
  assert.match(html,/equipment-character-stage/);
  assert.match(html,/HP/);
  assert.match(html,/공격/);
  assert.match(html,/방어/);
});

test('equipment replacement controls stay locked during an expedition',()=>{
  const html=renderToStaticMarkup(React.createElement(EquipmentScreen,{
    game:activeExpeditionState(),setGame:()=>{},onSkills:()=>{},
  }));
  assert.match(html,/원정 잠금/);
  assert.match(html,/disabled/);
});

test('skills screen exposes exactly three loadout slots and a paged catalog',()=>{
  const html=renderToStaticMarkup(React.createElement(SkillsScreen,{
    game:initialState(),setGame:()=>{},onBack:()=>{},
  }));
  assert.equal((html.match(/skill-loadout-slot/g)||[]).length,3);
  assert.match(html,/skill-catalog/);
  assert.match(html,/class="page-stepper"/);
  for(const label of ['강공','처형','방어 태세','신속'])assert.match(html,new RegExp(label));
});

test('equipment and skills mobile CSS avoid vertical scrolling and preserve touch targets',()=>{
  const equipmentCss=readFileSync(new URL('../src/components/equipment/equipment-mobile.css',import.meta.url),'utf8');
  const skillsCss=readFileSync(new URL('../src/components/skills/skills-mobile.css',import.meta.url),'utf8');
  assert.match(equipmentCss,/\.equipment-screen\{[^}]*height:100%[^}]*overflow:hidden/);
  assert.match(equipmentCss,/\.equipment-slot-button\{[^}]*min-height:44px/);
  assert.match(skillsCss,/\.skills-screen\{[^}]*height:100%[^}]*overflow:hidden/);
  assert.match(skillsCss,/\.skill-loadout-slot\{[^}]*min-height:44px/);
  assert.doesNotMatch(equipmentCss,/overflow-y:auto/);
  assert.doesNotMatch(skillsCss,/overflow-y:auto/);
});
